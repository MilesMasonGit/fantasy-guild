import React from 'react';
import { CardSlot } from '../base/CardSlot.jsx';
import GIProgressBar from '../base/GIProgressBar.jsx';
import { Shield, Sword, Crosshair, Wand2, Clock } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * HeroGroup
 * Renders an active hero slot within a combat stage, dynamically updating their live HP/Energy and specific attack skill.
 * 
 * @param {Object} props
 * @param {Object} props.card - The parent Combat Card instance
 * @param {Object|null} props.hero - The assigned hero currently occupying this specific combat slot
 * @param {Number} props.slotIndex - Which slot this group represents (e.g. 0, 1, 2)
 * @param {String} props.selectedStyle - Current attack preference ('melee', 'ranged', 'magic')
 */
export const HeroGroup = ({ card, hero, slotIndex = 0, selectedStyle = 'melee', className }) => {

    // Style configurations for dynamic icons
    const styleConfig = {
        melee: { icon: <Sword size={14} />, label: 'Melee Attack' },
        ranged: { icon: <Crosshair size={14} />, label: 'Ranged Attack' },
        magic: { icon: <Wand2 size={14} />, label: 'Magic Attack' }
    };
    const activeStyle = styleConfig[selectedStyle] || styleConfig['melee'];

    // Render an empty drop-zone state if no hero is present
    if (!hero) {
        return (
            <div className={cn("flex flex-col items-center gap-2 p-2 rounded-lg border border-dashed border-gi-border/50 bg-gi-surface/20 w-32", className)}>
                <CardSlot
                    id={`combat-${card.id || card.instanceId}-slot-${slotIndex}`}
                    className="w-full aspect-square bg-black/40 border border-white/10 flex flex-col items-center justify-center p-2 rounded"
                    data={{ type: 'combatSlot', cardId: card.id || card.instanceId, slotIndex }}
                    label={`Assign Hero`}
                />
            </div>
        );
    }

    // Hero is Present. Calculate dynamic live stats
    const name = hero.name || 'Hero';

    // Skills (fallback to 1 if missing)
    const attackSkill = hero.skills?.[selectedStyle]?.level ?? hero.skills?.[selectedStyle] ?? 1;
    const defenceSkill = hero.skills?.defence?.level ?? hero.skills?.defence ?? 1;

    // HP & Energy Defaults
    const hp = hero.hp || { current: 100, max: 100 };
    const energy = hero.energy || { current: 50, max: 50 };

    // Attack Speed & Progress Tracking
    // In Vanilla, card.heroAttackSpeeds tracks the base interval
    // card.heroTickProcesses tracks current accumulated ms of progress toward an attack
    const attackSpeedMs = card?.heroAttackSpeeds?.[hero.id] || 2500;
    const attackSpeedSec = (attackSpeedMs / 1000).toFixed(1);

    const attackProgress = card?.heroTickProcesses?.[hero.id] || 0;
    const attackPercent = Math.min((attackProgress / attackSpeedMs) * 100, 100);

    return (
        <div className={cn("flex flex-col gap-2 p-3 rounded-lg border border-gi-border bg-gi-surface shadow-md w-36", className)}>
            {/* Header */}
            <h4 className="font-display font-bold text-gi-primary text-sm text-center truncate w-full" title={name}>
                {name}
            </h4>

            {/* The Asset / Portrait Drop Target */}
            {/* We still wrap the actual portrait in a CardSlot so they can be dragged *out* or swapped */}
            <CardSlot
                id={`combat-${card.id || card.instanceId}-slot-${slotIndex}`}
                className="w-full aspect-square bg-black/40 border border-white/10 flex items-center justify-center p-1 rounded-sm overflow-hidden"
                data={{ type: 'combatSlot', cardId: card.id || card.instanceId, slotIndex }}
                label="" // Omit label when filled
            >
                {/* Visual identity proxy if HeroIdentityStrip's inner elements aren't strictly decoupled */}
                <div className="text-4xl filter drop-shadow-md">
                    {hero.icon || '🛡️'}
                </div>
            </CardSlot>

            {/* Live Combat Stats */}
            <div className="flex justify-between items-center text-xs py-1 px-2 bg-black/20 rounded border border-white/5 w-full">
                <div className="flex items-center gap-1 text-gray-300" title="Defence">
                    <Shield size={14} className="text-gray-400" />
                    <span className="font-bold">{defenceSkill}</span>
                </div>
                <div className="flex items-center gap-1 text-gi-danger" title={activeStyle.label}>
                    {activeStyle.icon}
                    <span className="font-bold">{attackSkill}</span>
                </div>
            </div>

            {/* Live HP / Energy Bars */}
            <div className="flex flex-col gap-1 w-full">
                <GIProgressBar
                    current={hp.current}
                    max={hp.max}
                    color="green"
                    height="sm"
                    showText={true}
                />
                <GIProgressBar
                    current={energy.current}
                    max={energy.max}
                    color="blue"
                    height="sm"
                    showText={false} // Mirroring Vanilla: energy often didn't show explicit un-hovered text in the mini-slot
                />
            </div>

            {/* Action Timer */}
            <div className="mt-1 flex flex-col gap-0.5">
                <div className="flex justify-between items-center w-full">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
                        <Clock size={10} />
                        Next Attack
                    </span>
                    <span className="text-[10px] font-bold text-gray-300">{attackSpeedSec}s</span>
                </div>
                {/* Standard yellow/gold for attack cooldown progression */}
                <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-gi-accent/80 transition-all ease-linear shadow-[0_0_5px_rgba(251,191,36,0.6)]"
                        style={{ width: `${attackPercent}%`, transitionDuration: '0.1s' }}
                    />
                </div>
            </div>

        </div>
    );
};

export default HeroGroup;
