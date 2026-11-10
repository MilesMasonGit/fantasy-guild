import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Feather } from 'lucide-react';
import { t } from '../../../i18n/index.js';
import * as Atlas from '../../../systems/atlas/Atlas.js';
import * as World from '../../../systems/world/World.js';
import { FLAVOUR_NAME_MAX } from '../../../systems/atlas/regionNames.js';
import { CELL_STATE } from '../../../systems/world/frontier.js';
import { matW, matH } from '../../../config/matGeometry.js';
import { formatPlaytime } from '../../../utils/Formatters.js';
import { SideDrawer } from '../base/SideDrawer.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../base/KitButton.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { PixelGlyph } from '../base/PixelGlyph.jsx';
import { Tooltip } from '../base/Tooltip.jsx';
import { FlagMark } from '../board/FlagMark.jsx';
import { onPoll } from '../board/frameClock.js';
import { MapPreview } from './MapPreview.jsx';
import { previewFit } from './mapPreview.js';
import { regionPlan } from './regionPreview.js';
import { GroundDials } from './GroundDials.jsx';
import { PriceRows, shortWords, lockWords } from './WorldPrice.jsx';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { useWorldArrived } from './WorldCamera.jsx';
import { useWorldInspection } from './worldInspection.js';

const HERE_FLAG_PX = 48;
const PREVIEW_MARGIN_PX = 4;
const PREVIEW_MAX_H = 180;
/** The preview box's width before the drawer has been measured (a test, a hidden pane). */
const PREVIEW_FALLBACK_W = 224;
/** How often a settled place's Token count and playtime are read again while shown. */
const LIVE_READ_MS = 1000;

const headingCls = 'font-pixel ui-text-small uppercase tracking-wide text-white/60';

/** Re-read `read()` every {@link LIVE_READ_MS} while mounted (and whenever `key` changes); a value React compares. */
function useLiveRead(read, key) {
    const [value, setValue] = useState(read);
    const latest = useRef(read);
    latest.current = read;
    useEffect(() => {
        setValue(latest.current());
        return onPoll(() => setValue(latest.current()), LIVE_READ_MS);
    }, [key]);
    return value;
}

/** A box's inner width, read when it mounts and when the window resizes. */
function useBoxWidth(fallback) {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const measure = () => setWidth(ref.current?.clientWidth || 0);
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);
    return [ref, width > 0 ? width : fallback];
}

/** The place's name, and its rename behind the quill: Enter or leaving the box keeps it, Escape does not. */
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
        onMessage?.(result.success ? null : result.reason);
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
        <div className="min-w-0 flex items-start gap-1">
            <h2 data-world-name className="min-w-0 font-pixel ui-text-title font-bold text-white break-words">{cell.name}</h2>
            {region && (
                <button
                    type="button"
                    data-world-rename={cell.id}
                    aria-label={SCREEN_TEXT.RENAME}
                    title={SCREEN_TEXT.RENAME}
                    onClick={() => setDraft(cell.name)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-gi-muted hover:text-[var(--color-ui-white)] transition-colors cursor-pointer"
                >
                    {/* ⚠️ Placeholder quill until the owner draws one (the hero panel's). */}
                    <Feather size={16} />
                </button>
            )}
        </div>
    );
};

/**
 * A settled place's mat drawn small, its Tokens over the cap in the corner (`28/128`, no label):
 * the guild's cap, the same in every place (`Atlas.capStatusOf`).
 */
