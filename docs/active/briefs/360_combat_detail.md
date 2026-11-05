# Brief 360 — Detail pass: how combat looks and reads

*Written 2026-11-02 by the planning agent from the owner's walkthrough of the same
day. Concept: [concept_detail_pass.md](../concept_detail_pass.md), "8. Combat": read
its list first; the item numbers below are that list's, and the owner's wish is what
counts. "There's a lot of visual information happening at once."*

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/UI_STYLE.md` (speech, the
work plate, pixel frames), GDD §6 "The combat screen" (this brief amends the owner's
picks of 2026-10-24/25 recorded there) and §14,
[concept_combat_v2.md](../concept_combat_v2.md).

Code to start from (verify; nobody has seen this section in the running game for
this brief): `src/ui/components/combat/` (`FightPanel.jsx`, `EnemyCard.jsx`,
`fightWatch.js`, `combatGlyphs.js`), `src/ui/components/board/FightLayer.jsx`,
`fightPlate.js`, `HealthBar.jsx`, `healthBar.js`, `fx/fightFloats.js`,
`src/systems/board/BoardCombat.js`, `HeroMotion.js`. Earlier mock-up scripts:
`docs/active/research/combat_screen/`.

## Needs

- C1 needs nothing and may run now.
- C2 and C3 use looks the owner picks elsewhere: the stylized HP bar (brief 340 H2)
  and the stat block (brief 350 T2). Build them after those merge, not before.
- C4 touches the mat's spacing and stack: after brief 350 T1.

## The owner's picks (2026-11-05, [mock-ups](../research/combat_look/index.html))

- **Fight window: B, the slim card.** **Minimized tab: D, faces and bars.** **Busy mat: F, the reduced plate.**
- **One change to F:** the combat icon (the detail view button) sits between the two health bars, not below the fight.
- The HP bar and stat block in the pictures are stand-ins: they follow the picks at briefs 340 H2 and 350 T2.

## Phases

| Phase | What | Tier |
|---|---|---|
| C1 | **Mock-ups** (no game code). Picture mock-ups for the owner to choose a direction: the window at two or three looks (larger battle, "Kira vs Goblin" header, stat block, enemy attacks styled and labelled, active effects in two columns, elixirs); a minimized tab and its strip above the hero bar; a busy mat with several fights, before and after (no plate, the button, HP bars with numbers, fewer floats, a move in a bubble). Saved under `docs/active/research/combat_look/`. The director brings them to the owner as one batched question. **Nothing later starts until the owner has picked.** | builder |
| C2 | **The fight window** (items 7 to 13). The panel becomes a window: drag it, minimize it, several at once; a minimized window is a small tab with hero against enemy and both healths, in a strip above the hero bar. **A window belongs to the hero** (owner, 2026-11-05): "Kira vs Goblin" becomes "Kira vs Wolf" on the next fight, and it stays open until closed, showing the last result while they aren't fighting. **Only a window the player minimized gets a tab.** Planning agent's default, judged at the look: the strip starts at the left and stops before the guide's corner (brief 480), bubbles draw over it, and the pop-up Shop covers it while open. The battle larger, at whole-pixel scales. The elixir counts move here from the plate; the matchup, type icons, Weak! and Resisted live here and in the log. In the owner's picked look. ⚠️ A window for every fight must not cost more than it needs: nothing redraws faster than its fight changes, a minimized tab least of all (T-198). | builder |
| C3 | **The mat during a fight** (items 1, 2, 3, 5, 6), plus **the live test**: a QA panel button that sets up several fights crowded together, so the owner can judge the motion. The plate goes; the detail view button stands in its place. Fighters use a small version of the stylized bar with numbers on it, heroes and enemies alike, and it stays readable at the mat's sizes. Floats over the fighter: damage, Crit!, Miss, heals. A named enemy move or effect proc in a speech-style bubble above the health bar, using the speech layer's rules (it must not sit on the number or another bubble). Expect more than one round: the owner wants iterative designs "to make sure that combat looks good and is clear throughout the fight". | builder |
| C4 | **Crowded fights step to open space** (item 4). Only when a fight would overlap another or a hero: the fighters step a short way to a clear spot; a lone fight stays where it starts; no clear spot within reach, it stays. ⚠️ This changes how the game plays: **expect WORK CHANGED**, explain it scenario by scenario, and check a camp's enemy still returns, a hero still goes back to their job, offline catch-up agrees, and a full mat of 128 doesn't stall. Say how far they walk and what it costs in fight time. Stop and report if the rule can't be stated simply. | engineer |

C2 and C3 share little and may run in parallel; C4 follows C3 alone.

## Done when

- Gate green (`TESTING.md`). C2 and C3: engine work **same**. C4's WORK CHANGED accepted
  by the director with the reasons in STATUS.
- In the running game, named as verified: three windows open at once, dragged and
  minimized; a tab shows both healths; closing with Escape still closes one layer at a
  time; a boss move and a proc read above the bar; a busy fight has no plate; fights in
  the QA button's crowd separate.
- `bench:draw --compare` for each look batch, with the crowd and several windows open;
  the number goes to the owner with the look, so they can judge the trade.
- GDD §6 and `UI_STYLE.md` updated.
- **Eye-checks**: the mock-ups' pick after C1 (no game change); one look after C2 and C3
  together; rounds after that as the owner asks; one after C4.

## Not in this brief

Combat's rules, numbers and content. Enemy animation sheets are owner art (the larger
battle will show that only the Cow has one): see
[the art list](../owner_art_list.md), section 5.

## Owner to-do

No CMS work. Pick from the mock-ups; art when convenient.
