import { watch } from 'node:fs';
import path from 'node:path';
import {
  ENGINE_FILES,
  sourceDirectory,
} from './engine-layout.mjs';
import { syncEngine } from './sync-ssi-engine.mjs';

const engineFiles = new Set(ENGINE_FILES);
let syncTimer = null;
let syncChain = Promise.resolve();

function queueSync(filename) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncChain = syncChain
      .then(() => syncEngine({ quiet: true }))
      .then(() => console.log(`Synced after ${filename || 'engine'} changed`))
      .catch((error) => console.error(error));
  }, 100);
}

await syncEngine({ quiet: true });
console.log(`Watching ${sourceDirectory}`);

const watcher = watch(sourceDirectory, (eventType, filename) => {
  const changedFile = filename ? path.basename(String(filename)) : '';
  if (!changedFile || engineFiles.has(changedFile)) {
    queueSync(changedFile);
  }
});

function stop() {
  clearTimeout(syncTimer);
  watcher.close();
  console.log('Stopped SSI engine watcher');
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
