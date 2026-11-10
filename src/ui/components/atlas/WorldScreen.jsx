import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { t } from '../../../i18n/index.js';
import * as World from '../../../systems/world/World.js';
import { HALL_CELL } from '../../../systems/world/frontier.js';
import { useAtlasRefresh } from './useAtlasRefresh.js';
import { travelFromScreen, END_DRAG_MARK } from './travelFromScreen.js';
import { worldView } from './worldView.js';
import { WorldMap } from './WorldMap.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { sideDrawerEdge } from '../base/SideDrawer.jsx';
import { NOTIFICATION_COLUMN, columnWidthAt } from '../board/boardConstants.js';
import { FOG_CSS } from './worldPicture.js';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { useWorldInsets } from './WorldCamera.jsx';
import { setWorldInspection } from './worldInspection.js';

/** The no-world screen's X keeps this far in from the room's corner. */
const CLOSE_GAP = 16;

/**
 * The strips of the screen the map keeps clear of when it centres (`WorldMap`'s `reserve`): the
 * mat's room's insets, and on the side away from the nav the World Map drawer, `drawerPx` wide from
 * the screen's edge.
 */
export function worldReserve(insets, menuRight, drawerPx) {
    const side = sideDrawerEdge(menuRight);
    return { ...insets, [side]: Math.max(insets[side] || 0, drawerPx) };
}

/** The window's width, kept current: the drawer's width follows it (`NOTIFICATION_COLUMN`). */
function useViewportWidth() {
    const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth || 0));
    useEffect(() => {
        const read = () => setWidth(window.innerWidth || 0);
        window.addEventListener('resize', read);
        return () => window.removeEventListener('resize', read);
    }, []);
    return width;
}

/**
 * The world map screen, below the mat (`WorldCamera` pans down to it): the map fills the whole
 * screen under the nav, the hero bar and the World Map drawer, centred in the room they leave
 * ({@link useWorldInsets}, {@link worldReserve}). The chosen place shows in the drawer
 * (`WorldDrawer`, in the screen-wide overlay; this screen hands it the place and what its buttons do
 * through `worldInspection.js`). Settle pays a place and takes the guild there; Travel goes to a
 * place settled; either closes the screen. Escape or the drawer's X close it too. A save from
 * before the world shows one line, with its own X.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {boolean} [props.menuRight] the nav on the right: the drawer stands on the left
 */
export const WorldScreen = ({ onClose, menuRight = false }) => {
    const version = useAtlasRefresh();
    const { isDragging } = useActiveDrag();
    const view = useMemo(() => worldView(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const [chosen, setChosen] = useState(null);
    const [message, setMessage] = useState(null);
    const insets = useWorldInsets();
    const drawerPx = columnWidthAt(useViewportWidth(), NOTIFICATION_COLUMN);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !e[END_DRAG_MARK]) onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const travel = async (regionId) => {
        const result = await travelFromScreen(regionId, { isDragging });
        if (result?.success) {
            setMessage(null);
            onClose?.();
            return;
        }
        setMessage(result?.reason ?? null);
    };

    // Settling moves the guild, so a carried Token is put down first, as for travel.
    const settle = async (cellId) => {
        const result = await travelFromScreen(cellId, { isDragging, travel: World.settleCell });
        if (result?.success) {
            setMessage(null);
            onClose?.();
            return;
        }
        setMessage(result?.reason ?? null);
    };

    // The drawer calls the latest of these, so what it is handed changes only with what it shows.
    const handlers = useRef(null);
    handlers.current = { settle, travel, setMessage };
    const actions = useMemo(() => ({
        onSettle: (id) => handlers.current.settle(id),
        onTravel: (id) => handlers.current.travel(id),
        onMessage: (text) => handlers.current.setMessage(text)
    }), []);

    const selectedId = view && chosen && view.cells.some(c => c.id === chosen && c.shown) ? chosen : (view?.here || HALL_CELL);
    const cell = view?.cells.find(c => c.id === selectedId) || null;
    const note = view?.note ?? null;

    // Before the frame is drawn, so the drawer never shows the last place for a frame.
    useLayoutEffect(() => {
        setWorldInspection(view ? { cell, note, version, message, ...actions } : null);
    }, [view, cell, note, version, message, actions]);
    useLayoutEffect(() => () => setWorldInspection(null), []);

    if (!view) {
        return (
            <div data-world-page="none" className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: FOG_CSS }}>
                <p data-world-none className="font-pixel ui-text-body text-white bg-black/70 px-2 py-1">{t('worldMap.noWorld')}</p>
                <CloseX data-world-close className="absolute" style={{ right: insets.right + CLOSE_GAP, top: insets.top + CLOSE_GAP }} onClick={() => onClose?.()} label={SCREEN_TEXT.CLOSE} />
            </div>
        );
    }
    const select = (id) => {
        if (id !== selectedId) setMessage(null);
        setChosen(id);
    };
    return (
        <section role="dialog" aria-label={t('worldMap.label')} data-world-page data-atlas-screen className="absolute inset-0 pointer-events-auto text-[12px] leading-snug">
            <WorldMap
                view={view}
                selectedId={selectedId}
                onSelect={select}
                reserve={worldReserve(insets, menuRight, drawerPx)}
            />
        </section>
    );
};

export default WorldScreen;
