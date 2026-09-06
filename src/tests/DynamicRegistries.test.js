import { describe, it, expect } from 'vitest';
import { getItem } from '../config/registries/itemRegistry.js';
import { enemyCombatBudget } from '../config/FormulaRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';

describe('Dynamic Registry Loading', () => {
    it('should successfully load item_water from data/items.json', () => {
        const item = getItem('item_water');
        expect(item).not.toBeNull();
        expect(item.name).toBe('Water');
        // No blanket per-item cap any more (C-15): ordinary items carry no
        // maxStack and inherit DEFAULT_MAX_STACK. A 99-item ceiling made the
        // authored economy impossible — a task of any real yield just failed
        // on capacity. Genuinely non-stackable gear still declares its own.
        expect(item.maxStack).toBeUndefined();
        // The companion assertion — that genuinely non-stackable gear declares
        // its own maxStack — used `item_copper_sword`, which the re-authored
        // content set no longer contains. Restore it against a real piece of
        // gear once equipment is authored in the CMS again (cleanup 2026-08-18).
    });

    // ⚠️ Was `should successfully load enemy_copper_miner from
    // data/enemies.json`. That file and `enemyRegistry.js` are gone
    // (2026-09-06) — an enemy is a Token, so it loads out of
    // `data/tokens.json` with everything else. The assertion that matters is
    // unchanged in spirit: authored content reaches the game, and its combat
    // stats are DERIVED from the band level rather than typed.
    it('should successfully load an enemy Token from data/tokens.json', () => {
        const def = getTokenType('token_thorn_elemental');
        expect(def).toBeTruthy();
        expect(def.name).toBe('Thorn Elemental');

        const enemy = enemyProfileOf(def);
        expect(enemy).not.toBeNull();
        expect(enemy.level).toBe(2);
        // 32·G(2), not a number anyone typed into the content file.
        expect(enemy.hp).toBe(enemyCombatBudget(2).hp);
        // Attack and defence are both the level — the hero side is one number
        // now, and so is this.
        expect(enemy.attackSkill).toBe(2);
        expect(enemy.defenceSkill).toBe(2);
    });

    // The quest-loading case is gone with the authored quest pipeline
    // (CR2-017, owner decision 2026-08-18): `data/quests.json` and
    // `questRegistry.js` are deleted, and quests are hardcoded in
    // `systems/quests/tutorialQuests.js`, covered by QuestSystem.test.js.
    //
    // The area-loading case is gone too: `data/cards/` was retired by the
    // playmat rework (Phase 1 §H), its archived copy was deleted 2026-08-24,
    // and areas are deleted content. Items still load from their own file;
    // enemies now load from `data/tokens.json` like every other Token.
});
