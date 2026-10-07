// Guard: the shipped bundle must not contain the perf harness; the perf bundle must.
// Builds both (dist/ and dist-perf/) and greps the JS for the HUD's root id.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = 'fg-perf-hud';

function bundleHas(dir) {
    const assets = path.join(root, dir, 'assets');
    return fs.readdirSync(assets)
        .filter((f) => f.endsWith('.js'))
        .some((f) => fs.readFileSync(path.join(assets, f), 'utf8').includes(MARKER));
}

execSync('npx vite build', { cwd: root, stdio: 'inherit' });
execSync('npx vite build --mode perf', { cwd: root, stdio: 'inherit' });

const normal = bundleHas('dist');
const perf = bundleHas('dist-perf');
console.log(`dist/ contains ${MARKER}: ${normal} (must be false)`);
console.log(`dist-perf/ contains ${MARKER}: ${perf} (must be true)`);
if (normal || !perf) {
    console.error('Perf build guard FAILED.');
    process.exit(1);
}
console.log('Perf build guard OK.');
