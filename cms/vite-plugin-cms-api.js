import fs from 'fs';
import path from 'path';

export default function cmsFileApi() {
  const projectRoot = process.cwd().endsWith('cms') ? path.resolve(process.cwd(), '..') : process.cwd();
  return {
    name: 'cms-file-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];

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

        if (!url.startsWith('/api/backups') && 
            !url.startsWith('/api/save-recolored-asset') && 
            !url.startsWith('/api/custom-palettes') &&
            !url.startsWith('/api/palette-groups') &&
            !url.startsWith('/api/sprite-audit') &&
            !url.startsWith('/api/register-sprite') &&
            !url.startsWith('/api/sync-game-data') &&
            !url.startsWith('/data/palettes/')) {
          return next();
        }

        const backupsDir = path.resolve(process.cwd(), 'backups');
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
                  .sort((a, b) => b.time - a.time);

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
              const { filename, category, base64Image } = JSON.parse(body);
              if (!filename || !category || !base64Image) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing filename, category, or base64Image' }));
                return;
              }

              const cleanFilename = filename.replace(/[^a-z0-9_-]/gi, '_');
              
              let baseDir;
              if (category === 'items') {
                baseDir = path.resolve(projectRoot, 'public', 'assets', 'items');
              } else if (category === 'enemy') {
                baseDir = path.resolve(projectRoot, 'public', 'assets', 'enemies');
              } else {
                baseDir = path.resolve(projectRoot, 'public', 'assets', 'dataset', category);
              }

              const parts = cleanFilename.split('_');
              let targetDir = baseDir;
              if (parts.length > 1) {
                const subpath = parts.slice(0, -1).join('/');
                targetDir = path.join(baseDir, subpath);
              }

              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

              const filePath = path.join(targetDir, `${cleanFilename}.png`);

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
              res.end(JSON.stringify({ success: true, path: filePath }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save asset: ' + err.message }));
            }
          });
          return;
        }

        // --- GET /api/custom-palettes (Load custom palettes) ---
        if (req.method === 'GET' && req.url === '/api/custom-palettes') {
          const palettesPath = path.resolve(projectRoot, 'data', 'palettes', 'custom_palettes.json');
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
              const palettesPath = path.resolve(projectRoot, 'data', 'palettes', 'custom_palettes.json');
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
          const groupsPath = path.resolve(projectRoot, 'data', 'palettes', 'palette_groups.json');
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
              const groupsPath = path.resolve(projectRoot, 'data', 'palettes', 'palette_groups.json');
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
          const filePath = path.resolve(projectRoot, 'data', 'palettes', filename);
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

                if (!ref) return null;
                if (typeof ref === 'string' && ref.startsWith('assets/')) {
                  return ref;
                }
                if (spriteManifest[ref]) {
                  return spriteManifest[ref];
                }
                // Check prefix fallbacks matching AssetManager.js
                if (typeof ref === 'string') {
                  let folder = '';
                  if (ref.startsWith('ore_')) folder = 'mining/ore/';
                  else if (ref.startsWith('ingot_')) folder = 'mining/ingot/';
                  else if (ref.startsWith('battleaxe_')) folder = 'equipment/battleaxe/';
                  else if (ref.startsWith('longsword_')) folder = 'equipment/longsword/';
                  else if (ref.startsWith('staff_')) folder = 'equipment/staff/';
                  else if (ref.startsWith('key_')) folder = 'crime/key/';
                  else if (ref.startsWith('drink_')) folder = 'drink/';
                  else if (ref.startsWith('wood_')) folder = 'wood/';
                  if (folder) {
                    return `assets/sprites/implemented/items/${folder}${ref}.png`;
                  }

                  if (ref.startsWith('bg_') || ref.startsWith('scene_')) {
                    if (ref.includes('.')) {
                      const baseId = ref.split('.')[0];
                      if (spriteManifest[baseId]) return spriteManifest[baseId];
                      return `assets/sprites/implemented/biomes/${ref}`;
                    }
                    return `assets/sprites/implemented/biomes/${ref}.png`;
                  }
                }
                return null;
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

        // --- POST /api/sync-game-data (Sync files directly to project data folder) ---
        if (req.method === 'POST' && req.url === '/api/sync-game-data') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { files } = JSON.parse(body);
              if (!files || typeof files !== 'object') {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing or invalid files payload' }));
                return;
              }

              for (const [relPath, content] of Object.entries(files)) {
                // Prevent path traversal attacks
                if (relPath.includes('..') || path.isAbsolute(relPath)) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid relative path: ' + relPath }));
                  return;
                }

                const absolutePath = path.resolve(projectRoot, 'data', relPath);
                const dir = path.dirname(absolutePath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }

                const strContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                fs.writeFileSync(absolutePath, strContent, 'utf8');
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to sync game data: ' + err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}
