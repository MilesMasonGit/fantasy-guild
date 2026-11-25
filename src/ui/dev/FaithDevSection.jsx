// The QA panel's Faith section: the shrine eye-check scene (brief 810 K3).
// ⚠️ QA BUILDS ONLY, and temporary: TestDashboard renders this behind `QA_TOOLS && …`; deleted with
// `faithScene.js` once the shrine eye-check is accepted.

import { useState } from 'react';
import { setUpFaithScene, QA_FAITH_WOOD } from './faithScene.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function FaithDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-faith">
            <div className={labelClass}>Faith</div>
            <button
                type="button"
                data-qa-faith-scene
                className={buttonClass}
                onClick={() => {
                    const r = setUpFaithScene();
                    setStatus(r.ok
                        ? `A QA Shrine with its priest, and a vein with its miner; ${QA_FAITH_WOOD} more Oak Wood in the Bank to offer. Once the Bank has none, it fades`
                        : r.error);
                }}
            >
                Shrine scene: lit, then fading
            </button>
            {status && <div className="ui-text-body text-gi-muted" data-qa-faith-status>{status}</div>}
        </div>
    );
}
