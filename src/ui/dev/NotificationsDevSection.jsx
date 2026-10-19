// The QA panel's Notifications section: every eye-check of the item stubs and banners by a click.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { useState } from 'react';
import {
    startLootFlow, stopLootFlow, findNewItem, levelUpForRecipes,
    fourBanners, knockoutWithWaiting, knockoutNow, bankFullNow, clearBanners
} from './notificationsDev.js';

const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors text-left';

const ACTIONS = [
    { id: 'loot', label: 'Busy minute of loot (one item spent)', run: () => startLootFlow(60) },
    { id: 'stop', label: 'Stop the loot', run: () => { stopLootFlow(); return 'Stopped'; } },
    { id: 'find', label: 'Find a new item', run: findNewItem },
    { id: 'recipe', label: 'Level-up that unlocks recipes', run: levelUpForRecipes },
    { id: 'four', label: 'Four banners at once', run: fourBanners },
    { id: 'ko-waiting', label: 'Knock-out behind three banners', run: knockoutWithWaiting },
    { id: 'ko', label: 'Knock-out banner', run: knockoutNow },
    { id: 'bank', label: 'Bank full banner', run: bankFullNow },
    { id: 'clear', label: 'Clear banners', run: clearBanners }
];

export function NotificationsDevSection() {
    const [status, setStatus] = useState('');
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-1" data-dev-section="notifications">
            <div className={labelClass}>Notifications</div>
            <div className="grid grid-cols-2 gap-1">
                {ACTIONS.map(a => (
                    <button key={a.id} type="button" data-dev-notify={a.id} className={buttonClass} onClick={() => setStatus(a.run())}>
                        {a.label}
                    </button>
                ))}
            </div>
            {status && <div className="text-[11px] text-gi-muted" data-dev-notify-status>{status}</div>}
        </div>
    );
}

export default NotificationsDevSection;
