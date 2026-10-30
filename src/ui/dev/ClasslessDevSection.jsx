// The QA panel's classless heroes section (brief 270 K1): a new hero against Goblins with a sword
// then a bow, an Iron Sword asking Melee 15, and an older save's promoted Knight, loaded.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import { setUpClasslessScene, giveGatedIronSword, loadOldKnightSave } from './classlessDev.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function ClasslessDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-classless">
            <div className={labelClass}>Classless heroes (dev only)</div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    data-qa-classless-scene
                    className={buttonClass}
                    onClick={() => {
                        const r = setUpClasslessScene();
                        setStatus(r.ok
                            ? `Right of the Hall: three Goblins. ${r.name} (every skill at 1, a Copper Sword and Shrimp) is sent at the first: open their sheet and watch Melee XP. The Copper Bow is in the Bank: drag it onto them, then drag them onto the next Goblin, and Ranged XP climbs instead`
                            : r.error);
                    }}
                >
                    New hero vs Goblins: sword, then bow
                </button>
                <button
                    type="button"
                    data-qa-classless-iron
                    className={buttonClass}
                    onClick={() => {
                        const r = giveGatedIronSword();
                        setStatus(r.ok
                            ? 'A QA Iron Sword (asks Melee 15) is in the Bank: drag it onto a new hero and it is refused, "Needs Melee 15" (a test item, gone on reload)'
                            : r.error);
                    }}
                >
                    QA Iron Sword asking Melee 15
                </button>
                <button
                    type="button"
                    data-qa-classless-old-save
                    className={buttonClass}
                    onClick={async () => {
                        setStatus('Loading…');
                        const r = await loadOldKnightSave();
                        setStatus(r.ok
                            ? 'Loaded an old save with QA Old Knight: open their sheet. Melee 25, Magic 33 and Enchanting 7 (back from the bank), Fletching 18, every Starting skill 12; no Leadership, Armory or Commerce; no job title; 43 HP. The slot’s backup holds the game before'
                            : r.error);
                    }}
                >
                    Old save: a promoted Knight (rewrites this slot)
                </button>
            </div>
            {status && <div className="ui-text-body text-gi-muted">{status}</div>}
        </div>
    );
}

export default ClasslessDevSection;
