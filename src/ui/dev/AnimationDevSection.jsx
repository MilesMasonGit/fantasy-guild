// The QA panel's Animation section: one button per mat effect, so each can be looked at on demand.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { enemies, worked, everyToken, some, playOn, neighbours, dropLootFrom, dropRareFrom } from './animationDev.js';
import { floatNumber, spark, knockoutGhost, KNOCKOUT_MS } from '../components/board/fx/matFx.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors text-left';

/** Each button: what it plays, and on which Tokens. */
const EFFECTS = [
    { id: 'hit', label: 'Hit: white flash, knockback, afterimages (enemies)', run: () => playOn(some(enemies(), 3), { fx: 'hit', dir: 1 }) },
    {
        id: 'damage', label: 'Damage number (enemies)',
        run: () => some(enemies(), 3).filter(t => floatNumber(t.id, 7 + (t.id.length % 9), 'damage')).length
    },
    {
        id: 'knockout', label: 'Knockout: blink, drop, dissolve, puff (an enemy)',
        run: () => some(enemies(), 1).filter(t => {
            playOn([t], { fx: 'hide', ms: KNOCKOUT_MS });
            return knockoutGhost(t.id);
        }).length
    },
    { id: 'loot', label: 'Loot hop, ground shadow, afterimages (adds 3 loot)', run: () => dropLootFrom(some(everyToken(), 3)).length },
    { id: 'rare', label: 'Rare find: gold flash and star (adds 2 loot)', run: () => dropRareFrom(some(everyToken(), 2)).length },
    { id: 'cycle', label: 'Cycle finished: outline blinks white (worked Tokens)', run: () => playOn(some(worked(), 4), { fx: 'cycle' }) },
    { id: 'transform', label: 'Transform: white outline, 3 frames (3 Tokens)', run: () => playOn(some(everyToken(), 3), { fx: 'transform' }) },
    { id: 'echo', label: 'Rule fired: echo ring (3 Tokens)', run: () => playOn(some(everyToken(), 3), { fx: 'echo' }) },
    {
        id: 'rule', label: 'Neighbour bonus: spark, +1, echo (3 pairs)',
        run: () => neighbours(3).filter(([a, b]) => {
            spark(a.id, b.id);
            floatNumber(b.id, '+1', 'gain', { delay: 300 });
            setTimeout(() => playOn([b], { fx: 'echo' }), 300);
            return true;
        }).length
    }
];

export function AnimationDevSection() {
    const [status, setStatus] = useState('');
    const run = (e) => {
        const n = e.run();
        setStatus(n ? `${e.label}: played on ${n}` : `${e.label}: nothing on the mat to play it on`);
    };
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-1" data-testid="qa-animation">
            <div className={labelClass}>Animation (dev only)</div>
            {EFFECTS.map(e => (
                <button key={e.id} type="button" data-qa-fx={e.id} className={`${buttonClass} w-full`} onClick={() => run(e)}>{e.label}</button>
            ))}
            {status && <div className="ui-text-body text-gi-muted" data-qa-fx-status>{status}</div>}
        </div>
    );
}

export default AnimationDevSection;
