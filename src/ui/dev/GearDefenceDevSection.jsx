// The QA panel's gear and defence section: one click sets up four fights showing armour and a shield resisting, a style's damage cut, Venom and Sunder.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpGearDefenceScene } from './gearDefenceDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function GearDefenceDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-gear-defence">
            <div className={labelClass}>Gear and defence (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-gear-defence-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpGearDefenceScene();
                        setStatus(r.ok
                            ? 'Below the Hall, left to right: Dara (sword, Plate Chestplate, Kite Shield) on a Venomous Rat; Eli (Frost Wand, no armour) and Fen (the same wand in the Plate Chestplate) on Training Dummies; Gus (Sundering Spear) on a Rock Crab. Click a crossed-swords chip for the panel and its log; rest the pointer on the chestplate or the shield in a hero\'s loadout for the tooltip'
                            : r.error);
                    }}
                >
                    Armour, a shield, a damage cut, Venom and Sunder (test content, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
