import React from 'react';
import { cn } from '../../utils/cn.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { Heart, Sword, Shield, Wind } from 'lucide-react';

export const EnemyStatsModule = React.memo(({ trait, card, template, ...props }) => {
    // Determine which enemy this card spawns. Usually stored in `enemyId`.
    const enemyId = props.enemyId || trait?.enemyId || card?.enemyId || template?.enemyId;
    if (!enemyId) return null;

    const enemy = getEnemy(enemyId);
    if (!enemy) return null;

    // Default combat stats
    const hp = enemy.maxHp || enemy.hp || 10;
    const attack = enemy.attack || enemy.damage || 1;
    const defense = enemy.defense || enemy.armor || 0;
    const speed = enemy.speed || enemy.attackSpeed || 1.0;

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", props.className)}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-gi-danger">
                Combat Stats ({enemy.name || 'Enemy'})
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded">
                    <Heart size={14} className="text-red-500" />
                    <span className="text-pixel-sm font-bold text-gi-text">{hp} <span className="text-[9px] text-gi-muted font-normal">HP</span></span>
                </div>
                
                <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded">
                    <Sword size={14} className="text-orange-500" />
                    <span className="text-pixel-sm font-bold text-gi-text">{attack} <span className="text-[9px] text-gi-muted font-normal">ATK</span></span>
                </div>

                <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded">
                    <Shield size={14} className="text-blue-500" />
                    <span className="text-pixel-sm font-bold text-gi-text">{defense} <span className="text-[9px] text-gi-muted font-normal">DEF</span></span>
                </div>

                <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded">
                    <Wind size={14} className="text-green-500" />
                    <span className="text-pixel-sm font-bold text-gi-text">{speed} <span className="text-[9px] text-gi-muted font-normal">SPD</span></span>
                </div>
            </div>
        </div>
    );
});

export default EnemyStatsModule;
