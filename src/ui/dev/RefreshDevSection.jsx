// The QA panel's Refresh section: one click lays out a vein beside a building giving Refresh 100 %, and a vein a Hall star gives Refresh 50 %, each with a miner.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpRefreshScene, refreshReadout } from './refreshDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function RefreshDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(refreshReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-refresh">
            <div className={labelClass}>Refresh: charges kept by a building and a Hall star (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-refresh-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpRefreshScene();
                        setStatus(r.ok
                            ? 'Upper left: a Refresh Vein beside a Refresh Well (Refresh 100 %): its 5 charges never drop. Below it a second vein the QA Fresh Seams star reaches (Refresh 50 %): about half its cycles spend nothing, so it rests later. A miner works each. Hover the Well and the star for their rule text.'
                            : r.error);
                    }}
                >
                    Veins kept by a Refresh building and a Refresh star (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-refresh-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}
