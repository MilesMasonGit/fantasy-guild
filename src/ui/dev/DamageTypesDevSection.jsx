// The QA panel's damage types section: one click sets up three fights showing Resisted, Weak! and a bow spending arrows.
// ⚠️ QA BUILDS ONLY: TestDashboard renders this behind `QA_TOOLS && …`.

import { useState } from 'react';
import { setUpDamageTypesScene } from './damageTypesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function DamageTypesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-damage-types">
            <div className={labelClass}>Damage types (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-damage-types-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpDamageTypesScene();
                        setStatus(r.ok
                            ? 'Below the Hall: Aela (Ember Wand, Fire) on a Fire Elemental (left), Bram (Frost Wand, Ice) on another (right), Cara (Spark Bow, 40 Bodkin Arrows) on a Rock Crab (middle). Rest the pointer on an enemy for its card; click the crossed-swords chip for the panel and its log'
                            : r.error);
                    }}
                >
                    Resisted, Weak! and a bow with arrows (test content, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
