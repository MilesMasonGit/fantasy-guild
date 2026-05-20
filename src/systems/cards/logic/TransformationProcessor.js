import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { CARD_TYPES } from '../../../config/registries/cardRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { logger } from '../../../utils/Logger.js';
import { ensureModular } from '../CardAssembler.js';
import { publishCardUpdate, cloneTraits } from './CardManagerUtils.js';

/**
 * Card Transformation - Handles switching between Combat and Task states.
 */

export function transformToCombat(cardId, enemyId) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    const enemy = getEnemy(enemyId);
    if (!enemy) return { success: false, error: 'ENEMY_NOT_FOUND' };

    logger.info('TransformationProcessor', `Transforming card ${cardId} into combat against ${enemyId}`);

    // State Snapshot for reversion
    card.originalTraits = cloneTraits(card.traits);
    card.originalCardType = card.cardType;

    // Transition to combat
    card.cardType = CARD_TYPES.COMBAT;
    card.traits = [
        { type: 'header' },
        { type: 'heroslot', slots: 1 },
        {
            type: 'combat',
            enemyId: enemyId,
            combatType: enemy.combatType || 'melee'
        }
    ];

    // Initialize Combat Namespace
    card.combat = {
        enemyId: enemyId,
        enemyHp: { current: enemy.hp, max: enemy.hp },
        heroTickProgress: 0,
        enemyTickProgress: 0,
        heroTickProcesses: {}, 
        state: {
            isHeroConsuming: false,
            lastHeroHit: false,
            lastEnemyHit: false,
            lastHeroDamage: 0,
            lastEnemyDamage: 0
        }
    };

    card.status = 'active'; 

    ensureModular(card);
    publishCardUpdate(cardId, { source: 'transformation' });
    EventBus.publish('card_transformed', { cardId, enemyId });

    return { success: true };
}

export function revertFromCombat(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    if (!card.originalTraits) {
        logger.warn('TransformationProcessor', `No originalTraits found for card ${cardId}.`);
        return { success: false, error: 'NO_ORIGINAL_STATE' };
    }

    logger.info('TransformationProcessor', `Reverting card ${cardId} from combat back to ${card.originalCardType}`);

    // Restore state
    card.cardType = card.originalCardType;
    card.traits = card.originalTraits;

    // Cleanup Snapshot & Combat State
    delete card.originalTraits;
    delete card.originalCardType;
    delete card.combat;

    // Resume gathering if hero is still assigned
    const hasHero = !!card.assignedHeroId;
    card.status = hasHero ? 'active' : 'idle';
    card.progress = 0; 

    ensureModular(card);
    publishCardUpdate(cardId, { source: 'reversion' });
    EventBus.publish('card_reverted', { cardId });

    return { success: true };
}

export function resetCombatCard(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card || card.cardType !== CARD_TYPES.COMBAT) {
        return { success: false, error: 'INVALID_CARD' };
    }

    const enemy = getEnemy(card.combat?.enemyId);
    if (!enemy) return { success: false, error: 'ENEMY_NOT_FOUND' };

    card.combat.enemyHp = { current: enemy.hp, max: enemy.hp };
    card.combat.heroTickProgress = 0;
    card.combat.heroTickProcesses = {}; 
    card.combat.enemyTickProgress = 0;
    card.combat.state = {
        isHeroConsuming: false,
        lastHeroHit: false,
        lastEnemyHit: false,
        lastHeroDamage: 0,
        lastEnemyDamage: 0
    };

    card.status = 'idle';
    publishCardUpdate(cardId, { source: 'combat_reset' });
    EventBus.publish('combat_card_reset', { cardId });

    return { success: true };
}

export function updateCombatStyle(cardId, style) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    if (!['melee', 'ranged', 'magic'].includes(style)) {
        return { success: false, error: 'INVALID_STYLE' };
    }

    card.selectedStyle = style;
    publishCardUpdate(cardId, { status: card.status });
    return { success: true };
}
