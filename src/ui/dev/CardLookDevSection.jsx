// The QA panel's Token card looks: the layouts on trial, one click each.
// ⚠️ DEV BUILDS ONLY: TestDashboard renders this behind `import.meta.env.DEV && …`.

import { CARD_LOOKS, setCardLook, useCardLook } from '../components/board/cardLook.js';

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 rounded bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function CardLookDevSection() {
    const look = useCardLook();
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-card-look">
            <div className={labelClass}>Token card look (dev only)</div>
            <div className="flex flex-wrap gap-1">
                {Object.values(CARD_LOOKS).map(option => (
                    <button
                        key={option.id}
                        type="button"
                        data-qa-card-look={option.id}
                        aria-pressed={option.id === look.id}
                        className={buttonClass}
                        style={option.id === look.id ? { color: 'var(--color-ui-gold)', borderColor: 'var(--color-ui-gold)' } : undefined}
                        onClick={() => setCardLook(option.id)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className="ui-text-body text-gi-muted">Pick one, then click a Token to see its card.</div>
        </div>
    );
}

export default CardLookDevSection;
