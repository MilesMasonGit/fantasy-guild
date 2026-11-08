# Brief 530 — Combat XP stars: kills get their style's XP bonuses

*Written 2026-11-07 by the planning agent from the owner's ruling of the same day (code review round 4,
CR4-037; no concept interview, the owner's instruction).*

**The owner's ruling.** **Every XP bonus is skill-specific, and that includes the four combat skills**: a
bonus aimed at Melee, Ranged, Magic or Stealth applies to the XP a kill awards in that style; a bonus aimed
at a work skill applies to that skill's cycles. The hero-side multiplier that reads nothing is replaced by
that rule, not deleted. **Content to follow: four Guild Hall stars, one per combat style
(`src/config/registries/skillRegistry.js:104-122`), each raising that style's kill XP.**

**What the player gets.** A Guild Hall star (or any gear, potion or perk) that adds Melee XP now speeds up
Melee levels from kills, as a Forestry XP star speeds up Forestry from chopping. Four new stars to buy, one
per combat style.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, the finding CR4-037 in
`docs/active/review/R3_heroes_combat_equipment_progression.md` (with `path:line` evidence), and for X2
`docs/reference/CONTENT_PHILOSOPHY.md` and `docs/reference/BALANCE_RULES.md`.

Code to start from (verify): `src/systems/combat/CombatResolutionProcessor.js:15-26` (`handleVictory`: the
kill's flat award goes to `SkillSystem.addXP` in the weapon's style); `src/systems/hero/SkillSystem.js:58-68`
(`getXpMultiplier`, which reads a hero aggregator nothing writes `XP_BONUS` to) and `:114-116` (`addXP`'s
`scaled` line and its "ONLY here" comment); `src/systems/hero/HeroEffects.js:217-259`
(`combatContributions`, which keeps only `heroOnly` palette entries; `XP_BONUS` is not one);
`src/systems/board/BoardRunner.js:350-361` (the work path: `TileModifiers.resolveAxis(id, XP_BONUS, baseXp,
skill)` over the Token's, the guild's and the hero's scopes, then `applyXpBonus`);
`src/systems/board/TileModifiers.js:817` (`resolveAxis`); `src/config/registries/modifierPalette.js:289-300`
(`XP_BONUS`'s palette entry and hint); `src/systems/hero/xpBonus.js` (`applyXpBonus`, the +1 floor).

## Phases

| Phase | What | Tier |
|---|---|---|
| X1 | **The engine half.** In `handleVictory`, resolve each fighter's award the way work does: `applyXpBonus(award, TileModifiers.resolveAxis(fight.instanceId, XP_BONUS, award, style))`, `style` being the hero's combat style. Check that `resolveAxis` on the enemy Token finds the fighting hero's own loadout (gear, perks, potions); if it finds the hero only through a work claim a fight does not make, pass the hero in explicitly, and **stop and report** if neither is clean. Delete `getXpMultiplier` and the `scaled` line in `addXP` (it then grants what the caller resolved), and rewrite its comment: bonuses are resolved where the XP is earned, by skill. Update the palette hint to "XP awarded per cycle to the working hero, or per kill in a combat style" and check the CMS offers the four combat skills as categories for `XP_BONUS` (`categories: 'skill'`). Check whether the progression ledger models kill XP (`src/systems/progression/ledger/rates.js`, `pace.js`): if it does, apply the same per-style bonus there so the ledger prices the new stars; if it does not, say so in the report (the content agent then prices X2 by the ledger's star proposals for work stars, by hand). Tests: a Melee XP bonus raises a melee kill's XP; a Ranged bonus does not touch a melee kill; an all-skills bonus (the shipped effect Merry, `effect_merry`, has no category) applies to kills as it does to every work skill; no bonus leaves the award unchanged; work XP unchanged. Do not change the +1 floor (that is T-338's item 4). **Bench: WORK CHANGED is possible and allowed** on fighting scenarios where a fighting hero holds a matching or all-skills XP bonus: `heroXp` rises there and nothing else may move (kills, drops, `tokensHash`, `randomDraws`). If the bench reports same work, say why (no scenario's fighter holds such a bonus). Explain any change scenario by scenario. | builder |
| X2 | **The content half: four stars.** The content agent (`/content`, branch `planning-content`, by `CONTENT_PHILOSOPHY.md`) writes a CMS change pack with four Guild Hall stars, one per combat style, each giving `XP_BONUS` (percentage) with the style as its category, the way the work XP stars do (`star_forestry_xp` in `data/hallStars.json`: +15 % a rank, `reach: board`). It proposes names, the constellation (a new combat constellation of four, or a home in an existing one), node positions, ranks, prices and amounts **the simplest reasonable way** and shows them to the owner as a short list with one line saying it took the simplest recommendation (owner rule: no item-by-item questions). Packs are staged in the scratchpad and copied to `cms/incoming` once their checks pass. | content agent |
| X3 | **Sync and check.** After X1 is merged: the owner reviews the pack in the CMS and Syncs on `main`; the director id-diffs the data files after the Sync, then in the running game buys the Melee star (QA panel for materials), records a melee kill's XP before and after, and checks a Ranged kill is unchanged. | director |

## Done when

- X1: gate green; the bench WORK CHANGED (if any) explained as above; the CMS shows the four combat skills
  as `XP_BONUS` categories; the ledger question answered in the report.
- X2: the pack reviewed and synced by the owner; the content checks pass (ledger, audits).
- X3: verified in the running game as above; T-371 and T-372 closed.
- The GDD's Guild Hall and progression sections say XP bonuses apply per skill, kills included.

**Eye-check: no** (no new screen; the stars use the existing sky). The owner sees the stars in the pack
review and on the sky after the Sync.

## Owner to-do

Review the four stars' short list and the pack in the CMS, then Sync on `main`.
