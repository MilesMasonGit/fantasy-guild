// Throwaway (brief 460 P1): the game's own Vite config on its own port and cache, for the before/after sheet.
// npx vite --config docs/active/research/hard_pixel/_tools/vite.hp.config.mjs
import path from 'node:path';
import os from 'node:os';
import base from '../../../../../vite.config.js';

const cfg = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../../..');
export default {
    ...cfg,
    root,
    cacheDir: path.join(os.tmpdir(), 'fg-vite.hp'),
    server: { ...(cfg.server || {}), port: 5408, strictPort: true, open: false }
};
