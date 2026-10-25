// The QA panel's work consumables section (brief 230 S6b): one click sets a forester with a Birdwatcher and a Coffee beside a miner who keeps their Birdwatcher.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpWorkConsumablesScene, workConsumablesReadout } from './workConsumablesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function WorkConsumablesDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What each worker has drunk, the Coffee's cycles left and the nests, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(workConsumablesReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-work-consumables">
            <div className={labelClass}>Work potions and drinks (dev only)</div>
            <button
                type="button"
                data-qa-work-consumables-scene
                className={buttonClass}
                onClick={() => {
                    const r = setUpWorkConsumablesScene();
                    setStatus(r.ok
                        ? 'Below the Hall: a QA Forester on a QA Oak with a Birdwatcher (one drunk each Forestry cycle, a Bird Nest a quarter of the time) and a Coffee (cycles at half time for 10 cycles); a QA Miner on a QA Copper Vein keeps their Birdwatcher'
                        : r.error);
                }}
            >
                A forester with a Birdwatcher and a Coffee (test items, gone on reload)
            </button>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-work-consumables-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default WorkConsumablesDevSection;
