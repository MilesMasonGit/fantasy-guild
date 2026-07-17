import React from 'react';
import EnemyStage from '../combat/EnemyStage.jsx';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * CombatModule
 * A modular trait component that wraps the combat theatre.
 * Split theatre (owner design 2026-07-14): only the enemy lives on the
 * combat card; the hero animates on the Hero card.
 *
 * @param {Object} props
 * @param {Object} props.trait - The 'combat' trait from the card's traits array.
 * @param {Object} props.card - The full card state object.
 */
export const CombatModule = React.memo(({ trait, card }) => {
    // Resolve enemy template from registry
    const enemyId = trait.enemyId || card.enemyId;
    const enemy = getEnemy(enemyId);

    if (!enemy) {
        return (
            <div className="p-4 text-center text-xs text-gi-muted italic">
                No enemy encountered...
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col flex-1">
            <EnemyStage card={card} enemy={enemy} />
        </div>
    );
});

export default CombatModule;
