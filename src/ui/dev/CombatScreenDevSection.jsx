// The QA panel's combat screen section: one click sets up two fights and an enemy nobody has fought; one plays time away.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpCombatScreenScene, playTimeAway } from './combatScreenDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function CombatScreenDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-combat-screen">
            <div className={labelClass}>Combat screen (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-combat-screen-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpCombatScreenScene();
                        setStatus(r.ok
                            ? 'Below the Hall: Aela on a Goblin Warlord (left), Bram on a Cow (right), a Goblin Scout nobody has fought (middle). Click the crossed-swords chip by a fight to open its panel'
                            : r.error);
                    }}
                >
                    Two fights and a new enemy (test content, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-combat-screen-away
                    className={buttonClass}
                    onClick={async () => {
                        setStatus('Playing 20 minutes away…');
                        const r = await playTimeAway();
                        setStatus(r.ok ? 'Played 20 minutes away: "While you were away" shows the fights block' : r.error);
                    }}
                >
                    Play 20 minutes away (not saved)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default CombatScreenDevSection;
