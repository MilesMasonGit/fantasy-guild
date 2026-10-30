// The QA panel's Bank section: Bank Tabs ranks, a Bank of every kind, an older save, one click each.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { devSetBankTabs, devBankEveryKind, devOldBankSlotsSave } from './bankDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function BankDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-bank">
            <div className={labelClass}>Bank tabs (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-bank-tabs-2
                    className={buttonClass}
                    onClick={() => { devSetBankTabs(2); setStatus('Bank Tabs rank 2: three tabs of 64'); }}
                >
                    Bank Tabs rank 2
                </button>
                <button
                    type="button"
                    data-qa-bank-every-kind
                    className={buttonClass}
                    onClick={() => {
                        const { added, left } = devBankEveryKind();
                        setStatus(left ? `Added ${added} kinds; ${left} found no slot` : `Added ${added} kinds`);
                    }}
                >
                    One of every item
                </button>
                <button
                    type="button"
                    data-qa-bank-old-slots
                    className={buttonClass}
                    onClick={() => {
                        const r = devOldBankSlotsSave();
                        if (!r.ok) setStatus(r.error);
                    }}
                >
                    Old save: Bank Slots ranks, every item in tab 1 (rewrites this slot)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default BankDevSection;
