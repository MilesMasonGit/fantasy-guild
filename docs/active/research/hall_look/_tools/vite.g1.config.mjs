// Throwaway: the game's own Vite config on its own port and cache, for the G1 mock-ups (brief 390).
// npx vite --config docs/active/research/hall_look/_tools/vite.g1.config.mjs
import path from 'node:path';
import os from 'node:os';
import base from '../../../../../vite.config.js';

const cfg = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../../..');
export default {
    ...cfg,
    root,
    cacheDir: path.join(os.tmpdir(), 'fg-vite.g1'),
    server: { ...(cfg.server || {}), port: 5405, strictPort: true }
};
