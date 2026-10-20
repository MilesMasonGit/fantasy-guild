import { cn } from '../../utils/cn.js';
import { PixelFrame } from '../base/PixelFrame.jsx';

/**
 * The Atlas's buttons: chamfer-framed, gold text and the shine for the main one (Settle, Travel),
 * white for the rest, greyed while they can't be used.
 */
export const AtlasButton = ({ main = false, disabled = false, className, ...rest }) => (
    <PixelFrame kind="chamfer" className={cn('inline-block shrink-0', disabled && 'opacity-50 grayscale')}>
        <button
            type="button"
            disabled={disabled}
            className={cn(
                'px-3 py-0.5 whitespace-nowrap font-pixel ui-text-body font-bold disabled:cursor-not-allowed',
                main && 'ui-shine',
                className
            )}
            style={{ color: disabled ? 'var(--color-ui-muted)' : main ? 'var(--color-ui-gold)' : 'var(--color-ui-white)' }}
            {...rest}
        />
    </PixelFrame>
);

export default AtlasButton;
