# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

- **Demolition (the Atlas, engine half).** A Token can now be marked for demolition, and a hero with Construction walks over and takes it away: a short job (10 s for now), no refund, nothing dropped, and the Token count goes down. While it is marked the Token stops its own work (a station stops its recipe, a spawner stops spawning, a sapling stops growing) and is just a job; taking the mark off makes it itself again and loses the half-done demolition. The Guild Hall, landmarks, the Tokens a map wrote, quests and enemies cannot be marked. A marked Token stays marked through a save. There is no button yet: for now it is marked from the dev console (`Game.Demolition.mark(id)`), and the discard bin is still there until the next slice (Atlas A3a).
- **Resource Tokens that come back (the Atlas, respawning resources).** A Token can now be set in the CMS, with a new Respawns block, to come back after it runs out instead of leaving the mat. A refilling Token, like an ore vein, stays where it is, greyed out with a countdown bubble (hover it: Refills in 12 s), then refills to full all at once and hops back to life; a regrowing Token, like a tree, turns into another Token (an Oak Sapling) that grows back into it. Its hero moves on to other work with no red alert, it is never counted under Tokens used up, a carried one rests in your hand, time away plays its rests like any other clock, and a tree a Forest spawned still counts toward the Forest's limit while it grows back. Nothing in the shipped content uses it yet: the respawn times are set on the veins and trees in the CMS (Atlas A2).
- **Maps are items (the Atlas, maps part).** Base Maps and Modifiers are authored in the CMS's rewritten Map editor (a Base Map's biome, points, which Tokens it writes and how often, its enemy camps and treasures; a Modifier's effects: more of a node, a better node instead, an enemy camp, a treasure), and each one is an item: Sync writes it into the items file, it sits in the Bank like any item, and inspecting it lists what it writes (40 Tokens: 30 × Oak Tree, …). Settling a Region from maps now uses the maps in the Bank and takes exactly the ones slotted (still from the dev console until the Atlas screen arrives). A claimed bounty now pays a map 1 time in 4 as well, drawn when you claim it. The economic simulator leaves maps alone, the boot check and the Economy Audit name a map that points at a missing Token or writes nothing, and the old Map code (the Map catalogue, its editor and simulator check, `data/maps.json`) is retired (T-110). No maps ship yet: they are authored in the CMS.
- **Regions written from maps (the Atlas, second part).** A set of maps can now be turned into a new Region: the game works out how many of each Token the maps write (more maps of a kind, more of its Tokens; modifiers add Tokens, swap one for another, or add an enemy camp), lays them out around a clear space in the middle for the Guild Hall, with same kinds of tree or ore growing together and camps out towards the edge, and settling keeps that layout as the Region's mat, its Tokens fixed where they were written. Rerolling before settling moves the Tokens but never changes how many there are, and the maps are used up only when you settle. A map can also carry a rule for its whole Region (say, +10 % Forestry), which applies only while the guild is there. There are no map items or Cartography screen yet: for now this is reached from the dev console with placeholder maps (Atlas A4).
- **A Token in your hand cannot vanish.** While you carry a Token it pauses: its work cycle stops (its hero waits beside it), a fight with a carried enemy stops with no damage either way, and a Token that runs out of charges while carried stays in your hand. When you drop it, work and fights carry on exactly where they stopped, and a Token that ran out is used up where it lands (T-129).
- **Ambush rules.** A Token's Spawns rule can now have a chance, set in the CMS rules editor, where it reads On Cycle: a 5% chance to spawn Rock Elemental on the nearest free tile. The chance is rolled before the rule does anything, so a miss costs no charge and starts no cooldown; a rule-fired spawn waits while the mat is at its Token cap (one that replaces its own Token still happens); and an enemy a rule spawns belongs to the Token that made it, watching for heroes around that Token, so it attacks whoever is working it, offline too. Rules without a chance behave exactly as before. Nothing in the shipped content uses it yet (Atlas A9).
- **Regions and travel (the Atlas, first part).** The game can now hold several Regions, each with its own mat, and move the whole guild between them: the Guild Hall and the quests come along, loot lying on the floor is banked as the guild leaves (whatever the Bank cannot hold stays on that Region's floor), each Region keeps its own flags so going back puts every hero at the flag they left there, and a Region the guild leaves stays frozen exactly as it was until it comes back. There is no Atlas screen yet: for now a Region can only be made and visited from the dev console. The Token cap is now 128 (it was 80) and counts only the Region the guild is in. Saves from before this change cannot be loaded: start a new game.
- **Level-ups from time away show on the hero bar.** After loading a save, waking a sleeping PC or coming back to a background tab, the level-ups the game played while you were away now wait in the hero bar's bubbles like any other, and waking a sleeping PC no longer clears bubbles you had not read yet. Background-tab catch-ups count too, so the bar shows every level gained (director ruling).
- **Smoother pick-up and drop.** Picking up or dropping a hero, flag, Token or item no longer redraws everything else that can be dragged (every Token on the mat, the heroes and flags, the hero bar, the Shop and Bank rows), so the small hitch at the start and end of a drag is gone from most drags: on a busy board a pickup or drop now runs long in 0 to 13 of 50 drags instead of nearly all of them. A very full mat (about 320 Tokens) still hitches at most drops, and the Bank and the Shop now and then (T-033).
- **Dragging picks up what you press.** A hero standing in front of a flag no longer blocks it: a press on the clear space around a hero's figure (their own or a neighbour's) now reaches the flag or Token behind, and a hero facing left is pressed where they are actually drawn (it used to test the mirror image). A flag standing among Tokens can always be picked up by its cloth: over a Token, the coloured banner of a flag drawn in front of it now takes the press, while its pole, its grass and its empty corners still let the Token have it. The playmat no longer jumps up under the top bar after dragging a flag or hero near its edge. The drag bench now reaches every kind of drag 100 % of the time (T-105, T-106).
- **Drag bench sees hitches.** The drag bench (npm run bench:drag) now times every frame of each drag, not only how fast it starts: for the pickup, the carry and the drop it reports the longest frame and how many frames ran over 16.7 ms (a visible hitch), per kind of drag, plain and with bubbles showing. Its dev server now keeps its own Vite cache per checkout, so two worktrees' benches no longer share one (T-123).
- **The flag is just something to drag.** A hero's flag on the mat no longer carries the rules gear or the … idle badge; the work rules move to the hero bar. Hovering a flag still outlines it and shows the hero's name and how far they reach, and a hero with nothing to do still says No work in range. Drag the flag to move it, or onto the bar to call the hero home. While you drag it, a green dot marks the middle of every Token inside its reach that the hero could work.
- **Hero panel.** Clicking a hero in the bottom bar now opens the same full-height side panel the Bank uses, on the notification side, instead of a sheet rising from the bar, and it stays open when you open the Bank. At the top the hero idles at twice their mat size with their flag behind them, then the name, job and HP bar with its numbers (61 / 432). Below: the loadout grid, then every skill the hero holds in one list (combat first, then the 9 Starting skills, then Advanced and Master skills, which have their own background colour), each as icon, name and 25/99 with a thin XP bar; hovering a skill shows the exact XP in the game's own tooltip, and clicking it opens its numbers: XP this level, XP to the next, total XP, XP an hour and the time to the next level (22:06). Skills set aside at a job change follow, and skills the hero has never had sit in a Locked list at the bottom, shut until you open it. The red X closes the panel (so do Esc and a click on the mat); the quill opens the editor (name, portrait, flag colour, Change Job) and is a stand-in until its own icon is drawn. Once closed the panel no longer catches drops on the mat. The hero tabs beside the Bank now read like the bar: portrait, name and a thin HP bar in one thin frame, with the details in a tooltip on hover instead of the tab sliding out.
- **Hero bar: level-up bubbles that wait for you.** Each hero in the bottom bar now keeps a speech bubble for every skill that levelled, so after time away you can read every level gained by scanning the bar. Bubbles read LVL UP! 50 Melee! (+49), the same words as the mat's level-up bubble, with the numbers in a warmer colour and the (+n) only when two or more levels merged; a bubble takes one or two lines. Three show at a time, and small arrows page back through older ones. Clicking a bubble fades it out and clears just that one; clicking the hero clears all of theirs. The bar has no dark backdrop any more (it is the mat's edge with one thin line), the heroes stand a little further apart, spaced for 8, and the HP bar is slimmer (hover it for the number). Old unused dock code removed (T-044).
- **Work rules grid.** A Work Rules button (the orange gear) at the left end of the hero bar opens a drawer that rises from behind the bar, one row per hero (up to 8), with the mat still in view above it. Columns are every skill, combat then Starting then specialist under group headings, then one Fight column; a skill a hero doesn't hold is a blank, dimmed square. Each square shows a tick when allowed; the Priorities switch at the top shows every square's priority instead. Click to step up, right-click to step down (1 to 5, then off); a skill switched on starts at priority 1. Squares are shaded by the hero's level, darker at 1 and brighter at 99, and hovering one names the hero, skill and level. Click a hero's name to allow or disallow their whole row, or a skill's icon for that whole column. Hovering a row lights that hero on the mat. The button or Esc closes it; clicking the mat leaves it open. The hero panel has a small Work rules link that opens the drawer with that hero's row lit. The hover gear on heroes, the side rules panel and Copy rules to are gone.
- **The Time Bank is gone.** The hidden Time Bank (banked time away, spent at 2×, 5× or 10× speed) is removed with its widget, its speed-ups and its save field, now that the game plays the time you were away instead.
- **Loading bar and While you were away.** While the game catches up on time away (2 minutes or more), a loading bar covers the mat saying how long you were gone, so the game never looks frozen; it cannot be closed part-way. Then a While you were away panel lists the time away (and how much past the 24 hour limit was skipped) under plain headings: Items produced (made and waiting on the mat), Items banked, Items spent, Level-ups (Mining 50 → 51), Tokens used up, Heroes wounded and Fights won, leaving out anything that did not happen. Every item, Token, level-up and hero is shown as the Token inspection's Item Bar, wider here: the sprite grows on hover, and the count reads short (5.9k) until hovered, then exact (5,900). The bars fade and slide in one after another, and a long list scrolls inside the panel. **Return to the Guild** (or Esc) keeps the catch-up; **Load as I left it**, below it, asks first, then throws the catch-up away and reloads the game exactly as you left it, with no catch-up, after a closed game or a sleeping PC alike (Cancel or Esc keeps it).
- **The game plays the time you were away.** Loading a save now plays every second since it was written, up to 24 hours, through the real game in fast 1-second steps (24 hours of the bench's busy board took 24 s), then saves once; a crash or a closed window part-way keeps the save you loaded, and the next load tries again. A sleeping PC or a background browser tab catches up the same way when it wakes. Work cycles now keep the part of a second left over when they finish, so production is about 0.5 % higher than before, live and offline alike. Effects, loot timing and the rate readouts follow game time. The Time Bank no longer banks anything.
- **Stealth joins the combat matchups.** Combat styles now form a four-way cycle: Melee beats Ranged, Ranged beats Magic, Magic beats Stealth, and Stealth beats Melee (still +10 % damage and +7 to hit for the winner). Melee against Magic and Ranged against Stealth are even, so Magic no longer beats Melee. Enemies can be set to Stealth in the CMS Style dropdown, which now lists the four combat skills from the skill registry.
- **CMS content generator follows the skill list (class rework v2, part 3).** The AI generator in the CMS no longer defaults to Nature, a skill that no longer exists: its default skill and the skill list it gives the AI now come straight from the game's 25 skills. The design document now says the Oak Forest Map is gone, the Shop sells 10 Tokens and the tutorial has 11 steps.
- **Promotion rules (class rework v2, part 2).** A Recruit now qualifies for a basic class once two of their Starting skills reach level 10: Fighter needs Mining and Smithing, Ranger Forestry and Crafting, Wizard Alchemy and Cooking, Rogue Fishing and Crafting (the Change Job planner shows what is still missing). Promotion is now free: an Academy no longer uses up a charge per hero and never wears out, unless its price is set in the CMS. Mastery: an Advanced or Master skill that reaches level 99 is never set aside when the hero changes class; it stays on top of the new class's skills (Combat skills are set aside as usual).
- **New skills and classes (class rework v2, part 1).** Heroes now have 25 skills in four groups: 9 Starting skills every hero always keeps (Mining, Forestry, Fishing, Smithing, Crafting, Cooking, Farming, Alchemy, Construction), 4 Combat styles (Melee, Ranged, Magic and the new Stealth), 4 Advanced skills (Leadership, Fletching, Enchanting, Crime) and 8 Master skills. Logging is now called Forestry and keeps its picture; Explore and the old specialist skills are gone. The class tree is now Recruit, then 4 basic classes (Fighter, Ranger, Wizard, Rogue), then 8 master classes (Paladin, Knight, Beastmaster, Hunter, Necromancer, Scholar, Merchant, Assassin), shown that way in the Change Job planner. A new Recruit holds 9 skills, a basic class 11 and a master class 13. The new skills are placeholders with emoji icons until the specialist-skill rework. Content that still says Logging is read as Forestry automatically, in the game and in the CMS, so trees keep working and the next Sync to Game writes Forestry; the boot check and the CMS Economy Audit now name any Token, recipe or item that points at a skill or job that no longer exists. Not yet: basic classes have no skill requirement and promotion still uses one Academy charge (both change in the next part), and saves from before this change load with their old heroes (start a new game to test).
- **Project notes.** Subagent tiers raised for the Max plan (runner Sonnet, builder Opus, engineer Opus extra-high) and code phases may now run in parallel in git worktrees; the test suite is confirmed to run in a worktree once both node_modules folders are linked (T-066 closed).
- **Motion and polish.** A spawned Token pops out of its spawner and slides to its spot (not while the time bank replays time away; the new spawnMotion perf switch turns it off). Item flights now scale with distance: a short hop takes about a third of a second, a long flight up to 0.8 s. A collection quest's billboard shows the item it wants, centred on the poster. Dragging an item out of the Bank casts the hard pixel shadow instead of the old soft one (U8).
- **Token inspection.** Charges, time and XP now show as the same round bubbles the mat uses, and they update live while a hero works the Token: the time bubble counts down and the XP bubble fills with the cycle, and charges follow as they are spent. Skill icons are sharp (they were being smoothed into a blur). The popup has the hero speech bubbles' shape and tail, and the Heroes may work this switch is now Disallow (on means heroes will not work it, and the Token's disallow bubble shows on the mat) (U7).
- **Token Summary and Upkeep rework.** Click the Tokens counter to open the Token Summary (Esc or a click elsewhere closes it): one row per Token type with working, idle, blocked and disallowed counts, Tokens missing items pinned on top, the rest under their skill section with a spawner beside what it spawns, spawned Tokens included, and an In the bin line. Hovering a row lights every Token of that type on the mat. Hovering the counter shows a short explanation instead. The Upkeep panel now lists only what consumes (no Passive Production, no idle spawners) without boxed rows, and the Hall tooltip reads Passive Production, next in 4:57 (U6).
- **Passive Production.** The Guild Hall's free income is now called Passive Production and pays everything at once on one 5-minute timer, dropped as loot beside the Hall: its seeds (the Apple Seed now comes every 5 minutes, not 10) and the Wishing Well's Water, 10 per rank every 5 minutes with no hero needed (it used to need a hero's flag on the Hall, at 1 per rank every 10 seconds). Hovering the Hall shows one countdown and what it pays. A save from before loads with the timer picked up from the furthest-along old clock (T-099).
- **Token cap 80, spawned Tokens included.** The mat now holds up to 80 Tokens, and spawned ones (trees, rocks, goblins) count toward it along with placed ones, on the mat or in the bin; the Guild Hall and quests never count. The top bar and the Shop read Tokens 62/80. At the cap the Shop refuses a purchase (Token cap full), a station holds a Token it makes, and a spawner waits with a red bubble saying Token cap full, on top of its own family cap. A save already over 80 keeps every Token; adding just waits until the count is under. The cap is now a game value; the Mat Tuner keeps a dev override, off by default (T-102).
- **Foundation tiers.** A Foundation can now have a tier (1, 2, 3...) and a building recipe a minimum Foundation tier, set in the CMS. A Foundation builds every recipe at or below its tier, the same rule tools follow, so a tier 3 Foundation builds everything a tier 1 or 2 can; the recipe picker leaves out anything above the Foundation's tier and says when a recipe needs tier 2 or higher. A Foundation or recipe with no tier set counts as tier 1, so today's content builds exactly what it did. A Shop group of Foundations lists its choices by tier, then price.
- **Shop rows, arrows and groups.** The Shop list scrolls with an arrow bar at the top and bottom instead of a scrollbar. Every row is the same height with the Token drawn at 128 pixels on the right, ready to drag out onto the mat, and the cost in a 2 by 2 grid. A Token can now be given a Shop group in the CMS (Spawning and Building, Shop block): Tokens sharing a group name show as one row with a dropdown, and the chosen entry's picture and price are what you buy.
- **Fast drops on the bin.** Flicking a Token onto the bin edge and letting go straight away now bins it; before, a release in the first few milliseconds after the bin popped open dropped the Token on the mat underneath. A Token dragged back out of the bin still never drops back into it.
- **Grabbing follows each Token's own circle.** Tokens still draw at their bigger 2× size, but only a Token's own round body now answers a press, so art spilling over a neighbour no longer steals the click or drag; where two Tokens overlap, the press goes to the one whose centre is nearest, the same one the hover outline shows. A hero's art beside their figure no longer blocks the flag or Token behind it either.
- **Heroes stand a little further from their Token.** A hero working or fighting now stands 32 units from the Token's edge instead of 16, so in a fight the hero's health bar and the enemy's no longer touch, even with a four-digit HP number (T-112).
- **Health bar numbers and lingering hero bar.** The health bar now has its number (like 34/50) written on it all the time, so there is no hover tooltip; the bars are a little thicker to fit it. A hero's bar stays up for about 3 seconds after their fight ends, then goes.
- **Notifications and bin pop out over the playmat.** The notification column and the discard bin are now slim tabs on the screen edge that slide out over the mat while you hover them, so the playmat is about 290 pixels wider on a 1600 pixel window. Dragging a Token toward the bin edge opens it too.
- **Stuck spawner warning.** A spawner that cannot spawn now shows a small warning bubble in the middle of its Token the whole time: yellow "Needs Oak Seed to spawn" while it waits on an item, red "No room to spawn" when the mat is full. A single level-up reads "Leveled up Mining to 25!"; the "(+n)" shows only when two or more levels merge.
- **Callouts instead of alert marks.** The floating exclamation marks on Tokens are gone. A spawner now shows a quick "! Spawned Oak Tree" popup that fades, a named effect (like a bonus drop) pops its name over its Token the same way, and the hero who uses a Token up says "Oak Tree Depleted". A level-up on the mat reads "Leveled up Mining to 25! (+4)", with quick level-ups merged into one bubble. The "Hero went elsewhere" notification is dropped.
- **Combat health bars.** A fight now shows a thin health bar above the hero and above the enemy (and above an enemy you hover), gone when the fight ends; hover a bar to read the exact number, like 34/50. The enemy's round HP badge is gone.
- **Token bubbles rebuilt.** Each Token's round badges now sit inside its box in fixed spots (timer top-left, gear, spawner count and disallow mark in the middle, work cycle bottom-left, quest progress bottom-centre, charges bottom-right) and show only when useful: the work cycle while a hero works, counts for a moment after they change and on hover, timers on hover and in their last 10 seconds. Saplings, sprouts and young trees now show a growth timer; every count bubble glides when its number jumps; each bubble has a tooltip and still lets you grab the Token; the name label moved above the Token's box.
- **Binned Tokens now count toward their spawner's cap.** Putting a spawned Token (a sapling, a tree) in the discard bin no longer lets its Forest make another; the slot frees only when the Token is discarded for good.
- **A closed hero sheet no longer blocks drops on the mat.** The bottom hero sheet stayed in place invisibly after closing, so its equipment slots kept refusing Tokens and flags dropped over its area; it now disappears completely once its closing animation ends.
- **Tests follow the owner's content cuts (2026-10-07).** With Copper Rubble and every Map deleted in
  the CMS, the tests that relied on them were updated: the Oak Forest Map's chain test removed, 8
  golden render cases for deleted Tokens dropped, the first-Map rule skipped while no Maps ship.
  The suite is fully green for the first time in the crunch prep; the AssetManager failure is gone.
- **Environment cleanup before the crunch (2026-10-07).** Test runs are quiet (~380 lines instead of
  ~25,000) and faster (~70 s instead of ~110 s); 25 tombstone tests removed. About 3,500 lines of dead
  code and ~3,000 lines of unused CSS deleted (CSS bundle 215 → 141 kB), plus 3 unused packages and
  old one-off scripts. Misleading names fixed (the Shop's internal id, `BankDrawer`, Tray/Vault
  constants); the slot picker says "Heroes". Audio files moved out of doubled folders. Docs:
  `.ignore` hides the archive from searches, the changelog is split, TESTING.md gained the machine's
  quirks. Plan: `docs/active/hygiene_plan.md`.
- **Crunch briefs written (2026-10-07).** Ten ready-to-run briefs in `docs/active/briefs/` (quick
  fixes, UI rework, class rework v2, hero bar and panel, offline progress, drag, optimization,
  Atlas, terrain, Performance Envelope), from the owner's design interviews.
- **Certification run by the owner (2026-10-07).** The realistic board passes (99.1 % of frames in
  budget, no freezes); the kill stall is confirmed gone; the torture board misses (83 %); picking up
  a Token stalls ~90 ms in the dev build (T-033). Results in `docs/reference/PERFORMANCE.md`.
- **Performance baseline recorded (2026-10-07).** Engine and drawing baselines saved on the owner's
  PC; results, the per-system cost table and the drag success rates are in
  `docs/reference/PERFORMANCE.md`. The rings are over half the drawing cost of a realistic mat.
- **Measurement tools, part 2 (2026-10-07).** `npm run bench:draw` measures what drawing costs:
  each stress board, and S2 with the Bank, the Shop or a hero sheet open or with notification and
  loot bursts, in headless Chrome on the real GPU at CPU 1× and 4×, with a cost table per drawing
  switch, a baseline compare and an A/B mode. `npm run bench:drag` makes hundreds of real mouse
  drags of every kind on a busy mat and reports which ones fail and what blocked them. See
  `bench/README.md`, "Drawing and drag benches". No baseline is saved yet (the owner's quiet run).
- **Measurement tools, part 1 (2026-10-06).** `npm run build:perf` makes a production build that keeps
  the Perf HUD (into `dist-perf/`); `npm run check:perf-build` proves the normal build has none of it.
  15 per-system drawing switches (`?off=rings,speech` or `window.__perf.off(name)`) turn one
  system's drawing off at a time to measure its cost; they never change game logic. Dev and perf
  builds only.
- **Crunch order updated (2026-10-06).** The Atlas joins the crunch after deep optimization,
  followed by a terrain rework; markets stay undecided.
- **Comment-slimming pass (2026-10-06).** Comments only, about 610 files across `src/config`,
  `src/systems`, `src/ui`, `src/state`, `src/utils`, `cms/src` and `src/tests`: roughly 12,000 net
  lines removed, ticket and decision IDs gone, around 90 false comments deleted or corrected. One
  test (`DeadEventWiring`) now matches comment text instead of a ticket ID. Leftovers are T-103.
- **Owner rulings on the GDD questions (2026-10-06).** Recorded in the GDD and as tickets
  T-097..T-100; skill & class rework v2 and real offline progress became crunch tracks; a
  comment-slimming pass is briefed in `docs/active/brief_comment_slimming.md`.
- **Crunch prep: one backlog, a lean doc set, a real GDD (2026-10-06).** All open work now lives in
  `docs/reference/TICKETS.md` (96 tickets); docs are split into `docs/active/` (start at `NOW.md`),
  `docs/reference/` (GDD, tickets, testing) and one `docs/archive/`; CLAUDE.md describes director
  mode; the GDD was rebuilt from code surveys. The dead tile-era terrain table and its 6 expected
  test failures were deleted.

## [0.8.0] — tagged 2026-09-16, plus later work through 2026-10-05 (no version bump)

- **Mat Tokens no longer stop the keyboard Tab key (CR3-411).** Tabbing through the page used to
  walk through every one of the ~150 Tokens on the mat, one by one, and a screen reader would
  read instructions for picking one up with the keyboard — which was never wired up. Tab now
  skips the mat entirely.
- **No stray reach ring while dragging (CR3-410).** Carrying a Token across a hero or a flag used
  to light up that hero's reach ring, even though the Token would not land there. Now, while
  dragging, only the rings of flags the Token would actually land in show.
- **Escape during a drag now only cancels the drag (CR3-409).** Pressing Escape while carrying an
  item out of a hero's sheet used to also close that sheet; pressing it while carrying something
  out of the dock or Bank in disallow mode used to also turn disallow mode off. Now Escape cancels
  the drag alone, and a second press is needed to close the sheet or end disallow mode.
- **A crisp pixel look for shadows and highlights (Wave 5, CR3-350).** Tokens resting on the board
  no longer have a soft shadow. A Token you are dragging, and loot floating on the mat, cast a hard
  black pixel shadow instead. The soft green glow is gone too: a sharp coloured outline now shows a
  Token's or hero's state (green working, white hovered or selected, red alert). The outline is one
  pixel of the art, touching it only edge to edge, so it stays crisp and even. Busy boards draw
  noticeably faster as a result.
- **Charge and spawner count rings glide to their new value** instead of jumping.
- **Smoother drawing on busy mats; looks the same (Wave 4: CR3-007, 011, 301, 303, 351, 352, 353,
  354, 357, 458).**
- **The dock's HP bars keep up with a hero's health (CR3-300).** They used to only catch up when
  something else about the hero changed; now a hit or a heal shows right away, in both the bottom
  hero dock and the Bank's side panel.
- **The hero sheet beside the Bank no longer closes itself the moment you click inside it
  (CR3-450).** Clicking the Edit button, a skill row, or anywhere else in that panel now works as
  expected. Clicking the playmat (or anywhere else outside) still closes it, as intended.
- **The Guild Hall upgrade panel's Close button actually closes it now (CR3-451).** It used to
  clear the panel and instantly put the same upgrade right back.
- **A refused equip no longer pretends to succeed (CR3-405).** Dropping an item on a hero who
  already carries it, has no free slot, or is out of stock now sends the item back where it came
  from, plays no equip sound, and shows a short message saying why.
- **A crash on one part of the screen no longer blacks out the whole game (CR3-203).** The
  playmat, the hero dock, the Bank panel, and the Bank and Shop drawers each now catch their own
  render errors and show a small "Something went wrong here" panel with a Reload button, while
  everything else keeps working.
- **Reordering heroes in the Bank's side panel works now (CR3-457).** It already showed the drop
  line; dragging a hero to reorder there now actually moves it, the same as the bottom dock.
- **Settings tidy-up (CR3-033).** Four controls naming things that no longer exist (Large Tray
  Tokens, Card Badge Tooltips, Boost Tile Tooltips, Instant Pack Reveal) are gone. Nine more that
  do nothing yet (Theme Mode, Zoom to Cursor, Animations, Notification Position, Master Tooltips,
  Item Tooltips, System/Level Up/Loot Messages) are now shown disabled and marked "Coming soon"
  instead of looking live.
- **New ore vein art.** Copper, coal, iron, gold, silver, mythril, adamantine and darkmetal veins,
  and the Stone Outcrop, show their new vein pictures. New foundation, stone and plank art is
  ready to pick in the CMS.
- **The game's art is now versioned** (Git LFS), so every save point can bring back the art that
  went with it.
- **Code review round 3** (see `docs/review_v3/Z.md`): a speed benchmark (`npm run bench`) and an
  in-game performance overlay for developers (`?stress=realistic`).
- **Performance overlay (developers only).** Its mat figure is now labelled "mat subtree commits"
  (every redraw of anything on the mat), with "MatBoard itself" beside it (how often the mat as a
  whole redrew). The small FPS counter in the corner hides while the overlay is on.
- **A brand-new game is now saved complete straight away** (CR3-100). Before, the first save was
  written before the Guild Hall and the starting items were laid out, so if the game closed
  uncleanly in its first ten minutes, that slot loaded as an empty table with no Guild Hall.
- **Changing the PC's clock no longer disturbs the game (CR3-101).** While you're playing, elapsed
  time is now measured by a clock the PC can't move. Winding the system clock back used to make
  every working station "start a new cycle" over and over (and pay for it each time); winding it
  forward used to stuff the jump into the Time Bank. Neither happens now. Time away while the game
  is closed is unaffected — that still uses the real clock, as it should.
- **The Shop slides aside while you place something (CR3-402).** Carrying a Shop item out over the
  playmat now slides the Shop drawer out of the way so you can see where you're dropping it, and it
  slides back the moment you move back over the drawer — not just when you let go. Letting go back
  over the drawer still cancels, as before. Separately, with the Bank open, the playmat it was
  hiding is confirmed to take no clicks or drags at all, the same as it looks.
- **The hero dock shows the heroes (B10, FB-46).** Heroes stand in a dark strip under the mat, idling
  and seen from the waist up, with their name and health bar above their heads. Heroes out on the
  mat are darkened and lowered; hovering lifts a hero. Click and drag work as before.
- **The Guild Hall upgrade web (B9, TL-23).** The Hall screen is a web: the Guild Hall in the centre,
  upgrades around it joined by lines, lit gold where bought; an upgrade opens once anything linked
  to it is bought. The Effects list sits on the left. The 7×7 grid is gone.
- **Small Tokens (B8, TL-19, FB-18).** A Token can be Small in the CMS: half-size art, hit area and
  spacing, with full-size ring badges. The Oak Sapling, Apple Sapling and Wheat Sprout are small.
- **Goblins are hostile (B7.3).** Goblin and Goblin Chief now attack heroes near their camp; Cow and
  Thorn Elemental still fight only when attacked. Set through the CMS.
- **Hostile enemies and fight-back (B7.2, TL-16, TL-24).** An enemy marked Hostile (a new CMS
  checkbox) attacks a hero that comes within a flag's radius of its spawner. An attacked hero
  always fights back, whatever its rules say, then returns to its work.
- **Enemies move (B7.1, TL-16).** Enemies wander near the spawner that made them, walk after it when
  you move it, walk back if you drag them away, and stand still while fighting.
- **Quest Token UI (B6.2, FB-41, TL-18).** Hover a quest Token to read it: title (tagged
  *Tutorial* for a tutorial step), instruction, what's still needed, the reward, and "Click to
  claim" once done. Its progress stands in a parchment ring under it (`3/10`); a done quest glows
  gold until clicked, and clicking it claims (disallow mode never claims). The Quests section is
  gone from the notification column, and the tutorial highlights read the tutorial quest Token.
- **Quest Tokens engine (B6.1, FB-41–FB-43, TL-18).** Quests are Tokens now: the Guild Hall spawns
  them beside itself (spawned, so they never count toward the Token cap). Bounties arrive every 3
  minutes of game time up to 2 on the mat; a new Hall upgrade, the Notice Board, adds one a rank
  up to 5. The tutorial starts with its first step on the mat and brings the next one when a step
  is claimed. Claiming a finished quest drops its reward as loot beside it and the quest vanishes;
  bounties can be binned and discarded (no refund), tutorial steps can't. An older save's quests
  move onto the mat with their progress. No quest screen yet (B6.2): the sidebar is now empty.
- **Flags: no hitbox, and pinning (B5, FB-44, FB-45, TL-17).** A flag no longer blocks the pointer
  for a Token behind it. Drop a hero's flag onto a Token it can work to pin it there: the hero
  works only that Token, the flag moves with it, and when it runs out the flag stays as a normal
  area flag. A Token the hero can't work, or a spawner, just gets an area flag (with the hero
  saying why, for skill or level).
- **Shop: drag to buy (B4, FB-25, FB-27).** The Shop is a drawer from the left edge. Drag a Token
  onto the mat to buy it there; the drawer slides away to a thin lip while you drag. Tokens you
  can't afford or fit are dimmed and say what's missing. The Buy buttons and the Shop tab in the
  bottom drawer are gone.
- **The discard bin (B3.2, FB-34).** At the foot of the notification column: drag Tokens from the mat
  into a grid of nine slots (each shows the Token), drag any back out, see the refund, and press
  *Discard all (n)* to discard them and collect it. The inspection panel's Remove button is gone.
- **Discard bin engine and refunds (B3.1, TL-13).** Tokens can be held in a bin of nine off the mat
  (still counting toward the cap), taken back out unchanged, or discarded together for a refund:
  half the price of a bought Token, a charge-weighted half for consumables, half the Foundation and
  half the build cost for a built station, nothing for spawned Tokens. Built stations now remember
  what they were built from. No screen yet.
- **Disallow mode and Allow all (B2.3, FB-32).** A *Disallow mode* button in the bar: while it is
  on, the mat has a red dashed edge, clicking a Token heroes can work flips it allowed or
  disallowed, and nothing on the mat can be dragged (the dock and the Bank still can). Esc or the
  button ends it. *Allow all (n)* lets heroes work every Token again, at once.
- **Upkeep moves to the bar (B2.2, FB-29).** The bar shows `Upkeep 6/min`, every ongoing item
  cost added up, and hovering it opens the full Upkeep Summary. The Bank drawer's Upkeep toggle
  is gone.
- **A bar above the playmat, with the Token cap (B2.1, FB-28, FB-31).** A slim wooden strip over
  the mat holds mat controls. It shows `Tokens 7/12` (placed Tokens against the cap, the Guild
  Hall not counted), and hovering it lists placed Tokens by type with a red note for blocked or
  disallowed ones, then the spawned Tokens, which don't count. The Time Bank widget now lives in
  the bar (still switched off).
- **Spawner count and turn countdown become rings (B1.3, FB-5, FB-14).** A spawner's `3/5` is a
  green ring that fills to its cap, and a Coast's countdown a sky-blue ring that empties toward its
  next roll. Both always show, last in the ring row, and the corner badges they replace are gone.
- **Ring badges replace the progress bar (B1.2, TL-22, FB-3, FB-4).** Under a worked Token and its
  hero, one row of rings: the cycle (fills, seconds left inside), charges (empties, charges left)
  and, in a fight, the enemy's HP. The row centres under the pair, whichever side the hero stands.
  A blocked Token's cycle ring greys out. Hovering any Token with charges shows its charges ring;
  the old hover charge chip is gone.
- **A worked Token's problems move to its centre (B1.1, TL-22).** Need Items, Wrong Skill, Level
  Too Low and the rest are no longer labels on the progress bar: they are the red or yellow mark
  at the Token's centre (TL-14), staying until fixed. Hovering the Token opens the mark's bubble
  with the hint sentence and what is missing, wrapped to a readable width. The missing list now
  reads a station's chosen recipe, so a Furnace short of ore finally names the ore (the old bar
  never did). The bar hides while its Token is blocked; ring badges replace it next.
