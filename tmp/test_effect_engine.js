import { ModifierAggregator } from '../src/systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../src/systems/effects/constants.js';

function testModifierAggregator() {
    console.log('--- Testing ModifierAggregator ---');
    const agg = new ModifierAggregator('test-hero');

    // 1. Base Multiplier
    console.assert(agg.getMultiplier(EFFECT_TYPES.SPEED) === 1.0, 'Base multiplier should be 1.0');

    // 2. Additive Stacking (10% + 20% = 30% -> 1.3x)
    agg.addModifier({
        source: 'source-1',
        type: EFFECT_TYPES.SPEED,
        target: { category: TARGET_CATEGORIES.ALL },
        value: 0.1
    });
    agg.addModifier({
        source: 'source-2',
        type: EFFECT_TYPES.SPEED,
        target: { category: TARGET_CATEGORIES.ALL },
        value: 0.2
    });
    
    const mult = agg.getMultiplier(EFFECT_TYPES.SPEED);
    console.log(`Additive Result: ${mult} (expected 1.3)`);
    console.assert(Math.abs(mult - 1.3) < 0.001, 'Additive stacking failed');

    // 3. Hierarchical Targeting (INDUSTRY vs MINING)
    agg.addModifier({
        source: 'source-3',
        type: EFFECT_TYPES.SPEED,
        target: { category: TARGET_CATEGORIES.MINING },
        value: 0.5
    });

    const industryMult = agg.getMultiplier(EFFECT_TYPES.SPEED, TARGET_CATEGORIES.INDUSTRY);
    const miningMult = agg.getMultiplier(EFFECT_TYPES.SPEED, TARGET_CATEGORIES.MINING);
    
    console.log(`Industry Multiplier: ${industryMult} (expected 1.3)`);
    console.log(`Mining Multiplier: ${miningMult} (expected 1.8)`);
    
    console.assert(Math.abs(industryMult - 1.3) < 0.001, 'Hierarchical targeting failed for parent');
    console.assert(Math.abs(miningMult - 1.8) < 0.001, 'Hierarchical targeting failed for child');

    console.log('--- ModifierAggregator Tests Passed! ---');
}

testModifierAggregator();
