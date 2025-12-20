
import { generateHero } from './src/systems/hero/HeroGenerator.js';
import { xpForLevel } from './src/utils/XPCurve.js';

console.log('--- Verifying Hero Generation Fix ---');

// Mock registries if needed (though imports should handle it if running in context)
// For this script, we'll rely on the actual imports working in the dev environment

try {
    const hero = generateHero();
    console.log(`Generated Hero: ${hero.name} (${hero.className})`);

    let passed = true;

    for (const [skillId, skill] of Object.entries(hero.skills)) {
        const expectedXp = xpForLevel(skill.level);

        if (skill.xp !== expectedXp) {
            console.error(`[FAIL] Skill ${skillId}: Level ${skill.level}, XP ${skill.xp} (Expected ${expectedXp})`);
            passed = false;
        } else {
            // console.log(`[PASS] Skill ${skillId}: Level ${skill.level}, XP ${skill.xp}`);
        }
    }

    if (passed) {
        console.log('✅ ALL SKILLS HAVE CORRECT XP INITIALIZATION');
    } else {
        console.error('❌ SOME SKILLS HAVE INCORRECT XP');
    }

} catch (error) {
    console.error('Error running verification:', error);
}
