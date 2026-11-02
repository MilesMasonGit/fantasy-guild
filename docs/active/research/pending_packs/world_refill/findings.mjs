// node findings.mjs <workspace.json> [checkId]  : list the ledger's findings of one check
import fs from 'fs';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const { createServer } = await import('file:///' + WT + '/node_modules/vite/dist/node/index.js');
const server = await createServer({ configFile: false, root: WT + '/cms', logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const rep = await server.ssrLoadModule('/src/engine/ledgerReport.js');
  const ws = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const { findings } = rep.workspaceReport(ws, { pace: false });
  const want = process.argv[3] || 'fragile';
  const hits = findings.filter((f) => (f.check || f.id || f.rule) === want);
  if (!hits.length) console.log('keys of a finding:', Object.keys(findings[0] || {}));
  for (const f of hits) console.log(f.severity, f.key, '|', f.message);
  console.log('count', hits.length);
} finally { await server.close(); }
