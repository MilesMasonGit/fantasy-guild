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
                            ? `Placed: ${r.placed.join(', ') || 'nothing new'}. Round the Hall: a Logging Camp with three Oak Trees (top left), a Mining Camp with two Copper Veins (top right), a Fishing Hut by a River (above the Hall), a Farmstead with two ripe Wild Wheat Patches (below the Hall). Their hands wait at the Hall, tools in hand: drag one onto a camp, or Send them. Hover a camp for its reach.${note}`
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
                            ? `${r.name} is sent to ${r.placed ? 'a new Goblin Camp above the Hall' : 'the Goblin Camp already on the mat'}. They fight its goblins one at a time, wait for the next (about 30 s after the camp has room), and fight that one too.`
                            : r.error);
                    }}
                >
                    Hunt at the Goblin Camp (a hunter sent to the camp)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-camps-status>{status}</div>}
        </div>
    );
}
