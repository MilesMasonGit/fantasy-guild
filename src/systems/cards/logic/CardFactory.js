import { GameState } from '../../../state/GameState.js';
import { logger } from '../../../utils/Logger.js';
import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { ensureModular } from '../CardAssembler.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { rehydrateEntity } from '../../../utils/RegistryUtils.js';

/**
 * CardFactory
 * 
 * Handles instantiation and hydration of card objects.
 */
export const CardFactory = {
    generateId(prefix = 'card') {
        const counter = (GameState.cards?.idCounter || 0) + 1;
        if (GameState.cards) GameState.cards.idCounter = counter;
        return `${prefix}_${Date.now()}_${counter}`;
    },

    createInstance(templateId, options = {}) {
        const template = typeof templateId === 'object' ? templateId : getCardTemplate(templateId);
        if (!template) return null;

        const card = {
            id: template.id && typeof templateId !== 'object' ? this.generateId('card') : (template.id || this.generateId('card')),
            templateId: template.id || template.templateId || (typeof templateId === 'string' ? templateId : null),
            position: template.position ? { ...template.position } : { x: null, y: null },
            isLocked: template.isLocked || false,
            areaId: template.areaId || GameState.activeAreaId,
            aggregator: new ModifierAggregator(null),
            
            // Runtime state
            location: template.location || 'board',
            stack: template.stack || [],
            progress: template.progress || 0,
            status: template.status || 'idle',
            createdAt: Date.now(),
            ...options.overrides
        };

        // Set dynamic template reference to avoid registry lookups for ad-hoc templates
        card._template = template;

        // Initialize Flyweight getters/setters dynamically
        rehydrateEntity(card, getCardTemplate);

        // Specialized initialization
        if (card.cardType === 'combat' || card.cardType === 'invasion') {
            this.initCombatState(card, template);
        }

        if (card.cardType === 'dungeon') {
            this.initDungeonState(card, template);
        }
        
        if (template.isProject || card.cardType === 'project') {
            this.initProjectState(card, template);
        }

        ensureModular(card, template);
        return card;
    },

    initCombatState(card, template) {
        const enemyId = template.enemyId || template.config?.enemyId;
        const enemy = getEnemy(enemyId);
        if (enemy) {
            card.enemyId = enemyId;
            card.combat = {
                enemyHp: { current: enemy.hp, max: enemy.hp },
                enemyTickProgress: 0,
                heroTickProcesses: {},
                state: { 
                    intermissionTimer: 0,
                    lastHeroHit: false,
                    lastEnemyHit: false
                },
                stats: {} // To be hydrated by StatProcessor
            };
        }
    },

    initDungeonState(card, template) {
        card.enemyQueue = template.enemies ? [...template.enemies] : [];
        card.totalCount = card.enemyQueue.length;
        card.completedCount = 0;
        card.finalRewards = template.rewards ? [...template.rewards] : [];

        if (card.enemyQueue.length > 0) {
            const firstEnemyId = card.enemyQueue.shift();
            const enemy = getEnemy(firstEnemyId);
            if (enemy) {
                card.enemyId = firstEnemyId;
                card.combat = {
                    enemyHp: { current: enemy.hp, max: enemy.hp },
                    enemyTickProgress: 0,
                    heroTickProcesses: {},
                    state: { intermissionTimer: 0 },
                    stats: {}
                };
            }
        }
    },

    initProjectState(card, template) {
        card.project = {
            level: 0,
            progress: {},
            isReady: false
        };
    }
};

export default CardFactory;
