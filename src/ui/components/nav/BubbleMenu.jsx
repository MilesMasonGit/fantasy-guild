import React from 'react';
import { cn } from '../../utils/cn.js';
import {
    Castle, Landmark, Map as MapIcon,
    Settings
} from 'lucide-react';
import { EventBus } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * BubbleMenu: the vertical column of glassmorphic bubble buttons used for navigation.
 * Default-docked on the left; a Settings toggle (`ui.bubbleMenuRight`) swaps it to the right
 * edge (side is decided in ReactRoot and passed down).
 * Four bubbles: Guild Hall, the Item Bank, the Shop (its own drawer) and Settings. They share
 * one 'only one view open at once' rule (`ui.nav`): clicking a bubble closes whatever any of
 * the others has open, and clicking the active one closes it. This applies only to the bubbles
 * themselves; a contextual 'open the drawer' prompt still opens the Bank pane independently,
 * without closing anything else. Heroes live in the always-visible Hero Dock and have no
 * bubble.
 * The Bank bubble also carries `id="bank-bubble-target"`, the fallback landing spot
 * `ParticleOverlay.jsx` flies collected loot toward when the Guild Hall is not on screen.
 */

/** One circular menu button. `pip` reserves a notification-pip slot. */
const Bubble = React.forwardRef(({ icon: Icon, label, color, onClick, active = false, disabled = false, pip = false, id, children, droppableProps, isValidDrop }, ref) => {
    const handleClick = (e) => {
        const rect = e.currentTarget?.getBoundingClientRect();
        if (rect) {
            const radius = Math.min(rect.width, rect.height) / 2;
            const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
            if (dist > radius) {
                return; // Transparent corner outside the orb: ignore click
            }
        }
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        onClick?.(e);
    };

    return (
        <div id={id} ref={ref} {...droppableProps} className={cn("relative flex flex-col items-center rounded-full", isValidDrop && "ring-4 ring-gi-success shadow-[0_0_15px_rgba(34,197,94,0.6)]")}>
            <button
                title={label}
                aria-label={label}
                onClick={handleClick}
                disabled={disabled}
                data-alpha-circle="true"
                className={cn(
                    'w-16 h-16 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-center bg-no-repeat bg-contain outline-none',
                    'transition-all duration-200',
                    !disabled && 'hover:scale-110 hover:brightness-110 hover:contrast-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] cursor-pointer',
                    active && 'scale-110 brightness-110 contrast-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]',
                    disabled && 'opacity-40 cursor-not-allowed'
                )}
                style={{
                    backgroundImage: `url('/assets/ui/ui_orb_${color === 'blue' ? 'lblu' : color}.png')`,
                    imageRendering: 'pixelated'
                }}
            >
                <Icon 
                    className="w-6 h-6 md:w-12 md:h-12 text-yellow-50" 
                    style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.75))' }} 
                />
            </button>
            {pip && (
                <span className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-gi-danger border border-black/50" />
            )}
            {children}
        </div>
    );
});

export const BubbleMenu = ({ ui, side = 'left' }) => {
    const nav = ui.nav;

    // Settings is a GIModal dialog whose backdrop (z-[300]) sits above the bar's normal
    // z-[110], so once it is open its own bubble is physically unreachable to close it again.
    // Rise above the backdrop only while Settings is the active view, so a second click (or
    // switching to another bubble) can still reach the bar. Stays at the normal layer the rest
    // of the time, so it doesn't leak above unrelated overlays (Slot Selection, Hero Edit,
    // ...).
    const aboveOwnModal = nav.isActive('settings');

    return (
        <nav
            className={cn(
                // `relative` so the z-index below actually applies: it is what keeps the nav
                // ABOVE the bank drawer (z-[90]).
                'pointer-events-auto relative shrink-0 flex flex-col items-center gap-4 py-6 px-3 min-w-[80px] md:min-w-[150px]',
                aboveOwnModal ? 'z-[310]' : 'z-[110]'
            )}
            style={{
                backgroundImage: `url('/assets/ui/ui_bar.png')`,
                backgroundRepeat: 'repeat-y',
                backgroundPosition: side === 'left' ? 'left top' : 'right top',
                backgroundSize: '100% auto',
                imageRendering: 'pixelated'
            }}
        >
            <Bubble id="guild-bubble-target" icon={Castle} label="Guild Hall" color="purple" active={nav.isActive('guild')} onClick={() => nav.toggle('guild')} />
            {/**
             * No Heroes bubble: the Hero Dock is always on screen, so there is nothing to
             * toggle.
             */}
            <Bubble id="bank-bubble-target" icon={Landmark} label="Item Bank" color="yellow" active={nav.isActive('bank')} onClick={() => nav.toggle('bank')} />
            {/**
             * The Shop: the one menu that is deliberately off-board. The design's rule is not
             * 'no menus' but 'no menu decides what the board does'; a Shop Token would have
             * permanently consumed a spot AND a hero purely to keep progression ticking.
             */}
            <Bubble id="shop-bubble-target" icon={MapIcon} label="Shop" color="green" active={nav.isActive('shop')} onClick={() => nav.toggle('shop')} />

            <div className="mt-auto" />
            <Bubble icon={Settings} label="Settings" color="red" active={nav.isActive('settings')} onClick={() => nav.toggle('settings')} />
        </nav>
    );
};

export default BubbleMenu;
