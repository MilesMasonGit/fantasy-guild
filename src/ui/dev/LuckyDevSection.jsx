// The QA panel's Lucky section: one click lays out two veins and an enemy with rare drop tables, raised by a Lucky building and a Lucky Hall star.
// ⚠️ QA BUILDS ONLY: TestDashboard renders this behind `QA_TOOLS && …`.

import { useEffect, useState } from 'react';
import { setUpLuckyScene, luckyReadout } from './luckyDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function LuckyDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(luckyReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-lucky">
            <div className={labelClass}>Lucky: rare drop tables raised by a building and a Hall star (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-lucky-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpLuckyScene();
                        setStatus(r.ok
                            ? 'Lower row: a Lucky Vein beside a Lucky Charm (its 5 % rare table raised to 50 %), a second vein the QA Lucky Finds star reaches (10 % raised to 20 %), and a QA Lucky Goblin the star reaches too (25 % raised to 50 %). A miner works each vein and a fighter takes on the Goblin. A rare find (Quartz or Gold Ore) lands beside the Token like any loot; it is marked for the rare twinkle, which is switched off for now. Hover a vein or the Goblin for its rare finds and their chances; hover the Charm and the star for their rule text.'
                            : r.error);
                    }}
                >
                    Rare tables raised by a Lucky building and star (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-lucky-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}
