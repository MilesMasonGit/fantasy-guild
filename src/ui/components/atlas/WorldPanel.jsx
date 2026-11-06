import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../../i18n/index.js';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { FLAVOUR_NAME_MAX } from '../../../systems/atlas/regionNames.js';
import { CELL_STATE } from '../../../systems/world/frontier.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { SKILLS } from '../../../config/registries/skillRegistry.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { matW, matH } from '../../../config/matGeometry.js';
import { formatCompact } from '../../../utils/Formatters.js';
import { cn } from '../../utils/cn.js';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { SkillIcon } from '../base/SkillIcon.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { MapPreview } from './MapPreview.jsx';
import { previewFit } from './mapPreview.js';
import { regionPlan, regionFacts } from './regionPreview.js';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { useWorldArrived } from './WorldCamera.jsx';

/** The panel's width in px: thinner than the book's page, so the map has the room. */
export const PANEL_W = 336;
/** The gap between the panel and the screen's edges. */
export const PANEL_GAP = 16;
const HERE_FLAG_PX = 48;
const PREVIEW_MARGIN_PX = 4;
const PREVIEW_MAX_H = 180;

const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60';

const skillName = (id) => SKILLS[id]?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');
const itemName = (id) => getItem(id)?.name || id;
const countCls = (short) => cn('tabular-nums', short ? 'text-[var(--color-ui-red)]' : 'text-white');

/** What a cell's price lacks, as words for the disabled Settle: "Short of 3 Copper Ore, Mining 5". */
export function shortWords(price) {
    const parts = [
        ...price.items.filter(r => r.short).map(r => `${(r.need - r.have).toLocaleString('en-US')} ${itemName(r.itemId)}`),
        ...price.skills.filter(r => r.short).map(r => `${skillName(r.skill)} ${r.need}`)
    ];
    return parts.length ? t('worldMap.short', { what: parts.join(', ') }) : null;
}

/** A have/need count in the 9.9k shorthand. */
const haveNeed = (have, need) => `${formatCompact(have)}/${formatCompact(need)}`;

/** The price as pills (sprite and have/need, red when short): the hover tip's. */
const PricePills = ({ price }) => {
    if (!price.items.length && !price.skills.length) return <div className="text-white/60">{t('worldMap.nothingAsked')}</div>;
    return (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {price.items.map(r => (
                <span key={r.itemId} data-world-price-item={r.itemId} className="flex items-center gap-1">
                    <ItemIcon item={r.itemId} size={32} title={null} />
                    <span className={countCls(r.short)}>{haveNeed(r.have, r.need)}</span>
                </span>
            ))}
            {price.skills.map(r => (
                <span key={r.skill} data-world-price-skill={r.skill} className="flex items-center gap-1">
                    <SkillIcon skillId={r.skill} size={32} />
                    <span className={countCls(r.short)}>{r.have}/{r.need}</span>
                </span>
            ))}
        </div>
    );
};

/** The price as rows (sprite, name, have/need), the panel's. */
const PriceRows = ({ price }) => {
    if (!price.items.length && !price.skills.length) return <div className="font-pixel ui-text-body text-white/60">{t('worldMap.nothingAsked')}</div>;
    const row = (key, attrs, icon, name, count, short) => (
        <div key={key} {...attrs} className="flex items-center gap-1.5 font-pixel ui-text-body">
            {icon}
            <span className="min-w-0 flex-1 text-white/85 break-words">{name}</span>
            <span className={cn('pl-2', countCls(short))}>{count}</span>
        </div>
    );
    return (
        <div className="flex flex-col gap-0.5">
            {price.items.map(r => row(r.itemId, { 'data-world-price-item': r.itemId }, <ItemIcon item={r.itemId} size={32} title={null} />, itemName(r.itemId), haveNeed(r.have, r.need), r.short))}
            {price.skills.map(r => row(r.skill, { 'data-world-price-skill': r.skill }, <SkillIcon skillId={r.skill} size={32} />, skillName(r.skill), `${r.have}/${r.need}`, r.short))}
        </div>
    );
};

/**
 * The hover over a cell (its title is the place's name, `Tooltip`'s): the kind of land under it,
 * then for a place not yet settled its price, and why it cannot be settled when it is out of reach.
 */
export const CellTip = ({ cell }) => (
    <div data-world-tip={cell.id} className="flex flex-col gap-1">
        <div data-world-tip-terrain className="text-white/70">{cell.terrain}</div>
        {cell.state !== CELL_STATE.SETTLED && <PricePills price={cell.price} />}
        {cell.state === CELL_STATE.BEYOND && <div className="ui-text-small text-white/55">{t('worldMap.beyond')}</div>}
    </div>
);

