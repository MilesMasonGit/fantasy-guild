
function xpForLevel(level) {
    if (level <= 1) return 0;
    if (level > 99) level = 99;

    let total = 0;
    for (let i = 1; i < level; i++) {
        total += Math.floor(i + 300 * Math.pow(2, i / 7));
    }
    return Math.floor(total / 4);
}

function getXpProgress(xp) {
    let level = 1;
    for (let l = 1; l <= 99; l++) {
        if (xpForLevel(l + 1) > xp) {
            level = l;
            break;
        }
    }
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const xpIntoLevel = xp - currentLevelXp;
    const xpForThisLevel = nextLevelXp - currentLevelXp;
    return { level, progress: xpIntoLevel / xpForThisLevel, currentLevelXp, nextLevelXp };
}

console.log("XP Table Check:");
for (let i = 1; i <= 15; i++) {
    console.log(`Level ${i}: ${xpForLevel(i)} XP`);
}

// Check Level 11 scenario
const level11XP = xpForLevel(11);
console.log(`\nLevel 11 XP: ${level11XP}`);

const xpAfter1000 = level11XP + 1000;
console.log(`XP after +1000: ${xpAfter1000}`);

const progress = getXpProgress(xpAfter1000);
console.log(`Resulting Level: ${progress.level}`);
console.log(`Progress: ${(progress.progress * 100).toFixed(2)}%`);

// Check Ranged Level 1 scenario
const level1XP = 0;
const xpAfter10 = level1XP + 10;
const progress1 = getXpProgress(xpAfter10);
console.log(`\nLevel 1 + 10 XP: Level ${progress1.level}, Progress: ${(progress1.progress * 100).toFixed(2)}%`);
