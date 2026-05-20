import React from 'react';
import { MODULE_REGISTRY, PlaceholderModule } from './ModuleRegistry.jsx';

/**
 * ModuleRenderer
 * A memoized wrapper for individual card modules.
 * Prevents unnecessary re-renders when other parts of the card state change.
 */
export const ModuleRenderer = React.memo(({ trait, card, template, isFirst = false }) => {
    const type = trait?.type?.toLowerCase();
    const config = MODULE_REGISTRY[type];
    
    if (!config) return <PlaceholderModule type={trait?.type} />;
    
    const Component = config.component;
    
    return (
        <Component 
            trait={trait} 
            card={card} 
            template={template}
            isFirst={isFirst} 
        />
    );
}, (prevProps, nextProps) => {
    // 1. Check if trait or template changed
    if (prevProps.trait !== nextProps.trait) return false;
    if (prevProps.template !== nextProps.template) return false;
    if (prevProps.isFirst !== nextProps.isFirst) return false;

    // 2. Check critical card identity and sync properties
    // We only re-render if the properties relevant to UI display change.
    const pc = prevProps.card;
    const nc = nextProps.card;
    
    if (pc.status !== nc.status) return false;
    if (pc.assignedHeroId !== nc.assignedHeroId) return false;
    if (pc.progress !== nc.progress) return false;
    if (pc.currentTickTime !== nc.currentTickTime) return false;
    if (pc._rev !== nc._rev) return false;

    // 3. Namespace deep-check (Selective)
    // If the module depends on namespaced data, we check for identity changes there.
    if (pc.combat !== nc.combat) return false;
    if (pc.project !== nc.project) return false;
    if (pc.loot !== nc.loot) return false;

    return true;
});

export default ModuleRenderer;
