import React from 'react';

// Import existing modules
import InfoModule from './InfoModule.jsx';
import InputSlotModule from './InputSlotModule/index.jsx';
import LootModule from './LootModule.jsx';
import CardHeaderModule from './CardHeaderModule.jsx';
import ProjectProgressModule from './ProjectProgressModule/index.jsx';
import SkillRequirementsModule from './SkillRequirementsModule.jsx';
import TaskDisplay from './TaskDisplay.jsx';
import TaskStage from './TaskStage.jsx';
import CardAssignmentModule from './CardAssignmentModule.jsx';
import { QuestSelectionModule } from './QuestSelectionModule.jsx';
import { QuestChoiceModule } from './QuestChoiceModule.jsx';
import { QuestProgressModule } from './QuestProgressModule.jsx';
import BlueprintSlotModule from './BlueprintSlotModule.jsx';
import ToolSlotModule from './ToolSlotModule.jsx';
import SpriteModule from './SpriteModule.jsx';
import CombatModule from './CombatModule.jsx';
import ExpirationModule from './ExpirationModule.jsx';
import HordeModule from './HordeModule.jsx';
import ThreatModule from './ThreatModule.jsx';
import DungeonModule from './DungeonModule.jsx';
import RecipeSelectorModule from './RecipeSelectorModule.jsx';
import { InputSlotItem } from './InputSlotModule/index.jsx';

export const PlaceholderModule = ({ type }) => (
    <div className="w-full bg-red-900/30 border border-red-500/50 p-2 rounded text-center text-xs text-red-300 font-mono my-1">
        [Missing Module: {type}]
    </div>
);

/**
 * DynamicInputSlotsModule
 * Renders 4 generic input slots that accept any item.
 */
const DynamicInputSlotsModule = React.memo(({ card, trait, globalIndex }) => {
    const cardId = card?.id || card?.instanceId;
    const assignedItems = card?.assignedItems || {};

    const slots = [0, 1, 2, 3];
    return (
        <div className="flex flex-col gap-2 w-full my-2">
            {slots.map(index => {
                const input = {
                    slotIndex: index,
                    quantity: 1,
                    slotLabel: `Ingredient ${index + 1}`
                };
                return (
                    <InputSlotItem
                        key={`${cardId}-dynamic-input-${index}`}
                        input={input}
                        index={index}
                        cardId={cardId}
                        isIndividual={true}
                        trait={input}
                        assignedItems={assignedItems}
                        globalIndex={globalIndex}
                        card={card}
                    />
                );
            })}
        </div>
    );
});

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
    'heroslot': { 
        component: CardAssignmentModule, 
        placement: 'header', 
        priority: 20,
        isVisible: () => false // Handled externally by GICard wrapper usually
    },
    'blueprintslot': { 
        component: BlueprintSlotModule, 
        placement: 'header', 
        priority: 25,
        isVisible: () => false 
    },
    'inputslot': { 
        component: InputSlotModule, 
        placement: 'header', 
        priority: 30,
        isVisible: () => false 
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
    'projectpanel': { 
        component: ProjectProgressModule, 
        placement: 'content', 
        priority: 45,
        isVisible: (p) => p.cardType === 'project' 
    },
    'combat': { 
        component: CombatModule, 
        placement: 'content', 
        priority: 50,
        isVisible: (p) => p.cardType === 'combat' || p.cardType === 'dungeon' || p.cardType === 'invasion' || (p.activeTab === 'combat' && !!p.card.assignedHeroId),
        showTab: (p) => p.cardType !== 'combat' && p.cardType !== 'invasion' // Only show tab if not already the primary content
    },
    'expiration': { 
        component: ExpirationModule, 
        placement: 'content', 
        priority: 55,
        isVisible: () => true 
    },
    'horde': { 
        component: HordeModule, 
        placement: 'content', 
        priority: 60,
        isVisible: (p) => p.cardType !== 'invasion'
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
    'dynamic_inputslots': {
        component: DynamicInputSlotsModule,
        placement: 'content',
        priority: 43,
        isVisible: () => false
    },
    'description': { 
        component: InfoModule, 
        placement: 'drawer', 
        priority: 100,
        isVisible: (p) => p.isHovered
    },
    'toolslot': { 
        component: ToolSlotModule, 
        placement: 'header', 
        priority: 30,
        isVisible: () => false 
    },
    'sprite': { 
        component: SpriteModule, 
        placement: 'content', 
        priority: 55,
        isVisible: () => true 
    },
    'threat': { 
        component: ThreatModule, 
        placement: 'content', 
        priority: 70,
        isVisible: (p) => p.cardType !== 'invasion'
    },
    'dungeon': { 
        component: DungeonModule, 
        placement: 'content', 
        priority: 50,
        isVisible: () => true 
    },
    'quest_selection': { 
        component: QuestSelectionModule, 
        placement: 'content', 
        priority: 60,
        isVisible: () => true 
    },
    'quest': {
        component: (props) => {
            // Unpack props for clarity
            const { card, template } = props;
            if (template.id === 'quest_scroll') {
                return <QuestChoiceModule cardId={card.id} cardState={card} />;
            }
            return <QuestProgressModule cardId={card.id} cardState={card} template={template} />;
        },
        placement: 'content',
        priority: 1, // Quests take priority in content
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

    const traits = card.traits || [];
    const cardType = card?.cardType?.toLowerCase() || template?.cardType?.toLowerCase() || 'task';

    const params = { card, template, cardType, activeTab, isHovered };

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
