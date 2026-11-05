// The QA panel's picker for how the Bank's hero column writes names. ⚠️ DEV BUILDS ONLY, and a
// picking aid: it goes with `heroColumnLook.js` once the owner has chosen.

import { HERO_COLUMN_LOOK, useHeroColumnLook, setHeroColumnLook } from '../components/base/heroColumnLook.js';

const LOOKS = [
    [HERO_COLUMN_LOOK.PLATE, 'A: stepped plate'],
    [HERO_COLUMN_LOOK.RIBBON, 'B: bronze ribbon'],
    [HERO_COLUMN_LOOK.OUTLINE, 'C: outlined, no box']
];

const labelClass = 'ui-text-title font-bold uppercase tracking-wider text-gi-muted mb-1';
const buttonClass = 'px-2 py-1 bg-gi-primary/10 hover:bg-gi-primary/20 border border-gi-primary/40 text-xs font-bold transition-colors';

export function ColumnLookDevSection() {
    const look = useHeroColumnLook();
    return (
        <div className="mb-3 pb-3 border-b border-gi-border space-y-2" data-testid="qa-column-look">
            <div className={labelClass}>Bank hero column names (dev only)</div>
            <div className="flex flex-wrap gap-2">
                {LOOKS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        data-qa-column-look={id}
                        aria-pressed={look === id}
                        className={`${buttonClass}${look === id ? ' text-gi-gold' : ''}`}
                        onClick={() => setHeroColumnLook(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ColumnLookDevSection;
