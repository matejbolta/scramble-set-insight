import { access, copyFile, lstat, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENGINE_FILES,
  sourceDirectory,
  vendorDirectory,
} from './engine-layout.mjs';

async function requireSources() {
  for (const file of ENGINE_FILES) {
    await access(path.join(sourceDirectory, file));
  }
}

export async function syncEngine({ quiet = false } = {}) {
  await requireSources();
  await mkdir(vendorDirectory, { recursive: true });

  for (const file of ENGINE_FILES) {
    const source = path.join(sourceDirectory, file);
    const target = path.join(vendorDirectory, file);
    let targetStats = null;

    try {
      targetStats = await lstat(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (targetStats?.isSymbolicLink()) {
      await rm(target);
    }
    await copyFile(source, target);
  }

  if (!quiet) {
    console.log(`Synced ${ENGINE_FILES.length} engine files from ${sourceDirectory}`);
  }
}

export async function checkEngine({ quiet = false } = {}) {
  await requireSources();

  for (const file of ENGINE_FILES) {
    const source = path.join(sourceDirectory, file);
    const target = path.join(vendorDirectory, file);
    const targetStats = await lstat(target);
    if (!targetStats.isFile() || targetStats.isSymbolicLink()) {
      throw new Error(`${file} must be a regular generated file. Run the sync command.`);
    }

    const [sourceBytes, targetBytes] = await Promise.all([
      readFile(source),
      readFile(target),
    ]);
    if (!sourceBytes.equals(targetBytes)) {
      throw new Error(`${file} is out of sync with the production SSI source.`);
    }
  }

  if (!quiet) {
    console.log(`Verified ${ENGINE_FILES.length} generated engine files`);
  }
}

const isCommand = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommand) {
  const mode = process.argv[2] || 'sync';
  if (mode === 'sync') {
    await syncEngine();
  } else if (mode === 'check') {
    await checkEngine();
  } else {
    throw new Error('Usage: node scripts/sync-ssi-engine.mjs [sync|check]');
  }
}
