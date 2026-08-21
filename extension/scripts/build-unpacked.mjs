import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  ENGINE_FILES,
  extensionRoot,
  sourceDirectory,
  vendorDirectory,
} from './engine-layout.mjs';

const outputDirectory = path.join(extensionRoot, 'dist', 'cstimer-auto-algcount');

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const directory of ['icons', 'popup', 'src']) {
  await cp(
    path.join(extensionRoot, directory),
    path.join(outputDirectory, directory),
    { recursive: true },
  );
}

await cp(
  path.join(extensionRoot, 'manifest.json'),
  path.join(outputDirectory, 'manifest.json'),
);

const outputVendorDirectory = path.join(outputDirectory, 'vendor', 'ssi-core');
await mkdir(outputVendorDirectory, { recursive: true });
await cp(
  path.join(vendorDirectory, 'LICENSE'),
  path.join(outputVendorDirectory, 'LICENSE'),
);
for (const file of ENGINE_FILES) {
  await cp(
    path.join(sourceDirectory, file),
    path.join(outputVendorDirectory, file),
  );
}

console.log(`Built portable unpacked extension at ${outputDirectory}`);
