// The m5 worktree's own Vite config with its own cache folder and port, so this dev server shares
// nothing with the main checkout's (node_modules is a junction there).
import { pathToFileURL } from 'url';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/m5';
const base = (await import(pathToFileURL(`${WT}/vite.config.js`).href)).default;
export default (env) => {
    const config = typeof base === 'function' ? base(env) : base;
    return {
        ...config,
        root: WT,
        cacheDir: 'C:/Users/16048/AppData/Local/Temp/claude/C--Users-16048-Projects-fantasy-guild-v2/d333e011-b2c2-45ca-a45c-16b112f36fb1/scratchpad/m5/vitecache',
        server: { ...config.server, port: 5295, strictPort: true }
    };
};
