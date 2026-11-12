// The QA panel's Effect badges section: one click lays out test Tokens whose cards show every kind of badge.
// ⚠️ QA BUILDS ONLY: TestDashboard renders this behind `QA_TOOLS && …`.

import { useState } from 'react';
import { setUpBadgeScene } from './badgesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function BadgesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-badges">
            <div className={labelClass}>Effect badges on the Token card (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-badge-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpBadgeScene();
                        setStatus(r.ok
                            ? 'Middle row, left to right. QA Badge Furnace beside the QA Badge Forge, with the QA Badge Training star and a smith in the QA Quick Cap: its card shows Speed (three sources and the cap), XP, Preservation, Refresh, Lucky and the smith\'s Hero Effects badge; Double Item on the ingot, Efficiency on the ore (9 a cycle, not 10), and a Rare finds group to click open. QA Badge Mine beside the QA Badge Rush: Speed held at the limit, in gold. QA Badge Goblin beside the QA Loot Banner: Double Loot and XP, Double Item on its Bones. The smith also carries arrows, bread and a quiver: open their Hero drawer and hover the Preservation chip on the arrows and the bread. Click a Token for its card and hover the badges; the Forge\'s card still lists what it Boosts.'
                            : r.error);
                    }}
                >
                    Badge scene: a Furnace, a Mine held at the limit and a Goblin (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