- **First pacing pass (Q9, FB-19).** Early gathering (Oak Tree, the three veins, Ripe Wheat, Apple
  Tree, Shrimp Coast) is tagged Quick and runs at 3 s (Coal Vein 4 s, where the calculator moved
  it); Oak Tree and the veins drop to 5 charges and Apple Tree to 3. Copper Ingot, Shrimp and Apple
  Juice are tagged Fast and run at 8 s; Charcoal, Torch, Copper Nails and Copper Pickaxe are tagged
  Fast at 6 s; the four builds and two plantings are tagged Heavy at 30 s. XP per cycle and item
  values re-derived from the new times: most of these producers now give 1 XP a cycle instead of
  2, and coal, the three seeds, raw shrimp and the ingots are cheaper (coal 4 → 1 g, copper ingot
  14 → 10 g).
- **A fifth tempo, Quick, and a wider Fast (TL-21).** Tokens and recipes can now be tagged
  *Quick*: 2–4 s at level 1 (a sync places a tuned producer at 3 s). *Fast* now reaches down to
  4 s (4–12 s, middle 8 s, was 8–12 s) so the bands still join up; Medium, Slow and Heavy are
  unchanged, and all scale with level by the same rule. Quick sits first in the CMS's Tempo buttons
  and Progression dropdowns, and the simulator's passes accept it.
