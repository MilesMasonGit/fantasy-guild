// Keeping the right V8 profile from a `--cpu-prof` run.
//
// ⚠️ On Node 24 a bench worker has a second thread (the module loader's), and
// `--cpu-prof` writes one file per thread. With a fixed `--cpu-prof-name` both
// threads write the same path and the loader's idle profile, written last,
// wins. So each run profiles into its own folder under Node's default names,
// `CPU.<date>.<time>.<pid>.<thread>.<seq>.cpuprofile`, and we keep thread 0
// (the main thread, where the engine runs).
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_NAME = /^CPU\.\d+\.\d+\.\d+\.(\d+)\.\d+\.cpuprofile$/;

/** The main thread's file among Node's default-named profiles, or null. */
export function mainThreadProfile(fileNames) {
    return fileNames.find(f => DEFAULT_NAME.exec(f)?.[1] === '0') ?? null;
}

/** Node flags that profile one run into its own folder `tmpDir`. */
export function cpuProfFlags(tmpDir) {
    return ['--cpu-prof', `--cpu-prof-dir=${tmpDir}`];
}

/**
 * After the run: move the main thread's profile to `target`, drop the folder
 * (and the loader thread's profile with it). Returns `target`, or null when
 * no main-thread profile was written.
 */
export function keepMainThreadProfile(tmpDir, target) {
    if (!fs.existsSync(tmpDir)) return null;
    const main = mainThreadProfile(fs.readdirSync(tmpDir));
    if (main) fs.renameSync(path.join(tmpDir, main), target);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return main ? target : null;
}
