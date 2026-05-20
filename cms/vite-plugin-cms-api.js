import fs from 'fs';
import path from 'path';

export default function cmsFileApi() {
  return {
    name: 'cms-file-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only intercept /api/backups routes
        if (!req.url.startsWith('/api/backups')) {
          return next();
        }

        const backupsDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
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

        next();
      });
    }
  };
}
