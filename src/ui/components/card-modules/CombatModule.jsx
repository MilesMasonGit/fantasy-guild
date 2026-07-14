import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import CombatStage from '../combat/CombatStage.jsx';
import EnemyStage from '../combat/EnemyStage.jsx';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { USE_DECK_LOOP } from '../../../config/featureFlags.js';

/**
 * CombatModule
 * A modular trait component that wraps the CombatStage.
 * Connects the card's 'combat' trait to the visual combat UI.
 * 
 * @param {Object} props
 * @param {Object} props.trait - The 'combat' trait from the card's traits array.
 * @param {Object} props.card - The full card state object.
 */
export const CombatModule = React.memo(({ trait, card, isHovered }) => {
    const engine = useEngine();
    
    // Resolve enemy template from registry
    const enemyId = trait.enemyId || card.enemyId;
    const enemy = getEnemy(enemyId);
    
    // Resolve active hero and subscribe to its state for live visual updates
    const assignedHeroId = card.assignedHeroId;
    const hero = useGameState(
        state => assignedHeroId ? engine?.HeroManager?.getHero(assignedHeroId) : null,
        ['heroes_updated'],
        null,
        { deps: [assignedHeroId] }
    );
    
    const handleStyleChange = (newStyle) => {
        if (engine?.CardManager?.updateCombatStyle) {
            engine.CardManager.updateCombatStyle(card.id, newStyle);
        }
    };

    if (!enemy) {
        return (
            <div className="p-4 text-center text-xs text-gi-muted italic">
                No enemy encountered...
            </div>
        );
    }

    // Deck loop: split theatre — only the enemy lives on the combat card; the
    // hero animates on the Hero card (owner design 2026-07-14). The legacy
    // playmat keeps the full CombatStage (incl. its hero assignment slot).
    if (USE_DECK_LOOP) {
        return (
            <div className="w-full flex flex-col flex-1">
                <EnemyStage card={card} enemy={enemy} />
            </div>
        );
    }

    return (
        <div className="w-full">
            <CombatStage
                card={card}
                hero={hero}
                enemy={enemy}
                isHovered={isHovered}
            />
        </div>
    );
});

export default CombatModule;
