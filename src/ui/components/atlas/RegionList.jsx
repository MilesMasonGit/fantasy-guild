import { useEffect, useMemo, useRef, useState } from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { TEXT, FLAVOUR_NAME_MAX } from '../../../systems/atlas/regionNames.js';
import { matW, matH } from '../../../config/matGeometry.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { cn } from '../../utils/cn.js';
import { PixelFrame, FRAME_BAND_PX } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { AtlasButton } from './AtlasButton.jsx';
import { TomeSpread, usePageRects } from './AtlasTome.jsx';
import { MapPreview } from './MapPreview.jsx';
import { previewFit } from './mapPreview.js';
import { bannerForRegion } from './regionBanner.js';
import { regionPlan, regionFacts } from './regionPreview.js';
import { SCREEN_TEXT } from './atlasScreenText.js';

/** The hero flag marking the Region the guild is in: the 64 px flag art at 1×. */
const HERE_FLAG_PX = 64;
/** A row's height in screen px: the flag and a band of the banner. */
const ROW_PX = 96;
const ROW_GAP_PX = 8;
/** One art pixel of the UI in screen px: the selected row's gold edge is one. */
const ART_PX = 2;
/** The Region page's header: its banner band and names. */
const HEADER_PX = 88;
/**
 * What the Region page keeps below its preview, in screen px: the header, the facts, a row of
 * landmarks, the buttons and the frames' bands. The preview gets the rest.
 */
const RIGHT_PAGE_RESERVED_PX = HEADER_PX + 300;
const PANEL_INSET_PX = FRAME_BAND_PX + 8;
/** The Region's Tokens as listing-size sprites: a row with its gap, and how many rows show before it scrolls. */
const CONTENT_GAP_PX = 4;
const CONTENT_ROW_PX = 32 + CONTENT_GAP_PX;
const CONTENT_ROWS_SHOWN = 3;
const PREVIEW_MARGIN_PX = 4;

/** Why Region `region` cannot be abandoned, or null when it can. The engine refuses the same. */
export function abandonRefusal(region) {
    if (region.active) return TEXT.REFUSE_ACTIVE;
    if (region.kind === Atlas.REGION_KIND.STARTER) return TEXT.REFUSE_STARTER;
    return null;
}

/** The Regions in the list's order: the Starter Camp first, then by the day settled, then as written. */
export function regionOrder(regions, settledAtOf = (id) => Atlas.getRegion(id)?.settledAt || 0) {
    const starter = (r) => (r.kind === Atlas.REGION_KIND.STARTER ? 0 : 1);
    return regions
        .map((r, i) => ({ r, i, at: settledAtOf(r.id) }))
        .sort((a, b) => starter(a.r) - starter(b.r) || a.at - b.at || a.i - b.i)
        .map(x => x.r);
}

/**
 * Which Region the page shows: the one clicked while it is still listed (an archived one only
 * while the archive is open), else the one the guild is in, else the first.
 */
export function shownRegionId(chosen, regions, archived, showArchive) {
    const listed = showArchive ? [...regions, ...archived] : regions;
    if (chosen && listed.some(r => r.id === chosen)) return chosen;
    return (regions.find(r => r.active) || regions[0] || null)?.id ?? null;
}

const boxCls = 'bg-black/65 px-2 py-0.5';
const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60';

/** The flavour name, and its inline rename: Enter or leaving the box keeps it, Escape does not. */
const FlavourName = ({ region, draft, setDraft, onMessage }) => {
    // Enter or Escape unmounts the box, and a browser may blur it on the way out: that blur must do nothing.
    const dropped = useRef(false);
    const commit = () => {
        if (draft == null || dropped.current) return;
        dropped.current = true;
        const result = Atlas.rename(region.id, draft);
        setDraft(null);
        onMessage(result.success ? null : result.reason);
    };
    const editing = draft != null;
    useEffect(() => { if (editing) dropped.current = false; }, [editing]);
    if (!editing) {
        return <div className="font-pixel ui-text-title font-bold text-white truncate">{region.flavourName}</div>;
    }
    return (
        <input
            autoFocus
            data-region-rename-input={region.id}
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
            className="w-full max-w-[16rem] px-1 bg-black/80 border border-gi-gold/50 text-white outline-none font-pixel ui-text-title"
        />
    );
};

