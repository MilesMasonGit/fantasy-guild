// The QA panel's fishing section (brief 230 S5): one click lays out a lake, a river and a sea, each fished its own way, and a Dock.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpFishingScene, fishingReadout } from './fishingDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function FishingDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What each fisher fishes with and their last catches, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(fishingReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-fishing">
            <div className={labelClass}>Fishing: water, catch pools, bait (dev only)</div>
            <button
                type="button"
                data-qa-fishing-scene
                className={buttonClass}
                onClick={() => {
                    const r = setUpFishingScene();
                    setStatus(r.ok
                        ? 'Above the Hall: a Lake with a Dock (rod and worms, then plain once the worms run out), a River (rod, no bait) and a Sea (a net). Click a water for its catches'
                        : r.error);
                }}
            >
                A lake, a river and a sea with fishers (test Tokens, gone on reload)
            </button>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-fishing-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default FishingDevSection;
