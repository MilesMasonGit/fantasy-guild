import React from 'react';
import { useEngine } from '@/ui/hooks/useEngine.js';
import { getItem, getCard } from '@/config/registries/index.js';
import { ProjectLayout } from './ProjectLayout.jsx';

/**
 * Helper: Map simple requirement object to progress object structure
 */
function mapRequirementsToZero(requirements) {
    if (!requirements) return {};
    const result = {};
    for (const [key, req] of Object.entries(requirements)) {
        result[key] = { current: 0, required: req };
    }
    return result;
}

/**
 * ProjectProgressModule
 * Renders resource contribution status for Project/Exploration cards.
 */
const ProjectProgressModule = React.memo(({ trait, card, isFirst, globalIndex, ...props }) => {
    const engine = useEngine();

    const progressData = props.progressData || trait?.progressData || card?.progressData || trait;
    const showTitle = props.showTitle !== undefined ? props.showTitle : true;
    const className = props.className;

    const getInventoryCount = props.getInventoryCount || ((itemKey) => {
        const itemId = itemKey.startsWith('tag:') ? null : itemKey;
        if (itemId) return engine.InventoryManager.getItemCount(itemId);
        return 0;
    });

    const getItemDef = props.getItemDef || ((itemId) => getItem(itemId));

    // --- Tiered Project Logic ---
    const template = getCard(card.templateId);
    
    // Fallback for non-tiered projects
    if (!template?.tiers) {
        if (!progressData) return null;
        
        const { inputProgress, requirements, percentComplete = 0 } = progressData;
        const entrySource = (Object.keys(inputProgress || {}).length > 0)
            ? inputProgress
            : mapRequirementsToZero(requirements);
            
        const keys = Object.keys(entrySource);
        if (keys.length === 0) return null;

        return (
            <ProjectLayout 
                showTitle={showTitle} 
                percentComplete={percentComplete} 
                className={className} 
                keys={keys}
                entrySource={entrySource}
                getInventoryCount={getInventoryCount}
                getItemDef={getItemDef}
                currentLevel={0}
                totalTiers={1}
            />
        );
    }

    // --- Hybrid State Logic ---
    const project = card.project || {};
    const inputProgress = project.progress || {};
    const isReadyForUpgrade = !!project.isReady;
    const currentLevel = (project.level !== undefined) ? project.level : 0;
    const currentTier = template.tiers[currentLevel];
    
    if (!currentTier) return null;

    const requirements = currentTier.requirements || {};
    const entrySource = {};
    let totalGot = 0;
    let totalReq = 0;

    for (const [itemId, reqQty] of Object.entries(requirements)) {
        const gotQty = inputProgress[itemId] || 0;
        entrySource[itemId] = { current: gotQty, required: reqQty };
        totalGot += Math.min(gotQty, reqQty);
        totalReq += reqQty;
    }

    const percentComplete = totalReq > 0 ? Math.floor((totalGot / totalReq) * 100) : 0;
    const keys = Object.keys(entrySource);

    const handleUpgrade = () => {
        if (engine.ProjectManager?.levelUpProject) {
            engine.ProjectManager.levelUpProject(card.templateId);
        }
    };

    return (
        <ProjectLayout 
            showTitle={showTitle} 
            percentComplete={percentComplete} 
            className={className} 
            keys={keys}
            entrySource={entrySource}
            getInventoryCount={getInventoryCount}
            getItemDef={getItemDef}
            label={currentTier.label || `Level ${currentLevel}`}
            isReadyForUpgrade={isReadyForUpgrade}
            onUpgrade={handleUpgrade}
            nextLevel={currentLevel + 1}
            currentLevel={currentLevel}
            totalTiers={Object.keys(template.tiers || {}).length}
        />
    );
});

export default ProjectProgressModule;