const HereFlag = () => (
    <span data-region-here title={SCREEN_TEXT.HERE} className="relative shrink-0 block leading-none">
        <FlagMark size={HERE_FLAG_PX} alt={SCREEN_TEXT.HERE} />
    </span>
);

/** A Region on the left page: its banner with its two names, the hero flag where the guild is; a click shows it on the right page. */
const RegionRow = ({ region, selected, onSelect }) => (
    <div role="listitem" data-region-row={region.id} data-region-active={region.active} className="relative shrink-0 flex flex-col" style={{ height: ROW_PX }}>
        <PixelFrame kind="studs" className="flex-1 flex flex-col" frameClassName="relative flex-1 flex flex-col overflow-hidden">
            <button
                type="button"
                data-region-select={region.id}
                aria-pressed={selected}
                onClick={() => onSelect(region.id)}
                className="relative flex-1 flex items-center gap-2 px-2 py-1 text-left cursor-pointer group"
            >
                <BannerArt banner={bannerForRegion(region)} />
                <span className={cn(boxCls, 'relative min-w-0 flex flex-col group-hover:bg-black/80')}>
                    <span className={cn('font-pixel ui-text-title font-bold truncate', selected ? 'text-[var(--color-ui-gold)]' : 'text-white')}>{region.flavourName}</span>
                    <span className="font-pixel ui-text-small text-white/70 truncate">{region.practicalName}</span>
                </span>
                <span className="flex-1" />
                {region.active && <HereFlag />}
                {selected && (
                    <span
                        aria-hidden="true"
                        data-region-selected
                        className="absolute inset-0 pointer-events-none"
                        style={{ boxShadow: `inset 0 0 0 ${ART_PX}px var(--color-ui-gold)` }}
                    />
                )}
            </button>
        </PixelFrame>
    </div>
);

const Fact = ({ id, label, children }) => (
    <div data-region-stat={id} className="flex items-baseline gap-2">
        <dt className={cn(headingCls, 'w-24 shrink-0')}>{label}</dt>
        <dd className="font-pixel ui-text-body text-white min-w-0">{children}</dd>
    </div>
);

/**
 * The right page: Region `region` (a `list()` summary) as its banner and names, its ground drawn
 * small with its Tokens (`MapPreview`, once per Region chosen), what it holds (its ground, counts,
 * landmarks, and its Tokens as sprites with counts), and
 * Travel, Rename, Archive and Abandon (asked first). The Region the guild is in shows the hero flag
 * in place of Travel; an archived one shows Restore.
 */
