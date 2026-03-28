import React from 'react';

// Import existing modules
import InfoModule from './InfoModule.jsx';
import InputSlotModule from './InputSlotModule.jsx';
import LootModule from './LootModule.jsx';
import CardHeaderModule from './CardHeaderModule.jsx';
import ProjectProgressModule from './ProjectProgressModule.jsx';
import SkillRequirementsModule from './SkillRequirementsModule.jsx';
import TaskDisplay from './TaskDisplay.jsx';
import TaskStage from './TaskStage.jsx';
import CardAssignmentModule from './CardAssignmentModule.jsx';
import { QuestSelectionModule } from './QuestSelectionModule.jsx';
import BlueprintSlotModule from './BlueprintSlotModule.jsx';
import ToolSlotModule from './ToolSlotModule.jsx';
import SpriteModule from './SpriteModule.jsx';
import CombatModule from './CombatModule.jsx';
import ExpirationModule from './ExpirationModule.jsx';
import HordeModule from './HordeModule.jsx';
import ThreatModule from './ThreatModule.jsx';
import DungeonModule from './DungeonModule.jsx';

// Placeholders for modules that don't exist in React yet
const PlaceholderModule = ({ type, data }) => (
    <div className="w-full bg-red-900/30 border border-red-500/50 p-2 rounded text-center text-xs text-red-300 font-mono my-1">
        [Missing Module: {type}]
    </div>
);

// Registry mapping CardAssembler trait strings to React Components
const Registry = {
    'header': CardHeaderModule,
    'description': InfoModule,
    'skillrequirement': SkillRequirementsModule,
    'heroslot': CardAssignmentModule,
    'inputslot': InputSlotModule,
    'blueprintslot': BlueprintSlotModule,
    'toolslot': ToolSlotModule,
    'workcycle': TaskStage, // Use TaskStage (Display + Slot + Bar) for workcycle
    'projectpanel': ProjectProgressModule,
    'loot': LootModule,
    'sprite': SpriteModule,

    // Other traits from AreaSystem / CardAssembler
    'reward': PlaceholderModule,
    'unifiedreward': () => null, // Logic-only, no UI needed here (ribbon handles display)
    'draggable': () => null, // Logic-only component
    'combat': CombatModule, // Using the new CombatModule wrapper
    'quest': PlaceholderModule,
    'quest_selection': QuestSelectionModule,
    'aura': () => null, // Logic-only
    'expiration': ExpirationModule,
    'horde': HordeModule,
    'threat': ThreatModule,
    'dungeon': DungeonModule,
};

/**
 * Dynamically resolves and renders a card module based on its trait configuration.
 * 
 * @param {Object} trait - The module trait configuration from the engine (e.g. { type: 'header' })
 * @param {Object} cardState - The full state of the card from the engine
 * @returns {React.ReactNode} The rendered module or a placeholder if not found.
 */
export const renderTraitModule = (trait, cardState, index = 0, isFirst = false) => {
    if (!trait || !trait.type) return null;

    const Component = Registry[trait.type.toLowerCase()];
    const uniqueKey = trait.id || `${trait.type}-${index}`;

    if (!Component) {
        console.warn(`[ModuleRegistry] Unknown module type requested: ${trait.type}`);
        return <PlaceholderModule key={uniqueKey} type={trait.type} data={trait} />;
    }

    // Pass both the specific trait config and the entire card state down
    return <Component key={uniqueKey} trait={trait} card={cardState} isFirst={isFirst} globalIndex={index} />;
};

export default {
    renderTraitModule
};
