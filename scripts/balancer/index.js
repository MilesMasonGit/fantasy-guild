import { getAllItems } from '../../src/config/registries/itemRegistry.js';
import { getAllCards } from '../../src/config/registries/cardRegistry.js';
import { ProductionCalculator } from './ProductionCalculator.js';

async function run() {
    console.log('=== Fantasy Guild Balancer ===');
    
    try {
        const items = getAllItems();
        const cards = getAllCards();
        
        const calculator = new ProductionCalculator(items, cards, {
            gptBaseline: 0.1, // 1 gold per 10s tick
            tickInterval: 10
        });

        console.log(`\nRegistries Loaded:`);
        console.log(`- Items: ${Object.keys(items).length}`);
        console.log(`- Cards: ${Object.keys(cards).length}`);

        console.log('\n--- Fair Value Audit ---');
        
        const report = [];
        const itemIds = Object.keys(items).sort();

        for (const id of itemIds) {
            const item = items[id];
            const calculatedValue = calculator.calculateFairValue(id);
            const currentValue = item.baseValue || 0;
            const diff = calculatedValue - currentValue;
            
            report.push({
                id,
                name: item.name,
                current: currentValue.toFixed(2),
                calculated: calculatedValue.toFixed(2),
                diff: diff.toFixed(2),
                percent: currentValue > 0 ? ((diff / currentValue) * 100).toFixed(1) + '%' : 'N/A'
            });
        }

        // Display top 20 items for preview
        console.table(report.slice(0, 20));

        console.log('\n--- Card Profitability (GPM) ---');
        const cardIds = Object.keys(cards).filter(id => cards[id].cardType === 'task' || cards[id].cardType === 'crafting');
        const cardProfits = cardIds.map(id => {
            const gpm = calculator.getCardProfitability(cards[id]);
            return {
                id,
                name: cards[id].name,
                gpm: gpm.toFixed(2)
            };
        }).sort((a, b) => b.gpm - a.gpm);

        console.table(cardProfits);

        // Analyze specific bottlenecks (e.g., items with 0 calculated value that aren't base resources)
        const zeros = report.filter(r => parseFloat(r.calculated) === 0);
        if (zeros.length > 0) {
            console.log(`\nFound ${zeros.length} items with 0 calculated value (check production cards).`);
        }

    } catch (error) {
        console.error('Balancer Error:', error);
    }
}

run();