- **Self-transforming Tokens roll a chance, and show a countdown (Q8: FB-14, FB-15, TL-12).** A
  Token with a *Turns* block no longer turns on a fixed timer: once per cycle it rolls its chance,
  and the Token it became rolls the same cycle and chance to turn back (defaults 1 min and 30%, so a
  Coast flips about every three minutes each way). `turns` is now `{ into, everyMs, chance }`, the
  chance a percent like every other chance in the content files; the old `lastsMs` is retired. The
  mat shows the time to the next roll as a small badge bottom-left (B1 will make it a ring), and the
  inspection panel reads e.g. *Next chance to turn into Shrimp Coast: in 34 s (30%)*. A roll held
  while the Token is in the hand, or won with nowhere to stand, is kept rather than re-rolled; one
  long tick (time bank, advance time) rolls once per whole cycle and carries the rest. The CMS
  *Spawning and Building* section edits the cycle and chance (*Roll every*, *Chance to turn*); the
  content audit checks the chance and warns about a leftover `lastsMs`.
- **The Shop has no inspect panel, and shows prices as item rows (Q7: FB-24, FB-26).** The Shop
  drawer no longer opens an *Inspect* column beside it, and clicking a Token's picture opens nothing;
  the Bank keeps its column. Each price line is now the standard item row used for costs elsewhere
  (icon, name, *have/need*), red when the Bank and the floor hold too few. Buying is unchanged: the
  Buy button, which names what is missing.
