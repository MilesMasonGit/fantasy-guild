// Throwaway (brief 470 E1): the game's own Vite config on its own port and cache, for the line mock-ups.
// npx vite --config docs/active/research/encyclopedia_lines/_tools/vite.e1.config.mjs
import path from 'node:path';
import os from 'node:os';
import base from '../../../../../vite.config.js';

const cfg = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../../..');
export default {
    ...cfg,
    root,
    cacheDir: path.join(os.tmpdir(), 'fg-vite.e1'),
    server: { ...(cfg.server || {}), port: 5409, strictPort: true, open: false }
};
