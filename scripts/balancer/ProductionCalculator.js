/**
 * ProductionCalculator - Deterministic analytic model for item valuation
 */
export class ProductionCalculator {
    constructor(items, cards, config = {}) {
        this.items = items;
        this.cards = cards;
        
        // Configuration Constants
        this.config = {
            gptBaseline: config.gptBaseline || 0.1, // Gold Per Tick (1 Gold per 10s tick)
            tickInterval: config.tickInterval || 10, // Seconds per tick
            durabilityCostFactor: config.durabilityCostFactor || 1.0, // Multiplier for tool wear
            ...config
        };

        this.cache = new Map(); // Cache for calculated item values
    }

    /**
     * Calculate the Fair Gold Value of an item
     * @param {string} itemId 
     * @returns {number}
     */
    calculateFairValue(itemId) {
        if (!itemId) return 0;
        if (this.cache.has(itemId)) return this.cache.get(itemId);

        const item = this.items[itemId];
        if (!item) {
            console.warn(`Item not found: ${itemId}`);
            return 0;
        }

        // Find cards that produce this item
        const producingCards = Object.values(this.cards).filter(card => {
            const outputs = this.getCardOutputs(card);
            return outputs.some(o => o.id === itemId);
        });

        if (producingCards.length === 0) {
            // If it's a raw material with no production card, use its hardcoded value or a default
            const val = item.baseValue || 1;
            this.cache.set(itemId, val);
            return val;
        }

        // Calculate cost for each production method and pick the "cheapest" (most efficient)
        const costs = producingCards.map(card => this.calculateCardProductionCost(card, itemId));
        const validCosts = costs.filter(c => c > 0);
        
        if (validCosts.length === 0) {
            const fallback = item.baseValue || 1;
            this.cache.set(itemId, fallback);
            return fallback;
        }

        const fairValue = Math.min(...validCosts);

        this.cache.set(itemId, fairValue);
        return fairValue;
    }

    /**
     * Calculate the cost to produce one unit of an item via a specific card
     */
    calculateCardProductionCost(card, targetItemId) {
        const tickTime = card.baseTickTime || 10000;
        const ticksRequired = tickTime / 1000 / this.config.tickInterval;
        
        // 1. Time Cost (Opportunity Cost)
        let totalCost = ticksRequired * this.config.gptBaseline;

        // 2. Input Costs
        if (card.inputs) {
            for (const input of card.inputs) {
                const inputValue = this.calculateFairValue(input.id);
                totalCost += inputValue * (input.quantity || 1);
            }
        }

        // 3. Tool Wear (Simplified)
        if (card.toolRequired) {
            // Assume a standard tool for the tier if not specified
            // For now, let's add a 5% overhead for tools
            totalCost *= 1.05; 
        }

        // 4. Divide by Output Quantity
        const outputs = this.getCardOutputs(card);
        const output = outputs.find(o => o.id === targetItemId);
        const quantity = output ? (output.quantity || 1) : 1;
        const chance = output ? (output.chance || 1) : 1;
        
        const averageYield = quantity * (chance / 100); // Assume chance is 0-100 if > 1

        return totalCost / (averageYield || 1);
    }

    /**
     * Helper to get unified outputs from a card
     */
    getCardOutputs(card) {
        const outputs = [];
        
        // 1. Direct outputs/drops
        const directLoot = card.outputs || card.drops || [];
        directLoot.forEach(o => {
            if (o.itemId || o.id) {
                outputs.push({
                    id: o.itemId || o.id,
                    quantity: o.quantity || 1,
                    chance: o.chance || 100
                });
            }
        });

        // 2. Traits (Loot)
        if (card.traits) {
            const lootTrait = card.traits.find(t => t.type === 'loot');
            if (lootTrait && lootTrait.items) {
                lootTrait.items.forEach(o => {
                    if (o.itemId || o.id) {
                        outputs.push({
                            id: o.itemId || o.id,
                            quantity: o.quantity || 1,
                            chance: o.chance || 100
                        });
                    }
                });
            }
        }

        return outputs;
    }

    /**
     * Helper to get unified inputs from a card
     */
    getCardInputs(card) {
        const inputs = [];
        
        // 1. Direct inputs
        const directInputs = card.inputs || [];
        directInputs.forEach(i => {
            if (i.itemId || i.id) {
                inputs.push({
                    id: i.itemId || i.id,
                    quantity: i.quantity || 1
                });
            }
        });

        // 2. Traits (Inputs)
        if (card.traits) {
            const inputTraits = card.traits.filter(t => t.type === 'input');
            inputTraits.forEach(t => {
                if (t.itemId || t.id) {
                    inputs.push({
                        id: t.itemId || t.id,
                        quantity: t.quantity || 1
                    });
                }
            });
        }

        return inputs;
    }

    /**
     * Get the "Gold Per Minute" potential for a card
     */
    getCardProfitability(card) {
        const outputs = this.getCardOutputs(card);
        if (outputs.length === 0) return 0;
        
        let totalOutputValue = 0;
        for (const output of outputs) {
            const chanceFactor = output.chance / 100;
            totalOutputValue += this.calculateFairValue(output.id) * (output.quantity || 1) * chanceFactor;
        }

        let totalInputCost = 0;
        const inputs = this.getCardInputs(card);
        for (const input of inputs) {
            totalInputCost += this.calculateFairValue(input.id) * (input.quantity || 1);
        }

        const netProfit = totalOutputValue - totalInputCost;
        const tickTimeSeconds = (card.baseTickTime || (card.config && card.config.baseTickTime) || 10000) / 1000;
        const profitPerSecond = netProfit / tickTimeSeconds;
        
        return profitPerSecond * 60; // Gold Per Minute
    }
}
