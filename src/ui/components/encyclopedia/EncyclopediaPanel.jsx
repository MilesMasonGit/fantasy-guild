import { t } from '../../../i18n/index.js';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { ItemTipContent } from '../drawer/ItemTip.jsx';
import { KIND } from './encyclopediaModel.js';
import { requirementOf } from './encyclopediaChart.js';
import { EntrySprite, EntryRow, RequirementLine, Tick, isCollected } from './encyclopediaParts.jsx';

/** `m:ss` (UI_STYLE "Numbers"). */
export function clockText(ms) {
    const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const Clock = ({ ms }) => (
    <span className="inline-flex items-center gap-1 tabular-nums">
        <PixelGlyph name="clock" />
        {clockText(ms)}
    </span>
);

/** A Token or an enemy: what it says of itself, the skill and level to work it, its cycle. */
const TokenFacts = ({ book, entry, heroes }) => {
    const def = entry.def;
    const config = def?.config || {};
    const gate = requirementOf(book, entry.key);
    const cycle = !def?.enemy && Number(config.cycleTimeMs) > 0 ? Number(config.cycleTimeMs) : null;
    return (
        <div data-codex-facts="token" className="flex flex-col gap-1 ui-text-body">
            {def?.description && <p className="text-white/85 leading-snug">{def.description}</p>}
            {(gate || cycle) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white">
                    {gate && <RequirementLine requirement={gate} heroes={heroes} book={book} />}
                    {cycle && <Clock ms={cycle} />}
                </div>
            )}
        </div>
    );
};

/** A recipe: its level, how long a craft takes, and every station that offers it (each a new chart). */
const RecipeFacts = ({ book, entry, heroes, got, onChartFrom }) => {
    const gate = requirementOf(book, entry.key);
    const stations = book.sourcesOf(entry.key).map(r => r.via).filter((k, i, all) => k && book.entryOf(k) && all.indexOf(k) === i);
    return (
        <div data-codex-facts="recipe" className="flex flex-col gap-1 ui-text-body text-white">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {gate && <RequirementLine requirement={gate} heroes={heroes} book={book} />}
                {Number(entry.def?.durationMs) > 0 && <Clock ms={entry.def.durationMs} />}
            </div>
            {stations.length > 0 && (
                <div className="flex flex-col">
                    <span className="ui-text-small text-white/60">{t('encyclopedia.madeAt')}</span>
                    {stations.map(key => (
                        <EntryRow key={key} entry={book.entryOf(key)} got={got} onPick={onChartFrom} dataAttr="data-codex-station" />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * The focused entry, small, in the right page's corner: what it is. Everything about where it
 * comes from and what it goes into is the chart's. Not shown at present (`SHOW_PANEL`).
 */
export const InspectPanel = ({ book, focusKey, got, heroes, onChartFrom, style }) => {
    const entry = book.entryOf(focusKey);
    if (!entry) return null;
    return (
        <PixelFrame kind={FRAME_KIND.CHAMFER} data-codex-panel={entry.key} className="absolute" style={style} frameClassName="p-2 flex flex-col gap-2 bg-gi-surface/95 text-white">
            <div className="flex items-center gap-2">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center"><EntrySprite entry={entry} /></span>
                <div className="flex flex-col min-w-0">
                    <h3 data-codex-name className="ui-text-title font-bold text-white break-words flex items-center gap-1.5">
                        {entry.name}
                        {isCollected(got, entry) && <Tick />}
                    </h3>
                    <span className="ui-text-small text-white/60">{t(`encyclopedia.kindOne.${entry.kind}`)}</span>
                </div>
            </div>
            {entry.kind === KIND.ITEM && <div className="ui-text-body"><ItemTipContent item={entry.def} /></div>}
            {(entry.kind === KIND.TOKEN || entry.kind === KIND.ENEMY) && <TokenFacts book={book} entry={entry} heroes={heroes} />}
            {entry.kind === KIND.RECIPE && <RecipeFacts book={book} entry={entry} heroes={heroes} got={got} onChartFrom={onChartFrom} />}
        </PixelFrame>
    );
};

export default InspectPanel;
