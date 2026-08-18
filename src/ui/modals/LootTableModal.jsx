import { GIModal } from '../components/base/GIModal.jsx';
import LootModule from '../components/card-modules/LootModule.jsx';

/**
 * LootTableModal
 * A central modal overlay displaying the full, detailed loot table for a card.
 * Opened by clicking "+ X more" on the CompactLootModule in hover drawers.
 */
export const LootTableModal = ({ data, isOpen, onClose }) => {
    if (!data) return null;

    // data contains whatever LootModule needs (items, trait, card, template, etc.)
    return (
        <GIModal isOpen={isOpen} onClose={onClose} title={data.title || 'Loot Table'}>
            <div className="p-4 bg-gi-background min-w-[300px] max-w-[400px] max-h-[80vh] overflow-y-auto custom-scrollbar">
                <LootModule 
                    trait={data.trait} 
                    card={data.card} 
                    template={data.template} 
                    items={data.items} 
                    mode={data.mode} 
                    title="" 
                />
            </div>
            <div className="p-3 border-t border-white/5 bg-gi-surface flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-bold text-pixel-sm"
                >
                    Close
                </button>
            </div>
        </GIModal>
    );
};

export default LootTableModal;
