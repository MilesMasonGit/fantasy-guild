import fs from 'fs';
import path from 'path';
import { normaliseStarterCamp } from '../src/config/starterCampShape.js';
import { listDropFolder, importDropFile, libraryFiles } from './paletteInbox.js';
import { BAKE_KEY, splitLibrary } from './paletteBrighten.js';
import { resolveSpritePath, currentSpriteName } from '../src/utils/AssetManager.js';
import { studioAssetPath } from './assetNaming.js';
import { PLAN_DIR } from './src/engine/planFile.js';
import { listPacks, getPack, archivePack, restorePack } from './changePackInbox.js';
import { getWorkspace, putWorkspace, WORKSPACE_FILE } from './workspaceFile.js';
import { loadGameData, writeSync } from './gameData.js';


/** Whether a request comes from a page on this machine (the game's dev server, on any port). */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Read a request's whole body as JSON. */
function readJson(req, onBody, onError) {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body || 'null');
    } catch (err) {
      onError(err);
      return;
    }
    onBody(parsed);
  });
}

/**
 * `/api/starter-camp`: the inbox between the game's dev button ("Save this mat as the Starter Camp")
 * and the CMS's Starter Camp page. The game POSTs the live mat; the page GETs it and, once the owner
 * takes it into the workspace or discards it, DELETEs it. It is written to `inboxDir`, never to
 * `data/`: only Sync to Game writes `data/starterCamp.json`, from the workspace.
 *
 * The game runs on another port, so this one route answers cross-origin calls, from pages on this
 * machine only.
 */
function starterCampRoute(req, res, inboxDir) {
  const file = path.join(inboxDir, 'starter-camp.json');
  const origin = req.headers?.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  const send = (status, body) => {
    res.statusCode = status;
    if (body === undefined) return res.end();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') return send(204);

  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return send(200, { camp: null });
    try {
      return send(200, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      return send(500, { error: 'Failed to read the saved Starter Camp: ' + err.message });
    }
  }

  if (req.method === 'DELETE') {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return send(200, { success: true });
  }

  if (req.method === 'POST') {
    readJson(req, (payload) => {
      const camp = normaliseStarterCamp(payload?.camp ?? payload);
      if (!camp) return send(400, { error: 'That is not a Starter Camp' });
      try {
        fs.mkdirSync(inboxDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ receivedAt: new Date().toISOString(), camp }, null, 2));
      } catch (err) {
        return send(500, { error: 'Failed to keep the Starter Camp: ' + err.message });
      }
      console.log(`[CMS] The game saved a Starter Camp: ${camp.tokens.length} Token(s), ${Object.keys(camp.bank).length} Bank item(s). Open the Starter Camp page to review it.`);
      send(200, { success: true, tokens: camp.tokens.length, bank: Object.keys(camp.bank).length });
    }, (err) => send(400, { error: 'Invalid JSON: ' + err.message }));
    return;
  }

  send(405, { error: 'Method not allowed' });
}

/**
 * `/api/change-packs`: the agents' change-pack inbox (`changePackInbox.js`).
 * - `GET /api/change-packs`: `{ inbox, applied }`, one summary per pack (a malformed one with its `errors`)
 * - `GET /api/change-packs/inbox/<file>` or `/applied/<file>`: the pack
 * - `POST /api/change-packs/inbox/<file>/archive` `{ review }`: finish a review, into the archive
 * - `POST /api/change-packs/applied/<file>/restore` `{ undone }`: after an undo, back to the inbox
 */
