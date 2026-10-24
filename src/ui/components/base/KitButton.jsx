import { cn } from '../../utils/cn.js';
import { PixelFrame, FRAME_KIND } from './PixelFrame.jsx';

/**
 * What a button's words say about it, in UI_STYLE's colours: `main` is the main action (gold,
 * with the shine), `plain` a second choice beside it (muted, white on hover), `danger` a choice
 * that loses something (red).
 */
export const KIT_BUTTON_TONE = Object.freeze({ MAIN: 'main', PLAIN: 'plain', DANGER: 'danger' });

const TONE_CLS = {
    main: 'ui-shine text-[var(--color-ui-gold)]',
    plain: 'text-white/70 hover:text-[var(--color-ui-white)]',
    danger: 'text-[var(--color-ui-red)] hover:text-[var(--color-ui-white)]'
};

/**
 * The kit's button (UI_STYLE "Buttons"): a chamfer pixel frame with a hard shadow, as the Hall's
 * Upgrade button. Disabled, it greys out. `className` places the frame (width, margins);
 * `buttonClassName` lays out the words inside; every other prop goes on the <button>.
 *
 * ⚠️ The frame's shadow sits 4 px outside it, down and right: a parent that hides its overflow
 * clips it.
 */
export const KitButton = ({ tone = KIT_BUTTON_TONE.MAIN, className, buttonClassName, disabled = false, type = 'button', children, ...rest }) => (
    <PixelFrame kind={FRAME_KIND.CHAMFER} data-kit-button={tone} className={cn('inline-block', disabled && 'opacity-50 grayscale', className)}>
        <button
            type={type}
            disabled={disabled}
            className={cn(
                'w-full flex items-center justify-center gap-1.5 px-2 py-0.5 font-bold transition-colors',
                TONE_CLS[tone],
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                buttonClassName
            )}
            {...rest}
        >
            {children}
        </button>
    </PixelFrame>
);

/**
 * The kit's on/off switch, drawn: a square track with the frames' 1-art-pixel line and a square
 * knob that sits right when on. `onClass` is the track's fill while on (a meaning colour); `small` for a header line. A span,
 * for a switch inside a bigger button with its word; `PixelToggle` is the switch as a button.
 */
export const PixelSwitch = ({ on, onClass = 'bg-[var(--color-ui-green)]', small = false, className }) => (
    <span
        aria-hidden="true"
        data-pixel-switch={on ? 'on' : 'off'}
        className={cn(
            'ui-pixel-edge relative inline-block shrink-0 transition-colors',
            small ? 'w-[28px] h-[16px]' : 'w-[40px] h-[20px]',
            on ? onClass : 'bg-black/50',
            className
        )}
    >
        <span className={cn(
            'absolute top-[2px] bg-[var(--color-ui-white)]',
            small ? 'w-2 h-2' : 'w-3 h-3',
            on ? (small ? 'left-[14px]' : 'left-[22px]') : 'left-[2px]'
        )} />
    </span>
);

/** The switch as a button of its own (a Settings row's). */
export const PixelToggle = ({ on, onClass, disabled = false, className, ...rest }) => (
    <button
        type="button"
        role="switch"
        aria-checked={!!on}
        disabled={disabled}
        className={cn('group flex shrink-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}
        {...rest}
    >
        <PixelSwitch on={on} onClass={onClass} className="group-hover:group-enabled:border-[var(--color-ui-white)]" />
    </button>
);

export default KitButton;
