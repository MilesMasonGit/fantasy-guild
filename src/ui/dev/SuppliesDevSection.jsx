// The QA panel's supplies section: one click sets up a fight with elixirs and one with food.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpSuppliesScene } from './suppliesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function SuppliesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-supplies">
            <div className={labelClass}>Supplies in fights (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-supplies-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpSuppliesScene();
                        setStatus(r.ok
                            ? 'Two Fighters on two Cows (left: Valor and Ironskin; right: Shrimp and Water), and a hurt one below the Hall with Water'
                            : r.error);
                    }}
                >
                    Elixir and food fights (test elixirs, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default SuppliesDevSection;
