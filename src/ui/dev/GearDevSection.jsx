// The QA panel's gear section: a full Bank and an older save's shared tool, one click each.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { devFillBank, devShareOneTool } from './gearDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function GearDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-gear">
            <div className={labelClass}>Gear: one item, one hero (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-fill-bank
                    className={buttonClass}
                    onClick={() => setStatus(`Filled ${devFillBank()} Bank slots`)}
                >
                    Fill the Bank
                </button>
                <button
                    type="button"
                    data-qa-share-tool
                    className={buttonClass}
                    onClick={() => {
                        const r = devShareOneTool();
                        if (!r.ok) setStatus(r.error);
                    }}
                >
                    Old save: heroes share one tool (rewrites this slot)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default GearDevSection;
