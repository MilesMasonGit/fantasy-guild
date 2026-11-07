#!/usr/bin/env node
/**
 * The CMS's command line: `npm run cms -- <command>` from the repo root (`node cms/cli.mjs` works
 * too). The commands and what they do: `cliCommands.mjs` (`npm run cms -- help`), and
 * `cms/README.md`.
 */
import path from 'path';
import process from 'node:process';
import { fileURLToPath } from 'url';
import { runCli } from './cliCommands.mjs';

const cmsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(cmsDir, '..');

/**
 * The CMS's modules through Vite, as the CMS runs them: its vocabulary reaches the game's
 * registries, which load `data/` with Vite's own imports that plain Node cannot run. Started only
 * when a command needs the engine, and closed before exit.
 */
let server = null;
async function load(modulePath) {
    if (!server) {
        const { createServer } = await import('vite');
        server = await createServer({
            configFile: false, root: cmsDir, logLevel: 'error', appType: 'custom',
            server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
        });
    }
    return server.ssrLoadModule(modulePath);
}

let code;
try {
    code = await runCli(process.argv.slice(2), { root, load });
} catch (err) {
    console.error(err?.stack || String(err));
    code = 1;
} finally {
    if (server) await server.close();
}
process.exit(code);