/** The place's name, and its rename: Enter or leaving the box keeps it, Escape does not. */
const PlaceName = ({ cell, region, onMessage }) => {
    const [draft, setDraft] = useState(null);
    // Enter or Escape unmounts the box, and a browser may blur it on the way out: that blur must do nothing.
    const dropped = useRef(false);
    useEffect(() => { setDraft(null); }, [cell.id]);
    const editing = draft != null;
    useEffect(() => { if (editing) dropped.current = false; }, [editing]);
    const commit = () => {
        if (draft == null || dropped.current) return;
        dropped.current = true;
        const result = Atlas.rename(region.id, draft);
        setDraft(null);
        onMessage(result.success ? null : result.reason);
    };
    if (editing) {
        return (
            <input
                autoFocus
                data-world-rename-input={cell.id}
                aria-label={SCREEN_TEXT.RENAME}
                value={draft}
                maxLength={FLAVOUR_NAME_MAX}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        dropped.current = true;
                        setDraft(null);
                    }
                }}
                className="min-w-0 w-full px-1 bg-black/80 border border-gi-gold/50 text-white outline-none font-pixel ui-text-title"
            />
        );
    }
    return (
        <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
            <h2 data-world-name className="font-pixel ui-text-title font-bold text-white break-words">{cell.name}</h2>
            {region && (
                <button
                    type="button"
                    data-world-rename={cell.id}
                    onClick={() => setDraft(cell.name)}
                    className="font-pixel ui-text-small text-white/60 hover:text-white cursor-pointer"
                >
                    {SCREEN_TEXT.RENAME}
                </button>
            )}
        </div>
    );
};

const Fact = ({ id, label, children }) => (
    <div data-world-fact={id} className="flex items-baseline gap-2">
        <dt className={cn(headingCls, 'w-20 shrink-0')}>{label}</dt>
        <dd className="font-pixel ui-text-body text-white min-w-0">{children}</dd>
    </div>
);

