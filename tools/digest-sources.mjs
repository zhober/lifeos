// Message digests: collectors. Each returns normalised items {id, keys, source, title, abstract, url, doi, pmid,
// journal, tier, published, authors, first_author, last_author, publication_types} plus a per-source status
// (ok | empty | failed, with detail). Only official APIs are used: NCBI E-utilities, the bioRxiv API, Europe PMC
// (also the fallback when the bioRxiv API fails), and the feeds the user lists. Requests identify LifeOS honestly.
// LIFEOS_DIGEST_FIXTURES=<dir> replaces the network with recorded responses (development tests).
import fs from 'node:fs';
import path from 'node:path';
import { plainText, decodeEntities, cleanDoi, itemId, itemKeys } from './digest-data.mjs';

const USER_AGENT = 'LifeOS-digest/1.0 (personal literature digest; https://github.com/zhober/lifeos)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, process.env.LIFEOS_DIGEST_FIXTURES ? 0 : ms));

function fixture(url) {
  const directory = process.env.LIFEOS_DIGEST_FIXTURES;
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const entry = manifest.find(candidate => url.includes(candidate.match));
  if (!entry) throw new Error('No fixture for ' + url);
  if (entry.error) throw new Error(entry.error);
  return fs.readFileSync(path.join(directory, entry.file), 'utf8');
}

export async function httpText(url, { attempts = 3, timeout = 30000 } = {}) {
  if (process.env.LIFEOS_DIGEST_FIXTURES) return fixture(url);
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) { last = error; if (attempt + 1 < attempts) await sleep(1000 * 2 ** attempt); }
  }
  throw last;
}
export async function httpJSON(url, options) {
  const text = await httpText(url, options);
  try { return JSON.parse(text); } catch { throw new Error('non-JSON response'); }
}

const finish = item => ({ ...item, id: itemId(item), keys: itemKeys(item) });
const ymd = (date, separator = '/') => date.replaceAll('-', separator);