- **No hero dock on the Guild Hall upgrade screen (Q7: FB-47).** The horizontal hero dock under the
  board is left out while the Guild Hall upgrades are open, and comes back on the playmat.
- **Guild Hall upgrades show their art again (Q7: FB-40).** The Token art had moved into
  per-family folders (`tokens/upgrade/`, `tokens/chest/`) and the upgrade tracks still pointed at the
  old flat folder, so every upgrade but the Hall drew a broken image. Bunk Beds, Bank Slots, Bank
  Tabs and the Wishing Well point at their art again; Flag Radius has no art of its own and borrows
  the plain hero flag. A test now checks every upgrade's art exists.
- **The QA panel fits the window (Q7: FB-36, FB-37).** The open QA tester panel is capped at the
  window's height, and everything under its title scrolls inside it, so its bottom never runs off a
  short window. The *banner card width* slider is gone from it.
- **Speech bubbles read naturally for a Token that names no skill (Q7: FB-54).** Such a Token used
  to make its hero say *My the right level is too low…* or *I don't have the the right skill…*; it
  now reads *My level is too low to work {token}.* / *I don't have the skill to work {token}.*
- **The Guild Hall tooltip is as wide as its lines (Q5b follow-up).** Each trickle line now fits on
  one row, even with all-caps text on, capped to the window width. The flag tooltip is unchanged.
- **Spawners pay their upkeep from loot on the mat too (TL-20).** A spawner's per-spawn upkeep (a
  Forest's Oak Seed) is paid from the Bank first, then from matching loot lying anywhere on the mat,
  the same way recipe inputs already are. A spawner no longer shows *needs Oak Seed* while seeds it
  would use lie on the floor; the Upkeep Summary counts those seeds (*On the mat*) in its runs-out
  estimate, and the inspection line says *paid from the Bank, then loot on the mat*.
- **The Guild Hall has a proper hover tooltip (Q5b: FB-52).** Hovering the Hall now shows a
  game-styled panel, like the flag's, with its trickle income and a *next in* countdown that ticks
  every second, instead of the browser's plain hover text. It never gets in the way of dragging or
  clicking the Hall or collecting loot beside it, and hides during a drag.
- **Guild Hall trickle pays onto the mat as loot (Q5b: FB-53).** The Hall's seeds no longer go
  straight into the Bank: each payout drops as floating loot beside the Hall, like a gathered item,
  is collected on hover (or by auto-collect when that is on) and flies to the Hall. A full Bank loses
  nothing: the loot waits on the floor. A long fast-forward drops one pile per seed type holding every
  payout, and later drops fold into the pile already there.
- **Speech bubbles sit above the head, and speak up only when it matters (Q6: FB-20, FB-21, FB-22).**
  A hero's bubbles now sit with their tail just above the hero's head at every mat size (they used to
  cover the top of it, worse on a small mat). Everyday lines are gone: a hero no longer says
  *Working at Oak Tree.* on arriving at a job, and an unset station or Foundation no longer makes its
  hero say *Choose a recipe…* / *Choose what to build…* (the gear alone says it, as decided after Q1).
  Problems, level-ups and *No work in range.* still show. Every line a bubble can show, with its
  status, is listed in `docs/speech_bubble_lines.md` for the owner's audit.
- **Heroes in a fight attack once per attack; stuck heroes stand idle (Q6: FB-49, FB-50).** A hero
  fighting an enemy now stands idle and plays its attack animation once each time it really attacks
  (hit or miss), instead of swinging in a loop. The enemy's knockback on a landed hit now waits for
  the moment the blow lands in that animation. A hero on a Token that has a problem alert stands idle
  instead of swinging at nothing, by the same test that stops the Token reacting.
- **A Token left in another's place glows (Q6: FB-51).** A Token spawned *where its bearer stands*
  (for example a Stump left behind) now gets the same glow as a transform. Ordinary spawns keep the
  green notice. No shipped Token does this yet, so it is covered by tests only.
- **Loot flies to the Guild Hall (Q5: FB-16, FB-17).** Collected items now arc to the Guild Hall
  Token on the mat instead of the Item Bank button, following the Hall wherever it has been moved;
  the Hall brightens briefly as they land. If the Hall is not on screen (or is being carried), items
  fly to the Bank button as before. Items stay the size they were on the mat for the whole flight
  (they used to shrink). Banking is unchanged: a full Bank still leaves the loot on the mat.
- **Guild Hall trickle on hover (Q5: FB-30).** Hovering the Guild Hall shows its trickle income, for
  example *1 Oak Seed every 5 min (next in 2 min 3 s)*, one line per item it pays.
- **Hit animations and the transform glow (Q4: FB-10, FB-11).** A Token now reacts each time its hero
  strikes it, timed to the blow in the hero's working animation: Logging shakes side to side, Mining
  jitters, Fishing bobs slowly, Farming sways from the base, Smithing squashes down, Crafting hops,
  Cooking pulses twice, Construction thumps, Explore rustles. In a fight, each landed blow knocks the
  enemy back away from the hero with a brief red flash (a miss does nothing). Only the art moves; the
  Token's spot, badges and dragging are unchanged. When a Token becomes another (a sapling grows, a
  Coast turns, a Foundation is built), the new Token flashes white-gold with a soft glow for about a
  second. Reduced-motion settings drop the movement and keep a simple flash.
- **Alerts after Q2.** The red alert left where a used-up Token stood, and the refused-drop mark, now
  fade after 10 seconds like a notice (neither can be fixed). While the time bank replays time away,
  spawns raise no green notice, so you come back to a calm mat.
- **Layering on the mat (Q3: FB-1, FB-2).** Hero flags now layer like Tokens: a flag standing higher
  on the mat than a Token is drawn behind it, one lower is drawn in front (they used to draw on top of
  everything). The idle hero beside a flag layers with it. While a hero works a Token, that Token and
  its hero draw above every other Token and flag; when the work stops they drop back into place. With
  the pointer on a flag, the Token behind it no longer pops up over it.
- **Corner and centre badges (Q2: FB-5, FB-6, FB-7, FB-8, FB-33, FB-48, TL-14).** The green plus on
  workable Tokens is gone. A station or Foundation with something to choose shows the gear sprite in
  its top-left corner; with nothing chosen the gear pulses gently and there is no red alert (heroes
  still skip it); click the gear to choose. A disallowed Token shows the red disallow sprite top-right.
  Alerts sit at the centre of the Token: problems (red, yellow) stay until fixed or read, while green
  notices, such as a Token a spawner has just made or a restock, fade after about 10 seconds. A problem
  always covers a notice. Spawners show their live count against their cap, for example 2/5.
- **Spawned Tokens that grow can be moved (FB-12).** A Sapling (or a turning Coast) no longer grows
  or turns while you are dragging it, which used to swap it for a new Token mid-drag and lose the move.
  The change waits and happens where you put it down; its grow clock is kept.
- **Stations start with no recipe (TL-15, FB-13).** A station, however it arrives, is idle until
  you pick a recipe; heroes don't work it until then, and it says *Choose a recipe*. A picked recipe
  stays, including across saves; a saved recipe that no longer exists becomes no recipe.
- **Handoff.** The token lifecycle first build is done; follow-up work starts from
  `docs/KICKOFF_token_lifecycle_feedback.md`. Versions stay in 0.8.x (TL-11).
- **Shop purchases always find room.** When the area around the Guild Hall is crowded, a purchase (or
  a Token a station makes) goes to the nearest free spot on the mat instead of being refused.
- **Playtest pack** for the token lifecycle build: `docs/token_lifecycle_playtest_pack.md`.
- **A new game starts with an Oak Forest and a Copper Mine** beside the Guild Hall, and a few Oak
  Seeds, Wheat Seeds and Oak Wood in the Bank. The tutorial is rewritten around the new loop: recruit,
  plant a flag, log, collect, shop, build a Workbench, craft, farm and explore.
- **The Token Vault and Tray are gone.** Tokens live only on the mat: a Token a station makes (such
  as a Copper Pickaxe) is placed right beside it, and waits if the mat is full. The Vault drawer, its
  upgrades and right-click deposit are removed; item loot is unchanged.
- **Enemies drop everything they list.** Each line of an enemy's drops now rolls on its own chance, like
  gathering does, so a Goblin always drops Bones and sometimes Copper Ore as well.
- **Goblin Camps.** Buy a Goblin Camp at the Shop (10 Stone, 10 Oak Wood); it keeps up to 3 Goblins on
  the mat and now and then a tougher Goblin Chief. Heroes with a combat skill fight them for Bones,
  Copper Ore and, from Chiefs, Copper Ingots and Beeswax Combs.
- **Explore a Map; Map bursts are gone.** The Oak Forest Map is sold at the Shop and worked by an
  Explore hero: each trip spends a cooked Shrimp and a Torch for mixed loot (wood, seeds, ore, rarely a
  Beeswax Comb), and the Map is used up after five trips. Buying Maps to burst them open is removed.
- **Fixed: an unfinished recipe requirement could blank the game screen.** A recipe whose nearby
  requirement had no tier yet crashed the display; it is now read as tier 1 everywhere.
- **Processing and academies.** Wood and Stone Foundations in the Shop are built by Construction
  into a Workbench (Charcoal, Torches), Cooking Pot, Furnace (Copper Ingots) or a Fighter's Academy.
  A Copper Anvil bought with ingots lets the Furnace smith Copper Nails and wears out as it is used.
  Cooking burns Charcoal as fuel.
- **Farming.** Buy Farmland at the Shop and have a Farming hero plant it as a Wheat Field or an Apple
  Orchard. Fields grow Wheat that ripens and is harvested three times; Orchards grow Apple Trees.
  Each new plant costs one seed, and harvests sometimes return seeds. The Guild Hall also trickles
  Wheat and Apple Seeds.
- **Managers and the gold code are gone.** Spawners replace used-up Tokens, so Managers, their
  restock spots and the "waiting for a Manager" state are removed; a hero whose Token runs out
  moves on. The retired currency, selling and transaction code is deleted, and saves no longer
  carry gold.
- **Mines and the Coast in the Shop.** A Copper Mine, Coal Mine and Quarry (15 Oak Wood each) grow
  up to 3 veins or Stone Outcrops each, mined without a pickaxe; Stone is a new material. The Coast
  (10 Oak Wood) turns into a Shrimp Coast for a minute every few minutes, fished without a net.
- **Waiting spawners show it on the mat.** A spawner that can't pay its upkeep shows a yellow icon
  naming the missing item; one with no room shows a red icon. Both clear the moment the cause is fixed.
- **The Oak Forest is a spawner.** Buy it at the Shop for 10 Oak Wood; it plants Oak Saplings that
  grow into Oak Trees (up to 5), paying one Oak Seed each. Oak Trees need no axe, last 10 logging
  cycles and sometimes drop an Oak Seed. The Guild Hall gives an Oak Seed every 5 minutes, so a
  Forest never stalls for good.
- **Inspection shows lifecycle state.** Clicking a Token now shows its spawner count and cap, when it
  spawns next or what it is waiting for, how long until it grows or turns, a Foundation's build
  progress, and a trickle's pay.
- **Remove a placed Token.** Tokens you placed (not the Guild Hall, not spawned ones) have a Remove
  button with a confirm step. Removal is permanent and returns nothing; anything a spawner left
  behind stays.
- **Spawners, Foundations and growing Tokens get proper types**, so the content audit no longer
  calls them Tokens that do nothing.
- **Upkeep Summary.** An Upkeep button in the Item Bank shows every ongoing cost per minute, how
  long the Bank's stock will last, which Tokens are waiting for an item, trickle income, and which
  spawners are idle at their cap.
- **Building on Foundations.** A Foundation asks you to choose what to build; a hero with the right
  skill and level then works it, and when the build finishes the Foundation becomes that Token on
  the same spot. Recipes above the hero's level show as locked.
- **The Shop.** The Cartographer is now the Shop: it sells Tokens for items, grouped by skill,
  shows what the Bank has against each price, and places a purchase beside the Guild Hall. It shows
  how many placed Tokens the mat holds against its cap. Maps are still sold below.
