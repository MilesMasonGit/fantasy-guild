// The QA panel's Combat styles section: the ammo, crit cap and poison eye-check scenes (brief 750).
// ⚠️ QA BUILDS ONLY, and temporary: TestDashboard renders this behind `QA_TOOLS && …`; deleted with
// `combatStylesScene.js` once the combat styles eye-check is accepted.

import { useState } from 'react';
import { setUpArcherScene, setUpMageScene, setUpKunaiScene, setUpCritScene, setUpPoisonScene } from './combatStylesScene.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

const SCENES = [
    { id: 'archer3', label: 'Archer, 3 arrows', run: () => setUpArcherScene(3), said: 'A QA Archer with a Test Bow and 3 Test Arrows at a QA Training Dummy: three shots, then they stop and say Needs Test Arrow' },
    { id: 'archer0', label: 'Archer, no arrows', run: () => setUpArcherScene(0), said: 'A QA Archer with a Test Bow and no Test Arrows: no fight, Needs Test Arrow' },
    { id: 'mage', label: 'Mage, 3 Motes', run: setUpMageScene, said: 'A QA Mage with a Test Ember Wand and 3 Test Fire Motes: three casts, then half damage and Needs Test Fire Mote' },
    { id: 'kunai', label: 'Kunai, none spare', run: setUpKunaiScene, said: 'A QA Kunai Thrower with one Test Kunai and none in the Bank: half damage, Needs Test Kunai' },
    { id: 'crit', label: 'Crit at the cap', run: setUpCritScene, said: 'A QA Lucky Fighter at 75% crit chance: about three hits in four crit, each double' },
    { id: 'poison', label: 'Poison: dagger and sword', run: setUpPoisonScene, said: 'A QA Poisoner (dagger) and a QA Swordsman each carrying Test Venom, 3 in the Bank: only the dagger hero takes one, for 5 attacks' }
];

export function CombatStylesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-combat-styles">
            <div className={labelClass}>Combat styles</div>
            <div className="grid grid-cols-2 gap-1">
                {SCENES.map(s => (
                    <button
                        key={s.id}
                        type="button"
                        data-qa-combat-scene={s.id}
                        className={buttonClass}
                        onClick={() => {
                            const r = s.run();
                            setStatus(r.ok ? s.said : r.error);
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-combat-status>{status}</div>}
        </div>
    );
}