// ---- PubMed (all papers of the listed journals, by Entrez date) ---------------------------------
const tag = (xml, name) => { const match = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>')); return match ? match[1] : ''; };
const tags = (xml, name) => [...xml.matchAll(new RegExp('<' + name + '(\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'g'))].map(match => ({ attributes: match[1] ?? '', body: match[2] }));

export function parsePubmedXml(xml, journals) {
  const tierOf = new Map();
  for (const journal of journals) for (const name of [journal.name, ...(journal.aliases ?? [])]) tierOf.set(name.toLowerCase(), journal);
  return tags(xml, 'PubmedArticle').map(({ body }) => {
    const pmid = plainText(tag(body, 'PMID'));
    const abstract = tags(tag(body, 'Abstract'), 'AbstractText').map(part => {
      const label = part.attributes.match(/Label="([^"]+)"/)?.[1];
      return (label ? label + ': ' : '') + plainText(part.body);
    }).join(' ').trim();
    const doi = cleanDoi(tags(body, 'ArticleId').find(id => /IdType="doi"/.test(id.attributes))?.body ?? tags(body, 'ELocationID').find(id => /EIdType="doi"/.test(id.attributes))?.body ?? '');
    const pmcid = plainText(tags(body, 'ArticleId').find(id => /IdType="pmc"/.test(id.attributes))?.body ?? '');
    const journalBlock = tag(body, 'Journal'), title = plainText(tag(journalBlock, 'Title')), abbreviation = plainText(tag(journalBlock, 'ISOAbbreviation'));
    const medline = plainText(tag(tag(body, 'MedlineJournalInfo'), 'MedlineTA'));
    const known = [medline, abbreviation, title].map(name => tierOf.get(name.toLowerCase())).find(Boolean);
    const authors = tags(tag(body, 'AuthorList'), 'Author').map(({ body: author }) => {
      const last = plainText(tag(author, 'LastName')), initials = plainText(tag(author, 'Initials')), collective = plainText(tag(author, 'CollectiveName'));
      return collective || [last, initials].filter(Boolean).join(' ');
    }).filter(Boolean);
    const date = tag(body, 'PubDate'), year = plainText(tag(date, 'Year')) || plainText(tag(date, 'MedlineDate')).slice(0, 4);
    return finish({ source: 'pubmed', pmid, pmcid, doi, title: plainText(tag(body, 'ArticleTitle')), abstract,
      journal: known?.name ?? (title || abbreviation), tier: known?.tier ?? 3, open_access: known?.open_access === true, published: [year, plainText(tag(date, 'Month')), plainText(tag(date, 'Day'))].filter(Boolean).join(' '),
      authors, first_author: authors[0] ?? '', last_author: authors.at(-1) ?? '',
      publication_types: tags(tag(body, 'PublicationTypeList'), 'PublicationType').map(type => plainText(type.body)),
      url: 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/' });
  });
}

const eutils = (tool, params) => {
  const extra = { tool: 'lifeos', ...(process.env.NCBI_EMAIL ? { email: process.env.NCBI_EMAIL } : {}), ...(process.env.NCBI_API_KEY ? { api_key: process.env.NCBI_API_KEY } : {}) };
  return 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/' + tool + '.fcgi?' + new URLSearchParams({ ...params, ...extra });
};

export async function collectPubmed(settings, window) {
  const journals = settings.sources?.pubmed?.journals ?? [];
  if (!journals.length) return { items: [], status: { status: 'empty', detail: 'no journals configured' } };
  const pause = process.env.NCBI_API_KEY ? 110 : 350;
  const term = '(' + journals.map(journal => '"' + journal.name + '"[Journal]').join(' OR ') + ')';
  try {
    const ids = [];
    for (let start = 0; ; start += 500) {
      const search = await httpJSON(eutils('esearch', { db: 'pubmed', term, datetype: 'edat', mindate: ymd(window.from), maxdate: ymd(window.to), retmax: 500, retstart: start, retmode: 'json' }));
      const page = search.esearchresult?.idlist ?? [];
      ids.push(...page);
      const total = Number(search.esearchresult?.count ?? 0);
      await sleep(pause);
      if (!page.length || ids.length >= total) break;
    }
    const items = [];
    for (let index = 0; index < ids.length; index += 200) {
      items.push(...parsePubmedXml(await httpText(eutils('efetch', { db: 'pubmed', id: ids.slice(index, index + 200).join(','), retmode: 'xml' })), journals));
      await sleep(pause);
    }
    return { items, status: { status: items.length ? 'ok' : 'empty', detail: ids.length + ' ids ' + window.from + '..' + window.to } };
  } catch (error) { return { items: [], status: { status: 'failed', detail: error.message } }; }
}

// ---- bioRxiv / medRxiv, with Europe PMC as the fallback ---------------------------------------
const normaliseCategory = value => String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '-').trim();
const preprintItem = (server, entry) => {
  const authors = String(entry.authors ?? '').split(';').map(name => name.trim()).filter(Boolean);
  return finish({ source: server, doi: cleanDoi(entry.doi), title: plainText(entry.title), abstract: plainText(entry.abstract), journal: server === 'medrxiv' ? 'medRxiv' : 'bioRxiv', tier: 4,
    published: entry.date ?? '', category: entry.category ?? '', version: entry.version ?? '', jatsxml: entry.jatsxml ?? '', authors, first_author: authors[0] ?? '', last_author: authors.at(-1) ?? '',
    corresponding: entry.author_corresponding ?? '', url: 'https://doi.org/' + cleanDoi(entry.doi) });
};

export async function collectPreprints(settings, window, prefilter) {
  const config = settings.sources?.biorxiv ?? {}, server = config.server ?? 'biorxiv';
  const categories = new Set((config.categories ?? []).map(normaliseCategory));
  const keep = item => (!categories.size || categories.has(normaliseCategory(item.category))) && prefilter(item);
  const latest = new Map();
  try {
    for (let cursor = 0, page = 0; page < 200; page++) {
      const data = await httpJSON('https://api.biorxiv.org/details/' + server + '/' + window.from + '/' + window.to + '/' + cursor);
      const collection = data.collection ?? [];
      for (const entry of collection) { const previous = latest.get(entry.doi); if (!previous || Number(entry.version) > Number(previous.version)) latest.set(entry.doi, entry); }
      cursor += collection.length;
      const total = Number(data.messages?.[0]?.total ?? 0);
      await sleep(1000);
      if (!collection.length || cursor >= total) break;   // pages are small (30 items); only the total ends the walk
    }
    const items = [...latest.values()].map(entry => preprintItem(server, entry)).filter(keep);
    return { items, status: { status: latest.size ? 'ok' : 'empty', detail: latest.size + ' preprints, ' + items.length + ' kept, ' + window.from + '..' + window.to } };
  } catch (error) {
    const fallback = await europePmcPreprints(server, window).catch(fallbackError => ({ error: fallbackError }));
    if (fallback.error) return { items: [], status: { status: 'failed', detail: error.message + '; Europe PMC fallback: ' + fallback.error.message } };
    const items = fallback.items.filter(prefilter);   // Europe PMC carries no bioRxiv category, so only the keyword prefilter applies
    return { items, status: { status: 'ok_via_europepmc', detail: server + ' API ' + error.message + '; Europe PMC ' + fallback.items.length + ' preprints, ' + items.length + ' kept' } };
  }
}

const EUROPE_PMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/';
async function europePmcPreprints(server, window) {
  const items = [];
  let cursor = '*';
  for (let page = 0; page < 50; page++) {
    const query = 'SRC:PPR AND PUBLISHER:"' + (server === 'medrxiv' ? 'medRxiv' : 'bioRxiv') + '" AND FIRST_PDATE:[' + window.from + ' TO ' + window.to + ']';
    const data = await httpJSON(EUROPE_PMC + 'search?' + new URLSearchParams({ query, resultType: 'core', format: 'json', pageSize: 1000, cursorMark: cursor }));
    for (const entry of data.resultList?.result ?? [])
      items.push(preprintItem(server, { doi: entry.doi, title: entry.title, abstract: entry.abstractText, date: entry.firstPublicationDate, authors: (entry.authorString ?? '').replace(/,\s*/g, '; ') }));
    if (!data.nextCursorMark || data.nextCursorMark === cursor || !(data.resultList?.result ?? []).length) break;
    cursor = data.nextCursorMark;
    await sleep(500);
  }
  return { items };
}

// A missing or truncated abstract: Europe PMC holds the same record.
export async function recoverAbstract(item) {
  const query = item.pmid ? 'EXT_ID:' + item.pmid + ' AND SRC:MED' : item.doi ? 'DOI:"' + item.doi + '"' : null;
  if (!query) return null;
  const data = await httpJSON(EUROPE_PMC + 'search?' + new URLSearchParams({ query, resultType: 'core', format: 'json', pageSize: 1 }));
  const entry = data.resultList?.result?.[0];
  return entry?.abstractText ? plainText(entry.abstractText) : null;
}

// ---- open-access full text (best effort) --------------------------------------------------------
function jatsText(xml) {
  const body = tag(xml, 'body') || xml;
  return body.replace(/<title>([\s\S]*?)<\/title>/g, '\n\n## $1\n').replace(/<\/p>/g, '\n\n').replace(/<(table-wrap|fig|ref-list)[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '').split('\n').map(line => decodeEntities(line).replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Text is downloaded only where an official full-text XML API exists (PMC open access through Europe PMC, or the
// preprint server's own JATS file); otherwise the free full-text links Europe PMC and Unpaywall report are returned
// for the reader to open. Pages that refuse automated access are not worked around.
export async function openAccessFullText(item, limit = 200000) {
  const attempts = [], links = [];
  const addLink = (label, url) => { if (url && !links.some(link => link.url === url)) links.push({ label, url }); };
  try {
    const query = item.pmid ? 'EXT_ID:' + item.pmid + ' AND SRC:MED' : item.doi ? 'DOI:"' + item.doi + '"' : null;
    const found = query ? (await httpJSON(EUROPE_PMC + 'search?' + new URLSearchParams({ query, resultType: 'core', format: 'json', pageSize: 1 }))).resultList?.result?.[0] : null;
    for (const url of found?.fullTextUrlList?.fullTextUrl ?? [])
      if (['Free', 'Open access'].includes(url.availability) && url.documentStyle !== 'doi') addLink(url.documentStyle === 'pdf' ? 'PDF' : 'HTML', url.url);
    const pmcid = item.pmcid || (found?.isOpenAccess === 'Y' ? found.pmcid : null);
    if (pmcid) { const text = jatsText(await httpText(EUROPE_PMC + pmcid + '/fullTextXML')); if (text.length > 1000) return { source: 'europepmc:' + pmcid, text: text.slice(0, limit), links }; }
  } catch (error) { attempts.push('europepmc: ' + error.message); }
  if (item.jatsxml) {
    try { const text = jatsText(await httpText(item.jatsxml, { attempts: 1 })); if (text.length > 1000) return { source: item.jatsxml, text: text.slice(0, limit), links }; }
    catch (error) { attempts.push('jats: ' + error.message); }
  }
  // Free-to-read by definition: every preprint, and journals the user marks open_access in the settings.
  if (['biorxiv', 'medrxiv'].includes(item.source) && item.doi) addLink(item.journal, 'https://www.' + item.source + '.org/content/' + item.doi + (item.version ? 'v' + item.version : '') + '.full');
  if (item.open_access && item.doi) addLink('OA', 'https://doi.org/' + item.doi);
  if (item.doi && process.env.UNPAYWALL_EMAIL) {
    try {
      const record = await httpJSON('https://api.unpaywall.org/v2/' + encodeURIComponent(item.doi) + '?email=' + encodeURIComponent(process.env.UNPAYWALL_EMAIL), { attempts: 1 });
      for (const location of record.oa_locations ?? []) addLink(location.url_for_pdf ? 'PDF' : 'HTML', location.url_for_pdf ?? location.url);
    } catch (error) { attempts.push('unpaywall: ' + error.message); }
  }
  return { source: null, text: null, links, detail: attempts.join('; ') || (links.length ? 'links only' : 'no open-access copy found') };
}

// ---- RSS 2.0 / Atom feeds ----------------------------------------------------------------------
export function parseFeed(xml, feed) {
  const atom = /<feed[\s>]/.test(xml) && !/<rss[\s>]/.test(xml);
  const blocks = tags(xml, atom ? 'entry' : 'item').map(block => block.body);
  return blocks.map(body => {
    const link = atom ? (body.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) ?? body.match(/<link[^>]*href="([^"]+)"/))?.[1] ?? '' : plainText(tag(body, 'link'));
    const summary = tag(body, atom ? 'summary' : 'description') || tag(body, 'content:encoded') || tag(body, 'content');
    const cdata = text => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    const published = plainText(tag(body, atom ? 'updated' : 'pubDate') || tag(body, 'published') || tag(body, 'dc:date'));
    const date = Number.isNaN(Date.parse(published)) ? '' : new Date(published).toISOString().slice(0, 10);
    return finish({ source: 'rss', feed: feed.name ?? feed.url, title: plainText(cdata(tag(body, 'title'))), abstract: plainText(cdata(summary)), url: decodeEntities(link.trim()),
      journal: feed.name ?? feed.url, tier: feed.tier ?? 3, published: date, authors: [], first_author: plainText(tag(body, 'author') || tag(body, 'dc:creator')), last_author: '' });
  }).filter(item => item.title);
}

export async function collectFeeds(settings, window) {
  const feeds = settings.sources?.rss?.feeds ?? [];
  if (!feeds.length) return { items: [], statuses: { rss: { status: 'empty', detail: 'no feeds configured' } } };
  const items = [], statuses = {};
  for (const feed of feeds) {
    try {
      const parsed = parseFeed(await httpText(feed.url), feed).filter(item => !item.published || (item.published >= window.from && item.published <= window.to));
      items.push(...parsed); statuses['rss:' + (feed.name ?? feed.url)] = { status: parsed.length ? 'ok' : 'empty', detail: parsed.length + ' items' };
    } catch (error) { statuses['rss:' + (feed.name ?? feed.url)] = { status: 'failed', detail: error.message }; }
    await sleep(300);
  }
  return { items, statuses };
}
