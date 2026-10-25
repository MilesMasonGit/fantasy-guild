// The QA panel's Farming section (brief 230 S4): one click lays out Fields in every state (wild and ripe, growing beside a Well, ripe beside a Composter and a Beehive, a Herb Garden stopped for a seed, one with nothing picked) and a farmer working them.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpFarmingScene, giveSageSeeds, farmingReadout } from './farmingDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function FarmingDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(farmingReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-farming">
            <div className={labelClass}>Farming: Fields, a Well, a Composter, a Beehive (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-farming-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpFarmingScene();
                        setStatus(r.ok
                            ? 'Above the Hall, left to right: a wild wheat patch already ripe; a Field growing wheat with a Well below (ripe in 1 minute, not 2); a ripe Field with a Composter below (6 harvests, not 4) and a Farmer on it; a Beehive (honey, then it rests and refills); a Herb Garden stopped for want of QA Sage Seed; an empty Field (click its gear to pick a crop). The Farmer waits silently while nothing is ripe.'
                            : r.error);
                    }}
                >
                    Fields in every state, with a Well, a Composter and a Beehive (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-farming-seeds
                    className={buttonClass}
                    onClick={() => {
                        giveSageSeeds();
                        setStatus('Five QA Sage Seeds in the Bank: the Herb Garden sows on the next tick and starts growing.');
                    }}
                >
                    Give 5 QA Sage Seeds
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-farming-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default FarmingDevSection;
