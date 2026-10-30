// The QA panel's hero orders section (brief 260): an ambush scene, a knock-out, a heal, an
// old save with one pinned flag and one area flag, loaded, and the tutorial's two order steps.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpOrdersScene, knockOutAHero, healEveryone, loadOldFlagsSave, jumpTutorialTo, TUTORIAL_JUMPS } from './ordersDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function OrdersDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-orders">
            <div className={labelClass}>Hero orders (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-orders-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpOrdersScene();
                        setStatus(r.ok
                            ? 'Left of the Hall: a Goblin Camp with a QA Old Oak beside it; away from the camps, a QA Berry Bush (3 charges). A QA Fighter waits at the Hall: drag them onto the Old Oak (the goblin attacks, they fight back and go back to chopping), or onto the Bush (it runs out: they need a job)'
                            : r.error);
                    }}
                >
                    Ambush and needs-a-job scene (test Tokens, gone on reload)
                </button>
                <button
                    type="button"
                    data-qa-orders-knockout
                    className={buttonClass}
                    onClick={() => {
                        const r = knockOutAHero();
                        setStatus(r.ok ? `${r.name} knocked out: order cleared, limping home to heal, then waiting at the Hall` : r.error);
                    }}
                >
                    Knock out a hero (loses gear and food as a defeat does)
                </button>
                <button
                    type="button"
                    data-qa-orders-heal
                    className={buttonClass}
                    onClick={() => {
                        const r = healEveryone();
                        setStatus(`${r.count} hero(es) healed now`);
                    }}
                >
                    Heal everyone now
                </button>
                <button
                    type="button"
                    data-qa-orders-old-save
                    className={buttonClass}
                    onClick={async () => {
                        setStatus('Loading…');
                        const r = await loadOldFlagsSave();
                        setStatus(r.ok
                            ? `Loaded an old save: ${r.pinned} had a flag pinned to a QA Old Oak (now an order: they work it); ${r.area} had an area flag beside the other Old Oak (now idling where it stood, working nothing). The slot's backup holds the game before`
                            : r.error);
                    }}
                >
                    Load an old save: one pinned flag, one area flag (rewrites this slot)
                </button>
                <button
                    type="button"
                    data-qa-tutorial-tree
                    className={buttonClass}
                    onClick={() => {
                        const r = jumpTutorialTo(TUTORIAL_JUMPS.tree);
                        setStatus(r.ok ? `Tutorial at "${r.title}": the first hero holds the Woodaxe; drag them onto a tree` : r.error);
                    }}
                >
                    Tutorial: jump to Send Your Recruit to a Tree
                </button>
                <button
                    type="button"
                    data-qa-tutorial-camp
                    className={buttonClass}
                    onClick={() => {
                        const r = jumpTutorialTo(TUTORIAL_JUMPS.camp);
                        setStatus(r.ok ? `Tutorial at "${r.title}": 60 Oak Wood in the Bank; buy a Wood Foundation near the trees, choose the Logging Camp, drag a hero onto it` : r.error);
                    }}
                >
                    Tutorial: jump to Build a Camp
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted" data-qa-orders-status>{status}</div>}
        </div>
    );
}
