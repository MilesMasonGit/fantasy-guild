import { useEffect, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';
import { RegionList } from './RegionList.jsx';
import { WorldPage } from './WorldPage.jsx';
import { useAtlasRefresh } from './useAtlasRefresh.js';
import { travelFromScreen, END_DRAG_MARK } from './travelFromScreen.js';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { AtlasTome } from './AtlasTome.jsx';
import { t } from '../../../i18n/index.js';
import * as World from '../../../systems/world/World.js';

export const ATLAS_TAB = Object.freeze({ REGIONS: 'regions', WORLD: 'world' });

/** The page tabs, in page order, top to bottom. */
const tabsOf = () => [
    { id: ATLAS_TAB.WORLD, label: t('worldMap.tab'), colour: '#7a1f1f' },
    { id: ATLAS_TAB.REGIONS, label: SCREEN_TEXT.TAB_REGIONS, colour: '#1f3f6e' }
];

const CLOSE_SPRITE = '/assets/ui/u_cancel_red.png';

/**
 * The Atlas: the owner's open book popping up over the mat (the mat stays as it is behind it),
 * opened from its bubble, with two sections behind page tabs. **World** is the run's hex world map
 * (`WorldPage`): settle a place beside the guild's, or travel to one settled. **Regions** lists
 * every Region the guild has settled down the left page and shows the one clicked on the right
 * (its ground, what it holds; travel, rename, archive, abandon). Escape, the close button or a
 * press outside the book closes it.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {string} [props.initialTab]
 */
export const AtlasScreen = ({ onClose, initialTab = ATLAS_TAB.WORLD }) => {
    const version = useAtlasRefresh();
    const { isDragging } = useActiveDrag();
    const [tab, setTab] = useState(initialTab);
    const [message, setMessage] = useState(null);

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
        setTab(ATLAS_TAB.REGIONS);
        setMessage(result?.reason ?? null);
    };

    // Settling moves the guild, so a carried Token is put down first, as for travel.
    const settle = async (cellId) => {
        const result = await travelFromScreen(cellId, { isDragging, travel: World.settleCell });
        if (result?.success) onClose?.();
        return result;
    };

    const closeButton = (
        <button
            type="button"
            data-atlas-close
            aria-label={SCREEN_TEXT.CLOSE}
            title={SCREEN_TEXT.CLOSE}
            onClick={() => onClose?.()}
            className="group p-0 bg-transparent border-0 cursor-pointer"
        >
            <img
                src={CLOSE_SPRITE}
                alt=""
                draggable={false}
                className="w-8 h-8 select-none pointer-events-none group-hover:[filter:drop-shadow(2px_0_0_#fff)_drop-shadow(-2px_0_0_#fff)_drop-shadow(0_2px_0_#fff)_drop-shadow(0_-2px_0_#fff)]"
                style={{ imageRendering: 'pixelated' }}
            />
        </button>
    );

    return (
        <div
            data-atlas-overlay
            className="absolute inset-0 z-[100] pointer-events-auto overflow-hidden text-[12px] leading-snug"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <AtlasTome tabs={tabsOf()} tab={tab} onTab={setTab} closeButton={closeButton} label={SCREEN_TEXT.TITLE}>
                {/* Both stay mounted, so moving between the tabs keeps what each had chosen. */}
                <div className={cn('absolute inset-0', tab !== ATLAS_TAB.REGIONS && 'hidden')}>
                    <RegionList version={version} open={tab === ATLAS_TAB.REGIONS} onTravel={travel} message={message} onMessage={setMessage} />
                </div>
                <div className={cn('absolute inset-0', tab !== ATLAS_TAB.WORLD && 'hidden')}>
                    <WorldPage version={version} onSettle={settle} onTravel={travel} />
                </div>
            </AtlasTome>
        </div>
    );
};

export default AtlasScreen;
