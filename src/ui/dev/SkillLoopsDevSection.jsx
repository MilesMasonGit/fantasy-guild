// The QA panel's skill loops section (brief 230 S1a): one click lays out Grow Time, the 80 % floor, a fixed vein and stations that never wear.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpSkillLoopsScene, skillLoopsReadout } from './skillLoopsDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function SkillLoopsDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // The numbers the scene is about, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(skillLoopsReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-skill-loops">
            <div className={labelClass}>Skill loops: speed-ups and wear (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-skill-loops-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpSkillLoopsScene();
                        setStatus(r.ok
                            ? 'Left of the Hall: a Sapling between two Groves. Right: a slow vein in five Minecarts, a Miner on it (try dragging the vein). Below: Grandma’s Kitchen and a Windmill'
                            : r.error);
                    }}
                >
                    Grow Time, the floor and never-wearing stations (test Tokens, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-skill-loops-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default SkillLoopsDevSection;
