import { useEffect, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';
import { RegionList } from './RegionList.jsx';
import { CartographyTable } from './CartographyTable.jsx';
import { useAtlasRefresh } from './useAtlasRefresh.js';
import { travelFromScreen, END_DRAG_MARK } from './travelFromScreen.js';
import { SCREEN_TEXT } from './atlasScreenText.js';
import { AtlasTome } from './AtlasTome.jsx';

export const ATLAS_TAB = Object.freeze({ REGIONS: 'regions', CARTOGRAPHY: 'cartography' });

/** The bookmark ribbons, in page order. */
const TABS = [
    { id: ATLAS_TAB.CARTOGRAPHY, label: SCREEN_TEXT.TAB_CARTOGRAPHY, colour: '#7a1f1f' },
    { id: ATLAS_TAB.REGIONS, label: SCREEN_TEXT.TAB_REGIONS, colour: '#1f3f6e' }
];

const CLOSE_SPRITE = '/assets/ui/u_cancel_red.png';

/**
 * The Atlas: the owner's open book popping up over the mat (the mat stays as it is behind it),
 * opened from its bubble, with two sections behind bookmark ribbons. **Regions** lists every
 * Region the guild has settled (travel, rename, archive, abandon); **Cartography** writes a new
 * one from maps. Escape, the close button or a press outside the book closes it, and closing
 * takes nothing: the Cartography slots are only remembered while it is open.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {() => void} [props.closePromotion]  closes the promotion ceremony before a travel
 * @param {string} [props.initialTab]
 */
export const AtlasScreen = ({ onClose, closePromotion, initialTab = ATLAS_TAB.REGIONS }) => {
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
        const result = await travelFromScreen(regionId, { isDragging, closePromotion });
        if (result?.success) {
            setMessage(null);
            onClose?.();
            return;
        }
        setTab(ATLAS_TAB.REGIONS);
        setMessage(result?.reason ?? null);
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
            <AtlasTome tabs={TABS} tab={tab} onTab={setTab} closeButton={closeButton} label={SCREEN_TEXT.TITLE}>
                {/* Both stay mounted, so moving between the tabs keeps what is slotted. */}
                <div className={cn('absolute inset-0', tab !== ATLAS_TAB.REGIONS && 'hidden')}>
                    <RegionList version={version} onTravel={travel} message={message} onMessage={setMessage} />
                </div>
                <div className={cn('absolute inset-0', tab !== ATLAS_TAB.CARTOGRAPHY && 'hidden')}>
                    <CartographyTable version={version} onTravel={travel} />
                </div>
            </AtlasTome>
        </div>
    );
};

export default AtlasScreen;
