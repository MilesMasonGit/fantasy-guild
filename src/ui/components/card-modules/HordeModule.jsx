import React from 'react';
import { Sword, Users, Shield } from 'lucide-react';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * HordeModule
 * Displays the remaining enemy count and a progress bar for Invasion cards.
 */
export const HordeModule = React.memo(({ trait, card }) => {
    const count = card.hordeCount || 0;
    const total = card.hordeTotal || 1;
    const progress = (count / total) * 100;
    
    // Resolve enemy name
    const enemyDef = getEnemy(card.enemyId);
    const enemyName = enemyDef?.name || 'Enemies';
    
    return (
        <div className="flex items-center justify-center py-2 px-3 bg-gi-danger/5 border-t border-gi-danger/10">
            <span className="gi-outline-2 text-[10px] font-bold uppercase tracking-widest text-gi-danger font-display">
                Defeat {enemyName} Horde - {count}/{total}
            </span>
        </div>
    );
});

export default HordeModule;
