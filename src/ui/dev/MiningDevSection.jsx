// The QA panel's Mining section (brief 230 S3): one click lays out a vein with two Mines and a Minecart round it, worked by a miner, and an empty vein drawn as the shared empty rock.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpMiningScene, miningReadout } from './miningDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function MiningDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(miningReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-mining">
            <div className={labelClass}>Mining: resting veins, Mines and Minecarts (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-mining-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpMiningScene();
                        setStatus(r.ok
                            ? 'Lower right: a Copper Vein between two Mines and a Minecart, a Miner on it (about half the ore doubled, never the Quartz; 2 s a cycle). After five ore it rests a minute as the empty rock, then refills all at once. Beside it, an empty Iron Vein: the same rock (click it: its card names the ore)'
                            : r.error);
                    }}
                >
                    A vein with Mines and a Minecart, and a resting vein (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-mining-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default MiningDevSection;
