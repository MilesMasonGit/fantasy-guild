# Brief 260 — Hero orders: drag a hero to a job

*Written 2026-10-28 by the planning agent from the owner's interview of the
same day. Concept: [concept_hero_orders.md](../concept_hero_orders.md) (read it
whole; its "Defaults the planning agent set" are the owner-approved
defaults). This replaces the heart of the game (GDD §4, "How heroes choose
work"): area flags, Work Permissions and Scouting Flags retire.*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md`,
[concept_hero_orders.md](../concept_hero_orders.md), GDD §4 (heroes, how they
choose work, health and defeat), §6 (enemies, encounters: ambush watch,
one-on-one waiting), §3 (Respawn waiting, Farming's waiting farmers), §8 (Hall
upgrades), §14 (the Performance Envelope).

Code to start from (verify; comments here are hypotheses):
`src/systems/board/Flags.js` (`keepOrRelease`, `waitingOf`, the choice
order), `FlagRules.js`, `HeroMotion.js`, `src/ui/components/board/FlagLayer.jsx`,
`FlagMark.jsx`, `flagGeometry.js`, `flagWorkable.js`, `flagText.js`,
`src/ui/components/dock/BottomHeroDock.jsx`, `HeroDockTab.jsx`,
`dockRecall.js`, `WorkRulesDrawer.jsx`, `workRules.js`, `guildUpgrades.js`
(Scouting Flags), the tutorial quests (`tutorialQuests.js`), the save loader.

⚠️ **Brief 250 P2** (the pennant for every hero's flag) was building on
2026-10-28. Its pennant art and geometry are reused here as the job marker;
start phase 1 after brief 250 has merged.

## Phases

Each phase on its own branch, merged after its eye-check. The owner may stop
after phase 1 if the feel is wrong: phase 1 must stand on its own.

| Phase | What | Tier |
|---|---|---|
| O1 | **Orders.** Heroes always on the mat (idle ones loiter near the Hall). Drag a hero (figure or roster tab) onto a Token: they walk there and work only it (stations, Fields, Promotion Token and Hall included); onto an enemy or a boss: fight it; onto blank ground: go there and idle, with the pennant on the spot fading out on arrival; onto the Hall: go home. While dragging, Tokens the hero can work glow; a drop on one they can't work shows the reason and the hero stays. A drop on a busy Token waits beside it. The job stops → the hero **waits there** (today's waiting words); a Token gone for good → a "needs a job" mark on the mat and the roster tab. **The pennant** sits at the top of the job's Token, drawn **behind** its sprite. The dock becomes a roster (find on mat, open sheet, idle / hurt / busy, drag from). Hostile enemies still ambush a hero working near their camp (the camp's watch area, no longer a flag radius); the hero fights back and returns. Defeat → heal → **wait at the Hall**, order cleared. Remove the Work Permissions drawer and launcher, rules, priorities and the Fight rule (the skills' purpose lines move to the hero sheet's skill list). **Old saves**: a pinned flag becomes an order on its Token, an area flag a hero idling where it stood. Atlas: returning to a Region, heroes resume their orders there. Hover a hero or tab: their job highlights. | engineer |
| O2 | **Camps.** A camp is a Token type (CMS: a Camp block naming its skill and its reach) built on a Foundation like a station. A hero ordered onto a camp works the nearest free Token of that skill they can work within its reach, finishes each cycle before moving (sticky), waits silently for resting or growing ones; any number of heroes, one per Token. A **Farmstead** harvests ripe Fields. An **enemy camp** (Goblin Camp) takes the same order: the hero hunts what it spawns and waits for the next. Hovering a camp, or a hero working from one, shows its reach ring. Ship four content shapes for the owner (Logging Camp, Mining Camp, Fishing Hut, Farmstead) as a CMS change pack with placeholder art, reach and Foundation recipe. **Scouting Flags retires** from the Hall (a save's bought ranks: drop silently). | engineer |
| O3 | **Clean-up.** Tutorial steps: "plant a flag" → "send your Recruit to a tree", plus a step that builds a first camp. The area-flag, radius and rules code removed (nothing dormant left). GDD §2, §4, §6, §8 and the glossary rewritten for orders and camps; `speech_bubble_lines.md` and any player text saying "flag" checked. | builder |

## Done when

- Gate green per phase (`TESTING.md`). The engine bench **will change work**
  (heroes choose differently): the engineer explains the change per scenario
  and the director accepts it under `brief260-O1` / `-O2`; catch-up identity
  and fidelity must still hold. The drag bench runs (drag code changes);
  `bench:draw --compare` once per eye-check: no regression.
- In the running game (O1): a Recruit dragged onto an Oak Tree walks there,
  fells it and waits while it regrows; dragged onto blank ground, idles there
  and the pennant fades; dragged onto a Copper vein without a pickaxe, stays
  put and the reason shows; a Goblin ambushes a hero chopping beside the
  camp, the hero fights and goes back to chopping; a defeated hero ends idle
  at the Hall; an old save with one pinned and one area flag loads as
  described; no Work Permissions anywhere.
- In the running game (O2): two heroes on one Logging Camp take two
  different trees; a Farmstead hero harvests two ripe Fields in turn; a hero
  on the Goblin Camp fights each goblin as it spawns.
- One eye-check file per phase in `docs/active/eyecheck/`.

## Owner CMS to-do

- After O2: review the camps pack (art, reach, Foundation recipes), then Sync
  on `main`.
- Shorter rest, regrow and respawn times wherever a waiting hero idles too
  long (as you play O1).
- The Bunk Beds price, so a second hero comes early (one hero per link means
  a miner and a smelter are two heroes).
