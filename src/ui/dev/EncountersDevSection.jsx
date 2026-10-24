// The QA panel's encounters section: one click sets up a guarded vein, an ambush node and a boss lair.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpEncountersScene } from './encountersDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function EncountersDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-encounters">
            <div className={labelClass}>Encounters (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-encounters-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpEncountersScene();
                        setStatus(r.ok
                            ? 'Below the Hall: a guarded vein (left), a goblin-haunted vein (middle), a boss den (right), four Fighters flagged; 2 Summoning Horns in the Bank (Shop → Summons)'
                            : r.error);
                    }}
                >
                    Guardian, ambush, boss lair and summon (test content, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default EncountersDevSection;
