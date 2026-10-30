// The QA panel's milestone perks section: a hero one log short of Forestry 10, and a forester at 30
// arriving by a load.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpForestryTen, loadForesterAtThirty } from './perksDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

const standInNote = (standIns) => (standIns
    ? ' Forestry has no authored perks yet, so QA stand-ins are in (Clean Felling at 10, as in the example pack, and a QA perk at 25), gone on reload.'
    : '');

export function PerksDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-perks">
            <div className={labelClass}>Milestone perks (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-perks-ten
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpForestryTen();
                        setStatus(r.ok
                            ? `Right of the Hall: an Oak Tree. ${r.name} (Forestry 9, one XP short of 10) is sent to fell it: the first log lifts them to 10, and the number over their head and their hero bar alert name the perk (${r.perk}). Open their sheet and hover or click the Forestry row.${standInNote(r.standIns)}`
                            : r.error);
                    }}
                >
                    Hero reaches Forestry 10
                </button>
                <button
                    type="button"
                    data-qa-perks-load
                    className={buttonClass}
                    onClick={async () => {
                        setStatus('Loading…');
                        const r = await loadForesterAtThirty();
                        setStatus(r.ok
                            ? `Saved and loaded with QA Old Forester at Forestry 30: their sheet's Forestry row lists every perk up to 30, held from the level, with no alert.${standInNote(r.standIns)}`
                            : r.error);
                    }}
                >
                    Load a forester at Forestry 30 (saves this slot)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default PerksDevSection;