- **Spawners and the trickle work.** A spawner Token grows new Tokens around itself on a clock, up to
  a cap shared by every spawner of that kind, paying an item from the Bank per spawn and waiting
  when it can't. A Token can also pay items into the Bank on a clock with no hero (for the Guild
  Hall). The QA panel lists each spawner kind's count and cap. No content uses them yet.
- **Gold is gone from play.** Nothing shows, earns or spends gold: selling is removed, coin loot
  and Markets pay nothing, and quests reward 10 Oak Wood instead of Maps. Maps are bought with Oak
  Wood until the Shop replaces them.
- **CMS: recipes that build.** A Construction or Farming recipe can be marked as built on a
  Foundation kind; its card then asks for the Token it builds, the building cost and the build time.
  Renaming a Token now also updates recipes that output it.
- **Content audit checks spawners, Foundations and the Shop.** Broken references, bad numbers
  and conflicting blocks are reported in plain English in the game's boot audit and in the CMS
  Economy Audit.
- **Tokens can grow and turn on a clock.** Engine support for a Token that becomes another after a
  time (a sapling into a tree) and one that turns into something else for a while and back (a Coast
  into a Shrimp Coast). Every Token now remembers whether the player placed it or it was spawned;
  spawns no longer push placed Tokens, and a Token cap for placed Tokens is in the Mat Tuner. No
  content uses it yet.
- **CMS: Spawning and Building.** The Token editor can author spawners, growing, turning,
  Foundations, shop prices and the Guild Hall trickle, and recipes can be marked as buildable on
  Foundation kinds. Sync to Game now carries all of them.
- **Recruits start with nine skills.** Construction (now a starting skill), and the new Farming and
  Explore join Mining, Logging, Fishing, Smithing, Crafting and Cooking. 
- **Promotion keeps every starting skill.** A promoted hero keeps all nine starting skills and adds
  the class's skills on top: 11 after the first promotion, 13 after the second.
- **Guild Hall upgrades cost items, not gold.** Each rank asks for Oak Wood (a placeholder: rank n
  costs 10 x n). The first recruit and the first Wishing Well rank stay free. The upgrade panel shows
  the price and how much the Bank holds.
- **Dev panel: give item and advance time.** The QA panel can put any amount of any item in the
  Bank and fast-forward the whole game by up to two hours per click.
- **Token lifecycle rework started.** Test baseline recorded and the final data shapes for
  spawners, growing, turning, Foundations, the Shop and the Guild Hall trickle written down
  (`docs/token_lifecycle_roadmap_v1.md` §0.4, §3.1). No gameplay change yet.
- **Hero speech bubbles.** A hero who cannot work their Token now says why in a bubble over their
  head, naming the specific thing: "I need a Pickaxe nearby to work Copper Ore Vein.", "I need Oak
  Wood to work Campfire.", too few charges, skill too low. The bubble follows the hero, never blocks
  the pointer, and clears the moment the problem does. A shortage of items waits 3 seconds before
  speaking. The on-Token alert icon no longer repeats these. Heroes also speak at key moments — starting work
  at a Token, running out of work, levelling a skill — with up to three bubbles stacked over one
  head; moments fade after 5 seconds. Bubbles from crowded heroes slide apart, or lift above one another,
  and stay inside the mat. (`docs/hero_speech_bubbles_roadmap_v1.md`)
- **The Cow animates.** It breathes and shifts in place at rest, turning to look the other way
  every so often, and rears up in an attack pose for as long as a hero is fighting it — facing
  whichever side that hero stands on. The first enemy with sprite-sheet animation; others get the
  same treatment as their art arrives.
- **A worked Token's progress bar hangs in the space below it**, wider than before and always
  visible while a hero works it — no need to hover. It used to hug the Token's bottom edge, a
  leftover from when a hero stood stacked on top; since heroes work from beside a Token, that
  space was sitting empty. The charge count and "assign a hero" badges (still hover-only) now sit
  right at the Token's own edge instead of shifting up to clear the old bar.
- **Saves remember what each hero was working on.** Load a game and every hero who was busy is
  standing back at their Token, carrying on, with its progress bar exactly where it was, which
  matters for Tokens with very long cycles. Heroes who weren't working yet start beside their flag.
- **Idle heroes potter about near their flag.** Instead of standing frozen, a hero with nothing to
  do pauses for a few seconds, strolls to a spot close by, and pauses again, never straying far
  from the flag. Work that turns up comes first. A new **Idle wander** slider in the Mat Tuner sets
  how far they stroll (0 keeps them standing still).
- **Heroes come and go through the Guild Hall.** A hero you send out walks out of the Guild Hall
  to their first job. Recall them and their flag disappears and they're back in the dock straight
  away, but on the mat they walk back into the Hall; send them out again on the way and they just
  turn around. A defeated hero limps home slowly, drained of colour.
- **Heroes no longer jump when they get back to their flag.** Every hero, working, walking,
  waiting or idle, is now one continuous figure on the mat, so walking home ends smoothly
  beside the flag. Heroes standing beside a Token always turn to face it.
- **Heroes walk** (Hero Movement, first slice). A hero now travels across the mat to the Token
  they're going to work, at a steady pace (a new **Walk speed** slider in the Mat Tuner — about
  15 seconds to cross the mat). The job's timer starts only when they arrive. They stop beside
  the Token on whichever side they came from and face it, and **the Token no longer shifts over
  to make room**. With nothing left to do they walk back to their flag. They pick their next job
  by what's nearest to where they're standing, not to the flag. Walking, working and facing use
  the hero's animation where the art exists (Recruit, Fighter, Ranger, Rogue, Wizard).
- **A Token you drop simply stays where you let go.** It used to replay a slide from its old
  spot, so it looked like it bounced over. Tokens the game moves (a push) still glide.
- **Only Tokens that care about their neighbours show a reach ring.** Tools, Tokens that need a
  tool nearby, buffs, Managers and "Cannot sit beside…" Tokens show one when hovered or dragged;
  plain resources, Maps and the Guild Hall no longer do.
- **Dragging a Token shows the reach of every flag it would land inside**, so you can see which
  heroes could pick it up before you let go.
- **The guild holds at most 8 heroes** (was 12). Bunk Beds now has 8 ranks at the same prices.
  A save that already has more heroes keeps every one of them, but can't recruit more.
- **Tokens no longer vanish into the retired Tray** (Free Playmat cleanup, 2026-09-21). The Tray
  was taken off the screen, but five things still quietly put Tokens into it, where nobody could
  see or reach them. Each now does what the playmat plan says:
  - **Right-clicking a Token on the mat sends it to the Vault.**
  - **The Vault's right-click, and the inspection panel's button (now "Place on Mat"), put the
    Token on the mat beside the Guild Hall.** No room there? It stays in the Vault.
  - **Dropping a copy on a matching Token to restock it**, when the leftover has nowhere to stand,
    sends the leftover back where it came from.
  - **Picking up a loose Token goes straight to the Vault.**
  - The QA panel's fill button fills the Vault.
- **Map bursts push their neighbours aside properly.** Tokens from a Map land on the mat and shove
  crowding Tokens outward — never into a spot a "Cannot" rule forbids, and never the Guild Hall a
  burst comes out of. If a push can't be done, the Token lands in the nearest free space instead;
  with no room anywhere it drops to the floor as loot rather than being lost. (The pushing that
  arrived with this work never actually succeeded — every burst fell back to "nearest free space".)
- **The Vault is open from the start** (FP-62). It used to wait for the tutorial step "Place a
  Dropped Token", which can no longer happen now that Map Tokens land on the mat.
- **Tutorial 5 is now "Move a New Token"** — drag one of the Tokens your Map just produced. Saves
  already on the old step pick up the new one when loaded.
- **"Requires an nearby Pickaxe" reads "Requires a nearby Pickaxe"** again, and the CMS writes
  "nearby" too — its description writer still said "adjacent", so the next Sync to Game would
  have put the old word back in every Token's description.
- **The Scouting Flags upgrade takes effect at once**: flags re-check for work and the reach ring
  redraws the moment a rank is bought, and the bonus is part of the save.
- **Free Playmat (Slice 1.10):** Renamed "adjacent" to "nearby" throughout the game interface and rules to match the new playmat mechanics.
- **Free Playmat (Slice 1.11):** Finalized tuning defaults and bumped versions for the v0.8.0 release.

- **The playmat can change size while you play** (Free Playmat slice 1.6d, third part). The
  developer Mat Tuner has a new **Mat size** slider — 6 to 20 steps, shipping at 11, which is
  exactly the mat you have now (1760 × 1126). The mat keeps its shape as it grows and shrinks.
  What happens when you move it:
  - **Growing the mat moves nothing.** Everything stays exactly where you put it, with more
    bare mat around it.
  - **Shrinking it pulls stranded Tokens back inside**, and spaces them apart from their new
    neighbours by the same rule a hand-placed Token follows — so they come back in tidy rather
    than in a heap on the edge.
  - **Flags are pulled in but never shuffled sideways**, so a hero keeps working what they were
    working. A spot a Manager owes a Token is pulled in too.
  - **Nothing is ever lost.** A Token with nowhere clear to go stays on the mat, visible,
    overlapping a neighbour, and you are told how many ended up crowded.
  - **New games now stand the Guild Hall in the middle of the mat.** It used to start half a
    step down and to the right of centre — a leftover from the old grid, which had no true
    middle square. Existing saves are untouched; only a brand-new game looks different.

- **The old grid is gone from the code** (Free Playmat slice 1.6d, second part). Nothing looks or
  behaves differently — this slice only deletes things. Underneath the playmat the game still kept a
  hidden grid of 36 numbered squares, and a lot of the engine still asked its questions in terms of
  it: which square is this Token on, which squares are empty, who is working square 14. All of that
  has been deleted. A Token is now known only by its own identity and by where it stands on the mat,
  which is how the playmat has actually worked since the previous slice. The Guild Hall upgrade board
  is a separate diagram, still has its own squares, and is untouched.

- **Tokens now sit anywhere on the playmat** (Free Playmat slice 1.6d, first part). The board
  has no squares left: a Token stays exactly where you let go of it, and you can group things
  as closely or as loosely as you like. What you might notice:
  - **A Token lands where you drop it.** No more jumping to the nearest square — two Tokens can
    sit almost touching (about a third of the old square's spacing apart).
  - **A drop with no room shuffles aside** to the nearest free spot instead of shoving whatever
    was already there. **Nothing on the board is ever rearranged behind your back any more** —
    dropping a Token onto another no longer pushes it away or bumps it to the Tray.
  - **A drop with nowhere at all to go flies back** to where it came from with a short note.
    Nothing is ever lost.
  - **A drop that would break a "Cannot" rule slides to the nearest spot that obeys it**, and
    only flies back if there is no such spot nearby — it tells you which rule refused it.
  - **Dropping a Token on a matching copy still restocks it**, and any charges left over stay
    on the board right beside the copy rather than going to the Tray.
  - **The practice outline is gone.** The mat is now a plain darker surface with a soft rounded
    edge — a placeholder until it gets its proper artwork.
  - **The Tray's mini board is now a small picture of the whole mat**, so placing a Token while
    a drawer covers the board puts it exactly where you point, just as on the real board.
  - **The drag preview ring shows where the Token will really land**, including the shuffle, and
    disappears when there is no room.
  - **A Manager restocking a spot you have since built on** now puts the Token beside it rather
    than on top.
  - New developer Mat Tuner sliders: **Token hitbox**, **Overlap allowed** and **Nudge reach**,
    which change how close the next drop can land.

- **The playmat now draws everything where it actually stands** (Free Playmat slice 1.6c,
  second part). The board is no longer a grid of squares on screen: each Token, hero and flag
  is drawn at its own place on the mat. Dropping, working, fighting and restocking all behave
  exactly as before — only the drawing has changed. What you might notice:
  - **Flags stand exactly where you drop them, and several can share a spot.** They used to
    shuffle sideways in threes, with a "+2" chip hiding the rest; now they simply overlap.
  - **A faint outline shows where Tokens can still land**, on a slightly darker mat. Temporary,
    until Tokens can sit anywhere.
  - **Hovering picks the Token you are really pointing at** — the round art rather than an
    invisible square around it — so two Tokens close together no longer steal each other's
    hover, and the one you point at comes to the front.
  - **A Token's sheet follows it** when it is pushed aside or moved somewhere else.
  - **A spot waiting for a restock shows a grey ghost** of the Token it is owed, with its red
    Restock bar, instead of an empty square.
  - **News about a Token that has just gone** — it ran dry, or a drop was refused — now appears
    at the spot it stood on.
  - Under the hood, the board wakes only the Token a message is about, instead of every Token
    on the mat checking every message.

- **The playmat is now a bigger mat, with today's board sitting in its middle** (Free Playmat
  slice 1.6c, first part). Everything still looks and plays like the 6×6 board, drawn in the
  centre of a wider mat, and every drop on the board now lands at the point you let go. What
  you might notice:
  - **A flag stands exactly where you drop it** — from the Dock, or dragging a flag or a hero
    already on the board — instead of jumping to the middle of a square.
  - **A Token dropped well outside the board area flies back** with a short note, "Place inside
    the play area for now." This is temporary, until Tokens can sit anywhere.
  - **Loot sparkles and Map bursts start from the right spot on smaller windows.** They used to
    start further from their Token the more the board was shrunk to fit.
  - **A Map that cannot be put on a square goes back where it lay**, not to the top-left corner.

