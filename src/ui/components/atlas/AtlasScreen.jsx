import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { cn } from '../../utils/cn.js';
import { RegionList } from './RegionList.jsx';
import { CartographyTable } from './CartographyTable.jsx';
import { useAtlasRefresh } from './useAtlasRefresh.js';
import { travelFromScreen, END_DRAG_MARK } from './travelFromScreen.js';
import { SCREEN_TEXT } from './atlasScreenText.js';

export const ATLAS_TAB = Object.freeze({ REGIONS: 'regions', CARTOGRAPHY: 'cartography' });

/**
 * The Atlas: an overlay over the mat, opened from its bubble, with two parts. **Regions** lists
 * every Region the guild has settled (travel, rename, archive, abandon); **Cartography** writes a
 * new one from maps. Escape, the close button or a click outside the panel closes it, and closing
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

    const tabButton = (id, label) => (
        <button
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-atlas-tab={id}
            onClick={() => setTab(id)}
            className={cn(
                'px-2 pb-1 font-bold uppercase tracking-wider border-b-2',
                tab === id ? 'text-gi-gold border-gi-gold' : 'text-white/60 border-transparent hover:text-white'
            )}
        >
            {label}
        </button>
    );

    return (
        <div
            data-atlas-overlay
            className="absolute inset-0 z-[100] pointer-events-auto flex items-center justify-center p-4 bg-black/55"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <section
                role="dialog"
                aria-label={SCREEN_TEXT.TITLE}
                data-atlas-screen
                className="w-[min(900px,100%)] max-h-full flex flex-col p-3 rounded-lg bg-black/90 border border-gi-gold/40 shadow-[4px_4px_0_0_#000] text-[12px] leading-snug text-white"
            >
                <header className="flex items-center gap-3 mb-2" role="tablist">
                    {tabButton(ATLAS_TAB.REGIONS, SCREEN_TEXT.TAB_REGIONS)}
                    {tabButton(ATLAS_TAB.CARTOGRAPHY, SCREEN_TEXT.TAB_CARTOGRAPHY)}
                    <div className="flex-1" />
                    <button type="button" data-atlas-close aria-label={SCREEN_TEXT.CLOSE} title={SCREEN_TEXT.CLOSE} onClick={() => onClose?.()} className="text-white/60 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </header>
                {/* Both stay mounted, so moving between the tabs keeps what is slotted. */}
                <div className={cn('min-h-0 flex flex-col', tab !== ATLAS_TAB.REGIONS && 'hidden')}>
                    <RegionList version={version} onTravel={travel} message={message} onMessage={setMessage} />
                </div>
                <div className={cn('min-h-0 flex flex-col', tab !== ATLAS_TAB.CARTOGRAPHY && 'hidden')}>
                    <CartographyTable version={version} onTravel={travel} />
                </div>
            </section>
        </div>
    );
};

export default AtlasScreen;
