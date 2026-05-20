/**
 * Slot Mapper: Projects UI traits onto the logic-layer 'slots' object.
 */

export function buildSlotsFromTraits(card) {
    if (!card.traits || !Array.isArray(card.traits)) return;

    const slots = {};
    let heroIndex = 0;
    let inputIndex = 0;
    let toolIndex = 0;
    let blueprintIndex = 0;

    for (const trait of card.traits) {
        const type = trait.type?.toLowerCase();

        if (type === 'heroslot') {
            const slotKey = `hero-${heroIndex}`;
            const entityId = card.heroSlots?.[heroIndex]
                || (heroIndex === 0 ? card.assignedHeroId : null)
                || null;
            slots[slotKey] = {
                type: 'hero',
                entityId,
                config: {
                    title: trait.title || 'Hero',
                    requirements: trait.requirements || null,
                },
            };
            heroIndex++;
        }
        else if (type === 'toolslot') {
            const slotKey = `tool-${toolIndex}`;
            slots[slotKey] = {
                type: 'tool',
                entityId: card.assignedToolId || null,
                config: {
                    toolType: trait.toolType || null,
                    minTier: trait.minTier || 0,
                },
            };
            toolIndex++;
        }
        else if (type === 'inputslot') {
            const inputs = trait.inputs || [trait];
            for (let i = 0; i < inputs.length; i++) {
                const inp = inputs[i];
                const idx = trait.inputs ? i : (trait.slotIndex ?? inputIndex);
                const slotKey = `input-${idx}`;
                if (!slots[slotKey]) {
                    slots[slotKey] = {
                        type: 'item',
                        entityId: card.assignedItems?.[idx] || null,
                        config: {
                            itemId: inp.itemId || null,
                            acceptTags: inp.acceptTags || trait.acceptTags || [],
                            quantity: inp.quantity || 1,
                            isTool: inp.isTool || false,
                            slotLabel: inp.slotLabel || trait.slotLabel || null,
                        },
                    };
                }
            }
            if (!trait.inputs) inputIndex++;
        }
        else if (type === 'blueprintslot') {
            const slotKey = `blueprint-${blueprintIndex}`;
            slots[slotKey] = {
                type: 'blueprint',
                entityId: card.assignedBlueprintId || null,
                config: {
                    acceptedBlueprints: trait.acceptedBlueprints || [],
                },
            };
            blueprintIndex++;
        }
    }

    card.slots = slots;
}