function changePackRoute(req, res, url, incoming) {
  const send = ({ status, body }) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const parts = url.split('/').slice(3);
  try {
    if (req.method === 'GET' && parts.length === 0) return send({ status: 200, body: listPacks(incoming) });
    const [where, file, action] = parts;
    if (req.method === 'GET' && parts.length === 2 && (where === 'inbox' || where === 'applied')) {
      return send(getPack(incoming, decodeURIComponent(file), { archived: where === 'applied' }));
    }
    if (req.method === 'POST' && parts.length === 3) {
      const run = where === 'inbox' && action === 'archive'
        ? (body) => archivePack(incoming, decodeURIComponent(file), body?.review)
        : where === 'applied' && action === 'restore'
          ? (body) => restorePack(incoming, decodeURIComponent(file), { undone: Array.isArray(body?.undone) ? body.undone : [] })
          : null;
      if (run) {
        readJson(req, (body) => {
          try {
            send(run(body));
          } catch (err) {
            send({ status: 500, body: { error: 'Failed to move the pack: ' + err.message } });
          }
        }, (err) => send({ status: 400, body: { error: 'Invalid JSON: ' + err.message } }));
        return;
      }
    }
  } catch (err) {
    return send({ status: 500, body: { error: 'Failed to read the change-pack inbox: ' + err.message } });
  }
  send({ status: 404, body: { error: 'No such change-pack route' } });
}

/**
 * `/api/workspace`: the workspace on disk (`workspaceFile.js`).
 * - `GET`: `{ exists, revision, savedAt, savedBy, simDials, workspace }`; `?meta=1` leaves out the workspace and dials
 * - `PUT` `{ baseRevision, workspace, simDials, clientId }` or `{ seed: true, workspace, simDials }`: 409 when the disk moved on
 */
function workspaceRoute(req, res, file, backupsDir) {
  const send = ({ status, body }) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET') return send(getWorkspace(file, { meta: /[?&]meta=1(&|$)/.test(req.url) }));
  if (req.method === 'PUT') {
    readJson(req, (body) => {
      try {
        send(putWorkspace(file, body, { backupsDir }));
      } catch (err) {
        send({ status: 500, body: { error: 'Failed to write the workspace: ' + err.message } });
      }
    }, (err) => send({ status: 400, body: { error: 'Invalid JSON: ' + err.message } }));
    return;
  }
  send({ status: 405, body: { error: 'Method not allowed' } });
}

/** The only API routes the Studio's server answers: palettes, sprites and animation runs, never game data. */
const STUDIO_ROUTES = ['/api/custom-palettes', '/api/palette-groups', '/api/palette-inbox', '/api/save-recolored-asset', '/api/animation-runs'];

/**
 * @param {object} [options]
 * @param {string} [options.inboxDir] where the game's saved Starter Camp waits for the page
 *        (default `cms/inbox/`, git-ignored)
 * @param {string} [options.paletteInboxDir] the palette drop folder (default `cms/palettes-inbox/`)
 * @param {string} [options.palettesDir] the Material Library's files (default `data/palettes/`)
 * @param {string} [options.dataDir] the game's content files read by Restore from Game and written by Sync
 *        (default `data/`). ⚠️ When set, Sync does not commit: the commit stages the project's `data/`, not this folder.
 * @param {string} [options.planDir] the ledger's plan, kept out of `data/` (default `cms/plan/`); written and read beside `data/`
 * @param {boolean} [options.studio] the Studio's server: refuses every API route outside `STUDIO_ROUTES`
 * @param {string} [options.incomingDir] the change-pack inbox (default `cms/incoming/`; archive in its `applied/`)
 * @param {string} [options.backupsDir] workspace backups and autosaves (default `cms/backups/`)
 * @param {string} [options.workspaceDir] the workspace on disk, `workspace.json` (default `cms/workspace/`)
 * @param {string} [options.sandboxDir] a throwaway folder that stands in for every place this server
 *        writes: `<dir>/data`, `<dir>/plan`, `<dir>/workspace`, `<dir>/backups`, `<dir>/incoming`,
 *        `<dir>/inbox`. A Sync there never commits. Options named on their own still win.
 */
