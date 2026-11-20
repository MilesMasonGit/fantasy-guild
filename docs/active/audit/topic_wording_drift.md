# Topic: wording drift
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-20 in two rounds. From S0 part 5, "Wording
drift": the same thing said in different words.*

## The rule (owner, 2026-11-20)

| Thing | Reads | Rule |
|---|---|---|
| A level requirement | `Needs [icon] Melee 15`; with one hero involved `Needs [icon] Melee 15 (Ana: 12)` | One form everywhere (gear and item tooltips, why a hero won't work, recipes, combat), **always with the skill's icon**. Where one hero is involved, their level follows so the gap shows. A hero's own level keeps `25/99`. `Lv` retires. |
| Capitals | `Knocked out!`, `New place settled!`, `New recipe!` | **Sentence case everywhere**, banner and window titles included, as the text guide already says; the All caps setting still does capitals. |
| Coming back | `Exhausted · respawns in 4m`; `Respawns as Oak Tree in 8m` | **One verb, Respawns.** The result is named only when it differs from what stands there. Refills, regrows, grows back and rests-then-refills retire. |
| An event leaving | `Fish Shoal expired` | **Expired** for every way an event goes by itself (time ran out, nobody worked it, worked until empty). **Demolished** stays for the player's own act. The same word on the leaving marker, the card and the away summary. |
| Events in the away summary | `[icon] Fish Shoal ×3 · 2 expired · 1 still here` | **One line per event kind**: icon, name, how many came, and how many expired, were demolished or are still here. |

This updates two silent-moments tickets: the leaving marker reads
"Fish Shoal expired" (T-497), and an exhausted Token's card reads
"Exhausted · respawns in 4m" (T-498).

## A content change for other sessions

**Cut Saplings** (owner, 2026-11-20): "Trees turn into stumps and then
regrow as full trees. Saplings don't do anything, and just slow down the
process and make it confusing." Today eight Sapling Tokens exist (oak, apple,
fir, birch, maple, mahogany, ebony, cedar); oak and fir Forests and the Apple
Orchard plant them as spawners. With Saplings gone, how those Forests make new
trees is a Forestry and spawner question, so it is settled in **A7 Forestry**
and **A2 Spawners and transforms**; their STATUS rows carry it.

## What the game does today

- **Levels**: `Needs Melee 15` (item tooltip, gear check), `Melee level too low (needs 15)` (why a hero won't work), `Combat · Lv 15`, `Melee 25/99` (the hero's sheet).
- **Capitals**: banner titles typed in Title Case (`Knocked Out!`, `New Place Settled!`, `Guild Upgrade!`, `Special Event! Fish Shoal!`); the same words in lines and the away summary read `Knocked out`.
- **Coming back**: `Refills in`, `Respawns`, `Rests 4 min when it runs out, then refills`, `Respawns 4 min after it's used up`, `grows back in`, `regrows`.
- **An event leaving**: the card's `Leaves in`, the hover's `An event: it leaves in 4 min, worked or not`; the away summary's `Worked out`, `Time ran out`, `Left unworked`, `Demolished`; live, nothing (silent moments topic).

## What it became

- **T-500**: one form for a level requirement, with the skill icon and the hero's level.
- **T-501**: sentence case for every typed text, banner titles included.
- **T-502**: Respawns is the one verb for coming back.
- **T-503**: Expired (or Demolished) for an event leaving; the away summary's events one line per kind with counts.
- **T-497, T-498** updated to these words.
- A7 Forestry and A2 Spawners: the Sapling ruling, in their STATUS rows.

All tickets blocked on the Telling the player group.

## Evidence

- Level wordings → `src/i18n/en.json:88, 135, 248, 601`; readers → `src/systems/equipment/EquipmentValidator.js:40`, `src/systems/board/Orders.js:61`, `src/ui/components/drawer/ItemTip.jsx:67-71`; `25/99` → `src/ui/components/dock/heroPanelSkills.js:35`
- Title Case banner titles → `src/systems/notifications/bannerKinds.js:88-95` (and the other kinds' titles in the same file); `Knocked out` → `src/i18n/en.json:389, 440, 553`; the text guide → `docs/reference/TEXT.md:56-57`
- Coming back → `src/ui/components/drawer/lifecycleLines.js:147-151, 233`, `src/ui/components/board/tokenCard.js:453-457`, `src/ui/components/board/idlePlate.js:43`, `src/i18n/en.json:272`
- Event leaving → `src/i18n/en.json:564-570, 794-800`
- Saplings in content → `data/tokens.json` (`token_oak_sapling`, `token_apple_sapling`, `token_fir_sapling`, `token_birch_sapling`, `token_maple_sapling`, `token_mahogany_sapling`, `token_ebony_sapling`, `token_cedar_sapling`)
