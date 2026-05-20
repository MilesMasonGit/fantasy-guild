import { GameState } from '../../../state/GameState.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import * as CardManager from '../../cards/CardManager.js';
import { CARD_TYPES } from '../../../config/registries/cardRegistry.js';

/**
 * Invasion Spawner: Strategic card instantiation and spatial placement.
 */

/**
 * Start a new invasion (instantiate card and track state)
 */
export function startInvasion(invasionId) {
    const template = getInvasion(invasionId);
    if (!template) {
        logger.error('InvasionSpawner', `Template not found: ${invasionId}`);
        return null;
    }

    // 1. Blueprint the card
    const cardData = {
        id: `invasion_${invasionId}`,
        templateId: `invasion_${invasionId}`,
        cardType: CARD_TYPES.INVASION,
        name: template.name,
        description: template.description,
        threat: 0,
        hordeCount: template.count,
        hordeTotal: template.count,
        enemyId: template.enemyId,
        traits: [
            { type: 'heroslot', title: 'Defender', count: 3 },
            { type: 'combat', enemyId: template.enemyId }
        ]
    };

    const result = CardManager.createCard(cardData);
    if (!result.success) {
        logger.error('InvasionSpawner', `Failed to create card: ${result.error}`);
        return null;
    }

    const card = result.card;

    // 2. Spatial Placement: Find a nearby empty cell
    const spawnPos = findStrategicSpawnPosition();
    if (spawnPos) {
        CardManager.updateCardPosition(card.id, spawnPos.x, spawnPos.y);
    }

    // 3. Track logic-state (horde size and threat)
    GameState.invasions.active[card.id] = {
        threat: 0,
        count: template.count,
        total: template.count,
        invasionId: invasionId,
        lastMilestoneThreat: 0
    };

    logger.info('InvasionSpawner', `Spawned ${template.name} at [${spawnPos?.x ?? '?'}, ${spawnPos?.y ?? '?'}]`);
    EventBus.publish('invasion_started', { cardId: card.id, invasionId, name: template.name });

    return card.id;
}

/**
 * Internal: Find valid adjacent empty cell near player-placed cards.
 */
function findStrategicSpawnPosition() {
    // Priority: Adjacent to a player-placed card
    const playerCard = (GameState.cards?.active || []).find(c =>
        c.cardType !== CARD_TYPES.INVASION && c.position?.x !== null
    );

    if (playerCard) {
        const emptyNeighbors = GameState.getValidAdjacentEmptyCells(playerCard.position.x, playerCard.position.y);
        if (emptyNeighbors.length > 0) {
            return emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
        }
    }

    // Fallback: Use first empty cell available on board
    return CardManager.findFirstEmptyCell();
}
