import { cn } from '../../utils/cn.js';
import ItemIcon from './ItemIcon.jsx';

/**
 * One line of a list: icon, name, number (`[ore] Copper Ore  +1,154`), in the Token Summary's
 * row look: unboxed, tight, the number right-aligned. The name wraps rather than being cut short.
 * `item` draws that item's (or Token's) icon; `icon` takes any other icon; with neither, the
 * icon's space is kept so names line up. Other props (data attributes, `style`) go on the row.
 * @param {{ item?: string|object, icon?: import('react').ReactNode, name: import('react').ReactNode,
 *           count?: import('react').ReactNode, className?: string }} props
 */
export const ItemRow = ({ item = null, icon = null, name, count = null, className, ...rest }) => {
    const hasCount = count != null && count !== '';
    return (
        <li data-item-row {...rest} className={cn('flex items-center gap-1.5 px-1 py-0.5 rounded-sm', className)}>
            <span data-item-row-icon className="w-4 h-4 shrink-0 flex items-center justify-center">
                {item != null ? <ItemIcon item={item} size={16} /> : icon}
            </span>
            <span className="min-w-0 break-words">{name}</span>
            {/* Whitespace between flex items draws nothing; it keeps the row's text one readable line. */}
            {hasCount && ' '}
            {hasCount && <span data-item-row-count className="ml-auto shrink-0 pl-3 tabular-nums font-bold">{count}</span>}
        </li>
    );
};

/** A list of `ItemRow`s, one per line. */
export const ItemRows = ({ className, children, ...rest }) => (
    <ul data-item-rows {...rest} className={cn('flex flex-col', className)}>{children}</ul>
);

export default ItemRow;
