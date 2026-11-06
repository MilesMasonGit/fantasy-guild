// Throwaway (brief 470 E2): the game's own Vite config on its own port and cache, for the built chart's pictures.
// npx vite --config docs/active/research/encyclopedia_lines/_tools/vite.e2.config.mjs
import path from 'node:path';
import os from 'node:os';
import base from '../../../../../vite.config.js';

const cfg = typeof base === 'function' ? await base({ command: 'serve', mode: 'development' }) : base;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../../..');
export default {
    ...cfg,
    root,
    cacheDir: path.join(os.tmpdir(), 'fg-vite.e2'),
    server: { ...(cfg.server || {}), port: 5427, strictPort: true, open: false }
};
