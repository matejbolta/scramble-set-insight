import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_FILES = Object.freeze([
  'buffer-selection.js',
  'wide-move-translator.js',
  'scrambling.js',
  'corner-tracing.js',
  'edge-common.js',
  'cycle-model.js',
  'cycle-residue.js',
  'cycle-residue-planner.js',
  'dlin-planner.js',
  'weakswap-tracing.js',
  'pseudoswap-tracing.js',
  'finalizing.js',
  'ssi-core.js',
]);

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

export const extensionRoot = path.resolve(scriptsDirectory, '..');
export const ssiRoot = process.env.SSI_REPO_ROOT
  ? path.resolve(process.env.SSI_REPO_ROOT)
  : path.resolve(extensionRoot, '..');
export const sourceDirectory = path.join(ssiRoot, 'web');
export const vendorDirectory = path.join(extensionRoot, 'vendor', 'ssi-core');
