import React from 'react';
import { Sword, Crosshair, Wand2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * Calculates the textual description of the combat interaction based on Rock-Paper-Scissors rules.
 * Melee > Ranged, Ranged > Magic, Magic > Melee.
 */
const getStyleInteractionStatus = (heroStyle, enemyStyle) => {
    if (!heroStyle || !enemyStyle || heroStyle === enemyStyle) {
        return { text: 'Neutral Match', colorClass: 'text-gi-muted' };
    }

    const rules = {
        melee: { weak: 'ranged', strong: 'magic' }, // Note: Original legacy code had melee strong vs magic. Let's stick to the legacy rules for exact parity. 
        // Wait, legacy rules from the spec snapshot:
        // melee: { weak: 'ranged', strong: 'magic' },
        // ranged: { weak: 'magic', strong: 'melee' },
        // magic: { weak: 'melee', strong: 'ranged' }
        ranged: { weak: 'magic', strong: 'melee' },
        magic: { weak: 'melee', strong: 'ranged' }
    };

    if (rules[heroStyle]?.strong === enemyStyle) {
        return { text: 'Deals more damage, takes less damage.', colorClass: 'text-gi-success' };
    }

    if (rules[heroStyle]?.weak === enemyStyle) {
        return { text: 'Deals less damage, takes more damage.', colorClass: 'text-gi-danger' };
    }

    return { text: 'Neutral Match', colorClass: 'text-gi-muted' };
};

/**
 * CombatTypeSelector
 * An interactive toggle allowing the player to swap attack styles, displaying a descriptive hint of the interaction.
 * 
 * @param {Object} props
 * @param {String} props.cardId - ID to emit the change event (if using vanilla event bus, or passed to a callback)
 * @param {String} props.selectedStyle - Current hero style ('melee', 'ranged', 'magic')
 * @param {String} props.enemyType - Enemy's fixed style
 * @param {Function} props.onStyleChange - Optional callback for purely React-driven state updates. If omitted, dispatches a CustomEvent.
 */
export const CombatTypeSelector = ({ cardId, selectedStyle = 'melee', enemyType = 'melee', onStyleChange, className }) => {

    const config = {
        melee: { icon: <Sword size={14} />, label: 'Melee' },
        ranged: { icon: <Crosshair size={14} />, label: 'Ranged' },
        magic: { icon: <Wand2 size={14} />, label: 'Magic' }
    };

    const handleSelect = (style) => {
        if (selectedStyle === style) return;

        if (onStyleChange) {
            onStyleChange(style);
        } else if (cardId) {
            // Emulate Vanilla Event System fallback
            window.dispatchEvent(new CustomEvent('combat-style-change', {
                detail: { cardId, style }
            }));
        }
    };

    const interactionStat = getStyleInteractionStatus(selectedStyle, enemyType);
    const enemyConfig = config[enemyType] || config.melee;

    return (
        <div className={cn("flex flex-col gap-2 p-3 bg-black/20 rounded-lg border border-gi-border w-full", className)}>

            <div className="flex justify-between items-center w-full mb-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                    Tactics vs {enemyType}
                </span>

                {/* Enemy Style Badge */}
                <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gi-danger bg-gi-danger/10 px-2 py-0.5 rounded border border-gi-danger/20" title={`Enemy uses ${enemyType}`}>
                    {enemyConfig.icon} {enemyConfig.label}
                </div>
            </div>

            {/* Tactical Toggle Pill */}
            <div className="flex w-full bg-black/40 rounded border border-white/5 p-1 gap-1 relative overflow-hidden">
                {['melee', 'ranged', 'magic'].map((style) => {
                    const isSelected = selectedStyle === style;
                    const { icon, label } = config[style];

                    return (
                        <button
                            key={style}
                            onClick={() => handleSelect(style)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all duration-200",
                                isSelected
                                    ? "bg-gi-primary text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                            )}
                            title={`Select ${label} Attack`}
                        >
                            {icon}
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Interaction Text */}
            <div className="w-full flex justify-center mt-1">
                <span className={cn("text-[10px] uppercase font-bold tracking-wider text-center transition-colors", interactionStat.colorClass)}>
                    {interactionStat.text}
                </span>
            </div>

        </div>
    );
};

export default CombatTypeSelector;
