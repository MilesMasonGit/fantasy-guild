// The QA panel's HP bar look picker. ⚠️ DEV BUILDS ONLY, and a picking aid: it goes with
// `hpBarLook.js` once the owner has chosen.

import { HP_BAR_LOOK, useHpBarLook, setHpBarLook } from '../components/base/hpBarLook.js';

const LOOKS = [
    [HP_BAR_LOOK.PLATE, 'A: plain plate'],
    [HP_BAR_LOOK.TICKS, 'B: ticks every tenth'],
    [HP_BAR_LOOK.HEART, 'C: heart and bronze edge']
];

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function HpLookDevSection() {
    const look = useHpBarLook();
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-hp-look">
            <div className={labelClass}>Hero HP bar look (dev only)</div>
            <div className="flex flex-wrap gap-2">
                {LOOKS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        data-qa-hp-look={id}
                        aria-pressed={look === id}
                        className={`${buttonClass}${look === id ? ' text-gi-gold' : ''}`}
                        onClick={() => setHpBarLook(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default HpLookDevSection;
