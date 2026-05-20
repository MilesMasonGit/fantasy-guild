import React from 'react';
import { InputSlotItem } from './InputSlotItem.jsx';

/**
 * InputSlotModule
 * Transforms resource requirements into interactive Drag & Drop zones.
 * 
 * Supports both:
 * 1. "Batch" traits (type: 'inputslot', inputs: [...])
 * 2. "Individual" traits (type: 'inputslot', itemId: '...', quantity: 1, etc.)
 */
const InputSlotModule = React.memo(({ trait, card, isFirst, globalIndex = 0 }) => {
    const cardId = card?.id || card?.instanceId;

    // Normalization logic: handles both array of inputs or single standalone traits
    const hasAcceptTags = trait?.acceptTags && trait.acceptTags.length > 0;
    const inputs = trait?.inputs || (trait?.itemId || trait?.acceptTag || hasAcceptTags ? [trait] : []);
    const isIndividual = !trait?.inputs && (trait?.itemId || trait?.acceptTag || hasAcceptTags);
    const assignedItems = card?.assignedItems || {};

    if (!inputs || inputs.length === 0) return null;

    return (
        <React.Fragment>
            {inputs.map((input, index) => (
                <InputSlotItem
                    key={`${cardId}-input-${index}`}
                    input={input}
                    index={index}
                    cardId={cardId}
                    isIndividual={isIndividual}
                    trait={trait}
                    assignedItems={assignedItems}
                    globalIndex={globalIndex}
                    card={card}
                />
            ))}
        </React.Fragment>
    );
}, (prev, next) => {
    // Only re-render if the card revision changes or the trait definition itself (rare)
    return prev.card?._rev === next.card?._rev && prev.trait === next.trait;
});

export default InputSlotModule;
export { ItemIdentityStrip } from './ItemIdentityStrip.jsx';
export { InputSlotItem } from './InputSlotItem.jsx';
