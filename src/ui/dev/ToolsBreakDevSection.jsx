// The QA panel's tools-that-break section: a brittle woodaxe and sword, worked until they break.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpBreakScene, rearmBreakScene, playBreakTimeAway, breakReadout, QA_BREAK_CHANCE } from './toolsBreakDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function ToolsBreakDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // What each QA hero holds and does, and what broke, read from the engine while the panel is open.
    useEffect(() => {
        const timer = setInterval(() => setLines(breakReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-tools-break">
            <div className={labelClass}>Tools that break (dev only)</div>
            <div className="flex flex-wrap gap-1">
                <button
                    type="button"
                    data-qa-break-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpBreakScene();
                        setStatus(r.ok
                            ? `Below the Hall: QA Woodcutter on the QA Endless Oak and QA Duelist on the QA Training Slime, each with a brittle tool (${QA_BREAK_CHANCE}% a cycle; the sword at each kill). A spare axe waits in the Bank. Watch them break and stop`
                            : r.error);
                    }}
                >
                    A brittle woodaxe and sword at work (test items, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-break-rearm
                    className={buttonClass}
                    onClick={() => {
                        const r = rearmBreakScene();
                        setStatus(r.ok ? 'Both heroes hold a new brittle tool and are back at work' : r.error);
                    }}
                >
                    Hand them new ones
                </button>
                <button
                    type="button"
                    data-qa-break-away
                    className={buttonClass}
                    onClick={() => {
                        setStatus('Playing 5 minutes away…');
                        playBreakTimeAway().then(r => setStatus(r.ok ? 'Played 5 minutes away: the summary\'s news lists what broke' : r.error));
                    }}
                >
                    Play 5 min away
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-break-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default ToolsBreakDevSection;
