import { logger } from '../../../utils/Logger.js';
import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import * as NotificationSystem from '../../core/NotificationSystem.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { getEventDef, getRandomEvent } from '../../../config/registries/eventRegistry.js';
import { createCard } from './LifecycleProcessor.js';
import { CardStackManager } from './CardStackManager.js';

/**
 * Event Processor - Handles spawning of regional Event and Invasion cards.
 */

export function spawnEventCard(areaId, stage = 1, eventId = null) {
    const eventDef = eventId ? getEventDef(eventId) : getRandomEvent(areaId);
    if (!eventDef) {
        logger.warn('EventProcessor', `No events found for area "${areaId}"`);
        return null;
    }

    logger.info('EventProcessor', `Spawning event "${eventDef.name}" (Stage ${stage}) in ${areaId}`);

    const emptyCell = CardStackManager.findFirstEmptyCell({ isGutter: true });

    const cardData = {
        id: `event_${eventDef.id}`,
        templateId: `event_${eventDef.id}`,
        name: eventDef.name,
        icon: eventDef.icon || '✨',
        description: eventDef.description,
        cardType: 'event',
        status: 'active',
        location: 'board',
        areaId: areaId,
        position: emptyCell ? { x: emptyCell.x, y: emptyCell.y } : null,
        isLocked: true,
        timeRemainingMs: eventDef.durationMs || 300000,
        traits: [
            { type: 'header' },
            { type: 'expiration', durationMs: eventDef.durationMs },
            ...(eventDef.traits || [])
        ]
    };

    const result = createCard(cardData);
    if (result.success) {
        NotificationSystem.info(`New Event: ${eventDef.name}!`);
    }
    return result.card || null;
}

export function spawnInvasionCard(areaId, invasionIdOverride = null) {
    const invasionId = invasionIdOverride ||
        (areaId === 'farmland' ? 'chicken_raid' :
            areaId === 'forest' ? 'wolf_pack_siege' : 'skeleton_onslaught');

    const template = getInvasion(invasionId);
    if (!template) {
        logger.warn('EventProcessor', `Invasion template "${invasionId}" not found`);
        return null;
    }

    logger.info('EventProcessor', `Spawning invasion "${template.name}" in ${areaId}`);

    const emptyCell = CardStackManager.findFirstEmptyCell({ isGutter: true });

    const cardData = {
        id: `invasion_${template.id}`,
        templateId: `invasion_${template.id}`,
        name: template.name,
        icon: '⚔️',
        description: template.description,
        cardType: 'invasion',
        status: 'active',
        location: 'board',
        areaId: areaId,
        position: emptyCell ? { x: emptyCell.x, y: emptyCell.y } : null,
        isLocked: true,
        invasionId: invasionId,
        hordeCount: template.count || 20,
        hordeTotal: template.count || 20,
        enemyId: template.enemyId,
        traits: [
            { type: 'header' },
            { type: 'threat' },
            { type: 'horde' },
            { type: 'heroslot', label: 'Defender', count: 3, slots: [{}, {}, {}] },
            { type: 'combat', enemyId: template.enemyId }
        ]
    };

    const result = createCard(cardData);
    if (result.success) {
        const areaState = GameState.state.areaStates[areaId];
        if (areaState) areaState.activeInvasionId = invasionId;
        NotificationSystem.error(`INVASION: ${template.name}!`);
    }
    return result.card || null;
}