const PlacePreview = ({ region, version }) => {
    const record = Atlas.getRegion(region.id);
    const activeId = Atlas.activeRegionId();
    const plan = useMemo(() => regionPlan(record), [record, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
    const wide = matW();
    const high = matH();
    const mat = useMemo(() => ({ w: wide, h: high }), [wide, high]);
    const [boxRef, boxW] = useBoxWidth(PREVIEW_FALLBACK_W);
    const fit = useMemo(() => previewFit(mat, boxW - 2 * PREVIEW_MARGIN_PX, PREVIEW_MAX_H), [mat, boxW]);
    // Drawn once the camera has arrived: drawing it mid-glide would stall the glide.
    const arrived = useWorldArrived();
    const count = useLiveRead(() => {
        const status = Atlas.capStatusOf(region.id);
        return status ? `${status.count}/${status.cap}` : '';
    }, `${region.id}|${version}`);
    return (
        <div ref={boxRef} data-world-facts={region.id} className="w-full">
            <div data-world-preview className="relative flex items-center justify-center overflow-hidden bg-black/40" style={{ height: fit.height + 2 * PREVIEW_MARGIN_PX }}>
                {plan && arrived && <MapPreview plan={plan} mat={mat} fit={fit} />}
                {count && (
                    <Tooltip title={t('worldMap.tokensTip')}>
                        <span data-world-count className="absolute right-1 bottom-1 px-1 bg-black/75 font-pixel ui-text-small font-bold tabular-nums text-white">{count}</span>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

/** How long the guild has spent on a settled place, time away included, read live. */
const PlacePlaytime = ({ regionId }) => {
    const text = useLiveRead(() => formatPlaytime(Atlas.playtimeOf(regionId)), regionId);
    return (
        <Tooltip title={t('worldMap.playtime')} lines={[t('worldMap.playtimeTip')]} maxWidth={240}>
            <div data-world-playtime={regionId} className="flex items-center gap-1.5 font-pixel ui-text-body text-white cursor-help">
                <span className="text-white/60"><PixelGlyph name="clock" /></span>
                <span className="tabular-nums">{text}</span>
            </div>
        </Tooltip>
    );
};

/** The cartographer's words at the top of the drawer, while the tutorial's last step asks for a place. */
const CartographerNote = ({ note }) => (
    <div data-world-note className="flex flex-col gap-0.5 pb-2 mb-1 border-b border-white/10">
        <div className={headingCls}>{note.speaker}</div>
        <div className="font-pixel ui-text-title font-bold text-white">{note.title}</div>
        <div className="font-pixel ui-text-body text-white/85 italic">{note.says}</div>
        <div className="font-pixel ui-text-small text-white/70">{note.instruction}</div>
    </div>
);

/**
 * What the World Map drawer holds for the chosen place. Its header: the guild's flag when the guild
 * is there, the place's name (renamed behind the quill once settled), its land and line, the X that
 * closes the map. Then, while the tutorial's last step asks for a place, the cartographer's words;
 * once settled, its mat drawn small with its Token count over the cap in the corner; the three
 * ground dials (Water, Grass, Stone), settled or not; once settled, the time spent there; what it
 * yields; its price while not settled. At the foot a large Settle on the frontier (greyed with what
 * is short, or the Guild Hall star its ring waits for) or Travel to a settled place elsewhere.
 *
 * @param {object} props
 * @param {object|null} props.cell a `worldView()` cell
 */
export const WorldDrawerBody = ({ cell, note, version, message, onMessage, onSettle, onTravel, onClose }) => {
    const settled = cell?.state === CELL_STATE.SETTLED;
    const frontier = cell?.state === CELL_STATE.FRONTIER;
    const region = cell?.regionId ? Atlas.getRegion(cell.regionId) : null;
    const locked = frontier && !!cell.lock;
    const short = frontier ? (lockWords(cell.lock) || shortWords(cell.price)) : null;
    const shares = useMemo(() => (cell ? World.placeGround(cell.id) : null), [cell?.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <>
            <header className="shrink-0 flex items-start gap-2 px-3 pt-3">
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
            </header>
            {/* The arrow bars are siblings of the list: this column holds all three. */}
            <div className="flex-1 min-h-0 flex flex-col">
                <ArrowScrollList step={80} compact className="flex-1 min-h-0">
                    <div className="flex flex-col gap-3 px-3 py-2">
                        {note && <CartographerNote note={note} />}
                        {!cell && <p className="font-pixel ui-text-body text-white/60">{t('worldMap.pickCell')}</p>}
                        {cell && (
                            <section data-world-detail={cell.id} className="flex flex-col gap-3">
                                {cell.state === CELL_STATE.BEYOND && (
                                    <p data-world-detail-state className="font-pixel ui-text-small text-white/60">{t('worldMap.beyond')}</p>
                                )}
                                {settled && region && <PlacePreview region={region} version={version} />}
                                {shares && <GroundDials shares={shares} />}
                                {settled && region && <PlacePlaytime regionId={region.id} />}
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
                                {cell.state === CELL_STATE.BEYOND && cell.lock && (
                                    <p data-world-detail-lock className="font-pixel ui-text-small text-white/60">{lockWords(cell.lock)}</p>
                                )}
                            </section>
                        )}
                    </div>
                </ArrowScrollList>
            </div>
            {cell && (frontier || (settled && !cell.here && cell.regionId) || message) && (
                <footer className="shrink-0 px-3 pt-2 pb-3 flex flex-col gap-1">
                    {frontier && (
                        <KitButton
                            tone={KIT_BUTTON_TONE.MAIN}
                            data-world-settle={cell.id}
                            data-world-settle-locked={locked || undefined}
                            disabled={locked || !cell.price.met}
                            onClick={() => onSettle?.(cell.id)}
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
                            onClick={() => onTravel?.(cell.regionId)}
                            className="w-full"
                            buttonClassName="font-pixel ui-text-title py-2"
                        >
                            {t('worldMap.travel')}
                        </KitButton>
                    )}
                    {(message || short) && (
                        <p role="status" data-world-message className="font-pixel ui-text-small" style={{ color: 'var(--color-ui-red)' }}>{message || short}</p>
                    )}
                </footer>
            )}
        </>
    );
};

/**
 * The World Map drawer: the side drawer (`SideDrawer`) in the world's blue, open while the world
 * map is (`open`) and its screen shows a world. The screen picks the place and does what is pressed
 * (`worldInspection.js`); the X closes the map.
 *
 * @param {{ open: boolean, menuRight?: boolean, onClose: () => void }} props
 */
export const WorldDrawer = ({ open, menuRight = false, onClose }) => {
    const shown = useWorldInspection();
    return (
        <SideDrawer
            open={open && !!shown}
            menuRight={menuRight}
            backdrop="world"
            label={t('worldMap.label')}
            data-world-panel={shown?.cell?.id || ''}
        >
            {shown && <WorldDrawerBody {...shown} onClose={onClose} />}
        </SideDrawer>
    );
};

export default WorldDrawer;
