
import { getHeroAttackSpeed } from './src/utils/CombatFormulas.js';

console.log('--- Testing Combat Speed Formula ---');

const testCases = [
    { level: 1, expected: 2985 },
    { level: 10, expected: 2857 },
    { level: 20, expected: 2727 },
    { level: 50, expected: 2400 },
    { level: 100, expected: 2000 }
];

testCases.forEach(({ level, expected }) => {
    const result = Math.floor(getHeroAttackSpeed(level, 0));
    const pass = Math.abs(result - expected) < 2; // Allow small rounding diff
    console.log(`Level ${level}: ${result}ms (Expected ~${expected}ms) - ${pass ? 'PASS' : 'FAIL'}`);
});
