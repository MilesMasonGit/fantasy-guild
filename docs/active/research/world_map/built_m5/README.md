# The settle ceremony in the running game (brief 380 M5, 2026-11-06)

Dev server from the `m5` worktree on its own port and Vite cache (`vite.m5.config.mjs`), headless
Chrome through the bench's CDP driver (`play.mjs`, read only), a fresh profile each run, at
1600 × 1000. Every frame's state was read from the page and the engine at the moment it was taken:
`play_main.txt`, `play_fixture.txt`, `play_fixture_still.txt`, `play_tutorial.txt`. The script
adds heroes to a new game (a player has them by then) and clears their "New Hero!" banners before
settling; nothing else is set by hand.

## The tutorial's first settle, from the world map (`scenario_main.mjs`)

QA panel, Atlas: Tutorial: jump to the world map step, then Meet the frontier's prices. The step
opens the world map with the cartographer; a ring-1 place is pressed and settled.

1. `01_settle_pressed.png` (+0.25 s): Settle pressed; the view starts back up to the mat.
2. `02_title_opening.png` (+0.9 s): the gold banner ("New Place Settled!") under the top bar, and
   the title opening from its middle line as the glide ends.
3. `03_title.png` (+1.5 s): the title: "Thistle Vale" in the display size over the place's banner at
   3×, "Woodland Trees" under it. The first hero has just stepped on at the mat's foot.
4. `04_title_heroes_walk_in.png` (+2.4 s), `05_heroes_walking.png` (+3.7 s): the three heroes walk
   up from the foot below the Hall one after another; the title closes at about 3.5 s.
5. `06_heroes_home_enemies_spread.png` (+7 s): every hero at home in front of the Hall, idle, no
   order; the wolf, the crab and the goblin stand apart round the Hall (392,466 / 1025,229 /
   1516,796 on the 1920 × 1040 mat); the mat is held (`data-mat-held` on).
6. `07_a_minute_later_still.png`: a game minute run on top of the live loop with nobody sent: every
   enemy where it stood, no fight, every hero at home.
7. `08_sent_hero_fights.png`: a hero dragged by the mouse from the Hall onto the farthest enemy:
   the order pins to it, the hero walks there, and the fight starts then.
8. `09_travel_home_plain_card.png`, `10_travel_back_plain_card.png`: travel to the Starter Camp and
   back from the world map: the plain arrival card each way, no title, no walk in (heroes at
   home at once, the hero sent out back at its enemy, the enemies where they were).
9. `11_skipped_by_key.png`: another settle, Space pressed while the title shows: gone at once.
   `12_after_skip_heroes_home_mat_held.png`: six seconds later the heroes have walked in anyway
   and the mat is held. A third settle's title was skipped by a click (log only).

The tutorial's last step ("Settle Your First Place") is done by the settle with the ceremony
(`scenario_tutorial.mjs`, `T1_tutorial_first_settle.png`). No console errors in any run.

## The QA panel's free settle (`scenario_fixture.mjs`)

`F1_fixture_title_opening.png`, `F2_fixture_heroes_home.png`: the Highland fixture place gets the
same banner, title and walk in (four heroes). Run again under reduced motion (`fixture_still`):
`S1_still_title_first_frame.png` shows the title whole at its first frame; it never wipes open or
shut (`S2_still_title_closing.png`). The heroes still walk: that is the game's own movement.

## How long clearing takes, the lair against the spread (`clear_time.measure.mjs`, measured)

A vitest file (not in the suite; copied into `src/tests` to run, then removed). Twelve worlds, the
first ring-1 place of each settled, heroes walking at the game's speed, fit to fight (a combat
skill at 40, steaks); the arrival stood once as the old lair did (its code copied exactly) and
once spread. Heroes sent at the standing enemies nearest the Hall at once; each then goes on to
the nearest left. Game seconds to clear, median (min to max) of 12; raw rows in `clear_time.json`.

| Heroes sent | Lair | Spread | Hero walking (median, all heroes) |
|---|---|---|---|
| 1 | 101 s (68 to 137) | 113 s (81 to 158) | 5 s → 17 s |
| 3 | 52 s (33 to 77) | 58 s (30 to 97) | 23 s → 39 s |

The fights dominate; the spread adds about the extra walking, some 10 to 12 % at ring 1.

**The ledger** times no clearing: settling a place is a step of nought hours of its own
(`pace.js`, `HOW.SETTLE` falls to `done(0)`), and fights are untimed (an enemy's drop has no cycle).
It imports nothing M5 changed (`world/Arrival.js`, `board/HeroMotion.js`, `world/Settling.js`,
the screen), so its numbers are the same before and after. With clearing at one to three minutes
against stage budgets of hours, no adjustment is proposed.
