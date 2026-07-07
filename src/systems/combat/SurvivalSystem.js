// Fantasy Guild - Survival System
// Handlers automatic food/drink consumption (Non-blocking)

import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';

export const SurvivalSystem = {
    /**
     * Check if hero needs food/drink and consume if available.
     * This version is "Free" - it does not block the combat tick.
     * @param {Object} hero 
     */
    processAutoConsume(hero) {
        if (!hero || !hero.id) return;

        const { needsFood, needsDrink } = CombatFormulas.checkAutoConsume(hero);

        if (needsFood && hero.equipment?.food) {
            this._consumeItem(hero, hero.equipment.food, 'hp');
        }

        if (needsDrink && hero.equipment?.drink) {
            this._consumeItem(hero, hero.equipment.drink, 'energy');
        }
    },

    /**
     * Internal helper to handle the consumption logic
     */
    _consumeItem(hero, itemId, type) {
        const template = getItem(itemId);
        if (!template || !InventoryManager.hasItem(itemId, 1)) return;

        const restoreAmount = template.restoreAmount || 0;
        const restoreType = template.restoreType || type;

        if (restoreType === 'hp') {
            HeroManager.modifyHeroHp(hero.id, restoreAmount);
        } else {
            HeroManager.modifyHeroEnergy(hero.id, restoreAmount);
        }

        InventoryManager.removeItem(itemId, 1);
        logger.debug('SurvivalSystem', `${hero.name} consumed ${template.name} (+${restoreAmount} ${restoreType})`);

        EventBus.publish('combat_consumed', {
            heroId: hero.id,
            itemId: itemId,
            restoreType: restoreType,
            amount: restoreAmount
        });
    }
};
