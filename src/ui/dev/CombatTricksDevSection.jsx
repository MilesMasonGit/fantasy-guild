// The QA panel's Combat tricks section: the signature perk tricks' eye-check scenes (brief 800 P5).
// ⚠️ QA BUILDS ONLY, and temporary: TestDashboard renders this behind `QA_TOOLS && …`; deleted with
// `combatTricksScene.js` once the tricks are looked at.

import { useState } from 'react';
import {
    setUpSecondWindScene, setUpUnbreakableScene, setUpTwinShotScene, setUpDoubleCastScene, setUpShadowstepScene
} from './combatTricksScene.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

const SCENES = [
    { id: 'secondWind', label: 'Second Wind', run: setUpSecondWindScene, said: 'A QA Brawler at half health at a QA Weak Camp: each kill heals 3 (the fight log says Test Second Wind)' },
    { id: 'unbreakable', label: 'Unbreakable', run: setUpUnbreakableScene, said: 'A QA hero with 10 health at a QA Brute: the first defeating blow leaves them at 1, the next defeats them' },
    { id: 'twinShot', label: 'Twin Shot', run: setUpTwinShotScene, said: 'A QA Twin Archer with 6 Test Arrows: every shot hits twice, twelve attacks for six arrows' },
    { id: 'doubleCast', label: 'Double Cast', run: setUpDoubleCastScene, said: 'A QA Double Mage with 4 Test Fire Motes: every cast twice, one Mote each' },
    { id: 'shadowstep', label: 'Shadowstep', run: setUpShadowstepScene, said: 'A QA Shadow at a QA Clumsy Dummy: after each miss on them, their next hit is a crit' }
];

export function CombatTricksDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-combat-tricks">
            <div className={labelClass}>Combat tricks</div>
            <div className="grid grid-cols-2 gap-1">
                {SCENES.map(s => (
                    <button
                        key={s.id}
                        type="button"
                        data-qa-trick-scene={s.id}
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
            {status && <div className="ui-text-body text-gi-muted" data-qa-trick-status>{status}</div>}
        </div>
    );
}
