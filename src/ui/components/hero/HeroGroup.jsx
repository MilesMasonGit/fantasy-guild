import React from 'react';
import { CardSlot } from '../base/CardSlot.jsx';
import ProgressBar from '../base/ProgressBar.jsx';
import { Shield, Sword, Crosshair, Wand2, Clock, Zap } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import * as CardManager from '../../../systems/cards/CardManager.js';
import StatusPlacards from '../combat/StatusPlacards.jsx';

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
    const defenceSkill = hero.skills?.defense?.level ?? hero.skills?.defense ?? 1;

    // HP & Energy Defaults
    const hp = hero.hp || { current: 100, max: 100 };
    const energy = hero.energy || { current: 50, max: 50 };

    // Attack Speed & Progress Tracking (Unified Modular System)
    const attackSpeedMs = card?.combat?.stats?.attackSpeed || card?.heroAttackSpeed || 2500;
    const attackSpeedSec = (attackSpeedMs / 1000).toFixed(1);

    const attackProgress = card?.combat?.heroTickProcesses?.[hero.id] ?? card?.combat?.heroTickProgress ?? 0;
    const attackPercent = Math.min((attackProgress / attackSpeedMs) * 100, 100);

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* Live Stats Table (Info Block) */}
            <div className="flex flex-col gap-1 w-full p-2 bg-black/30 rounded-lg border border-white/5">
                {/* Hero Name Header inside Info Block */}
                <CardSlot
                    id={`combat-${card.id || card.instanceId}-slot-${slotIndex}`}
                    className="w-full bg-transparent border-none flex items-center justify-center p-0 min-h-[20px] select-none pointer-events-auto"
                    data={{ type: 'combatSlot', cardId: card.id || card.instanceId, slotIndex }}
                    label="" 
                    hero={hero}
                    onRemove={handleUnassign}
                >
                    <h4 className="font-display font-bold text-gi-primary text-sm uppercase tracking-wider text-center truncate w-full gi-outline-2" title={name}>
                        {name}
                    </h4>
                </CardSlot>

                {/* Active status effects on this hero */}
                <StatusPlacards statuses={hero.statuses} />

                {/* Health Row */}
                <div className="flex items-center gap-2 w-full">
                    <div className="flex gap-1 shrink-0 text-xs font-bold uppercase tracking-wider gi-outline-1">
                        <span className="text-gi-hp">Health</span>
                        <span className="font-mono text-gi-text/90">{Math.floor(hp.current)}/{hp.max}</span>
                    </div>
                    <ProgressBar
                        cardId={card.id}
                        heroId={hero.id}
                        targetType="combat-hero-hp"
                        current={hp.current}
                        max={hp.max}
                        color="hp"
                        size="sm"
                        showBloom={true}
                        showBitDrift={false}
                        className="flex-1"
                    />
                </div>

                {/* Energy Row */}
                <div className="flex items-center gap-2 w-full">
                    <div className="flex gap-1 shrink-0 text-xs font-bold uppercase tracking-wider gi-outline-1">
                        <span className="text-gi-warning">Energy</span>
                        <span className="font-mono text-gi-text/90">{Math.floor(energy.current)}/{energy.max}</span>
                    </div>
                    <ProgressBar
                        cardId={card.id}
                        heroId={hero.id}
                        targetType="combat-hero-energy"
                        current={energy.current}
                        max={energy.max}
                        color="energy"
                        size="sm"
                        showBloom={true}
                        showBitDrift={false}
                        className="flex-1"
                    />
                </div>

                {/* Attack Row */}
                <div className="flex items-center gap-2 w-full">
                    <div className="flex gap-1 shrink-0 text-xs font-bold uppercase tracking-wider gi-outline-1">
                        <span className="text-gi-accent">Attack</span>
                        <span className="font-mono text-gi-text/90">{attackSpeedSec}s</span>
                    </div>
                    <ProgressBar
                        cardId={card.id}
                        heroId={hero.id}
                        targetType="combat-hero-attack"
                        current={attackProgress}
                        max={attackSpeedMs}
                        color="yellow"
                        size="sm"
                        showBloom={false}
                        showBitDrift={false}
                        transitionDuration="100ms"
                        className="flex-1"
                    />
                </div>
            </div>

        </div>
    );
};

export default HeroGroup;