- **Fights, promotions, rules, spawned Tokens and the board's messages now follow each
  Token itself, not the square it sits on** (Free Playmat slice 1.6b, second half). This
  finishes moving the game's rules off squares — the next step towards placing Tokens
  anywhere. The board still looks and plays as before. What you might notice:
  - **A monster you move in the middle of a fight keeps its injuries**, and a promotion
    offer stays with its training Token wherever you put it — both now simply belong to
    the Token.
  - **Loot from a Map that has nowhere else to come from now flies out of the Guild Hall.**
    It used to come from a square in the bottom-right corner, a leftover from the old
    7×7 board.
  - **A "Converts" rule with several matching destinations now picks the nearest one**,
    and only on a tie the one put on the board first.
  - **"Spawns on the nearest free tile" now measures straight-line distance**, so a free
    square directly beside the Token wins over a diagonal one; **"Spawns on a random free
    tile" now prefers roomier spots** over ones crowded by neighbours.

- **The game's "what is near this Token?" rules no longer think in squares** (Free Playmat
  slice 1.6b, first half). Buffs, tools and context beside a station, tool wear, Managers,
  neighbour triggers, "Cannot" placement rules and the way a flag picks its hero's job now
  all look at each Token itself and its position on the board, instead of the square it
  sits on — the next step towards placing Tokens anywhere. The board still looks and plays
  as before, with one small difference: **when two choices are exactly tied** — two
  Managers equally close to an empty spot, two equally near jobs for a flag, or a
  conversion with two matching destinations — **the one put on the board first now wins**,
  where before the one on the lower-numbered square did.

- **The save format has changed, and new games start with the Guild Hall already on the
  board** (Free Playmat slice 1.6a). Behind the scenes the board now remembers each Token
  by where it sits rather than by which square it is on — the groundwork for placing
  Tokens anywhere. **Saves from earlier versions will not load**; start a new game. A new
  game now opens with the Guild Hall standing on the board and an empty Tray, instead of
  the Hall waiting in the Tray. Everything else plays exactly as before.

- **Flags you move, in each hero's own colour, with a rules panel** (Free Playmat slice
  1.5b, second half — still on today's grid).
  - **You never move a hero, only their flag.** Dragging a hero on the board now picks up
    their flag: drop it on another tile and the flag moves there, and the hero goes
    straight to the best job near it (they appear at it; walking comes later). The hero
    stays where they are while you carry the flag. Dragging a hero out of the Dock still
    sends them out, and dropping a flag (or a board hero) on the Dock still calls them home.
    Right-click a hero to call them home and left-click for their sheet, as before.
  - **Flags use the new flag art**, drawn at the same 128 px size as heroes. The flag stands
    at the bottom-left corner of its tile, with the cloth over the left of the Token so the
    charges number stays readable. Clicking an empty part of the flag picture reaches the
    Token underneath.
  - **Every hero has their own flag colour**, given the first time they plant a flag (a
    colour nobody else has, while there are colours left) and kept for good — reordering the
    Dock does not change it, and it is saved. Change it in the **Edit Hero** window, which
    now shows the eight flags to choose from.
  - **A small gear on the flag opens that hero's rules** in a narrow panel over the
    Notifications column, so the board stays in view. It appears while you hover the flag or
    its hero. Each skill (and Fight, for heroes who can fight) has an **Allowed** tick box
    and a priority from **1 (most wanted) to 5**; the job the hero is doing now is
    highlighted, and **Reset to defaults** puts everything back to allowed, priority 3. The
    panel also shows what the hero is doing and why their flag skipped nearby Tokens. Rules
    are the hero's, so the panel keeps working after they are called home ("In the Guild").
  - **An idle hero stands beside their flag** at full size, with a "…" on the pole; the
    flag keeps its colour.
  - **Several flags on one tile** spread out to the right, earlier flags in front; past
    three, a "+N" badge counts the rest.

- **Heroes work anything they can near their flag, by their own rules** (Free Playmat slice
  1.5b, first half — the engine; the rules panel, flag sprites and new dragging come next).
  - **A flag no longer has a skill.** A hero now works any Token near their flag that uses a
    skill they have, and fights any enemy near it if they can fight. The skill drawn on the
    pennant and the skill menu you got by clicking the pennant are gone; the pennant's
    hover note now starts with just the hero's name.
  - **Each hero has rules**: every skill (and Fight) can be switched on or off, and given a
    priority from 1 (most wanted) to 5. Everything starts switched on at priority 3. A hero
    takes the nearest job of their best priority that can actually run, and only drops to
    the next priority if none can. Rules belong to the hero, so they survive calling the
    hero home, a defeat and saving. Until the rules panel arrives they can only be changed
    from the browser console (`Game.Flags.setRule(heroId, 'logging', { priority: 1 })`).
  - **Fighting is on by default.** A hero who can fight will fight enemies near their flag
    when that is their best job.
  - **A hero finishes what they are doing first.** If better-priority work appears, they
    complete their current cycle (or win their current fight) and then switch, so nothing
    is lost. Switching a skill off sends the hero away from it straight away.
  - A Token skipped because the hero's rules switch it off says so on hover ("off in
    Aria's rules").
  - ⚠️ **Both reaches are now much shorter: 164 instead of 400 (flags) and 272 (Near).**
    A flag now reaches only the tile it stands on and the four tiles beside it — not the
    diagonals. Everything that works "next to" something shrinks the same way: buffs,
    tools and other Tokens a station needs beside it, Managers restocking, "when a
    neighbour…" triggers and "Cannot" counts all reach only the four side neighbours.
    **Big 2×2 Tokens reach nothing and nothing reaches them** until reach upgrades exist.
    Both reaches will be upgradeable later.
  - ⚠️ If you have ever moved a slider in the **Mat Tuner**, your computer remembers the
    old values: open the Mat Tuner and press **Reset** to get the new ones.
  - Old saves load normally; the skill each flag used to have is simply forgotten.

- **Flags you can see and handle** (Free Playmat slice 1.5, still on today's grid). Every
  choice here is provisional and cheap to change once you have seen it.
  - **A small gold pennant marks each hero's flag**, in the top-left corner of the tile it
    stands on, with the flag's skill drawn on it (crossed swords for a fighting flag).
    Several flags on one tile fan out side by side.
  - **Drag a hero** (from the dock, or off the board) onto any tile to plant their flag
    there. **Drag the pennant** to move just the flag. Drop either one on the hero dock to
    call the hero home. Right-clicking a hero still calls them home too. Heroes and flags
    can now be dropped on any Token, including ones nobody works.
  - **Click the pennant** to pick the skill the flag works: the hero's own skills with
    their levels, plus **Fight** if the hero has a fighting skill. Changing it counts as
    re-planting: the hero drops what they were doing and picks again.
  - **Hover the pennant** to see the flag's reach as a faint dashed gold circle, and a note
    saying what the hero is doing ("Working: Oak Forest", "Waiting for restock: Copper
    Vein" or "Nothing to do") plus up to five Tokens the flag passed over and why ("Iron
    Forge — needs materials"). The circle also shows while you drag the hero or flag, and
    while the hero's panel is open. Hovering a Token lists the flags that passed it over.
  - **An idle hero is quieter.** The bright yellow idle glow is gone. A hero with nothing
    to do is drawn small beside a grey pennant with a "…" mark. A hero stuck on a Token
    shows only that Token's red badge, as before.
  - **"Heroes may work this"** is a new checkbox in a board Token's panel (for Tokens a
    hero could work: resources, stations, enemies, Academies). Untick it and any hero
    working it leaves; the Token shows a dim ⊘ in its corner. A Token restocked by a
    Manager arrives allowed again.
  - **The dock tab says what each hero is doing:** "Working: Oak Forest", "Waiting",
    "Idle at flag" or "Idle in Guild".
  - The "deploy a hero" quest now counts every flag planted, including on empty ground.

- **Fighting, promotion and "don't work this" under flags** (Free Playmat slice 1.4c).
  - **Fighters find their own enemies.** A hero with a fighting flag now fights the
    nearest enemy within the flag's reach, then the next one when that one is cleared
    out, instead of only the enemy right under the flag. They stay with their enemy
    through the short rest after each kill. A cleared-out enemy camp that a Manager can
    restock from the Vault is waited for, just like a spent Forest.
  - **A hero with no fighting skill ignores enemies.** They no longer stand on an enemy
    doing nothing under a red mark; the enemy just isn't picked (the reason will show on
    hover once flags get their own display).
  - **Moving an enemy mid-fight keeps its wounds.** Drag it, or shove it aside with
    another Token, and the fight carries on where it was.
  - **Recalling a hero, or moving their flag off the enemy, ends the fight at once**, and
    the enemy is back to full health next time.
  - **One message when a hero is defeated**, saying who fell and what was lost (for
    example "Aria was defeated and carried home, injured. Lost: Iron Sword."), instead of
    separate "wounded" and "destroyed" pop-ups. Their flag still comes down.
  - **A "not yet" on a promotion stays a "not yet."** The Academy no longer asks again
    just because the hero briefly stopped working it. It asks again when you drop a
    hero onto it (the same hero or a different one). After accepting, the hero goes back
    to ordinary work instead of standing on the Academy, and doesn't wait around for a
    replacement Academy they have no use for.
  - **Any Token can be marked "heroes may not work this"** (no button yet; developers can
    use `Game.Flags.setDisallowed(tile, true)` in the console). A hero working it leaves
    at once and its progress resets. Everything else about the Token keeps working: its
    bonuses, its triggers, and Manager restocking. The mark is saved with the game, and is
    dropped if the Token goes into the Vault.

- **Heroes now hold flags and pick their own work** (Free Playmat slice 1.4b). Dropping a
  hero on the board plants their flag there. The flag works one skill and looks within a
  radius (400 by default, adjustable as "Flag radius" in the developer Mat Tuner), and the
  hero works the **nearest Token they can run**. Dropping a hero on a Token still works it
  when they can: it is the nearest thing to the flag. On a Token whose skill the hero
  doesn't have, the flag keeps the hero's own skill and they work something else nearby.
  What changed in play:
  - **One hero per Token, and nobody gets pushed any more.** A second hero dropped on a
    worked Token looks for other work instead of shoving the first hero aside.
  - **A hero sticks with their Token.** Once working, they stay until it stops being
    workable, you move their flag, or you recall them.
  - **Moving a Token carries its hero, and its progress is kept** — even if you move it
    out of the flag's reach. Anything that makes a hero leave a Token (moving on,
    re-planting, recall) resets that Token's progress, as before.
  - **Tokens with no skill are no longer worked.** The 17 bushes, fruit trees and other
    Tokens the content check lists won't be worked until their skill is chosen in the
    CMS. Enemies, Promotion Tokens and the Guild Hall are exempt; the Hall is worked only
    when a flag is planted on it.
  - **Skipped Tokens:** a hero passes over a Token they can't run and tries the next. If a
    Token is stuck for a reason you can fix (missing materials, too few charges, a missing
    Token beside it), it keeps its red mark, and you get **one** message when a hero goes
    elsewhere because of it. A hero already working a Token that runs short stays put
    until something else nearby can run. "Skill too low" shows no red mark.
  - **Waiting for restocks:** when a hero's Token runs dry and a Manager nearby will
    restock it from a copy in the Vault, the hero waits on the spot and carries on with the
    new Token. With no Manager or no copy, they move on.
  - **Saves convert automatically:** heroes in an existing save get a flag where they
    stood. Enemies get a fighting flag; a hero who was on bare ground gets their best
    work skill at the first tick.
  - **Fights are unchanged for now:** a fighting flag only fights the enemy it was dropped
    on, and recall and defeat take the flag down. Flags aren't drawn on the board yet (a
    later slice); one hero is shown per tile and the dock shows the rest.
  - Also fixed along the way: dragging a hero from the board onto the dock now recalls
    them (that drop was silently doing nothing).

