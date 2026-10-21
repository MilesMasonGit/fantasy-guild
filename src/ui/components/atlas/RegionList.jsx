import { useEffect, useMemo, useRef, useState } from 'react';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import { TEXT, FLAVOUR_NAME_MAX } from '../../../systems/atlas/regionNames.js';
import { cn } from '../../utils/cn.js';
import { PixelFrame } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { AtlasButton } from './AtlasButton.jsx';
import { TomeSpread } from './AtlasTome.jsx';
import { bannerForRegion } from './regionBanner.js';
import { SCREEN_TEXT } from './atlasScreenText.js';

/** The hero flag marking the Region the guild is in: the 64 px flag art at 1×. */
const HERE_FLAG_PX = 64;
/** A row's height in screen px: the flag and a slice of the banner. */
const ROW_PX = 84;

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

const boxCls = 'bg-black/65 px-2 py-0.5';

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
        return <div className="font-pixel ui-text-title font-bold text-white">{region.flavourName}</div>;
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

/** Three art pixels in a row: the "more" icon, drawn in code until there is a sprite. */
const MoreDots = () => (
    <svg width={20} height={8} viewBox="0 0 10 4" shapeRendering="crispEdges" aria-hidden="true" className="block">
        {[1, 4, 7].map(x => <rect key={x} x={x} y={1} width={2} height={2} fill="currentColor" />)}
    </svg>
);

const menuItemCls = 'block w-full text-left px-2 py-0.5 whitespace-nowrap font-pixel ui-text-body hover:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

const RegionRow = ({ region, banner, onTravel, onMessage }) => {
    const [menu, setMenu] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [draft, setDraft] = useState(null);
    const refusal = abandonRefusal(region);
    const act = (fn) => {
        setMenu(false);
        const result = fn(region.id);
        onMessage(result.success ? null : result.reason);
    };
    return (
        <div role="listitem" data-region-row={region.id} data-region-active={region.active} className="relative shrink-0 flex flex-col" style={{ minHeight: ROW_PX }}>
            <PixelFrame kind="studs" className="flex-1 flex flex-col" frameClassName="relative flex-1 flex flex-col overflow-hidden">
                <BannerArt banner={banner} />
                <div className="relative flex-1 flex items-center gap-2 px-2 py-1">
                    <div className={cn(boxCls, 'min-w-0')}>
                        <FlavourName region={region} draft={draft} setDraft={setDraft} onMessage={onMessage} />
                        <div className="font-pixel ui-text-small text-white/70">{region.practicalName}</div>
                    </div>
                    <div className="flex-1" />
                    {region.active ? (
                        <span data-region-here title={SCREEN_TEXT.HERE} className="shrink-0 block leading-none">
                            <FlagMark size={HERE_FLAG_PX} alt={SCREEN_TEXT.HERE} />
                        </span>
                    ) : region.archived ? (
                        <AtlasButton data-region-restore={region.id} onClick={() => act(Atlas.restore)}>{SCREEN_TEXT.RESTORE}</AtlasButton>
                    ) : (
                        <AtlasButton main data-region-travel={region.id} onClick={() => onTravel(region.id)}>{SCREEN_TEXT.TRAVEL}</AtlasButton>
                    )}
                    <button
                        type="button"
                        data-region-menu={region.id}
                        aria-label={SCREEN_TEXT.MORE}
                        title={SCREEN_TEXT.MORE}
                        aria-expanded={menu}
                        onClick={() => setMenu(m => !m)}
                        className={cn(boxCls, 'self-center py-2 flex items-center text-white hover:[filter:drop-shadow(1px_0_0_#fff)_drop-shadow(-1px_0_0_#fff)]')}
                    >
                        <MoreDots />
                    </button>
                </div>
            </PixelFrame>
            {menu && (
                <PixelFrame kind="chamfer" className="absolute right-12 top-1 z-20" frameClassName="py-1 min-w-[8rem]">
                    <div role="menu" data-region-menu-list={region.id}>
                        <button type="button" role="menuitem" data-region-rename={region.id} className={menuItemCls}
                            onClick={() => { setMenu(false); setDraft(region.flavourName); }}>
                            {SCREEN_TEXT.RENAME}
                        </button>
                        {!region.archived && !region.active && (
                            <button type="button" role="menuitem" data-region-archive={region.id} className={menuItemCls} onClick={() => act(Atlas.archive)}>
                                {SCREEN_TEXT.ARCHIVE}
                            </button>
                        )}
                        <button
                            type="button"
                            role="menuitem"
                            data-region-abandon={region.id}
                            disabled={!!refusal}
                            title={refusal || undefined}
                            className={cn(menuItemCls, 'text-[var(--color-ui-red)]')}
                            onClick={() => { setMenu(false); setConfirming(true); }}
                        >
                            {SCREEN_TEXT.ABANDON}
                        </button>
                    </div>
                </PixelFrame>
            )}
            {confirming && (
                <div data-region-abandon-confirm={region.id} className="absolute inset-x-2 bottom-2 z-20 flex items-center gap-2 bg-black/90 px-2 py-1">
                    <span className="flex-1 font-pixel ui-text-small" style={{ color: 'var(--color-ui-red)' }}>{SCREEN_TEXT.abandonQuestion(region.flavourName)}</span>
                    <AtlasButton data-region-abandon-yes={region.id} className="text-[var(--color-ui-red)]" onClick={() => { setConfirming(false); act(Atlas.abandon); }}>{SCREEN_TEXT.ABANDON}</AtlasButton>
                    <AtlasButton data-region-abandon-no={region.id} onClick={() => setConfirming(false)}>{SCREEN_TEXT.KEEP}</AtlasButton>
                </div>
            )}
        </div>
    );
};

