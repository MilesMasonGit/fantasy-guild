import React from 'react';
import { cn } from '../../utils/cn.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { ItemIcon } from './ItemIcon.jsx';
import { TokenSprite, TOKEN_SURFACE } from './TokenSprite.jsx';
import { formatCompact } from '../../../utils/Formatters.js';
import { Sparkles, HelpCircle } from 'lucide-react';

/**
 * EntityRibbon: standard minimalist ribbon row for items, tokens and loot.
 * Distinct from the square badges used in inventory (which represent owned assets): this row
 * view represents what the player *needs*, what a station *outputs*, what a Token *costs*, or
 * what a loot table *drops*.
 * Layout: [ Sprite (32px, scales to 64px on hover overflowing) | Name + Subtitle | Quantity /
 * Chance (crossfades on hover) ]
 * `amount` shows a count abbreviated (`+5.9k`, after `sign`) that crossfades to the exact number
 * (`+5,900`) on hover; `countText` shows its text as given. `icon` replaces the sprite (a skill's
 * icon). Other props (data attributes, `style`) go on the bar.
 */
export const EntityRibbon = ({
    kind,
    id,
    refId,
    itemId,
    typeId,
    name,
    quantity,
    minQty,
    maxQty,
    chance,
    interval,
    subtitle,
    have,
    required,
    isDiscovered = true,
    // Optional hover text. Defaults to the entity's name; pass a sentence when
    // the row needs explaining rather than naming.
    title,
    size = 'md',
    variant = 'default',
    onClick,
    onInspect,
    amount,
    sign = '×',
    countText,
    icon,
    className,
    ...rest
}) => {
    const rawId = id || refId || itemId || typeId;

    let resolvedKind = kind;
    if (!resolvedKind) {
        // No `gold` kind: gold is retired and `item_coins` is an ordinary item now.
        if (rawId === 'xp') {
            resolvedKind = 'xp';
        } else if (rawId && getTokenType(rawId)) {
            resolvedKind = 'token';
        } else {
            // ⚠️ There is no `enemy` branch here: enemies are Tokens, so an enemy id resolves
            // on the `token` branch above, which is why that branch is checked first.
            resolvedKind = 'item';
        }
    }

    const itemDef = resolvedKind === 'item' && rawId ? getItem(rawId) : null;
    const tokenDef = resolvedKind === 'token' && rawId ? getTokenType(rawId) : null;

    let displayName = name;
    if (!displayName) {
        if (!isDiscovered) {
            displayName = '???';
        } else if (resolvedKind === 'xp') {
            displayName = 'Experience';
        } else if (resolvedKind === 'token') {
            displayName = tokenDef ? tokenName(rawId) : rawId;

        } else {
            displayName = itemDef?.name || rawId || 'Unknown';
        }
    }

    let qtyDisplay = null;
    if (have !== undefined && required !== undefined) {
        qtyDisplay = `${have}/${required}`;
    } else if (minQty !== undefined && maxQty !== undefined) {
        qtyDisplay = minQty === maxQty ? `×${minQty}` : `×${minQty}–${maxQty}`;
    } else if (quantity !== undefined && quantity !== null) {
        if (typeof quantity === 'number') {
            qtyDisplay = `×${formatCompact(quantity, 1)}`;
        } else {
            qtyDisplay = String(quantity).startsWith('×') || String(quantity).startsWith('x') || String(quantity).startsWith('+')
                ? quantity
                : `×${quantity}`;
        }
    }

    const subLabel = interval || subtitle || (!isDiscovered ? 'Undiscovered' : null);

    const isRequirement = have !== undefined && required !== undefined;
    const isShort = isRequirement && have < required;

    const handleClick = (e) => {
        if (onInspect) {
            e.stopPropagation();
            onInspect(resolvedKind, rawId);
        } else if (onClick) {
            onClick(e);
        }
    };

    const isInteractive = Boolean(onClick || onInspect);

    // Always enable the hover chance transition if chance is provided (even for 100% /
    // guaranteed drops).
    const hasHoverChance = chance !== undefined && chance !== null && qtyDisplay !== null;
    const hasAmount = typeof amount === 'number' && Number.isFinite(amount);

    // Size configs: all display standard 32px sprites inside a 32px box.
    const sizeConfig = {
        sm: {
            box: 'w-8 h-8',
            iconSize: 32,
            text: 'text-xs',
            sub: 'text-[9px]',
            pad: 'p-1.5 gap-2.5'
        },
        md: {
            box: 'w-8 h-8',
            iconSize: 32,
            text: 'text-xs md:text-sm',
            sub: 'text-[10px]',
            pad: 'p-2 gap-2.5'
        },
        lg: {
            box: 'w-8 h-8',
            iconSize: 32,
            text: 'text-sm font-bold',
            sub: 'text-xs',
            pad: 'p-2.5 gap-3'
        }
    }[size] || {
        box: 'w-8 h-8',
        iconSize: 32,
        text: 'text-xs md:text-sm',
        sub: 'text-[10px]',
        pad: 'p-2 gap-2.5'
    };

    return (
        <div
            data-item-bar
            {...rest}
            onClick={isInteractive ? handleClick : undefined}
            className={cn(
                'group relative flex items-center rounded-lg border transition-all select-none overflow-visible hover:z-30',
                sizeConfig.pad,
                isShort
                    ? 'bg-[#221316] border-gi-danger/40'
                    : 'bg-[#181412] border-white/10 hover:border-white/25',
                isInteractive && 'cursor-pointer hover:bg-[#201b18] active:scale-[0.99]',
                className
            )}
            title={title || displayName}
        >
            {/**
             * Sprite Box: 32px base, smoothly scales to 64px (scale-[2]) overflowing the
             * container on hover.
             */}
            <div
                className={cn(
                    sizeConfig.box,
                    'relative rounded-md bg-black border border-white/10 flex items-center justify-center shrink-0 shadow-inner group-hover:border-white/25 transition-colors overflow-visible z-10'
                )}
            >
                <div data-item-bar-sprite className="relative flex items-center justify-center w-8 h-8 transition-transform duration-200 ease-out group-hover:scale-[2] group-hover:z-50 group-hover:drop-shadow-[0_6px_14px_rgba(0,0,0,0.95)] pointer-events-none origin-center">
                    {icon ?? (!isDiscovered ? (
                        <HelpCircle size={18} className="text-gi-muted/50" />
                    ) : resolvedKind === 'xp' ? (
                        <Sparkles size={20} className="text-amber-400" />
                    ) : resolvedKind === 'token' ? (
                        <TokenSprite
                            typeId={rawId}
                            surface={TOKEN_SURFACE.CATALOGUE}
                            alt={displayName}
                        />
                    ) : (
                        <ItemIcon
                            item={itemDef || rawId}
                            size={32}
                            isDiscovered={isDiscovered}
                        />
                    ))}
                </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span
                    data-item-bar-name
                    className={cn(
                        sizeConfig.text,
                        'font-bold truncate leading-tight transition-colors group-hover:text-white',
                        !isDiscovered ? 'text-gi-muted/60 italic' : 'text-gi-text'
                    )}
                >
                    {displayName}
                </span>
                {subLabel && (
                    <span className={cn(sizeConfig.sub, 'text-gi-muted truncate leading-tight mt-0.5')}>
                        {subLabel}
                    </span>
                )}
            </div>

            <div className="relative flex flex-col items-end justify-center shrink-0 tabular-nums font-mono min-w-[3.5rem]">
                {hasAmount ? (
                    // Both counts share one grid cell, so the column is as wide as the longer one.
                    <div className="grid justify-items-end">
                        <span
                            data-item-bar-count
                            className={cn(sizeConfig.text, 'col-start-1 row-start-1 font-bold tracking-tight text-gi-text transition-all duration-200 group-hover:opacity-0 group-hover:-translate-y-1')}
                        >
                            {sign}{formatCompact(amount, 1)}
                        </span>
                        <span
                            data-item-bar-count-exact
                            className={cn(sizeConfig.text, 'col-start-1 row-start-1 font-bold tracking-tight text-white opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0')}
                        >
                            {sign}{Math.round(amount).toLocaleString('en-US')}
                        </span>
                    </div>
                ) : countText != null ? (
                    <span data-item-bar-count className={cn(sizeConfig.text, 'font-bold tracking-tight text-gi-text whitespace-nowrap')}>
                        {countText}
                    </span>
                ) : hasHoverChance ? (
                    <div className="relative flex items-center justify-end w-full">
                        <span
                            className={cn(
                                sizeConfig.text,
                                'font-bold tracking-tight transition-all duration-200 group-hover:opacity-0 group-hover:-translate-y-1',
                                isShort ? 'text-gi-danger font-semibold' : 'text-gi-text'
                            )}
                        >
                            {qtyDisplay}
                        </span>

                        <span
                            className={cn(
                                sizeConfig.text,
                                'absolute inset-0 flex items-center justify-end font-bold tracking-wider text-gi-primary transition-all duration-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                            )}
                        >
                            {typeof chance === 'number' ? `${chance}%` : chance}
                        </span>
                    </div>
                ) : (
                    <>
                        {qtyDisplay && (
                            <span
                                className={cn(
                                    sizeConfig.text,
                                    'font-bold tracking-tight',
                                    isShort ? 'text-gi-danger font-semibold' : 'text-gi-text'
                                )}
                            >
                                {qtyDisplay}
                            </span>
                        )}
                        {chance !== undefined && chance !== null && (
                            <span
                                className={cn(
                                    sizeConfig.sub,
                                    'font-bold uppercase tracking-wider text-gi-primary'
                                )}
                            >
                                {typeof chance === 'number' ? `${chance}%` : chance}
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default EntityRibbon;
