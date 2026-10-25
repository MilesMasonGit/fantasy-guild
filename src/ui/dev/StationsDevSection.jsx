// The QA panel's station pools section (brief 230 S6a): one click lays out a Furnace that offers only smelting and a Smithy that offers only smithing.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpStationsScene, stationsReadout } from './stationsDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function StationsDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What each station offers, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(stationsReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-stations">
            <div className={labelClass}>Stations: recipe pools (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-stations-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpStationsScene();
                        setStatus(r.ok
                            ? 'Below the Hall: a QA Furnace (left, a Smith on it) and a QA Smithy (right). Click each and open its recipe list: the Furnace lists only ingots, the Smithy only tools, weapons and nails'
                            : r.error);
                    }}
                >
                    Furnace and Smithy recipe lists (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-stations-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default StationsDevSection;
