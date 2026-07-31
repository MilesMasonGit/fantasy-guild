import React, { useMemo } from 'react';
import { useEngine } from '../../hooks/useEngine.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getCard } from '../../../config/registries/cardRegistry.js';
import { buildProductionData } from '../../modals/library/binderCatalog.js';
import { LibraryCardPreviewGutter } from '../../modals/library/LibraryCardPreviewGutter.jsx';
import { DeploymentPanel } from '../../modals/library/DeploymentPanel.jsx';

/**
 * Card details (high-res preview + production info) + Deployment Map —
 * rendered by the shared InspectionPanel.
 *
 * Extracted from the retired global Cards drawer pane (D-41/D-42, C-2b): the
 * pane is gone, but inspecting a card is still wanted from anywhere a card
 * tile is clicked, so this lives on its own.
 */
export const CardInspection = ({ templateId, onInspect }) => {
    const engine = useEngine();
    const unlockedAreaIds = useGameState(
        state => state.collection?.unlockedAreaSets || [],
        ['collection_updated']
    );
    const selectedTemplate = useMemo(() => templateId ? getCard(templateId) : null, [templateId]);
    const productionData = useMemo(() => buildProductionData(selectedTemplate), [selectedTemplate]);

    return (
        <div className="h-full flex flex-col gap-2 p-2 min-h-0">
            <div className="flex-1 min-h-0 bg-gi-base rounded-xl border border-gi-border/20 overflow-hidden relative">
                <LibraryCardPreviewGutter
                    selectedTemplateId={templateId}
                    selectedItemId={null}
                    selectedEnemyId={null}
                    productionData={productionData}
                    inputs={productionData.inputs}
                    outputs={productionData.outputs}
                    handleNavigationInspect={(id, type) => { if (type === 'card') onInspect('card', id); }}
                    handleNavigationSearch={() => {}}
                />
            </div>
            <DeploymentPanel
                templateId={templateId}
                unlockedAreaIds={unlockedAreaIds}
                engine={engine}
            />
        </div>
    );
};

export default CardInspection;
