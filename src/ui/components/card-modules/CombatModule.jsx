import React from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import CombatStage from '../combat/CombatStage.jsx';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';

/**
 * CombatModule
 * A modular trait component that wraps the CombatStage.
 * Connects the card's 'combat' trait to the visual combat UI.
 * 
 * @param {Object} props
 * @param {Object} props.trait - The 'combat' trait from the card's traits array.
 * @param {Object} props.card - The full card state object.
 */
export const CombatModule = ({ trait, card }) => {
    const engine = useEngine();
    
    // Resolve enemy template from registry
    const enemyId = trait.enemyId || card.enemyId;
    const enemy = getEnemy(enemyId);
    
    // Resolve active hero (supporting modular slots)
    const assignedHeroId = card.heroSlots?.[0] || card.assignedHeroId;
    const hero = assignedHeroId ? engine?.HeroManager?.getHero(assignedHeroId) : null;
    
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

    return (
        <div className="w-full">
            <CombatStage 
                card={card}
                hero={hero}
                enemy={enemy}
            />
        </div>
    );
};

export default CombatModule;
