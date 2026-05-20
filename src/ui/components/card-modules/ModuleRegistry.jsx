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
        isVisible: (p) => !!p.card.assignedHeroId || p.cardType === 'project'
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
        isVisible: (p) => p.cardType === 'combat' || p.cardType === 'dungeon' || (p.activeTab === 'combat' && !!p.card.assignedHeroId),
        showTab: (p) => p.cardType !== 'combat' // Only show tab if not already the primary content
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
        isVisible: () => true 
    },
    'loot': { 
        component: LootModule, 
        placement: 'content', 
        priority: 65,
        isVisible: (p) => p.activeTab === 'loot',
        showTab: () => true
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
        isVisible: () => true 
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
    const cardType = template?.cardType?.toLowerCase() || 'task';

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
        .map(t => ({ trait: t, config: MODULE_REGISTRY[t.type?.toLowerCase()] }))
        .filter(entry => entry.config?.showTab && entry.config.showTab({ card }))
        .map(entry => ({ id: entry.trait.type?.toLowerCase(), icon: entry.trait.icon }));
}

export const renderTraitModule = (trait, cardState, index = 0, isFirst = false) => {
    const type = trait?.type?.toLowerCase();
    const config = MODULE_REGISTRY[type];
    if (!config) return <PlaceholderModule type={trait?.type} />;
    
    const Component = config.component;
    return <Component key={trait.id || `${type}-${index}`} trait={trait} card={cardState} isFirst={isFirst} />;
};

export default { renderTraitModule, getCardLayout, MODULE_REGISTRY };
