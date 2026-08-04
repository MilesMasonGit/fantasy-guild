import React from 'react';

// Import existing modules
import InfoModule from './InfoModule.jsx';
import LootModule from './LootModule.jsx';
import CardHeaderModule from './CardHeaderModule.jsx';
import SkillRequirementsModule from './SkillRequirementsModule.jsx';
import TaskDisplay from './TaskDisplay.jsx';
import TaskStage from './TaskStage.jsx';
import SpriteModule from './SpriteModule.jsx';
import CombatModule from './CombatModule.jsx';
import RecipeSelectorModule from './RecipeSelectorModule.jsx';

import CompactLootModule from './CompactLootModule.jsx';
import CompactInputModule from './CompactInputModule.jsx';
import BuffGlossaryModule from './BuffGlossaryModule.jsx';
import EnemyStatsModule from './EnemyStatsModule.jsx';

export const PlaceholderModule = ({ type }) => (
    <div className="w-full bg-red-900/30 border border-red-500/50 p-2 rounded text-center text-xs text-red-300 font-mono my-1">
        [Missing Module: {type}]
    </div>
);

/**
 * MODULE_REGISTRY
 * 
 * Each entry defines:
 * - component: The React component to render.
 * - placement: 'header', 'content', 'footer', 'drawer'
 * - priority: Order within the placement (Lower = Higher/Earlier).
 * - isVisible: Function returning true if the module should be rendered.
 * - showTab: Function reporting if this trait should have a dedicated Footer Tab.
 */
export const MODULE_REGISTRY = {
    'header': { 
        component: CardHeaderModule, 
        placement: 'header', 
        priority: 10,
        isVisible: () => true 
    },
    'skillrequirement': { 
        component: SkillRequirementsModule, 
        placement: 'ribbon', 
        priority: 35,
        isVisible: () => true 
    },
    'workcycle': { 
        component: TaskStage, 
        placement: 'content', 
        priority: 40,
        isVisible: (p) => p.cardType === 'task' || p.cardType === 'project' || p.cardType === 'station' || !!p.card.assignedHeroId
    },
    'combat': { 
        component: CombatModule, 
        placement: 'content', 
        priority: 50,
        isVisible: (p) => p.cardType === 'combat' || p.cardType === 'dungeon' || p.cardType === 'invasion' || (p.activeTab === 'combat' && !!p.card.assignedHeroId),
        showTab: (p) => p.cardType !== 'combat' && p.cardType !== 'invasion' // Only show tab if not already the primary content
    },
    'loot': { 
        component: LootModule, 
        placement: 'content', 
        priority: 65,
        isVisible: (p) => p.activeTab === 'loot',
        showTab: () => true
    },
    'recipe_selector': { 
        component: RecipeSelectorModule, 
        placement: 'content', 
        priority: 42,
        isVisible: (p) => p.activeTab === 'recipe_selector',
        showTab: () => true
    },
    'description': { 
        component: InfoModule, 
        placement: 'drawer', 
        priority: 100,
        isVisible: (p) => p.isHovered
    },
    'compact_loot_hover': {
        component: CompactLootModule,
        placement: 'drawer',
        priority: 60,
        isVisible: (p) => p.isHovered
    },
    'compact_input_hover': {
        component: CompactInputModule,
        placement: 'drawer',
        priority: 50,
        isVisible: (p) => p.isHovered
    },
    'buff_glossary_hover': {
        component: BuffGlossaryModule,
        placement: 'drawer',
        priority: 40,
        isVisible: (p) => p.isHovered
    },
    'enemy_stats_hover': {
        component: EnemyStatsModule,
        placement: 'drawer',
        priority: 30,
        isVisible: (p) => p.isHovered
    },
    'sprite': { 
        component: SpriteModule, 
        placement: 'content', 
        priority: 55,
        isVisible: () => true 
    }
};

/**
 * getCardLayout
 * Processes a card state and returns a structured object of modules.
 */
export function getCardLayout(card, template, activeTab = null, isHovered = false) {
    const layout = { header: [], content: [], ribbon: [], footer: [], drawer: [] };
    if (!card) return layout;

    const traits = [...(card.traits || [])];
    const cardType = card?.cardType?.toLowerCase() || template?.cardType?.toLowerCase() || 'task';

    const params = { card, template, cardType, activeTab, isHovered };

    // Inject synthetic traits for drawer hovers!
    if (isHovered) {
        if (cardType === 'combat' || cardType === 'dungeon' || cardType === 'invasion') {
            traits.push({ type: 'enemy_stats_hover' });
        }
        if (traits.some(t => t.type === 'loot') || template?.xpAwarded || card?.xpAwarded) {
            traits.push({ type: 'compact_loot_hover' });
        }
        if (traits.some(t => t.type === 'inputslot' || t.type === 'dynamic_inputslots') || template?.inputs || card?.inputs) {
            traits.push({ type: 'compact_input_hover' });
        }
        if (card?.buffText || template?.buffText || traits.some(t => t.buffText || t.text)) {
            traits.push({ type: 'buff_glossary_hover' });
        }
    }

    traits.forEach((trait, index) => {
        const type = trait.type?.toLowerCase();
        const config = MODULE_REGISTRY[type];
        if (!config) return;

        // --- Tab Exclusion Rule ---
        // Footers/Headers always show. Content only shows if it matches active tab or isn't tabbed.
        if (activeTab && activeTab !== 'info' && config.placement === 'content') {
            if (activeTab !== type) return;
        }

        if (config.isVisible(params)) {
            layout[config.placement].push({
                component: config.component,
                trait,
                priority: config.priority,
                key: `${type}-${index}`
            });
        }
    });

    // Final sorting based on priority
    Object.keys(layout).forEach(slot => {
        layout[slot].sort((a, b) => a.priority - b.priority);
        // Mark first in slot for CSS styling
        if (layout[slot].length > 0) layout[slot][0].isFirst = true;
    });

    return layout;
}

/**
 * getAvailableTabs
 * Returns list of modules that want a footer tab.
 */
export function getAvailableTabs(card) {
    if (!card?.traits) return [];
    return card.traits
        .map(t => {
            const id = t.type?.toLowerCase();
            let icon = t.icon;
            let label = id;
            if (id === 'recipe_selector') {
                icon = '🔨';
                label = 'Recipes';
            } else if (id === 'loot') {
                icon = '📦';
                label = 'Loot';
            }
            return { trait: t, config: MODULE_REGISTRY[id], icon, label };
        })
        .filter(entry => entry.config?.showTab && entry.config.showTab({ card }))
        .map(entry => ({ 
            id: entry.trait.type?.toLowerCase(), 
            icon: entry.icon,
            label: entry.label
        }));
}

export const renderTraitModule = (trait, cardState, index = 0, isFirst = false) => {
    const type = trait?.type?.toLowerCase();
    const config = MODULE_REGISTRY[type];
    if (!config) return <PlaceholderModule type={trait?.type} />;
    
    const Component = config.component;
    return <Component key={trait.id || `${type}-${index}`} trait={trait} card={cardState} isFirst={isFirst} />;
};

export default { renderTraitModule, getCardLayout, MODULE_REGISTRY };