- **"Applies" now has one way to aim at the enemy** (Effects Grammar V10b). The old
  "on an item, lands on the enemy" setting is gone; "aims at: the enemy" (from V10a) is
  the only way. Anything still saved the old way is converted automatically when the
  game or the CMS loads it, so a Sync can't bring it back. No shipped content used the
  old setting. The rules text is fixed too: an item rule that poisoned the enemy used
  to read as if it hit "heroes on adjacent Tokens"; it now says "to the enemy". The
  content check now warns about any leftover old setting, and about an "Applies" aimed
  at the enemy that also has a filter or reach (which the enemy aim ignores).

- **Rules can now aim at "the enemy"** (Effects Grammar V10a). On a combat moment ("On
  Neighbour's Fight", "On Engaged") a rule's *deals damage*, *heals*, *removes* and
  *applies* can target the creature the hero is fighting; on a monster's own rule, "the
  enemy" is that monster. *Restores* and *Transforms* can't aim there, and outside a fight
  the choice isn't offered. **Items' damage, heal and cleanse rules now actually work** —
  before this they were silently skipped — and like other item rules they use up the item
  only when they do something. The enemy is found by which hero is fighting, never by
  which square they're standing on. **A hero now fights one enemy at a time**: starting a
  new fight ends any other fight that hero was in.

- **Behind-the-scenes groundwork for flags: one place now answers "which hero is on
  this Token"** (Free Playmat slice 1.4a). Damage, statuses, rules, hero gear, filters,
  the board, the hero dock and drag-and-drop all used to look up hero positions on
  their own; they now all ask the board the same three questions (who works this Token,
  which Token does this hero work, where to draw this hero). *Nothing plays
  differently.* This is what lets the next slice swap standing-on-a-tile for flags in
  one place. The hero dock tab was also listening for two event names nothing ever
  sent; it now listens for the real "hero moved" event (it was already refreshing
  through the general state update, so this is a tidy-up, not a visible fix).

- **Crafting, tool wear, Managers, neighbour triggers and "Cannot" now reach the same
  way buffs do** (Free Playmat slice 1.3, FP-41). Every "beside" question in the game —
  whether a station has its tool, which stations a tool wears for, which Manager restocks
  a spent Token, which Tokens hear "On Neighbour's …", and how many Coasts a Coast counts
  — now uses the same **Near** distance as buffs. For ordinary 1×1 Tokens *nothing plays
  differently*. **Large (2×2) Tokens now reach the same way for crafting, Managers,
  triggers and Cannot as they already did for buffs**: the 8 tiles touching their sides,
  not the 4 touching only a corner. Two small changes come with it: where two Managers
  could restock the same spot, the **nearest** one does it (then the lower tile number),
  which only changes whose name is on the "Restocked from" message; and raising Near in
  the Mat Tuner now widens tool service, Manager reach, triggers and Cannot counts too.
  Tool wear is still one charge per station served per cycle, and Managers still restock
  in the exact spot.

- **Fix: board-wide buffs now update everywhere at once.** A rule that reaches "every
  Token on the board" used to refresh only the Tokens near where something changed, so
  far-away Tokens could keep a buff from a Token that had left (or miss one from a Token
  that had just arrived) until the game reloaded. Any change now refreshes the whole board
  while such a rule is present.

- **"Adjacent" is now measured as a distance** (Free Playmat slice 1.2, FP-41/FP-56). Buffs,
  item grants, statuses, damage and "per adjacent" counts now reach every Token whose
  centre is within **Near** (272 units — a tile step is 160) instead of looking up the 8
  surrounding tiles. For ordinary 1×1 Tokens *nothing plays differently*: 272 reproduces
  the same ring exactly. ⚠️ **Large (2×2) Tokens reach less**: measured from their middle
  they reach the 8 tiles touching their sides but no longer the 4 touching only their
  corners, and Tokens beside them measure to their middle too. Two large Tokens side by
  side no longer reach each other. Crafting, tool wear, Managers, neighbour triggers and
  "Cannot" rules still use the old 8 tiles until slice 1.3, so for a large Token those
  can briefly disagree with its buffs. Rule wording still says "adjacent" (slice 1.10).

- **Dev tool: Mat Tuner** (FP-66) — a new developer-only panel (the **TUNER** button beside
  the QA tester, dev builds only) for the free playmat's numbers. Its first setting is
  **Near radius**: drag it and buff reach changes live; the reset button restores 272.
  Like the Playmat Tuner it remembers your setting on this device only — it is never in a
  save — but unlike that panel, this one changes how the game plays while it's moved.

- **Terrain is switched off** (Free Playmat slice 1.1, FP-10). Placing a Token no longer
  paints the ground, bursting a Map no longer stamps its terrain on what comes out, and
  the painted landscape under the board is gone — every tile shows its plain faint
  outline on the table, as a new game always started. The **Playmat Tuner** dev panel,
  which only tuned terrain, is hidden with it. *Nothing is deleted*: the terrain code
  sleeps behind one switch (`TERRAIN_ENABLED` in `terrainRegistry.js`), and saves keep
  any terrain they already hold. The free playmat has no tiles to paint, so terrain
  had to go before free placement; it may come back in a form that suits a free mat.

- **Dev tool: Sprite Animation Studio** — a developer-only viewer for hero animation
  sheets (idle / walk / active rows): playback, frame-by-frame scrubbing, alignment
  guides and onion skinning. Open it from the QA tester panel or with **Shift+A**; like
  the rest of that panel it only appears in development builds.

- **Tokens with no skill are now flagged** (Free Playmat slice 1.0, FP-47). On the free
  playmat a Token a hero works must name a skill or it won't be workable, and 17 Tokens
  (the fruit bushes and trees, the grapevine, the wheat field, the watermelon patch and
  the adamantine ore vein) have none today. They're named in the game's content check at
  startup, on the CMS **Economy Audit** tab after a Recalculate, and at the top of the
  Token's editor. Enemies and Promotion Tokens don't need one. *Nothing plays differently
  yet* — pick each Token's skill under **Work Cycle → Skill**, then Recalculate and Sync.

- **Fixed: Token descriptions said every rule twice** — "Works as a Smithing station.
  Works as a Smithing station." It affected 24 Tokens, every one that uses a library
  effect. The CMS's Recalculate added a Token's library rules a second time before
  writing its description. ⚠️ *The saved descriptions in the game files are still
  doubled until you run **Recalculate** and then **Sync to Game** in the CMS* — the
  descriptions are written by the CMS, not by hand.

- ⭐ **Promotion is playable end to end.** When a hero finishes training on a Token with a
  Promotes rule, a window asks "Wren has finished training. Make it official?", showing
  the old job, the new one, and which skills are set aside and taken up. **Become
  Wizard** promotes and spends the Token's charge; **Not yet** spends nothing, leaves the
  hero where they are, and doesn't ask again until the hero is moved off and back on.
- **An unanswered offer survives saving and reloading.** Load a game where a hero was
  waiting to be asked and the window opens again. An offer you said "Not yet" to stays
  quiet.
- **The Change Job screen shows the same skill trade** as the promotion window, so the
  two always agree.

- ⭐ **Heroes train on Tokens with a Promotes rule.** Stand a qualified hero on Wizard
  Academy or Fighter's Academy and they train for a cycle (30 seconds unless the Token
  sets its own time). When it finishes, the game offers the job. Nothing about the hero
  changes until the offer is accepted.
- **The Token is the price.** Accepting spends the rule's charge cost — one charge
  unless you change it in the rule's cost line (0 makes an academy that never wears
  out). A Token that can't pay won't start training and shows the charges warning, and
  a hero who doesn't meet the skill requirement won't start either.
- **Promotion no longer costs gold or materials**, and the **Change Job screen now only
  plans**: it still shows every job and what each would cost the hero in skills, and
  tells you to promote on the board. It can no longer change a hero's job itself.
- ⚠️ *Not yet playable end to end:* the window that asks "become a Fighter?" arrives in
  the next phase. Until then a hero who finishes training waits on the Token.
- **Two re-training tests switched back on.** They had been skipped on a note claiming
  advanced promotion didn't work; it always did.

- ⭐ **Wizard Academy and Fighter's Academy now carry Promotes rules.** They were
  authored with an older "promotion" setting that the game never read. Each now has
  a library effect, *Wizard Training* and *Fighter Training*, reading "Promotes the
  hero to Wizard." and "…to Fighter." Nothing you authored was lost. *Still no
  training happens on the board — that is the next phase.*
- ⚠️ **Reload the CMS before your next Sync to Game.** A CMS page opened before this
  change still holds the old setting. Reloading converts it the same way; syncing
  without reloading would write the old setting back.

- ⭐ **New rule: "Promotes the hero to Knight."** A Token can now carry a rule naming
  the job it trains heroes into. Click the job to pick any job a hero can be
  promoted to. It's offered only on Tokens: an item's New rule menu leaves it out,
  and an item given one anyway says it does nothing there. A Token carrying it is
  now its own "promotion" type. *The rule doesn't train anyone yet — that arrives
  with the engine in a later phase.*

- ⭐ **Tokens and items edit their own rules in place.** On a Token or item, an effect
  only it uses now shows the same clickable sentence and cost line as the effects
  library, so you can change it without leaving the Token. An effect shared with
  other Tokens or items still shows as plain text with "shared" and an Edit button,
  so you can't change the others by accident. One help panel appears beside
  whichever rule you're editing.
- **Requirements read as sentences.** "Requires an adjacent Tier 1 net." is now
  edited by clicking "1" or "net", with "Satisfied by" still shown underneath. The
  old Capability and Min Tool Tier boxes are gone.
- **The duplicate "Rules Text" section is gone** from the Token and Item editors. It
  printed the same sentences a second time.
- **Fixed: a shared effect that applies another effect showed that effect's internal
  id** instead of its name on the Token and Item editors.

- ⭐ **A rule's cost now reads beside its sentence.** Under each rule, one quiet line
  says what the rule's rules text doesn't: "spends 1 charge each time it fires ·
  no cooldown · consumes 1 Coal every 30 seconds". Click any underlined part to
  change it in the panel. This replaces the separate "Charge cost" and "Costing"
  boxes. A cooldown moves into the sentence itself once it has one, so it's never
  shown in two places.
- **Fixed: retyping a cooldown used the wrong unit.** The sentence shows seconds, but
  typing a new number stored milliseconds, so "10" became a hundredth of a second
  and the rule read "every 0 seconds". It now takes seconds.
- **A charge cost reads the way you'd say it.** You type how many charges a rule
  spends (1, not −1), and a minus sign gives charges back.

- ⭐ **The old forms under each rule are gone.** Every rule in the effects editor is now
  just its sentence: what an item grants and how often, which skill a station works,
  a tool’s tier, a Manager’s Tokens, a limit, a chance — all edited by clicking the
  word in the sentence, or from the small row of extra choices underneath it. The one
  exception is a conversion, which keeps its two item lists as a table. Picking an
  item from a search can still create a new one when it doesn’t exist yet.
- **“Applies” now offers your library effects only.** The old statuses are no longer
  offered for new rules. A rule that still names a status keeps working, and clicking
  it lets you swap in an effect.
- **Scoping a bonus to a skill works from the sentence.** “…but only for Mining work”
  could previously only be set through the old form.

- ⭐ **The rules editor's help panel sits on the left and follows you.** One panel
  now serves every rule in an effect, stays in view as you scroll, and shows
  what can go in whichever word you're on. On a narrow screen it moves above the
  rules instead of overlapping them.
- ⭐ **Rules can be edited from the keyboard.** Tab jumps to the next underlined
  word and opens it; Shift+Tab goes back. Anything valid you typed is kept on the
  way; anything that isn't a real word is simply dropped. The Up and Down arrows
  move through the panel's list, and Enter takes the highlighted option.
- **Blanks open a search.** Clicking a "…" asks you to pick, and long lists — like
  every item in the game — show 30 at a time with a count, narrowing as you type.

- ⭐ **Rules are edited by retyping their words.** In the effects editor a rule
  is now one line — the exact sentence the game prints — and every word that
  stands for a decision can be clicked. Click the "2" in "deals 2 damage", type
  5, press Enter, and only that word changes. A word the game doesn't know
  changes nothing and offers the closest real words instead. A number keeps its
  direction when retyped, so "work 5% faster" stays faster unless you type a
  minus or plus sign. Decisions the sentence doesn't mention yet, like "ignores
  armour", sit in a small row underneath, and the two extra copies of the
  sentence the old editor showed are gone.

