// The Compass in the Hall's sky: dragged into view, every title checked for touching, and a close look.
export async function run({ page, ev, shot, say, sleep }) {
    await ev(`[...document.querySelectorAll('button')].find(b => /new game/i.test(b.textContent)).click()`);
    await page.waitFor('!!window.Game.World.currentWorld()', { timeoutMs: 60000 });
    await sleep(2500);
    if (!(await ev('window.Game.HeroManager.getAllHeroes().length'))) await ev(`window.Game.GuildUpgradeManager.purchase('roster_size')`);
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA').click()`);
    await sleep(800);
    await ev(`document.querySelector('[data-qa-world-ring-stars]').click()`);
    await sleep(300);
    // Light the ring-2 star so its line shows bright, the rest as they are.
    await ev(`window.Game.InventoryManager.addItem('item_cherry', 1700)`);
    say('bought ring 2', await ev(`window.Game.GuildUpgradeManager.purchase('star_ring_2')`));
    await ev(`document.querySelector('[data-testid="qa-panel"] [data-close-x]')?.click()`);
    await sleep(500);
    const c = await ev(`(() => { const r = document.querySelector('#guild-bubble-target').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await page.click(Math.round(c.x), Math.round(c.y));
    await page.waitFor(`!!document.querySelector('[data-hall-node="star_ring_6"]')`, { timeoutMs: 20000 });
    await sleep(1500);
    // Drag the sky right so the Compass comes into the middle.
    const from = { x: 560, y: 830 };
    await page.mouse('mouseMoved', from.x, from.y);
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 30; i++) {
        await page.mouse('mouseMoved', from.x + i * 40, from.y - i * 2, { buttons: 1 });
        await sleep(30);
    }
    await page.mouse('mouseReleased', from.x + 1200, from.y - 60, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(800);
    const where = await ev(`(() => { const out = {}; for (const b of document.querySelectorAll('[data-hall-node^="star_ring_"]')) { const r = b.getBoundingClientRect(); out[b.getAttribute('data-hall-node')] = [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), b.getAttribute('data-node-state')]; } const l = document.querySelector('[data-constellation="compass"]'); const lr = l?.getBoundingClientRect(); out.label = lr ? [Math.round(lr.left), Math.round(lr.top), l.textContent] : null; return out; })()`);
    say('after the drag', where);
    const overlaps = await ev(`(() => {
        const boxes = [];
        for (const b of document.querySelectorAll('[data-hall-node]')) { const r = b.querySelector('img').getBoundingClientRect(); boxes.push({ what: 'star ' + b.getAttribute('data-hall-node'), r }); }
        for (const t of document.querySelectorAll('[data-star-tag] > span')) { const r = t.getBoundingClientRect(); boxes.push({ what: 'title ' + t.firstChild.textContent, r }); }
        for (const l of document.querySelectorAll('[data-constellation]')) { const r = l.getBoundingClientRect(); if (r.width) boxes.push({ what: 'name ' + l.textContent, r }); }
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const out = [];
        let nearest = Infinity, pair = null;
        const ring = boxes.filter(b => /star_ring_|Charted|Far Hor|The Wilds|Untamed|World's Edge|The Compass/.test(b.what));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            if (hit(boxes[i].r, boxes[j].r) && !(boxes[i].what.startsWith('star') && boxes[j].what.startsWith('title') && boxes[i].what.slice(5) === boxes[j].what.slice(6))) out.push(boxes[i].what + ' x ' + boxes[j].what);
        }
        for (const a of ring) for (const b of boxes) {
            if (a === b || ring.includes(b)) continue;
            const dx = Math.max(0, Math.max(a.r.left, b.r.left) - Math.min(a.r.right, b.r.right));
            const dy = Math.max(0, Math.max(a.r.top, b.r.top) - Math.min(a.r.bottom, b.r.bottom));
            const d = Math.hypot(dx, dy);
            if (d < nearest) { nearest = d; pair = a.what + ' / ' + b.what; }
        }
        return { boxes: boxes.length, touching: out, nearestToARingThing: [Math.round(nearest), pair] };
    })()`);
    say('sky check', overlaps);
    await shot('09_hall_compass', true);
}
