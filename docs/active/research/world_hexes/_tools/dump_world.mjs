// Throwaway (brief 380 M1): open a new game on the M1 dev server in a headless Chrome, and dump the
// world with every cell's real mat (its ground picture and its Tokens) as the settled Region would
// be written, into `world.json` and `ground/<cell>.png` beside this script.
// node dump_world.mjs [url]
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [url = 'http://localhost:5403'] = process.argv.slice(2);
mkdirSync(path.join(here, 'ground'), { recursive: true });

const chrome = await launchChrome({ width: 1600, height: 1000 });
try {
    const page = await chrome.newPage();
    await page.setViewport(1600, 1000);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (b) b.click(); return !!b; })()`);
    await page.waitFor('!!(window.Game.World && window.Game.World.currentWorld())');
    await sleep(4000);
    const out = await page.evaluate(`(async () => {
        const imp = (p) => import(p);
        const World = window.Game.World;
        const { worldTables } = await imp('/src/config/registries/worldTablesRegistry.js');
        const { recipesOfCell } = await imp('/src/systems/world/cellRegion.js');
        const { getTokenType } = await imp('/src/config/registries/tokenRegistry.js');
        const { getItem } = await imp('/src/config/registries/itemRegistry.js');
        const { resolveSpritePath } = await imp('/src/utils/AssetManager.js');
        const Cart = await imp('/src/systems/atlas/Cartography.js');
        const { regionGround } = await imp('/src/systems/atlas/regionGround.js');
        const { buildGroundPlan } = await imp('/src/systems/board/TerrainSurface.js');
        const GS = await imp('/src/ui/components/board/groundScreen.js');
        const Sheets = await imp('/src/ui/components/board/groundSheets.js');
        const { sheetPath, propSheetPath } = await imp('/src/config/registries/terrainRegistry.js');
        const { matW, matH } = await imp('/src/config/matGeometry.js');
        const { boardScaleAt } = await imp('/src/ui/components/base/TokenSprite.jsx');
        await Sheets.loadGroundSheets();
        const world = World.currentWorld();
        const tables = worldTables();
        const hall = world.cells.find(c => c.ring === 0);
        const skillOf = (id) => getTokenType(id)?.config?.skill || null;
        const mat = { w: matW(), h: matH() };
        const pixel = GS.groundPixel();
        const unit = pixel * boardScaleAt(1);
        const grid = GS.screenGrid(mat, unit);
        const sprite = (e) => { try { return resolveSpritePath(e); } catch { return null; } };
        const cells = [];
        const times = [];
        for (const cell of world.cells) {
            const t0 = performance.now();
            let ground = null, nodes = [], biome = null;
            if (cell.ring === 0) {
                const region = window.Game.Atlas.activeRegion();
                ground = regionGround(region, mat);
                nodes = window.Game.BoardState.tokens().map(t => ({ typeId: t.typeId, role: 'node', x: t.x, y: t.y }));
            } else {
                const { recipes } = recipesOfCell(cell, { tables, skillOf, hallOrigins: (hall.origins || []).map(o => o.id), name: '' });
                const plan = Cart.preview(recipes, { seed: cell.seed >>> 0 });
                ground = regionGround({ seed: plan.seed, ground: plan.summary.ground, terrain: plan.layout.terrain }, mat);
                nodes = plan.layout.nodes.map(n => ({ typeId: n.typeId, role: n.role, x: n.x, y: n.y }));
                biome = plan.summary.ground?.main || null;
            }
            const t1 = performance.now();
            const gplan = buildGroundPlan(ground);
            const canvas = document.createElement('canvas');
            canvas.width = grid.cols; canvas.height = grid.rows;
            const ctx = canvas.getContext('2d');
            const image = ctx.createImageData(grid.cols, grid.rows);
            GS.buildScreenPass(gplan, { mat, unit: grid.unit, pixel, sheet: (id) => Sheets.mutedSheet(sheetPath(id)),
                prop: (id, drawn) => drawn ? Sheets.drawnSheet(propSheetPath(id)) : Sheets.mutedSheet(propSheetPath(id)), out: image.data });
            ctx.putImageData(image, 0, 0);
            const t2 = performance.now();
            times.push({ id: cell.id, layout: t1 - t0, ground: t2 - t1 });
            cells.push({
                id: cell.id, q: cell.q, r: cell.r, ring: cell.ring, wild: cell.wild, kit: cell.kit, wedge: cell.wedge,
                specialty: cell.specialty, name: World.cellName(cell, tables),
                outputs: World.outputsOf(cell).map(id => ({ id, name: getItem(id)?.name || id, sprite: sprite(getItem(id)) })),
                biome,
                nodes: nodes.map(n => ({ ...n, sprite: sprite(getTokenType(n.typeId)) })),
                png: canvas.toDataURL('image/png')
            });
        }
        return JSON.stringify({ seed: world.seed, rings: world.rings, mat, groundCols: grid.cols, groundRows: grid.rows, groundUnit: grid.unit,
            kits: tables.kits.map(k => ({ id: k.id, name: k.name })), lines: (tables.lines || []).map(l => ({ id: l.id, name: l.name })), cells, times });
    })()`, { timeoutMs: 600000 });
    const data = JSON.parse(out);
    for (const c of data.cells) {
        writeFileSync(path.join(here, 'ground', `${c.id.replace(',', '_')}.png`), Buffer.from(c.png.split(',')[1], 'base64'));
        delete c.png;
    }
    writeFileSync(path.join(here, 'world.json'), JSON.stringify(data, null, 1));
    const sum = (k) => data.times.reduce((s, t) => s + t[k], 0);
    console.log(`${data.cells.length} cells, rings ${data.rings}; layout ${sum('layout').toFixed(0)} ms, ground ${sum('ground').toFixed(0)} ms; mat ${data.mat.w}x${data.mat.h}, ground picture ${data.groundCols}x${data.groundRows}`);
} finally {
    await chrome.close();
}
