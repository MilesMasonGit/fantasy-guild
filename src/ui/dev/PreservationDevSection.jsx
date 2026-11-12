// The QA panel's Preservation section: a forge whose Ore a building keeps and one a Hall star keeps half the time, and an archer whose arrows a building keeps.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpPreservationForges, setUpPreservationArcher, preservationReadout } from './preservationDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function PreservationDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scenes are about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(preservationReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-preservation">
            <div className={labelClass}>Preservation: materials and arrows kept by a building and a Hall star (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-preservation-forges
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpPreservationForges();
                        setStatus(r.ok
                            ? 'Upper right: a Preservation Forge beside a Preservation Cellar (Preservation 100 %): it makes Copper Ingots and the Bank\'s Copper Ore never drops. Below it a second forge the QA Thrifty Hands star reaches (Preservation 50 %): the Bank\'s Stone drops on about half its cycles. A smith works each; 40 Copper Ore and 40 Stone were added. Hover the Cellar and the star for their rule text.'
                            : r.error);
                    }}
                >
                    Forges kept by a Preservation building and star (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-preservation-archer
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpPreservationArcher();
                        setStatus(r.ok
                            ? 'Upper middle: a QA Archer shoots a QA Dummy beside a QA Quiver Post (Preservation 100 % on Ammo): the Bank\'s 40 QA Arrows never drop.'
                            : r.error);
                    }}
                >
                    An archer whose arrows a Preservation building keeps (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-preservation-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}
