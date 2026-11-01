import fs from 'fs';
import { engine, dataWorkspace, plannedWorkspace } from './lib.mjs';
const { server, load } = await engine();
try {
    fs.writeFileSync('ws_data.json', JSON.stringify(await dataWorkspace(load)));
    fs.writeFileSync('ws_planned.json', JSON.stringify((await plannedWorkspace(load)).workspace));
} finally { await server.close(); }
