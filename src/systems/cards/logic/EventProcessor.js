import { logger } from '../../../utils/Logger.js';
import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import * as NotificationSystem from '../../core/NotificationSystem.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { getEventDef, getRandomEvent } from '../../../config/registries/eventRegistry.js';
import { getAreaSet, getClass } from '../../../config/registries/index.js';
import { createCard, discardCard } from './LifecycleProcessor.js';
import { CardStackManager } from './CardStackManager.js';

/**
 * Event Processor - Handles spawning of regional Event and Invasion cards.
 */

function clearExistingEventsAndInvasions(areaId) {
    const activeCards = GameState.state.cards?.active || [];
    const cardsToClear = activeCards.filter(c => 
        (c.cardType === 'event' || c.cardType === 'invasion') && c.areaId === areaId
    );

    for (const card of cardsToClear) {
        logger.info('EventProcessor', `Despawning existing ${card.cardType} "${card.name}" (${card.id})`);
        discardCard(card.id);
    }
}

export function spawnEventCard(areaId, stage = 1, eventId = null) {
    const eventDef = eventId ? getEventDef(eventId) : getRandomEvent(areaId);
    if (!eventDef) {
        logger.warn('EventProcessor', `No events found for area "${areaId}"`);
        return null;
    }

    // Despawn existing events/invasions in this area first
    clearExistingEventsAndInvasions(areaId);

    logger.info('EventProcessor', `Spawning event "${eventDef.name}" (Stage ${stage}) in ${areaId}`);

    const areaSet = getAreaSet(areaId);
    const gridConfig = areaSet?.gridConfig || {};
    const hubPos = gridConfig.hubPosition || gridConfig.center || { x: 0, y: 0 };

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
        position: { x: hubPos.x, y: hubPos.y },
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

    // Despawn existing events/invasions in this area first
    clearExistingEventsAndInvasions(areaId);

    logger.info('EventProcessor', `Spawning invasion "${template.name}" in ${areaId}`);

    const areaSet = getAreaSet(areaId);
    const gridConfig = areaSet?.gridConfig || {};
    const hubPos = gridConfig.hubPosition || gridConfig.center || { x: 0, y: 0 };

    // Calculate highest combat level among all owned heroes (active and benched)
    const heroes = [...(GameState.state.heroes || []), ...(GameState.state.bench || [])];
    let highestCombatLevel = 1;
    for (const hero of heroes) {
        if (hero.isVillager) continue;
        const classId = hero.classId;
        const heroClass = getClass(classId);
        const combatStyle = heroClass?.combatStyle || 'melee';
        const skillLevel = hero.skills?.[combatStyle]?.level ?? 1;
        if (skillLevel > highestCombatLevel) {
            highestCombatLevel = skillLevel;
        }
    }
    const quantity = highestCombatLevel;

    // Pick initial enemy from the area's configured spawn pool
    let selectedEnemyId = template.enemyId;
    const spawnPool = areaSet?.invasionSpawnPool || [];
    if (spawnPool && spawnPool.length > 0) {
        selectedEnemyId = spawnPool[Math.floor(Math.random() * spawnPool.length)];
    }

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
        position: { x: hubPos.x, y: hubPos.y },
        isLocked: true,
        invasionId: invasionId,
        hordeCount: quantity,
        hordeTotal: quantity,
        enemyId: selectedEnemyId,
        traits: [
            { type: 'header' },
            { type: 'threat' },
            { type: 'horde' },
            { type: 'heroslot', label: 'Defender', count: 3, slots: [{}, {}, {}] },
            { type: 'combat', enemyId: selectedEnemyId }
        ]
    };

    const result = createCard(cardData, {
        overrides: {
            hordeCount: quantity,
            hordeTotal: quantity,
            invasionId: invasionId
        }
    });
    if (result.success) {
        const areaState = GameState.state.areaStates[areaId];
        if (areaState) areaState.activeInvasionId = invasionId;
        NotificationSystem.error(`INVASION: ${template.name}!`);
    }
    return result.card || null;
}
