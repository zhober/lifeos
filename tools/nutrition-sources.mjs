// Traceability checks do not establish the accuracy of a source or model interpretation.
import fs from 'node:fs';
import { currentHash, vaultPath } from './store.mjs';

export function sourcesCurrent(sources) {
  return Array.isArray(sources) && sources.length > 0 && sources.every(source => {
    try {
      const file = vaultPath(source.path);
      return fs.statSync(file).isFile() && currentHash(file) === source.sha256_at_capture;
    } catch { return false; }
  });
}
