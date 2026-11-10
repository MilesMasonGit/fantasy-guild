import { CombatGlyph } from './CombatGlyph.jsx';
import { GLYPH_COLOUR, damageTypeGlyph } from './combatGlyphs.js';
import { damageText, damageTypeName } from './fightView.js';
import { t } from '../../../i18n/index.js';

/** Pieces of a fighter's stat block, shared by the fight window and the hero drawer's Combat view. */

/** A hit's size with its type's glyph: `2 [fire]`, and for a shot `2 [fire] + 1 [stab]`. */
export const HitParts = ({ parts }) => (
    <span className="inline-flex flex-wrap items-center gap-1" data-fight-hit-parts>
        {parts.map((p, i) => (
            <span key={`${p.type}-${i}`} className="inline-flex items-center gap-1" data-fight-hit-type={p.type}>
                {i > 0 && <span className="text-gi-muted">+</span>}
                {damageText(p.hit)}
                <CombatGlyph name={damageTypeGlyph(p.type)} colour={GLYPH_COLOUR.text} />
            </span>
        ))}
    </span>
);

/** A side's resistances as glyph chips: `[fire] 100%`, a weakness `[ice] −50%` in gold; `–` for none. */
export const ResistChips = ({ lines }) => (lines.length === 0
    ? <span className="text-gi-muted" data-fight-resists="none">–</span>
    : (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5" data-fight-resists="some">
            {lines.map(l => (
                <span key={l.id} className="inline-flex items-center gap-0.5" data-fight-resist={l.id} style={l.value < 0 ? { color: 'var(--color-ui-gold)' } : undefined}>
                    <CombatGlyph name={damageTypeGlyph(l.id)} colour={l.value < 0 ? GLYPH_COLOUR.gold : GLYPH_COLOUR.text} />
                    {l.value < 0 ? `−${-l.value}%` : `${l.value}%`}
                </span>
            ))}
        </span>
    ));

/** What a side's resistances say, one line each, for the tooltip. */
export const resistTip = (lines) => lines.map(l => (l.value < 0
    ? `${t('fight.card.weakTo')}: ${t('fight.card.step', { type: damageTypeName(l.id), n: -l.value })}`
    : `${t('fight.card.resists')}: ${t('fight.card.step', { type: damageTypeName(l.id), n: l.value })}`));