- ⭐ **A rule now opens with a short tag instead of a sentence.** "On Cycle:
  deals 2 damage to the hero" rather than "When this Token's own cycle
  completes, …". All twelve moments read this way — On Cycle, On Start, On
  Depleted, On Engaged, On Tick, and the neighbour equivalents — so a rule's
  opening stops eating half the line.

- **Rules text reads like English, not like the engine.** A Token that works
  faster now says so — "Makes adjacent Coast Tokens work 5% faster" rather than
  "Provides 5% less work time". Upkeep is its own line and says "consumes"
  rather than "costing", and no label shouts in capitals any more.
- ⚠️ **Three rules were describing themselves backwards.** A rule that *reduced*
  a Token's failure chance read as one that *caused* it, and removing a
  double-loot bonus read exactly like granting one — the minus sign was being
  thrown away before the sentence was written. A bonus-drop rule also refused to
  say which item it dropped, though it always dropped the right one.

- ⭐ **Monsters can carry effects too, not just suffer them.** A monster can be
  poisoned, or be given armour that lasts a while, using the same named effects
  everything else uses. Effects on a monster last as long as the fight — walk
  away and it is whole again. Damage from a rule now respects a monster's
  armour, and "ignores armour" works on that side too.
- ⭐ **"Leave a Stump behind when this depletes" can now be written.** A Token
  can react to spending its own last charge — the square is already free by
  then, so something else can take its place. Rules on that moment cost nothing,
  because the Token has already spent everything it had.
- **Rules text uses the game's words.** "The actor" is now **the hero**, "this
  entity" is **itself**, and "the entity that caused this" is **that Token**.
  Nothing about what the rules do changed — only what they call things.

- ⭐ **Every status is now authorable as an ordinary effect.** Poison, Burning,
  Bleed, Armor Shield, Well Fed, Cookout and Stun can all be written in the
  effects editor like anything else — three as damage on a clock, four as a
  bonus that lasts a while. The four that last needed something new: an effect
  you are carrying can now change your numbers, not just hurt you.
- **A damage bonus can be a percentage**, so "+10% damage for a while" is
  something you can write down rather than something only code could do.
- ⭐ **Tokens can leave things behind, and become other things.** A felled tree
  can leave a Stump, a watered Sapling can become an Oak. Where a spawned Token
  lands is something you pick — this tile, the nearest free one, or a random one
  — and the rules text says which, so it is never a hidden rule.
- **Rules can heal, repair and cleanse.** A spring that mends whoever works it, a
  Token that gives itself charges back, a shrine that lifts a curse — all
  authorable, all with the same targeting as everything else. A heal never
  overheals and a repair never pushes a Token past what it was built to hold.
- ⭐ **Effects can stay on a hero and keep acting.** A poison, a regeneration, a
  buff that lasts half a minute — all authored as ordinary named effects with a
  clock on them, rather than as a separate kind of thing. Applying the same one
  twice refreshes it rather than stacking, and a stronger version replaces a
  weaker one.
- ⭐ **One effect can set off another.** Give it no duration and it fires
  immediately, which is how a combo is built.
- **A rule can check what a hero is already under** — "every adjacent Token whose
  hero is not already poisoned".
- ⭐ **A rule's number can be worked out rather than typed.** Damage equal to 10%
  of the target's maximum health, or one point per adjacent Coast Token — so an
  effect can stay meaningful as heroes grow, or reward how you have arranged the
  board.
- ⭐ **Rules can be narrowed, and stacked.** A rule can now say *which* of the
  things in range it actually hits: tagged something, working as a station,
  running low on charges, or currently being worked — as many as you like, and
  any of them can be flipped to mean the opposite.
- **Rules can now react to a Token's live state**, not just to what it is. A
  buff that only helps Tokens somebody is actually working is authorable.
- ⭐ **Rules are written as sentences now, not clicked through dropdowns.** A rule
  is a row of words you type into: click any part, start typing, and only what
  fits there is offered. Beneath it sits the sentence the rule will actually
  read as. The nested picker boxes are gone.
- **A panel under the rule lists everything that can go where you are.** With its
  explanation, so the parts of the vocabulary you have not used yet are
  discoverable rather than hidden behind knowing what to type.
- **Changing a rule's verb rebuilds it properly**, instead of leaving the
  previous verb's settings stranded behind the new word.
- ⭐ **Rules can now hurt somebody — and Thorns exists.** A rule can deal damage
  to whoever just harvested or fought the thing carrying it. Author it once, name
  it Thorns, and put it on a monster *and* on a berry bush: the same entry works
  on both, because winning a fight and finishing a harvest have always been the
  same event underneath.
- **Thorns damage respects armour, and heavy armour can stop it outright.** Tick
  "ignores armour" for a rule that should pierce regardless.
- **A rule's price is set where you assign it.** The same effect can be free on
  one Token and cost a charge on another.
- **The editor stops offering targets a rule cannot reach.** Pick "when a
  neighbour runs out of charges" and "the actor" is simply not in the list —
  nobody acted, a Token ran dry. If a rule is already aiming somewhere
  impossible, it says so.
- **The rules text stopped shouting your proper nouns down.** It read "this
  token's own cycle" and "the bank"; Token and Bank keep their capitals now.
- **Rules can tell who did something to them.** Groundwork, invisible on its own:
  every firing moment now says which participants it has — the entity itself, the
  hero who caused it, the neighbour it happened to — so a rule will shortly be
  able to say "whoever just harvested me". Two moments were quietly missing that
  information and now carry it: a Token beginning a cycle, and a fight ending.
- **Gear can make a hero immune to a status.** Poison, Burning, Stun and the rest
  can be blocked outright by an item — the game has asked whether a hero is
  immune every time a status landed, since the day statuses were built, and
  nothing could ever say yes. Pick which status; it stops new stacks landing and
  never strips ones already carried.
- **A rule can apply to one skill only.** "+10% yield, but only for Mining work"
  — the machinery has been running on every cycle for months with no way to write
  it down.
- **The editor stops offering settings a rule cannot use.** A combat or immunity
  rule reaches a hero, never a tile, so it no longer shows a reach or a target to
  set.
- **A rule can now say how far it reaches — including "just me".** Every rule in
  the game reached the eight surrounding tiles and nothing else, and never the
  Token carrying it, so a Token could not improve its own work or put a status on
  the hero standing on it. A rule now picks one of four: adjacent Tokens (what
  every rule already meant), this Token only, this Token and its neighbours, or
  every Token on the board. The rules text says which, in words.
- ⚠️ **A board-wide rule is not capped.** It touches everything you own, and a
  second copy of that Token doubles it. The editor warns you; nothing stops you.
- **Nothing you have already authored changed.** A rule with no reach set still
  means "adjacent", so every Token on your playmat behaves exactly as it did.
- **A rule that fires now lands where its sentence says it lands.** A triggered
  "grants an item" rule was ignoring the target you gave it and dropping the
  item on the Token that fired instead — so a rule reading *"grant 1 Copper to
  any adjacent Forge"* put the copper on itself. It now reaches the Tokens it
  names, and a target that matches nothing correctly grants nothing. No shipped
  Token was affected: every authored grant is the untriggered kind, which has
  always aimed correctly.
- **A conversion can send its output to a neighbour.** A Sigil that turns Stone
  into Bricks can put them on the Kiln beside it. Unlike every other rule this
  one picks a **single** destination — the nearest match — because a conversion
  spends a fixed input, and producing onto all eight neighbours would multiply
  what you get without multiplying what you pay. Leave the target alone and the
  output lands where it always did.
- **The content check now catches a rule aimed at something it cannot aim at**,
  which is the shape of the bug above.
- **Every rule in the game now has a name.** A Token's rules used to live on the
  Token that used them, unnamed and unshareable. They now live in a **named
  effect library**, and Tokens point at entries in it — so the same rule can sit
  on two Tokens (and, later, on an item or an enemy) without being authored
  twice. Nothing about how the game plays has changed: every Token resolves to
  exactly the rules it had before.
- **The CMS has an Effects screen.** Name an effect, edit its rules once, and
  see which Tokens use it before you change it. A Token's Rules section now
  shows the effects it references, with a "shared x3" badge where an edit will
  reach further than the Token you are looking at.
- ⚠️ **Your CMS workspace migrates itself the first time you open it** after this
  change. Check that your Tokens' rules read right before syncing.
- **Gear and enemies can change combat numbers.** Armor, Resistance, Accuracy,
  Block and Damage are authorable at last — carried on an item they go to the
  hero holding it, and put on an enemy they go to the hero fighting it, so a
  creature can genuinely make its opponent softer. Nothing authored uses them
  yet, so no fight changed.
- **Enemies are a moment you can react to.** A rule can act as a fight begins —
  every fight, including each fresh enemy after a kill, not just the first. And
  a carried item can now put a status on the creature itself: a venom flask
  poisons what you are fighting.

- **Rules can react to a cycle *starting*, not just finishing.** A Token can act
  as a neighbour begins work, or as it begins its own — and a carried item can
  proc at the start of its hero's cycle, so a buff is already up while they
  work rather than arriving as they finish. A Token waiting on inputs has not
  started, and does not pretend it has.

- **Items can carry effects now.** Gear and consumables use the same named
  library Tokens use, reaching the hero holding them, the Token that hero is
  working, or the enemy they are fighting. A pickaxe can raise what a mine
  yields; a potion can put a status on its carrier.
- **A potion is spent from the Bank when it works.** An item's rule can cost
  units of that item — one potion per firing — and a rule costing nothing is
  never consumed, which is how weapons and armour are built. Run out and the
  slot greys: the item stays where you put it and starts working again when you
  restock.
- **Carrying two of the same effect stacks it, up to a limit.** A charm at II and
  a ring at III make one effect at V rather than two separate bonuses, and five
  is the ceiling however much you pile on.
- **The old gear stat system is gone.** It read damage, defense and a hidden
  effect id off items, mapped them through a hardcoded list, and wrote mostly
  into nothing — no item ever used it and the editor had no field for it.

- **Effects say their name when they fire.** When a named effect actually does
  something — a rule triggers, a bonus item drops, a status lands — its title
  flashes above the tile, rises out of its top edge and fades. Nothing to click
  and nothing to dismiss; if you miss one, the rule is still written on the
  Token. Effects that are simply always on stay quiet, because nothing happened.

- **One effect can now be strong or weak.** A Token points at a named effect and
  says how strong its version is — 1 to 5 — so the same *Shrimp Trawler* can sit
  on a Token at full strength and on a potion at triple, without a second entry
  in the library. The rules text says the scaled number, and the effect's title
  carries a numeral: *Shrimp Trawler III*.
- **Rules can cost their Token charges, and you say when.** A rule that fires
  spends when it fires, as before; a permanent one can now be made to cost a
  charge every cycle its Token completes. Setting the cost to **0** is how an
  always-on effect is authored, and everything you have already written stays at
  0 — no existing Token started wearing down.
- **The old `data/effects.json` is gone.** It held 56 placeholder effects from
  the retired card system, read by nothing since CMS-36 deleted the editor that
  wrote them. The filename now belongs to the real library.

- **The terrain blending actually draws now.** It was in the last release but
  painted nothing at all — the effect you could see was the coarser
  tile-level raggedness underneath it. Coastlines now break up at the pixel
  level as intended.
- **Bare earth wears through the grass in patches.** Irregular clumps of dirt
  scattered across meadows and forests, denser where the ground sees more use.
  Dirt is no longer a ground type of its own: farmland, hamlets and diggings are
  grass worn through heavily rather than solid earth, so a ploughed field has
  green surviving between its rows.
- **Trees grow on the grasslands.** Scattered rather than placed on a grid, and
  overlapping correctly — a tree lower on the board stands in front of one
  behind it.
- **Coasts finally have water.** The Coast and the Fishing Net lay down sea
  instead of more sand, so a shoreline has two sides to it. Every tool now
  leaves churned earth wherever it came from.
- **A playmat tuning panel** sits beside the QA tester: coastline shape, how far
  terrain bleeds between tiles, patch coverage and clump size, tree density and
  scatter, and the ground art switch. Developer tool — nothing it changes is
  saved with your game.

---

Older versions (0.7.2 and earlier) are in [`docs/archive/CHANGELOG_pre_0.8.md`](docs/archive/CHANGELOG_pre_0.8.md).
