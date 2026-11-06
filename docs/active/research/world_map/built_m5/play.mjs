// Drives the m5 dev server in headless Chrome. Usage: node play.mjs <stage> (scenario_<stage>.mjs)
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/m5';
const { launchChrome, sleep } = await import(pathToFileURL(`${WT}/bench/browser/cdp.mjs`).href);
const OUT = path.join(WT, 'docs/active/research/world_map/built_m5');
const SHOTS = 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'http://localhost:5295/';
const stage = process.argv[2] || 'main';

const chrome = await launchChrome({ width: 1600, height: 1000 });
const log = [];
const say = (...a) => { const line = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); log.push(line); console.log(line); };
try {
    const page = await chrome.newPage();
    const shot = async (name, keep = false) => {
        const { data } = await page.send('Page.captureScreenshot', { format: 'png' }, 60000);
        const file = path.join(keep ? OUT : SHOTS, `${name}.png`);
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        say('shot', path.basename(file));
    };
    const ev = (expr, opts) => page.evaluate(expr, opts);
    if (stage.includes('still')) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.navigate(URL);
    await page.waitFor('!!window.Game && !!window.Game.SaveManager', { timeoutMs: 180000 });
    await sleep(1500);
    const scenario = await import(pathToFileURL(path.resolve(`scenario_${stage.replace(/_still$/, '')}.mjs`)).href);
    await scenario.run({ page, ev, shot, say, sleep, stage });
    say('console errors', page.consoleErrors);
} catch (err) {
    say('ERROR', err.stack || String(err));
} finally {
    fs.writeFileSync(path.join(OUT, `play_${stage}.txt`), log.join('\n') + '\n');
    const closed = await chrome.close();
    console.log('chrome closed', JSON.stringify(closed));
}
