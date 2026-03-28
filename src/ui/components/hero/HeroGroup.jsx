import React from 'react';
import { CardSlot } from '../base/CardSlot.jsx';
import ProgressBar from '../base/ProgressBar.jsx';
import { Shield, Sword, Crosshair, Wand2, Clock, Zap } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import * as CardManager from '../../../systems/cards/CardManager.js';

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

    const handleUnassign = () => {
        if (card && (card.id || card.instanceId)) {
            CardManager.unassignHero(card.id || card.instanceId, slotIndex);
        }
    };

    // Style configurations for dynamic icons
    const styleConfig = {
        melee: { icon: <Sword size={14} />, label: 'Melee Attack' },
        ranged: { icon: <Crosshair size={14} />, label: 'Ranged Attack' },
        magic: { icon: <Wand2 size={14} />, label: 'Magic Attack' }
    };
    const activeStyle = styleConfig[selectedStyle] || styleConfig['melee'];

    // Return null if no hero is assigned (Simplified UI)
    if (!hero) return null;

    // Hero is Present. Calculate dynamic live stats
    const name = hero.name || 'Hero';

    // Skills (fallback to 1 if missing)
    const attackSkill = hero.skills?.[selectedStyle]?.level ?? hero.skills?.[selectedStyle] ?? 1;
    const defenceSkill = hero.skills?.defence?.level ?? hero.skills?.defence ?? 1;

    // HP & Energy Defaults
    const hp = hero.hp || { current: 100, max: 100 };
    const energy = hero.energy || { current: 50, max: 50 };

    // Attack Speed & Progress Tracking (Unified Modular System)
    const attackSpeedMs = card?.heroAttackSpeed || 2500;
    const attackSpeedSec = (attackSpeedMs / 1000).toFixed(1);

    const attackProgress = card?.heroTickProcesses?.[hero.id] ?? card?.heroTickProgress ?? 0;
    const attackPercent = Math.min((attackProgress / attackSpeedMs) * 100, 100);

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* The Asset / Portrait Drop Target (Minified) */}
            {/* We still need a CardSlot for DnD assignment/unassignment. 
                We wrap the header so the name itself acts as the handle. */}
            <CardSlot
                id={`combat-${card.id || card.instanceId}-slot-${slotIndex}`}
                className="w-full bg-black/40 border border-white/10 flex items-center justify-center py-1 px-2 rounded-sm overflow-hidden min-h-[32px]"
                data={{ type: 'combatSlot', cardId: card.id || card.instanceId, slotIndex }}
                label="" 
                hero={hero}
                onRemove={handleUnassign}
            >
                <h4 className="font-display font-bold text-gi-primary text-xs text-center truncate w-full" title={name}>
                    {name}
                </h4>
            </CardSlot>

            {/* Live Stats Table */}
            <div className="flex flex-col gap-1.5 w-full">
                {/* HP Row */}
                <div className="flex items-center gap-2">
                    <span className="text-green-500"><Shield size={12} /></span>
                    <div className="flex-1">
                        <ProgressBar
                            current={hp.current}
                            max={hp.max}
                            color="green"
                            height="xs"
                            showText={false}
                            showBloom={false}
                            showBitDrift={false}
                        />
                    </div>
                </div>

                {/* Energy Row */}
                <div className="flex items-center gap-2">
                    <span className="text-blue-500"><Zap size={12} /></span>
                    <div className="flex-1">
                        <ProgressBar
                            current={energy.current}
                            max={energy.max}
                            color="blue"
                            height="xs"
                            showText={false}
                            showBloom={false}
                            showBitDrift={false}
                        />
                    </div>
                </div>

                {/* Attack Cycle Row */}
                <div className="flex items-center gap-2">
                    <span className="text-gi-accent"><Clock size={12} /></span>
                    <div className="flex-1">
                        <ProgressBar
                            current={attackProgress}
                            max={attackSpeedMs}
                            color="yellow"
                            height="xs"
                            showText={false}
                            transitionDuration="100ms"
                            showBloom={false}
                            showBitDrift={false}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default HeroGroup;
