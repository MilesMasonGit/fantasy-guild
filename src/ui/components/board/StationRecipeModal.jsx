import { GIModal } from '../base/GIModal.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { RecipeList } from './RecipeList.jsx';

/**
 * ⚠️ The mat gear's recipe window, kept only until Board.jsx opens the Token card on its recipe
 * list instead (`requestRecipeList`). It draws the same list; with no instance in hand it cannot
 * judge what is beside the station, so requirement bars are never red here.
 */
export const StationRecipeModal = ({ isOpen, onClose, tokenName, banding, selectedRecipeId, onSelect }) => (
    <GIModal isOpen={isOpen} onClose={onClose} title={tokenName || 'Station'} maxWidth="max-w-3xl">
        <div className="flex flex-col" data-recipe-modal>
            <ArrowScrollList compact className="max-h-[60vh]">
                {banding?.def && (
                    <RecipeList
                        def={banding.def}
                        selectedRecipeId={selectedRecipeId}
                        workerId={banding.workerId}
                        heroes={banding.heroes}
                        onChoose={(id) => onSelect?.(id)}
                    />
                )}
            </ArrowScrollList>
        </div>
    </GIModal>
);

export default StationRecipeModal;