const RegionPage = ({ region, version, open, onTravel, message, onMessage }) => {
    const [draft, setDraft] = useState(null);
    // The picture waits until the page is first seen: an Atlas opened on Cartography draws none.
    const [seen, setSeen] = useState(open);
    useEffect(() => { if (open) setSeen(true); }, [open]);
    const [confirming, setConfirming] = useState(false);
    useEffect(() => {
        setDraft(null);
        setConfirming(false);
    }, [region.id]);

    const record = Atlas.getRegion(region.id);
    const activeId = Atlas.activeRegionId();
    // One plan per Region chosen: renaming it, the Bank or the live board moving do not redraw it.
    const plan = useMemo(() => regionPlan(record), [record, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const facts = useMemo(() => regionFacts(record), [record, version]); // eslint-disable-line react-hooks/exhaustive-deps

    const rects = usePageRects();
    const boxW = Math.max(0, Math.floor(rects.right.width - 2 * PANEL_INSET_PX));
    const maxH = Math.max(0, Math.floor(rects.right.height - RIGHT_PAGE_RESERVED_PX));
    const wide = matW();
    const high = matH();
    const mat = useMemo(() => ({ w: wide, h: high }), [wide, high]);
    const fit = useMemo(
        () => previewFit(mat, boxW - 2 * PREVIEW_MARGIN_PX, maxH - 2 * PREVIEW_MARGIN_PX),
        [mat, boxW, maxH]
    );

    const refusal = abandonRefusal(region);
    const act = (fn) => {
        const result = fn(region.id);
        onMessage(result.success ? null : result.reason);
    };

    return (
        <section data-region-detail={region.id} className="flex-1 min-h-0 flex flex-col">
            <PixelFrame kind="studs" className="shrink-0 flex flex-col" frameClassName="relative flex flex-col overflow-hidden" style={{ height: HEADER_PX }}>
                <BannerArt banner={bannerForRegion(region)} />
                <div className="relative flex-1 flex items-center gap-2 px-2 py-1">
                    <div className={cn(boxCls, 'min-w-0')}>
                        <FlavourName region={region} draft={draft} setDraft={setDraft} onMessage={onMessage} />
                        <div className="font-pixel ui-text-small text-white/70 truncate">{region.practicalName}</div>
                    </div>
                    <div className="flex-1" />
                    {region.active && <HereFlag />}
                </div>
            </PixelFrame>
            <PixelFrame kind="studs" className="mt-2 shrink min-h-0 flex flex-col" frameClassName="min-h-0 flex flex-col items-center gap-2 p-2 bg-gi-surface/95">
                <div
                    data-region-preview
                    className="relative shrink-0 flex items-center justify-center overflow-hidden bg-black/40"
                    style={{ width: boxW, height: fit.height + 2 * PREVIEW_MARGIN_PX }}
                >
                    {plan && seen && <MapPreview plan={plan} mat={mat} fit={fit} />}
                </div>
                <dl className="w-full flex flex-col gap-0.5">
                    <Fact id="ground" label={SCREEN_TEXT.FACT_GROUND}>{facts.biomes.join(', ')}</Fact>
                    <Fact id="tokens" label={SCREEN_TEXT.FACT_TOKENS}>{facts.tokens}</Fact>
                    <Fact id="heroes" label={SCREEN_TEXT.FACT_HEROES}>{facts.heroes}</Fact>
                    {facts.landmarks.length > 0 && (
                        <Fact id="landmarks" label={SCREEN_TEXT.FACT_LANDMARKS}>
                            <ul data-region-landmarks className="flex flex-wrap gap-x-3 gap-y-1">
                                {facts.landmarks.map(l => (
                                    <li key={l.typeId} data-region-landmark={l.typeId} className="flex items-center gap-1">
                                        <TokenSprite typeId={l.typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
                                        <span>{l.count > 1 ? `${l.name} ×${l.count}` : l.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </Fact>
                    )}
                </dl>
                {facts.contents.length > 0 && (
                    <ArrowScrollList step={CONTENT_ROW_PX} compact className="w-full min-h-0" listProps={{ style: { maxHeight: CONTENT_ROWS_SHOWN * CONTENT_ROW_PX } }}>
                        <ul data-region-contents className="flex flex-wrap gap-x-2" style={{ rowGap: CONTENT_GAP_PX }}>
                            {facts.contents.map(({ typeId, count }) => (
                                <Tooltip key={typeId} title={tokenName(typeId) || typeId}>
                                    <li data-region-token={typeId} data-count={count} className="flex items-center gap-0.5">
                                        <TokenSprite typeId={typeId} surface={TOKEN_SURFACE.CATALOGUE} alt="" />
                                        <span className="font-pixel ui-text-small tabular-nums text-white/85">×{count}</span>
                                    </li>
                                </Tooltip>
                            ))}
                        </ul>
                    </ArrowScrollList>
                )}
            </PixelFrame>
            <div className="relative mt-2 shrink-0 flex flex-wrap items-center justify-end gap-2">
                <AtlasButton data-region-rename={region.id} onClick={() => setDraft(region.flavourName)}>{SCREEN_TEXT.RENAME}</AtlasButton>
                {!region.archived && !region.active && (
                    <AtlasButton data-region-archive={region.id} onClick={() => act(Atlas.archive)}>{SCREEN_TEXT.ARCHIVE}</AtlasButton>
                )}
                <AtlasButton
                    data-region-abandon={region.id}
                    disabled={!!refusal}
                    title={refusal || undefined}
                    style={refusal ? undefined : { color: 'var(--color-ui-red)' }}
                    onClick={() => setConfirming(true)}
                >
                    {SCREEN_TEXT.ABANDON}
                </AtlasButton>
                {region.archived ? (
                    <AtlasButton data-region-restore={region.id} onClick={() => act(Atlas.restore)}>{SCREEN_TEXT.RESTORE}</AtlasButton>
                ) : !region.active && (
                    <AtlasButton main data-region-travel={region.id} onClick={() => onTravel(region.id)}>{SCREEN_TEXT.TRAVEL}</AtlasButton>
                )}
            </div>
            {confirming && (
                <div data-region-abandon-confirm={region.id} className="mt-2 shrink-0 flex items-center gap-2 bg-black/90 px-2 py-1">
                    <span className="flex-1 font-pixel ui-text-small" style={{ color: 'var(--color-ui-red)' }}>{SCREEN_TEXT.abandonQuestion(region.flavourName)}</span>
                    <AtlasButton data-region-abandon-yes={region.id} className="text-[var(--color-ui-red)]" onClick={() => { setConfirming(false); act(Atlas.abandon); }}>{SCREEN_TEXT.ABANDON}</AtlasButton>
                    <AtlasButton data-region-abandon-no={region.id} onClick={() => setConfirming(false)}>{SCREEN_TEXT.KEEP}</AtlasButton>
                </div>
            )}
            {message && <p role="status" data-region-message className="mt-2 shrink-0 font-pixel ui-text-small bg-black/80 px-2" style={{ color: 'var(--color-ui-red)' }}>{message}</p>}
        </section>
    );
};

/**
 * The Regions as a two-page spread. The left page lists every Region the guild has settled, one
 * row per Region on its area banner with its two names: the Starter Camp first, then by the day
 * settled, the archive behind a toggle at the foot. A click on a row shows that Region on the
 * right page (`RegionPage`); the one the guild is in is shown first. `open` is whether the section
 * is on screen.
 */
export const RegionList = ({ version, open = true, onTravel, message, onMessage }) => {
    const regions = useMemo(() => regionOrder(Atlas.list()), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const archived = useMemo(() => regionOrder(Atlas.list({ archived: true })), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const [showArchive, setShowArchive] = useState(false);
    const [chosen, setChosen] = useState(null);
    const shownId = shownRegionId(chosen, regions, archived, showArchive);
    const shown = regions.find(r => r.id === shownId) || archived.find(r => r.id === shownId) || null;
    const select = (id) => {
        if (id !== shownId) onMessage(null);
        setChosen(id);
    };
    const row = (r) => <RegionRow key={r.id} region={r} selected={r.id === shownId} onSelect={select} />;

    const left = (
        <>
            <ArrowScrollList step={ROW_PX + ROW_GAP_PX} compact className="flex-1 min-h-0 flex flex-col py-1">
                <div className="flex flex-col" style={{ gap: ROW_GAP_PX }}>
                    <div role="list" className="flex flex-col" style={{ gap: ROW_GAP_PX }}>{regions.map(row)}</div>
                    {showArchive && archived.length > 0 && (
                        <div data-region-archive-list className="flex flex-col" style={{ gap: ROW_GAP_PX }}>
                            <h3 className={cn(headingCls, 'bg-black/65 self-start px-2')}>{SCREEN_TEXT.ARCHIVED_HEADING}</h3>
                            <div role="list" className="flex flex-col" style={{ gap: ROW_GAP_PX }}>{archived.map(row)}</div>
                        </div>
                    )}
                </div>
            </ArrowScrollList>
            {archived.length > 0 && (
                <div className="shrink-0 pt-1 flex justify-end">
                    <AtlasButton data-region-archive-toggle aria-pressed={showArchive} onClick={() => setShowArchive(s => !s)}>
                        {showArchive ? SCREEN_TEXT.HIDE_ARCHIVE : SCREEN_TEXT.showArchive(archived.length)}
                    </AtlasButton>
                </div>
            )}
        </>
    );
    const right = shown
        ? <RegionPage region={shown} version={version} open={open} onTravel={onTravel} message={message} onMessage={onMessage} />
        : null;
    return (
        <div data-region-list className="absolute inset-0">
            <TomeSpread left={left} right={right} />
        </div>
    );
};

export default RegionList;