export default function cmsFileApi({ inboxDir, paletteInboxDir, palettesDir, dataDir, planDir, incomingDir, backupsDir: backupsDirOption, workspaceDir, sandboxDir, studio = false } = {}) {
  const projectRoot = process.cwd().endsWith('cms') ? path.resolve(process.cwd(), '..') : process.cwd();
  const sandbox = sandboxDir ? path.resolve(sandboxDir) : null;
  const inSandbox = (name) => (sandbox ? path.join(sandbox, name) : null);
  dataDir = dataDir || inSandbox('data');
  planDir = planDir || inSandbox('plan');
  const inbox = inboxDir || inSandbox('inbox') || path.resolve(projectRoot, 'cms', 'inbox');
  const paletteInbox = paletteInboxDir || path.resolve(projectRoot, 'cms', 'palettes-inbox');
  const palettesRoot = palettesDir || path.resolve(projectRoot, 'data', 'palettes');
  const dataRoot = dataDir || path.resolve(projectRoot, 'data');
  const planRoot = planDir || path.resolve(projectRoot, ...PLAN_DIR.split('/'));
  const incoming = incomingDir || inSandbox('incoming') || path.resolve(projectRoot, 'cms', 'incoming');
  // ⚠️ From the project root, like every other folder here: it once followed the server's working folder, so a server started from the repo root kept its backups in a second `backups/` there.
  const backupsDir = backupsDirOption || inSandbox('backups') || path.resolve(projectRoot, 'cms', 'backups');
  const workspaceFile = path.join(workspaceDir || inSandbox('workspace') || path.resolve(projectRoot, 'cms', 'workspace'), WORKSPACE_FILE);
  const library = libraryFiles(palettesRoot);
  return {
    name: 'cms-file-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];

        if (studio && url.startsWith('/api/') && !STUDIO_ROUTES.some((r) => url === r || url.startsWith(r + '/'))) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'The Studio does not read or write game data; use the CMS' }));
          return;
        }

        if (url === '/api/workspace') return workspaceRoute(req, res, workspaceFile, backupsDir);
        if (url === '/api/starter-camp') return starterCampRoute(req, res, inbox);
        if (url === '/api/change-packs' || url.startsWith('/api/change-packs/')) return changePackRoute(req, res, url, incoming);

        // --- The palette drop folder: list it, and import one file into the Material Library ---
        if (req.method === 'GET' && url === '/api/palette-inbox') {
          res.setHeader('Content-Type', 'application/json');
          try {
            res.end(JSON.stringify(listDropFolder(paletteInbox)));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to read the palette drop folder: ' + err.message }));
          }
          return;
        }
        if (req.method === 'POST' && url === '/api/palette-inbox/import') {
          readJson(req, (payload) => {
            let out;
            try {
              out = importDropFile(paletteInbox, palettesRoot, payload?.file, { overwrite: payload?.overwrite === true });
            } catch (err) {
              out = { status: 500, body: { error: 'Failed to import the palette: ' + err.message } };
            }
            res.statusCode = out.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out.body));
          }, (err) => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON: ' + err.message }));
          });
          return;
        }

        // Serve static assets from project root public/assets folder if requested in CMS
        if (url.startsWith('/assets/')) {
          const filePath = path.join(projectRoot, 'public', url);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.gif') contentType = 'image/gif';
            else if (ext === '.svg') contentType = 'image/svg+xml';
            else if (ext === '.webp') contentType = 'image/webp';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        // Serve raw_assets from project root raw_assets folder if requested in CMS
        if (url.startsWith('/raw_assets/')) {
          const filePath = path.join(projectRoot, url);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.gif') contentType = 'image/gif';
            else if (ext === '.svg') contentType = 'image/svg+xml';
            else if (ext === '.webp') contentType = 'image/webp';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        // GET /api/animation-runs (List all candidate and staging animation runs)
        if (req.method === 'GET' && url === '/api/animation-runs') {
          try {
            const runs = [];
            const animDir = path.join(projectRoot, 'raw_assets', 'animations', 'enemies');
            if (fs.existsSync(animDir)) {
              const categories = fs.readdirSync(animDir);
              for (const cat of categories) {
                const catPath = path.join(animDir, cat);
                if (!fs.statSync(catPath).isDirectory()) continue;
                const enemies = fs.readdirSync(catPath);
                for (const enemy of enemies) {
                  const enemyPath = path.join(catPath, enemy);
                  if (!fs.statSync(enemyPath).isDirectory()) continue;

                  // Check for raw 4x4 sheet if assembled
                  const rawSheet = path.join(enemyPath, `ani_${enemy}_raw.png`);
                  if (fs.existsSync(rawSheet)) {
                    runs.push({
                      id: `${enemy}_raw`,
                      label: `${enemy} (Assembled 4×4 Raw)`,
                      path: `/raw_assets/animations/enemies/${cat}/${enemy}/ani_${enemy}_raw.png`,
                      type: 'enemy',
                      category: cat,
                      enemy
                    });
                  }

                  // Check runs/
                  const runsFolder = path.join(enemyPath, 'runs');
                  if (fs.existsSync(runsFolder)) {
                    const runList = fs.readdirSync(runsFolder);
                    for (const run of runList) {
                      const runFolder = path.join(runsFolder, run);
                      const strip = path.join(runFolder, 'strip_8f.png');
                      if (fs.existsSync(strip)) {
                        let meta = {};
                        const metaPath = path.join(runFolder, 'meta.json');
                        if (fs.existsSync(metaPath)) {
                          try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}
                        }
                        runs.push({
                          id: run,
                          label: `${enemy} [${meta.cycle || 'strip'}] (${run.replace('run_', '')})`,
                          path: `/raw_assets/animations/enemies/${cat}/${enemy}/runs/${run}/strip_8f.png`,
                          type: 'strip',
                          category: cat,
                          enemy,
                          cycle: meta.cycle || 'strip',
                          cost: meta.cost,
                          seed: meta.seed
                        });
                      }
                    }
                  }
                }
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(runs));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (!url.startsWith('/api/backups') && 
            !url.startsWith('/api/save-recolored-asset') && 
            !url.startsWith('/api/custom-palettes') &&
            !url.startsWith('/api/palette-groups') &&
            !url.startsWith('/api/sprite-audit') &&
            !url.startsWith('/api/register-sprite') &&
            !url.startsWith('/api/sync-game-data') &&
            !url.startsWith('/api/load-game-data') &&
            !url.startsWith('/data/palettes/')) {
          return next();
        }

        if (!fs.existsSync(backupsDir) && url.startsWith('/api/backups')) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }

        // --- GET /api/backups (List all backups) ---
        if (req.method === 'GET' && req.url === '/api/backups') {
          try {
            const files = fs.readdirSync(backupsDir)
              .filter(f => f.endsWith('.json'))
              .map(f => {
                const stat = fs.statSync(path.join(backupsDir, f));
                return {
                  name: f.replace('.json', ''),
                  createdAt: stat.mtimeMs,
                  size: stat.size
                };
              })
              .sort((a, b) => b.createdAt - a.createdAt); // newest first

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to list backups' }));
          }
          return;
        }

        // --- POST /api/backups (Create a backup) ---
        if (req.method === 'POST' && req.url === '/api/backups') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { name, data, isAutoSave } = JSON.parse(body);
              if (!name || !data) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing name or data' }));
                return;
              }

              const safeName = name.replace(/[^a-z0-9_-]/gi, '_');
              const filename = `${safeName}.json`;
              const filePath = path.join(backupsDir, filename);

              fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

              // If it's an autosave, maintain only the last 5 autosaves
              if (isAutoSave) {
                const autoSaves = fs.readdirSync(backupsDir)
                  .filter(f => f.startsWith('autosave_'))
                  .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtimeMs }))
                  // Names carry the time too: two saves in one clock tick must still drop the older.
                  .sort((a, b) => b.time - a.time || b.name.localeCompare(a.name));

                // Delete any autosaves beyond the 5th
                if (autoSaves.length > 5) {
                  for (let i = 5; i < autoSaves.length; i++) {
                    fs.unlinkSync(path.join(backupsDir, autoSaves[i].name));
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, name: safeName }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save backup: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /api/backups/:name (Load a backup) ---
        if (req.method === 'GET' && req.url.startsWith('/api/backups/')) {
          const name = req.url.split('/').pop();
          const filePath = path.join(backupsDir, `${name}.json`);
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Backup not found' }));
          }
          return;
        }

        // --- DELETE /api/backups/:name (Delete a backup) ---
        if (req.method === 'DELETE' && req.url.startsWith('/api/backups/')) {
          const name = req.url.split('/').pop();
          const filePath = path.join(backupsDir, `${name}.json`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Backup not found' }));
          }
          return;
        }

        // --- POST /api/save-recolored-asset (Save processed PNG sprite) ---
        if (req.method === 'POST' && req.url === '/api/save-recolored-asset') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { filename, category, group, base64Image } = JSON.parse(body);
              if (!filename || !category || !base64Image) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing filename, category, or base64Image' }));
                return;
              }

              // Named and filed by docs/reference/ASSET_NAMING.md: <kind>/<group>/<prefix>_<name>.png.
              const target = studioAssetPath({ name: filename, category, group });
              if (target.error) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: target.error }));
                return;
              }
              const filePath = path.resolve(projectRoot, 'public', 'assets', ...target.rel.split('/'));
              fs.mkdirSync(path.dirname(filePath), { recursive: true });

              // Remove base64 prefix
              const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (!matches || matches.length !== 3) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid base64 image data' }));
                return;
              }

              const imageBuffer = Buffer.from(matches[2], 'base64');
              fs.writeFileSync(filePath, imageBuffer);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, path: filePath, rel: target.rel }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save asset: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /api/custom-palettes (Load custom palettes) ---
        if (req.method === 'GET' && req.url === '/api/custom-palettes') {
          const palettesPath = library.palettes;
          if (fs.existsSync(palettesPath)) {
            const data = fs.readFileSync(palettesPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({}));
          }
          return;
        }

        // --- POST /api/custom-palettes (Save custom palettes) ---
        if (req.method === 'POST' && req.url === '/api/custom-palettes') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const palettes = JSON.parse(body);
              const palettesPath = library.palettes;
              // A save from a page that does not know about the bake marker must not drop it,
              // or the palettes could be brightened a second time.
              if (palettes && typeof palettes === 'object' && !(BAKE_KEY in palettes) && fs.existsSync(palettesPath)) {
                const marker = splitLibrary(JSON.parse(fs.readFileSync(palettesPath, 'utf-8'))).marker;
                if (marker) palettes[BAKE_KEY] = marker;
              }
              const dir = path.dirname(palettesPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(palettesPath, JSON.stringify(palettes, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save custom palettes: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /api/palette-groups (Load palette groups) ---
        if (req.method === 'GET' && req.url === '/api/palette-groups') {
          const groupsPath = library.groups;
          if (fs.existsSync(groupsPath)) {
            const data = fs.readFileSync(groupsPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({}));
          }
          return;
        }

        // --- POST /api/palette-groups (Save palette groups) ---
        if (req.method === 'POST' && req.url === '/api/palette-groups') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const groups = JSON.parse(body);
              const groupsPath = library.groups;
              const dir = path.dirname(groupsPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save palette groups: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /data/palettes/:filename (Serve palette files) ---
        if (req.method === 'GET' && url.startsWith('/data/palettes/')) {
          const filename = url.split('/').pop();
          const filePath = path.resolve(palettesRoot, filename);
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Palette not found' }));
          }
          return;
        }

        // --- POST /api/sprite-audit (Scan physical files + audit assignments) ---
        if (req.method === 'POST' && req.url === '/api/sprite-audit') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { items = {}, tasks = {}, enemies = {}, areas = {} } = JSON.parse(body);

              // 1. Scan physical assets on disk
              const publicDir = path.resolve(projectRoot, 'public');
              const assetsDir = path.join(publicDir, 'assets');
              
              function getPngFiles(dir, relativeRoot, acc = []) {
                if (!fs.existsSync(dir)) return acc;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                  if (file === 'dataset' || file === 'input32' || file === 'input64' || file === 'input128' || file === 'input256' || file === 'backup' || file === 'backups') {
                    continue;
                  }
                  const filePath = path.join(dir, file);
                  const stat = fs.statSync(filePath);
                  if (stat.isDirectory()) {
                    getPngFiles(filePath, relativeRoot, acc);
                  } else if (file.endsWith('.png')) {
                    const relative = path.relative(relativeRoot, filePath).replace(/\\/g, '/');
                    acc.push(relative);
                  }
                }
                return acc;
              }

              const physicalSprites = getPngFiles(assetsDir, publicDir);

              // 2. Read manifest mapping
              const manifestPath = path.resolve(projectRoot, 'src', 'config', 'registries', 'sprite-manifest.js');
              let spriteManifest = {};
              let manifestExists = false;
              if (fs.existsSync(manifestPath)) {
                manifestExists = true;
                try {
                  const content = fs.readFileSync(manifestPath, 'utf8');
                  const regex = /['"]?([a-zA-Z0-9_-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
                  let match;
                  while ((match = regex.exec(content)) !== null) {
                    spriteManifest[match[1]] = match[2];
                  }
                } catch (e) {
                  console.error("Error parsing manifest file:", e);
                }
              }

              // 3. Helper to resolve sprite path from entity
              function resolvePath(entity, type) {
                // Priority: spriteId > sprite > backgroundImage > areaArt
                let ref = entity.spriteId || entity.sprite;
                if (type === 'area') {
                  ref = entity.spriteId || entity.sprite || entity.areaArt || entity.backgroundImage;
                } else if (type === 'task') {
                  ref = entity.spriteId || entity.sprite || entity.background;
                }

                if (!ref || typeof ref !== 'string') return null;
                if (ref.startsWith('assets/')) return ref;
                // The manifest as it is on disk now (a sprite registered since this server started),
                // then the game's own rules (old names, hero portraits, skill icons).
                return spriteManifest[currentSpriteName(ref)] || spriteManifest[ref] || resolveSpritePath(ref);
              }

              // 4. Map active assignments
              const assignments = {}; // key: spritePath, value: array of { id, name, type }
              const missingList = []; // array of { id, name, type, reason }

              function auditEntity(entity, type) {
                const spritePath = resolvePath(entity, type);
                const entityInfo = { id: entity.id, name: entity.name, type };

                // Get the raw ref string for debugging / display
                let rawRef = entity.spriteId || entity.sprite;
                if (type === 'area') rawRef = entity.spriteId || entity.sprite || entity.areaArt || entity.backgroundImage;
                else if (type === 'task') rawRef = entity.spriteId || entity.sprite || entity.background;

                if (!rawRef) {
                  missingList.push({ ...entityInfo, reason: 'No sprite or background configured' });
                  return;
                }

                if (!spritePath) {
                  missingList.push({ ...entityInfo, reason: `Unregistered reference key: "${rawRef}"` });
                  return;
                }

                // Verify file exists
                const fullPath = path.join(publicDir, spritePath);
                if (!fs.existsSync(fullPath)) {
                  missingList.push({ ...entityInfo, reason: `File not found on disk: "${spritePath}"` });
                }

                if (!assignments[spritePath]) {
                  assignments[spritePath] = [];
                }
                assignments[spritePath].push(entityInfo);
              }

              Object.values(items).forEach(item => auditEntity(item, 'item'));
              Object.values(tasks).forEach(task => auditEntity(task, 'task'));
              Object.values(enemies).forEach(enemy => auditEntity(enemy, 'enemy'));
              Object.values(areas).forEach(area => auditEntity(area, 'area'));

              // 5. Compute duplicates
              const duplicates = {};
              Object.entries(assignments).forEach(([spritePath, list]) => {
                if (list.length > 1) {
                  duplicates[spritePath] = list;
                }
              });

              // 6. Compute unassigned sprites
              const assignedPaths = new Set(Object.keys(assignments));
              const unassigned = physicalSprites.filter(spritePath => !assignedPaths.has(spritePath));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                unassigned,
                missing: missingList,
                duplicates,
                spriteManifest,
                physicalSpritesCount: physicalSprites.length,
                manifestExists
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to complete sprite audit: ' + err.message }));
            }
          });
          return;
        }

        // --- POST /api/register-sprite (Write to sprite-manifest.js) ---
        if (req.method === 'POST' && req.url === '/api/register-sprite') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { spriteId, spritePath } = JSON.parse(body);
              if (!spriteId || !spritePath) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing spriteId or spritePath' }));
                return;
              }

              const manifestFile = path.resolve(projectRoot, 'src', 'config', 'registries', 'sprite-manifest.js');
              if (!fs.existsSync(manifestFile)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'sprite-manifest.js not found' }));
                return;
              }

              let content = fs.readFileSync(manifestFile, 'utf8');

              // Check if already registered
              if (content.includes(`'${spriteId}':`) || content.includes(`"${spriteId}":`)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Already registered' }));
                return;
              }

              // Find SPRITE_MANIFEST assignment
              const insertionPoint = content.indexOf('export const SPRITE_MANIFEST = {');
              if (insertionPoint === -1) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Could not locate SPRITE_MANIFEST declaration' }));
                return;
              }

              const openBracketIndex = content.indexOf('{', insertionPoint);
              if (openBracketIndex === -1) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Malformed sprite-manifest.js' }));
                return;
              }

              const before = content.substring(0, openBracketIndex + 1);
              const after = content.substring(openBracketIndex + 1);
              const newline = `\n    '${spriteId}': '${spritePath}',`;
              const updatedContent = before + newline + after;

              fs.writeFileSync(manifestFile, updatedContent, 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to register sprite: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /api/load-game-data (Reconstruct workspace from data/, the plan laid back on: `gameData.js`) ---
        if (req.method === 'GET' && req.url === '/api/load-game-data') {
          try {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(loadGameData({ dataRoot, planRoot })));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to load game data: ' + err.message }));
          }
          return;
        }

        // --- POST /api/sync-game-data (one-way full-file write to data/: `gameData.js`'s writeSync, which the command line's sync runs too) ---
        if (req.method === 'POST' && req.url === '/api/sync-game-data') {
          readJson(req, (parsed) => {
            writeSync({
              files: parsed?.files,
              plan: parsed?.plan ?? null,
              confirmRemovals: parsed?.confirmRemovals === true,
              // A Sync built from a tab whose workspace revision is older than the disk's is refused.
              baseRevision: Number.isInteger(parsed?.baseRevision) ? parsed.baseRevision : null,
              workspaceFile,
              branchRule: 'refuse',
              dataRoot,
              planRoot,
              // ⚠️ Committed only when the folders are the project's own: a sandbox or test folder is outside its git.
              commit: dataDir || planDir ? null : { projectRoot },
              log: (line) => console.log(line),
            }).then(({ status, body }) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            }).catch((err) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to sync game data: ' + err.message }));
            });
          }, (err) => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to sync game data: ' + err.message }));
          });
          return;
        }

        next();
      });
    }
  };
}
