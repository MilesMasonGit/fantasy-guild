// The QA panel's statuses section: one click sets up a Venomous enemy, a burning attacker and a boss with its four moves.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useEffect, useState } from 'react';
import { setUpStatusesScene, statusesReadout } from './statusesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function StatusesDevSection() {
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState([]);

    // Statuses are not drawn on the board yet: read them out here while the scene runs.
    useEffect(() => {
        const timer = setInterval(() => setLines(statusesReadout()), 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-statuses">
            <div className={labelClass}>Statuses and boss moves (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-statuses-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpStatusesScene();
                        setStatus(r.ok
                            ? 'Three Fighters below the Hall: on a Venomous Goblin, a Fire Imp, and a Goblin Warlord with four moves'
                            : r.error);
                    }}
                >
                    Poison, burn and a boss (test content, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
            {lines.length > 0 && (
                <div className="ui-text-body space-y-0.5" data-qa-statuses-readout>
                    {lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}
        </div>
    );
}

export default StatusesDevSection;
