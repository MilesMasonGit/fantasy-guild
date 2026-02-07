
import { GameState } from '../state/GameState.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as CardManager from '../systems/cards/CardManager.js';
import { CombatSystem } from '../systems/combat/CombatSystem.js';
import { logger } from '../utils/Logger.js';

// Mock logger to avoid spam
logger.level = 'error';

console.log('--- Starting Hero Reset Reproduction ---');

// 1. Create Hero
const hero = HeroManager.createHero();
console.log(`Created Hero: ${hero.name}, HP: ${hero.hp.current}/${hero.hp.max}`);

// 2. Damage Hero
HeroManager.modifyHeroHp(hero.id, -20);
console.log(`Damaged Hero. HP is now: ${hero.hp.current}/${hero.hp.max}`);

if (hero.hp.current >= hero.hp.max) {
    console.error('FAIL: Hero HP did not decrease!');
    process.exit(1);
}

// 3. Create Combat Card
// Using 'combat_rat_cellar' if available, or just a dummy one if needed.
// 'combat_rat_cellar' is a standard early game card.
const { card } = CardManager.createCard('combat_rat_cellar');
if (!card) {
    console.error('FAIL: Could not create combat card "combat_rat_cellar"');
    process.exit(1);
}
console.log(`Created Card: ${card.name} (${card.id})`);

// 4. Assign Hero
const assignResult = CardManager.assignHero(card.id, hero.id);
if (!assignResult.success) {
    console.error('FAIL: Could not assign hero:', assignResult.error);
    process.exit(1);
}
console.log('Hero assigned to card.');

// 5. Unassign Hero
console.log('Unassigning hero...');
CardManager.unassignHero(card.id);

// 6. Check Result
const finalHero = HeroManager.getHero(hero.id);
console.log(`Final Hero HP: ${finalHero.hp.current}/${finalHero.hp.max}`);

if (finalHero.hp.current === finalHero.hp.max) {
    console.log('BUG REPRODUCED: Hero HP reset to full!');
} else {
    console.log('BUG NOT REPRODUCED: Hero HP persisted correctly.');
}
