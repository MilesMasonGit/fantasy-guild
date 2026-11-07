import { useEffect, useMemo, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { t } from '../../../i18n/index.js';
import * as World from '../../../systems/world/World.js';
import { HALL_CELL } from '../../../systems/world/frontier.js';
import { useAtlasRefresh } from './useAtlasRefresh.js';
import { travelFromScreen, END_DRAG_MARK } from './travelFromScreen.js';
import { worldView } from './worldView.js';
import { WorldMap } from './WorldMap.jsx';
import { WorldPanel, PANEL_W, PANEL_GAP } from './WorldPanel.jsx';
import { CloseX } from '../base/CloseX.jsx';
import { FOG_CSS } from './worldPicture.js';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { useWorldInsets } from './WorldCamera.jsx';

/**
 * The world map screen, below the mat (`WorldCamera` pans down to it): the map fills the whole
 * screen under the nav and the hero bar, centred in the mat's room ({@link useWorldInsets}), and
 * the chosen place's panel lies over the room's right edge. Settle pays a place and takes the
 * guild there; Travel goes to a place settled; either closes the screen. Escape or the panel's
 * close X close it too. A save from before the world shows one line.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 */
export const WorldScreen = ({ onClose }) => {
    const version = useAtlasRefresh();
    const { isDragging } = useActiveDrag();
    const view = useMemo(() => worldView(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
    const [chosen, setChosen] = useState(null);
    const [message, setMessage] = useState(null);
    const insets = useWorldInsets();

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

    if (!view) {
        return (
            <div data-world-page="none" className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: FOG_CSS }}>
                <p data-world-none className="font-pixel ui-text-body text-white bg-black/70 px-2 py-1">{t('worldMap.noWorld')}</p>
                <CloseX data-world-close className="absolute" style={{ right: insets.right + PANEL_GAP, top: insets.top + PANEL_GAP }} onClick={() => onClose?.()} label={SCREEN_TEXT.CLOSE} />
            </div>
        );
    }
    const selectedId = chosen && view.cells.some(c => c.id === chosen && c.shown) ? chosen : (view.here || HALL_CELL);
    const cell = view.cells.find(c => c.id === selectedId) || null;
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
                reserve={{ ...insets, right: insets.right + PANEL_W + 2 * PANEL_GAP }}
            />
            <WorldPanel
                insets={insets}
                cell={cell}
                note={view.note}
                version={version}
                message={message}
                onMessage={setMessage}
                onSettle={settle}
                onTravel={travel}
                onClose={() => onClose?.()}
            />
        </section>
    );
};

export default WorldScreen;
