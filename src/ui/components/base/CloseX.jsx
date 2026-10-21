import { cn } from '../../utils/cn.js';

/** `u_cancel_red.png` is 16 art pixels; UI sprites draw at 2×. */
export const CLOSE_X_PX = 32;

/**
 * The one close control on every panel, drawer and window (UI_STYLE "Panel headers"): the red
 * pixel X at 2×, a bare sprite with the icon button's white outline on hover. Extra props
 * (`data-*`, `title`) pass to the button.
 */
export const CloseX = ({ onClick, label = 'Close', className, ...rest }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        data-close-x
        onClick={onClick}
        className={cn('ui-icon-button shrink-0 p-0 bg-transparent border-0 cursor-pointer flex items-center justify-center', className)}
        {...rest}
    >
        <img
            src="/assets/ui/u_cancel_red.png"
            alt="Close"
            draggable={false}
            className="select-none pointer-events-none"
            style={{ width: CLOSE_X_PX, height: CLOSE_X_PX, imageRendering: 'pixelated' }}
        />
    </button>
);

/**
 * The one panel header: the title on the left (with an optional sprite), anything extra, then the
 * close X top right. Small floating pop-ups (tooltips) have no header.
 */
export const PanelHeader = ({ title, sprite = null, onClose, closeLabel = 'Close', className, children }) => (
    <div data-panel-header className={cn('shrink-0 flex items-center gap-2', className)}>
        {sprite}
        <span className="min-w-0 ui-text-title font-bold tracking-wide text-gi-text">{title}</span>
        <span className="flex-1" />
        {children}
        {onClose && <CloseX onClick={onClose} label={closeLabel} />}
    </div>
);

export default CloseX;
