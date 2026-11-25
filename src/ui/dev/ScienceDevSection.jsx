// The QA panel's Science section: the Laboratory eye-check scene (brief 810 K6).
// ⚠️ QA BUILDS ONLY, and temporary: TestDashboard renders this behind `QA_TOOLS && …`; deleted with
// `scienceScene.js` once the Science eye-check is accepted.

import { useState } from 'react';
import { setUpScienceScene } from './scienceScene.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function ScienceDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-science">
            <div className={labelClass}>Science</div>
            <button
                type="button"
                data-qa-science-scene
                className={buttonClass}
                onClick={() => {
                    const r = setUpScienceScene();
                    setStatus(r.ok
                        ? 'A QA Laboratory with a QA Scientist on it and a QA University beside it, two QA Oaks in reach and one far off. Click the Laboratory\'s gear and pick an Oak'
                        : r.error);
                }}
            >
                Laboratory scene: study an Oak
            </button>
            {status && <div className="ui-text-body text-gi-muted" data-qa-science-status>{status}</div>}
        </div>
    );
}