/** A settled place's own picture and facts: its ground with its Tokens, what it holds, who is there. */
const PlaceFacts = ({ region, version }) => {
    const record = Atlas.getRegion(region.id);
    const activeId = Atlas.activeRegionId();
    const plan = useMemo(() => regionPlan(record), [record, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const facts = useMemo(() => regionFacts(record), [record, version]); // eslint-disable-line react-hooks/exhaustive-deps
    const wide = matW();
    const high = matH();
    const mat = useMemo(() => ({ w: wide, h: high }), [wide, high]);
    const boxW = PANEL_W - 40;
    const fit = useMemo(() => previewFit(mat, boxW - 2 * PREVIEW_MARGIN_PX, PREVIEW_MAX_H), [mat, boxW]);
    // Drawn once the camera has arrived: drawing it mid-glide would stall the glide.
    const arrived = useWorldArrived();
    return (
        <div data-world-facts={region.id} className="flex flex-col gap-2">
            <div data-world-preview className="relative shrink-0 flex items-center justify-center overflow-hidden bg-black/40" style={{ width: boxW, height: fit.height + 2 * PREVIEW_MARGIN_PX }}>
                {plan && arrived && <MapPreview plan={plan} mat={mat} fit={fit} />}
            </div>
            <dl className="flex flex-col gap-0.5">
                <Fact id="ground" label={SCREEN_TEXT.FACT_GROUND}>{facts.biomes.join(', ')}</Fact>
                <Fact id="tokens" label={SCREEN_TEXT.FACT_TOKENS}>{facts.tokens}</Fact>
                <Fact id="heroes" label={SCREEN_TEXT.FACT_HEROES}>{facts.heroes}</Fact>
            </dl>
            {facts.contents.length > 0 && (
                <ul data-world-holds className="flex flex-wrap gap-x-2 gap-y-1">
                    {facts.contents.map(({ typeId, count }) => (
                        <Tooltip key={typeId} title={tokenName(typeId) || typeId}>
                            <li data-world-token={typeId} className="flex items-center gap-0.5">
                                <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
                                <span className="font-pixel ui-text-small tabular-nums text-white/85">×{count}</span>
                            </li>
                        </Tooltip>
                    ))}
                </ul>
            )}
        </div>
    );
};

/** The cartographer's words at the top of the panel, while the tutorial's last step asks for a place. */
const CartographerNote = ({ note }) => (
    <div data-world-note className="flex flex-col gap-0.5 pb-2 mb-1 border-b border-white/10">
        <div className={headingCls}>{note.speaker}</div>
        <div className="font-pixel ui-text-title font-bold text-white">{note.title}</div>
        <div className="font-pixel ui-text-body text-white/85 italic">{note.says}</div>
        <div className="font-pixel ui-text-small text-white/70">{note.instruction}</div>
    </div>
);

/**
 * The inspection panel over the map's right edge: the chosen place's name (renamed here once
 * settled) with the guild's flag when it is there, the kind of land, the cartographer's words
 * while the tutorial asks for a place, what it yields, then its price and a large Settle while it
 * is on the frontier, or its picture, facts and Travel once settled.
 *
 * @param {object} props
 * @param {object|null} props.cell a `worldView()` cell
 */
export const WorldPanel = ({ cell, note, version, message, onMessage, onSettle, onTravel, onClose }) => {
    const settled = cell?.state === CELL_STATE.SETTLED;
    const frontier = cell?.state === CELL_STATE.FRONTIER;
    const region = cell?.regionId ? Atlas.getRegion(cell.regionId) : null;
    const short = frontier ? shortWords(cell.price) : null;
    return (
        <PixelFrame
            kind="studs"
            backdrop="world"
            data-world-panel
            className="absolute flex flex-col pointer-events-auto"
            style={{ right: PANEL_GAP, top: PANEL_GAP, width: PANEL_W, maxHeight: `calc(100% - ${2 * PANEL_GAP}px)` }}
            frameClassName="min-h-0 flex flex-col p-3 bg-gi-surface/95 text-white"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="shrink-0 flex items-start gap-2">
                {cell?.here && (
                    <span data-world-detail-here className="shrink-0">
                        <FlagMark size={HERE_FLAG_PX} alt={t('worldMap.here')} />
                    </span>
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                    {cell
                        ? <PlaceName cell={cell} region={settled ? region : null} onMessage={onMessage} />
                        : <h2 className="font-pixel ui-text-title font-bold text-white">{t('worldMap.label')}</h2>}
                    {cell && <div data-world-terrain className="font-pixel ui-text-body text-white/70">{cell.terrain}</div>}
                </div>
                <CloseX data-world-close onClick={onClose} label={SCREEN_TEXT.CLOSE} />
            </div>
            <ArrowScrollList step={80} compact className="mt-2 flex-1 min-h-0">
                <div className="flex flex-col gap-3">
                    {note && <CartographerNote note={note} />}
                    {!cell && <p className="font-pixel ui-text-body text-white/60">{t('worldMap.pickCell')}</p>}
                    {cell && (
                        <section data-world-detail={cell.id} className="flex flex-col gap-3">
                            {cell.state === CELL_STATE.BEYOND && (
                                <p data-world-detail-state className="font-pixel ui-text-small text-white/60">{t('worldMap.beyond')}</p>
                            )}
                            {settled && region && <PlaceFacts region={region} version={version} />}
                            {cell.outputs.length > 0 && (
                                <div className="flex flex-col gap-1" data-world-yields>
                                    <h3 className={headingCls}>{t('worldMap.yields')}</h3>
                                    {cell.outputs.map(id => <EntityRibbon key={id} kind="item" id={id} size="sm" wrap />)}
                                </div>
                            )}
                            {!settled && (
                                <div className="flex flex-col gap-1" data-world-price>
                                    <h3 className={headingCls}>{t('worldMap.price')}</h3>
                                    <PriceRows price={cell.price} />
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </ArrowScrollList>
            {cell && (frontier || (settled && !cell.here && cell.regionId) || message) && (
                <div className="shrink-0 pt-3 flex flex-col gap-1">
                    {frontier && (
                        <KitButton
                            tone={KIT_BUTTON_TONE.MAIN}
                            data-world-settle={cell.id}
                            disabled={!cell.price.met}
                            onClick={() => onSettle(cell.id)}
                            className="w-full"
                            buttonClassName="font-pixel ui-text-title py-2"
                        >
                            {t('worldMap.settle')}
                        </KitButton>
                    )}
                    {settled && !cell.here && cell.regionId && (
                        <KitButton
                            tone={KIT_BUTTON_TONE.MAIN}
                            data-world-travel={cell.id}
                            onClick={() => onTravel(cell.regionId)}
                            className="w-full"
                            buttonClassName="font-pixel ui-text-title py-2"
                        >
                            {t('worldMap.travel')}
                        </KitButton>
                    )}
                    {(message || short) && (
                        <p role="status" data-world-message className="font-pixel ui-text-small" style={{ color: 'var(--color-ui-red)' }}>{message || short}</p>
                    )}
                </div>
            )}
        </PixelFrame>
    );
};

export default WorldPanel;
