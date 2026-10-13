// File-bound review validation; semantic judgments remain the critic's responsibility.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, vaultPath, currentHash } from './store.mjs';

const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
const sameRef = (a, b) => a.path === b.path && a.sha256 === b.sha256;

export function checkReview(relative, expected = {}) {
  const packet = readJSON(relative);
  requireValue(packet?.schema_version === 1 && identifier(packet.request_id), 'Invalid review packet schema or request identifier.');
  requireValue(Number.isInteger(packet.plan_revision) && packet.plan_revision >= 1 && text(packet.trigger), 'Review needs a plan revision and trigger.');
  requireValue(expected.request_id === undefined || packet.request_id === expected.request_id, 'Review belongs to another request.');
  requireValue(expected.plan_revision === undefined || packet.plan_revision === expected.plan_revision, 'Review plan revision is stale.');
  const artifactDirectory = expected.directory ? expected.directory + 'artifacts/' : null;
  const inArtifacts = relative => {
    const nested = path.relative(vaultPath(artifactDirectory), vaultPath(relative));
    return nested && nested !== '..' && !nested.startsWith('..' + path.sep) && !path.isAbsolute(nested);
  };
  if (artifactDirectory) requireValue(inArtifacts(relative), 'Review packet must stay in the request artifacts directory.');
  const reference = (ref, label, artifact = false) => {
    requireValue(ref && typeof ref.path === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256 ?? ''), `${label} needs a path and SHA-256.`);
    if (artifactDirectory && artifact) requireValue(inArtifacts(ref.path), `${label} must stay in the request artifacts directory.`);
    const file = vaultPath(ref.path);
    requireValue(fs.existsSync(file) && fs.statSync(file).isFile(), 'Missing review reference: ' + ref.path);
    requireValue(currentHash(file) === ref.sha256, 'Review reference changed: ' + ref.path);
    return fs.readFileSync(file, 'utf8');
  };
  const sources = (refs, label) => {
    requireValue(Array.isArray(refs) && refs.length > 0, label + ' needs evidence references.');
    for (const ref of refs) reference(ref, label);
  };
  const targetText = reference(packet.target, 'Final target', true);
  if (expected.summary !== undefined) requireValue(expected.summary === targetText, 'Final response differs from the reviewed target.');
  requireValue(Array.isArray(packet.rounds) && packet.rounds.length > 0 && Array.isArray(packet.dispositions), 'Review needs rounds and dispositions.');
  const maximum = readJSON('project.json')?.review?.max_final_rounds ?? 3;
  requireValue(Number.isInteger(maximum) && maximum >= 1 && maximum <= 10, 'review.max_final_rounds must be an integer from 1 to 10.');
  const findings = new Map();
  let preliminary = 0, finals = 0;
  const responses = new Set();
  for (const [index, round] of packet.rounds.entries()) {
    requireValue(round.round === index + 1 && ['proposals', 'final'].includes(round.stage), 'Review round numbers/stages are invalid.');
    requireValue(['independent', 'sequential'].includes(round.mode) && ['pass', 'revise', 'insufficient_evidence'].includes(round.verdict), 'Review needs an execution mode and verdict.');
    if (round.stage === 'proposals') { preliminary++; requireValue(index === 0, 'Preliminary review must precede final review.'); } else finals++;
    const roundTarget = reference(round.target, 'Round target', true);
    reference(round.response, 'Critic response', true);
    requireValue(!responses.has(round.response.path), 'Each critic round must retain a distinct original response.');
    responses.add(round.response.path);
    sources(round.sources, 'Round');
    requireValue(Array.isArray(round.findings) && Array.isArray(round.resolutions), 'Round findings and resolutions must be arrays.');
    const resolved = new Set();
    for (const resolution of round.resolutions) {
      const previous = findings.get(resolution.finding_id);
      requireValue(previous && !resolved.has(resolution.finding_id), 'Resolution must identify a unique earlier finding.');
      requireValue(['resolved', 'not_applicable', 'unresolved'].includes(resolution.outcome) && text(resolution.reason), 'Resolution needs an outcome and reason.');
      sources(resolution.sources, 'Resolution'); resolved.add(resolution.finding_id);
    }
    for (const finding of round.findings) {
      requireValue(identifier(finding.id) && !findings.has(finding.id), 'Finding identifiers must be unique and stable across rounds.');
      requireValue(['blocker', 'major', 'minor'].includes(finding.severity) && ['evidence', 'scope', 'feasibility', 'conflict', 'safety'].includes(finding.category), 'Invalid finding severity or category.');
      requireValue(Array.isArray(finding.targets) && finding.targets.length > 0 && finding.targets.every(text), 'Finding needs affected claim/action labels.');
      requireValue(finding.targets.every(label => roundTarget.includes(label)), 'Finding refers to a label missing from its reviewed target.');
      requireValue(text(finding.description) && text(finding.requested_change) && text(finding.owner), 'Finding needs a description, requested change, and owner.');
      sources(finding.sources, 'Finding'); findings.set(finding.id, { ...finding, round: index + 1 });
    }
  }
  requireValue(preliminary <= 1 && finals <= maximum, 'Review round budget exceeded. Preserve results and resolve the remaining scope.');
  const dispositions = new Map();
  for (const disposition of packet.dispositions) {
    requireValue(findings.has(disposition.finding_id) && !dispositions.has(disposition.finding_id), 'Disposition must identify a unique known finding.');
    requireValue(['fixed', 'removed', 'rejected', 'deferred', 'unresolved'].includes(disposition.action) && text(disposition.reason), 'Disposition needs an action and reason.');
    sources(disposition.sources, 'Disposition'); dispositions.set(disposition.finding_id, disposition);
  }
  requireValue([...findings.keys()].every(id => dispositions.has(id)), 'Every finding needs a reasoned disposition.');
  const latest = packet.rounds.at(-1), confirmations = new Map(latest.resolutions.map(item => [item.finding_id, item]));
  const blocking = [], notes = [];
  if (latest.stage !== 'final' || !sameRef(latest.target, packet.target)) blocking.push('The exact final target has not been reviewed.');
  if (latest.verdict !== 'pass') blocking.push('Latest critic verdict: ' + latest.verdict);
  for (const [id, finding] of findings) {
    const disposition = dispositions.get(id), confirmation = confirmations.get(id);
    if (finding.severity !== 'minor') {
      const fixed = ['fixed', 'removed'].includes(disposition.action) && confirmation?.outcome === 'resolved';
      const rejected = disposition.action === 'rejected' && confirmation?.outcome === 'not_applicable';
      if (!(fixed || rejected)) blocking.push('Material issue lacks final reviewer confirmation: ' + id);
    } else if (['rejected', 'deferred', 'unresolved'].includes(disposition.action) || confirmation?.outcome === 'unresolved') notes.push(id);
  }
  if (notes.length) {
    requireValue(Array.isArray(packet.disclosures), 'Minor notes need disclosures in the reviewed target.');
    for (const id of notes) requireValue(packet.disclosures.some(item => item.finding_id === id && text(item.quote)
      && targetText.includes(item.quote)), 'Missing reviewed-target disclosure for minor issue: ' + id);
  }
  return { packet, target_text: targetText, gate: blocking.length ? 'blocked' : notes.length ? 'passed_with_notes' : 'passed',
    blocking, notes, final_rounds: finals, max_final_rounds: maximum };
}

export function reviewArchiveText(review) {
  let output = '\n\n## Review status\n\n' + review.gate;
  for (const round of review.packet.rounds) {
    output += '\n\n## Critic round ' + round.round + ' (' + round.stage + ', ' + round.mode + ')\n\n'
      + fs.readFileSync(vaultPath(round.response.path), 'utf8');
    output += '\n\n### Reviewed target\n\n' + fs.readFileSync(vaultPath(round.target.path), 'utf8');
  }
  return output + '\n\n## Complete review packet\n\n```json\n' + JSON.stringify(review.packet, null, 2) + '\n```';
}
