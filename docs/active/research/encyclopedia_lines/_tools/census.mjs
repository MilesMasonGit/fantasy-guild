// Throwaway (brief 470 E1): every kind of relationship the encyclopedia's chart draws, counted over the
// whole book with an example each, from the real game's content. node census.mjs > census.json
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const chrome = await launchChrome({ width: 1280, height: 800, headless: true });
try {
    const page = await chrome.newPage();
    await page.navigate('http://localhost:5409/');
    await page.waitFor(`!!document.querySelector('[data-save-slot="1"] button')`, { timeoutMs: 180000, intervalMs: 500, what: 'the slot picker' });
    const out = await page.evaluate(`(async () => {
        const M = await import('/src/ui/components/encyclopedia/encyclopediaModel.js');
        const C = await import('/src/ui/components/encyclopedia/encyclopediaChart.js');
        const book = M.encyclopedia();
        const tally = {};
        const note = (side, role, how, a, b) => {
            const k = side + ' | ' + role + ' | ' + how;
            const t = tally[k] || (tally[k] = { n: 0, ex: [] });
            t.n++;
            if (t.ex.length < 4) t.ex.push(book.nameOf(a) + ' -> ' + book.nameOf(b));
        };
        for (const e of book.entries.values()) {
            for (const w of C.waysIn(book, e.key)) {
                if (w.from) note('left', 'from', w.how, w.from, e.key);
                for (const i of w.inputs) note('left', 'input', w.how, i.key, e.key);
                if (!w.from && !w.inputs.length) note('left', 'caption:' + w.caption, w.how, e.key, e.key);
                if (w.through) note('left', 'folded-stage', w.how + (w.regrow ? '/regrow' : ''), w.through[0], e.key);
            }
            for (const w of C.waysOut(book, e.key)) note('right', w.gives ? 'gives' : 'used', w.how, e.key, w.to);
        }
        return tally;
    })()`);
    console.log(JSON.stringify(out, null, 1));
} finally {
    await chrome.close();
}
