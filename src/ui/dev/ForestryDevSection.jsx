// The QA panel's Forestry section (brief 230 S2a): one click lays out a Forest that plants and regrows, a forester waiting on a Stump, a wild Stump with no Forest, and a Stump stopped for want of its seedling.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpForestryScene, giveBirchSeedling, forestryReadout } from './forestryDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function ForestryDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(forestryReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-forestry">
            <div className={labelClass}>Forestry: Stumps, Forests and seedlings (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-forestry-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpForestryScene();
                        setStatus(r.ok
                            ? 'Upper right: a QA Oak Forest with two Oaks and a Forester (felled Oaks become Stumps, pay a seedling, grow back; the Forest plants a third tree). Far right: a wild Stump with no Forest (yellow mark; Demolish on its inspection) and a Birch Stump that stops for want of a Birch Seedling'
                            : r.error);
                    }}
                >
                    Forest, Stumps and seedlings (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-forestry-birch-seedling
                    className={buttonClass}
                    onClick={() => {
                        giveBirchSeedling();
                        setStatus('One Birch Seedling in the Bank: the Birch Stump grows into a Sapling');
                    }}
                >
                    Give a Birch Seedling
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-forestry-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default ForestryDevSection;
