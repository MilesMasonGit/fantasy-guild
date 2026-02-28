import React from 'react';
import GIProgressBar from '../base/GIProgressBar.jsx';
import { Shield, Sword, Crosshair, Wand2, Clock, Star } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * EnemyStatBlock
 * Renders the active enemy's stats within a combat stage, dynamically updating their live HP and action timer.
 * Designed as the visual counterpart to the HeroGroup component.
 * 
 * @param {Object} props
 * @param {Object} props.card - The active Combat Card instance (contains live enemyHp)
 * @param {Object} props.enemy - The Enemy template object (contains base stats)
 */
export const EnemyStatBlock = ({ card, enemy, className }) => {
    if (!enemy) return null;

    // Combat style configurations for dynamic icons
    const styleConfig = {
        melee: { icon: <Sword size={14} />, label: 'Melee Attack' },
        ranged: { icon: <Crosshair size={14} />, label: 'Ranged Attack' },
        magic: { icon: <Wand2 size={14} />, label: 'Magic Attack' }
    };

    const enemyType = enemy.combatType || 'melee';
    const activeStyle = styleConfig[enemyType] || styleConfig['melee'];

    // Stats
    const attackSpeedSec = (enemy.attackSpeed / 1000).toFixed(1);

    // In Vanilla, enemy HP was often stored directly on the active card instance
    // Fallback to max HP from the template if the card doesn't track it yet
    const enemyHp = card?.enemyHp || { current: enemy.hp, max: enemy.hp };

    // Attack progress tracking
    const attackProgress = card?.enemyTickProgress || 0;
    const attackPercent = Math.min((attackProgress / enemy.attackSpeed) * 100, 100);

    return (
        <div className={cn("flex flex-col gap-2 p-3 rounded-lg border border-gi-danger/30 bg-gi-surface shadow-md w-36", className)}>
            {/* Header */}
            <h4 className="font-display font-bold text-gi-danger text-sm text-center truncate w-full" title={enemy.name || 'Enemy'}>
                {enemy.name || 'Enemy'}
            </h4>

            {/* Fixed Enemy Portrait Box */}
            <div className="w-full aspect-square bg-black/50 border-2 border-gi-danger/40 flex items-center justify-center p-1 rounded-sm overflow-hidden shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
                <div className="text-5xl filter drop-shadow-md brightness-75 transition-transform">
                    {enemy.icon || '👹'}
                </div>
            </div>

            {/* Base Combat Stats */}
            <div className="flex justify-between items-center text-xs py-1 px-2 bg-black/20 rounded border border-gi-danger/20 w-full">
                <div className="flex items-center gap-1 text-gray-300" title="Defence">
                    <Shield size={14} className="text-gray-400" />
                    <span className="font-bold">{enemy.defenceSkill || 1}</span>
                </div>
                <div className="flex items-center gap-1 text-gi-danger" title={activeStyle.label}>
                    {activeStyle.icon}
                    <span className="font-bold">{enemy.attackSkill || 1}</span>
                </div>
            </div>

            {/* Live HP / XP Blocks */}
            <div className="flex flex-col gap-1 w-full">
                <GIProgressBar
                    current={enemyHp.current}
                    max={enemyHp.max}
                    color="red"
                    height="sm"
                    showText={true}
                />
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-gi-muted px-1 mt-0.5">
                    <span className="flex items-center gap-1">
                        <Star size={10} className="text-yellow-500" /> XP Award
                    </span>
                    <span className="text-yellow-500/80">{enemy.xpAwarded ?? 5}</span>
                </div>
            </div>

            {/* Action Timer */}
            <div className="mt-1 flex flex-col gap-0.5">
                <div className="flex justify-between items-center w-full">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
                        <Clock size={10} />
                        Next Attack
                    </span>
                    <span className="text-[10px] font-bold text-gi-danger">{attackSpeedSec}s</span>
                </div>
                {/* Standard red glow for enemy attack progression */}
                <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-gi-danger transition-all ease-linear shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                        style={{ width: `${attackPercent}%`, transitionDuration: '0.1s' }}
                    />
                </div>
            </div>

        </div>
    );
};

export default EnemyStatBlock;