/**
 * Every Region the guild has settled, down the left page and on down the right, one row per Region
 * on its area banner: its two names, Travel, and a "…" menu for Rename, Archive and Abandon (asked
 * first). The Region the guild is in shows the hero flag instead of Travel. The Starter Camp comes
 * first, then by the day settled; the archive sits behind a toggle at the foot.
 */
export const RegionList = ({ version, onTravel, message, onMessage }) => {
    const regions = useMemo(() => regionOrder(Atlas.list()), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const archived = useMemo(() => regionOrder(Atlas.list({ archived: true })), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const [showArchive, setShowArchive] = useState(false);
    const row = (r) => <RegionRow key={r.id} region={r} banner={bannerForRegion(r)} onTravel={onTravel} onMessage={onMessage} />;
    // Read like a book: the first half down the left page, the rest down the right.
    const half = Math.ceil(regions.length / 2);
    const page = (children) => (
        <ArrowScrollList step={ROW_PX + 8} compact className="flex-1 min-h-0 flex flex-col gap-2 py-1">{children}</ArrowScrollList>
    );
    const left = page(<div role="list" className="flex flex-col gap-2">{regions.slice(0, half).map(row)}</div>);
    const right = (
        <>
            {page(
                <>
                    <div role="list" className="flex flex-col gap-2">{regions.slice(half).map(row)}</div>
                    {showArchive && archived.length > 0 && (
                        <div data-region-archive-list className="flex flex-col gap-2">
                            <h3 className="font-pixel ui-text-small uppercase tracking-wide bg-black/65 self-start px-2 text-white/70">{SCREEN_TEXT.ARCHIVED_HEADING}</h3>
                            <div role="list" className="flex flex-col gap-2">{archived.map(row)}</div>
                        </div>
                    )}
                </>
            )}
            {(message || archived.length > 0) && (
                <div className="shrink-0 pt-1 flex flex-wrap items-center justify-end gap-2">
                    {message && <p role="status" data-region-message className="flex-1 font-pixel ui-text-small bg-black/80 px-2" style={{ color: 'var(--color-ui-red)' }}>{message}</p>}
                    {archived.length > 0 && (
                        <AtlasButton data-region-archive-toggle aria-pressed={showArchive} onClick={() => setShowArchive(s => !s)}>
                            {showArchive ? SCREEN_TEXT.HIDE_ARCHIVE : SCREEN_TEXT.showArchive(archived.length)}
                        </AtlasButton>
                    )}
                </div>
            )}
        </>
    );
    return (
        <div data-region-list className="absolute inset-0">
            <TomeSpread left={left} right={right} />
        </div>
    );
};

export default RegionList;
