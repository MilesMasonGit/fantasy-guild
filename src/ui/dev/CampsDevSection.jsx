// The QA panel's camps section (brief 260 O2): the four camps of the change pack as test Tokens,
// with work in each reach and a hand for each, and a hunting scene at a Goblin Camp.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { placeCamps, sendCampHands, huntAtGoblinCamp } from './campsDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function CampsDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-camps">
            <div className={labelClass}>Camps (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-camps-place
                    className={buttonClass}
                    onClick={() => {
                        const r = placeCamps();
                        const note = r.short?.length ? ` Short of room: ${r.short.join(', ')}.` : '';
                        setStatus(r.ok
                            ? `Placed: ${r.placed.join(', ') || 'nothing new'}. Round the Hall: a Logging Camp with three Oak Trees, a Mining Camp with two Copper Veins, a Fishing Hut by a River, a Farmstead with two ripe Wild Wheat Patches. Their hands wait at the Hall, tools in hand: drag one onto a camp, or Send them. Hover a camp for its reach.${note}`
                            : r.error);
                    }}
                >
                    Place the four camps, with work and hands (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-camps-send
                    className={buttonClass}
                    onClick={() => {
                        const r = sendCampHands();
                        setStatus(r.ok ? `${r.sent} hand(s) sent to their camps` : r.error);
                    }}
                >
                    Send the hands to their camps
                </button>
                <button
                    type="button"
                    data-qa-camps-hunt
                    className={buttonClass}
                    onClick={() => {
                        const r = huntAtGoblinCamp();
                        setStatus(r.ok
                            ? `Below the Hall: a Goblin Camp with a goblin standing; ${r.name} is sent to the camp. They fight it, wait for the next goblin (about 30 s), and fight that one too.`
                            : r.error);
                    }}
                >
                    Hunt at a Goblin Camp (a hunter sent to the camp)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-camps-status>{status}</div>}
        </div>
    );
}
