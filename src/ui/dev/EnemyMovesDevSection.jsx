// The QA panel's enemy moves section: one click sets up the owner's chicken (Peck, Scratch, Flutter) on a hero in Physical-resistant gear.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpEnemyMovesScene } from './enemyMovesDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function EnemyMovesDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-enemy-moves">
            <div className={labelClass}>Enemy moves (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-enemy-moves-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpEnemyMovesScene();
                        setStatus(r.ok
                            ? 'Below the Hall: Dara (sword, Plate Chestplate, Kite Shield: Physical 35 %) on a Chicken that Pecks (Stab), Scratches (Slash) or Flutters (+50 % Physical for her next swing). Watch the floats name each move; click the crossed-swords chip for the panel and its log; rest the pointer on the chicken for its card'
                            : r.error);
                    }}
                >
                    The owner&apos;s chicken: Peck, Scratch, Flutter (test content, gone on reload)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}
