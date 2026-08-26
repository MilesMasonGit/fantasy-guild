# Changelog

All notable changes to Fantasy Guild are recorded here. Version 0.3.0 is the
project's first tagged baseline — everything before it was untagged development.

## [Unreleased]

### Fixed

- **A quest counter no longer counts one action twice** (2026-08-25, wave 4,
  CR2-085, owner decision 13). Placing a Token, or sending a hero to a Token,
  ticked the matching quest up by **two**. It was invisible because every
  tutorial quest asks for exactly one and the counter stops at the target — but
  any future quest asking for five would have finished at two and a half. The
  cause: the quest tracker listened for *two* announcements of the same action —
  the meaningful one ("a Token was placed") and a housekeeping one ("this square
  needs redrawing") — and counted both. It now listens only to the meaningful
  one. As a bonus, a square being redrawn for some *other* reason — a Token
  running out, being pushed aside, being restocked — no longer counts as the
  player placing one.

- **Two announcements that did not exist now do** (2026-08-25, wave 4, CR2-055,
  CR2-177, owner decision of 2026-08-25). The Tray and the quest tracker each
  asked to be told about something — "the Tray changed", "a Token was placed" —
  by a name the game had never defined. Both requests quietly resolved to
  nothing, so each registered a listener that could never fire. The Tray got
  away with it by also watching the catch-all "something changed" signal. Both
  names are now real: the Tray is told directly whenever a Token is added to it,
  taken from it, or moved within it, and "a Token was placed" is now a named
  event rather than a loose string, so it is visible from both ends.

- **Losing a fight no longer destroys potions that the game never uses**
  (2026-08-25, wave 4, CR2-079, owner decision of 2026-08-25). A hero could
  equip potions, scrolls and runes — and a quarter of each stack was destroyed
  when they were defeated. But nothing in the game has ever *spent* one: the
  code that would fire them at the start of a work cycle has no callers, and no
  item has an effect for it to apply. So the slot only ever cost the player.
  Consumables are now exempt from defeat loss until the mechanic is actually
  built. Food and drink are unchanged — food is genuinely eaten, and drink is
  dormant by an earlier decision of its own. The dormant machinery is left in
  place, unwired, with a note in the code saying so.

### Changed

- **Bank tabs come from the Guild Hall, and from nowhere else** (2026-08-25,
  wave 4, CR2-089, owner ruling of 2026-08-25). Buried in the Bank code were
  four unfinished features — create a tab, rename a tab, delete a tab, drag
  tabs into a new order — that no button, menu or screen in the game could
  reach. Creating one could not have worked even if something had called it:
  the Guild Hall upgrade already fills the tab list right up to its limit, so
  "create" always came back with "tab limit reached — unlock more via Guild
  Hall upgrades", a warning the player could never have acted on. Those four
  are now deleted, and the rule is written down where the code lives: **buying
  the `bank_tabs` upgrade gives you another tab, and that is the only way tabs
  appear.** They are named `Tab 2`, `Tab 3`, and so on, and you cannot rename
  or rearrange them. Nothing a player can do changes, because none of it was
  reachable. Saved games are untouched — the leftover `isCustom` marker stays
  in save files as a dead field so old saves keep loading.

- **The board's tile size is written once, not ten times** (2026-08-25, wave 4,
  CR2-051 residue). Five places worked out where a tile sits on the board using
  the numbers 136 and 68 typed out by hand, instead of the constant the rest of
  the board reads. Nothing was wrong today — the numbers agreed — but they would
  have silently drifted apart the first time the board was rescaled. No
  behaviour change.

- **Two decisions recorded in the docs** (2026-08-25, wave 4). Roadmap decision
  `G-1` ("Hero Speed and Efficiency are deferred", 2026-08-06) is marked in
  `playmat_roadmap_v1.md` as **half superseded**: Speed is live as of owner
  decision 5 (2026-08-19), built 2026-08-25; Efficiency is still deferred. The
  original wording is struck through rather than deleted, with both dates
  visible. And the owner's future plan for **skill milestones at 25/50/75/99**
  is recorded both in the roadmap and beside the code that would change —
  labelled, emphatically, as something that does **not** exist yet.

- **Levelling a skill now actually makes a hero faster** (2026-08-25, wave 4,
  CR2-072, owner decision 5). A hero has always earned a speed bonus for every
  skill level — half a percent each, so a Mining level of 60 is worth +30% —
  and **nothing in the game read it**. It was also filed under the wrong name
  (`MINING` where everything else says `mining`), so even a reader looking for
  it would have found nothing and reported "no bonus" rather than an error.
  Both ends are joined up: the bonus is filed where it can be found, and a
  Token's work cycle is now divided by it. Proved in the running game on a Coal
  Vein — at Mining 1 a cycle takes 11.9 seconds, at Mining 60 it takes 9.2.

  ⚠ **You will not see this in play yet.** No authored Token awards skill XP,
  so nothing levels on its own; the machinery is connected and waiting for
  content (CR2-109).

- **"+10% Cooking XP" is no longer a bonus that does nothing** (2026-08-25,
  wave 4, CR2-073). The function that works out a hero's XP bonus asked for an
  effect named `XP_GAIN`, and the game calls it `XP_BONUS` — so it could never
  match anything and always answered "no bonus". It also had no callers, so
  even correcting the name would have changed nothing. The name is fixed and
  the bonus is now applied wherever XP is awarded, once, so it is worth the
  same however the XP was earned. A small award can be slowed by a penalty but
  never rounded away to zero.

- **A hero poisoned to death is now actually wounded** (2026-08-25, wave 4,
  CR2-070, owner decision 11). A hero taken to 0 health by poison or burning
  while working an ordinary Token simply **carried on working at zero health,
  forever** — the game noticed the death and did nothing but write a line to
  the log. The code that used to handle it went with the deck loop and nothing
  replaced it. Dying this way now costs exactly what dying to an enemy costs:
  wounded, every status cleansed, equipment rolled for loss, carried off the
  board. Deliberately **the same** routine, not a second copy of it — the
  status clock announces the death and the existing defeat code answers.
  Verified in the running game and covered by seven new tests.

- **The red warning marks on the playmat now explain themselves** (2026-08-25,
  wave 4, CR2-156 and CR2-155). Six sentences saying what each warning means —
  *"Nothing beside this station tells it what to make"*, *"This hero doesn't
  have the skill for this work — levelling won't help"*, and four more — had
  been written months ago and were shown to nobody. With no supply dashboard by
  design (D-114), hovering a tile is the **only** way to find out why it has
  stalled, and it said nothing. Hovering a stalled tile now drops down the
  sentence for that warning, under the existing list of what is missing, and
  the tile itself carries the same sentence as a tooltip.

  Half the warnings were not even drawing a mark. Of the six things that can
  stop a tile, only three changed the bar; the other three — hero's level too
  low, hero has the wrong skill, tile ran dry — fell through and left whatever
  was on screen a moment earlier. A hero who lost the skill for their job kept
  a **normal work countdown ticking down** for work that would never finish.
  Every warning now draws its own mark and its own short label ("Level Too
  Low", "Wrong Skill", "Restock"). Verified in the running game on four of the
  six, produced for real by the engine.

  ⚠ Still open for a decision: a tile that **ran dry** has no Token left on it,
  so it has nothing to draw a mark on. Its explanation now reaches the player
  on hover, but there is no red mark drawing the eye to it.

- **A refused quest now says why** (2026-08-25, fix backlog wave 4, CR2-143).
  The quest engine already wrote a proper explanation when it turned a Claim
  or Abandon down — *"Need 4× Copper Ore"*, *"Map limit reached (50/50)"*,
  *"Tutorial quests cannot be abandoned"* — and the quest cards threw it away.
  The worst case was a collection quest whose items you had since spent: the
  Claim button stayed lit and pulsing, and clicking it did nothing at all,
  silently. Both buttons now show the engine's reason as a warning.

- **Bursting a Map on the playmat now reports a refusal like every other board
  action** (2026-08-25, wave 4, CR2-170.1). Every other outcome on the board
  goes through one shared announcer that turns a refusal into a warning; the
  Map burst quietly put the Map back instead. It now uses the same announcer.
  Verified in the running game: bursting a Map still removes it and scatters
  its contents.

- **The save-slot screen no longer shows a close button that does nothing**
  (2026-08-25, wave 4, CR2-135). The shared modal frame decided whether to draw
  its ✕ by comparing the close handler's *source text* against `'() => {}'`.
  The real default was written with a space inside the braces, so the
  comparison never matched and **every** modal drew a ✕ — including the SYSTEM
  BOOT slot-selection screen, which has nothing to close to. The frame now
  takes an explicit answer: no close handler, or the new `hideClose`, means no
  ✕. (`hideClose` was already being passed by the boot screen to a frame that
  did not accept it.) Verified in the running game: the SYSTEM BOOT header now
  has no ✕, and covered by new tests.

- **The Guild Hall upgrade panel has a way out again** (2026-08-25, wave 4,
  CR2-167). The panel was being handed a close handler, but had stopped
  declaring one, so it drew no ✕ — the only exits were picking a different
  tile or closing the whole drawer. The ✕ is back. A locked upgrade now also
  has a place to explain itself: today the adjacency lock stays unspoken on
  purpose (the board already shows which tiles are reachable, so saying it
  again is noise), and the slot is there for the skill gates to come, such as
  *"Requires Blacksmithing 5"*. Covered by new tests; the panel could not be
  reached in the preview harness, which cannot open drawers.

### Changed

- **Housekeeping on props that went nowhere** (2026-08-25, wave 4, CR2-138.3,
  CR2-159 residue, CR2-166). Several components were being handed values they
  do not accept, and the storage drawer handed every one of its panes the same
  five values regardless of which ones that pane reads. None of this was
  visible while playing; all of it made the code read as more connected than it
  was. Each pane now receives exactly what it takes, and the dead hand-offs
  (`engine` to the drag provider, `inspectSelection` and `isRightMenu` to the
  board, `cardTier` and `upgradeId` to the drawer and the upgrade panel) are
  gone.

- **The mini playmat on the Tray now takes the same drops as the real board,
  and stops claiming a tile is free when a big Token is sitting on it**
  (2026-08-25, fix backlog wave 4, CR2-160). The little 7×7 grid that appears
  over the Tray while the Vault is open exists so you can still put a Token
  down when the drawer is covering the playmat — so it is a stand-in for the
  board, and it has to behave like one. It did not. It carried its own
  half-copy of the board's "a Token was dropped here" code, which knew four of
  the six places a Token can be dragged from: **a Map lifted off the playmat,
  and a Token conjured with no source, both landed on it and simply vanished
  into nothing.** Worse, it worked out which squares were full by reading the
  board's own storage, where a 2×2 Token is filed once under its top-left
  square only — so **the other three squares under a big Token drew as empty
  and offered themselves as somewhere to drop.** The board then refused, and
  you got a warning from a square that had looked available. Both surfaces now
  call one shared piece of code
  (`src/ui/components/board/placeTokenFromDrag.js`), and the mini-board asks
  the board engine which squares are full rather than guessing, so it sees a
  big Token's whole four-square area. Verified in the running game: a Token
  dragged from the Tray lands on the playmat through the shared code, and with
  a 2×2 Forge Altar down, the engine reports all four of its squares occupied
  where the old reading saw only one.

- **Every Vault control now accepts the same drags** (2026-08-25, fix backlog
  wave 4, owner ruling; follow-up to CR2-134 / CR2-169). The pending decision
  noted in the entry below has been made: **widen everything to what the Tray's
  gold chest already took.** The Vault pane and the Vault orb in the side bar
  accepted a Token only from the Tray or from a board tile; they now also take
  a loose loot Token off the floor, and a Map. Nothing that worked before has
  changed. What is new: dropping a floor Token on the Vault pane or the Vault
  orb now stores it, and dropping a Map on either now says **"Maps cannot be
  stored — open it."** instead of doing nothing at all and leaving you to
  guess. The rule itself was already shared, so this is only a matter of which
  controls are willing to be dropped on.

- **Putting a Token in the Vault, and taking one out, now works the same way
  whichever control you use** (2026-08-25, fix backlog wave 4, CR2-134 /
  CR2-146 / CR2-169). The rule for storing a Token — "a Map cannot be stored,
  open it", "the Vault is full", and then actually moving the Token — was
  written out four separate times inside the on-screen part of the game: twice
  in the Tray (the gold chest you drop onto, and the right-click menu), once in
  the Vault pane, and once on the Vault orb in the side bar. Four copies of one
  rule drift apart, and these had: **the Tray's chest accepted a Token dragged
  from four places, while the Vault pane and the Vault orb accepted only two**,
  so the same drag succeeded or did nothing depending on which one you aimed
  at. They also disagreed about telling the rest of the game that anything had
  happened — the Vault orb told it nothing at all, which is why the Tray could
  keep showing a Token that had already gone into storage. There is now one
  copy of the rule, in the engine (`src/systems/board/VaultTransfer.js`), and
  the four controls simply ask it and show whatever it says. **The refusals and
  their wording are unchanged**, and *which* controls accept *which* drags was
  deliberately left exactly as it was, pending a decision. That decision has
  since been made — see the entry above.

- **Withdrawing a Token from the Vault no longer counts as two withdrawals**
  (2026-08-25, fix backlog wave 4, CR2-146). Two of the ways to take a Token
  out of the Vault announced the withdrawal to the rest of the game a second
  time, on top of the announcement the Vault itself already makes. A quest that
  asks you to take a Token out was therefore ticked up **twice** for one
  Token. It was invisible until now only because the tutorial's "Stage a Token"
  step asks for exactly one, so the counter hit its ceiling before the second
  tick could show. Confirmed in the running game: one withdrawal now moves the
  counter from 0 to 1, and replaying the two removed announcements moves it to
  2.

### Changed

- **The board's shape is now written down in exactly one place**
  (2026-08-25, fix backlog wave 4, CR2-051 / CR2-104). The numbers that
  describe the playmat — that it is 7×7, that it has 49 tiles, that the Guild
  Hall sits on the middle one, how big a tile is in pixels — used to live
  inside the on-screen part of the code, and the game's board engine reached
  up into the interface to read them. They were *also* written out a second
  time in the Guild Hall upgrade file, which kept its own private copy of the
  board size and the Guild Hall's tile. Two copies of the same board can drift
  apart: change one and the upgrade tree would quietly keep buying tiles
  against the old shape. They now live together in `src/config/boardGeometry.js`
  and everything reads that one copy. Purely cosmetic values — how far a hero
  and their Token slide apart on a tile, the hero's clickable box, the
  pointer-snapping used while dragging — stayed behind in the interface, where
  they belong. **Nothing about the board changes for the player**: the two
  copies were checked and did agree, so this removes a trap rather than fixing
  a visible bug.

### Fixed

- **A Map now says "click to open it", because that is what it does**
  (2026-08-24, owner ruling, fix backlog wave 3, CR2-158). Two messages the
  player actually reads — the one when a Map lands in your Tray, and the one
  after you buy it from the Cartographer — told you to **double**-click. A
  single click has in fact been enough for some time, in the Tray and on the
  playmat alike. So the Map you had just paid gold and materials for could
  burst the moment you touched it, while the game was still telling you to
  click twice. The wording now matches the game. **The behaviour is
  unchanged and deliberate**: one click bursts a Map, everywhere. This
  reverses an earlier note in the review backlog that said Maps should burst
  on a double-click; that note is marked superseded rather than deleted, with
  both dates on it, so it does not get re-argued later.

### Removed

- **A dead "should this upgrade be shown?" check** (2026-08-25, fix backlog
  wave 4, CR2-104). `isUpgradeVisible` in the Guild Hall upgrade file always
  answered "yes" and was never called by anything.

- **`theme` — a whole content axis that was never a feature — is gone**
  (2026-08-24, fix backlog wave 3, CR2-125 / CR2-039 / CR2-173 / CR2-001).
  Every Token and Map carried a `theme` field, the CMS offered a "Theme"
  dropdown for Maps with two values in it (`woodland`, `riverlands`), and the
  Token inspection panel would print the value as a tag. Nothing in the game
  ever read it for anything: every piece of your authored content has it
  blank, and the two places that appeared to depend on it — deciding which
  Maps the Cartographer sells, and which Maps use the tutorial drop sequence
  — were both already deciding it by the Map's id and its price at the same
  time. Those two now say plainly that they are checking for the Guild Hall
  Maps, which is what they always meant. **Nothing the player sees changes**,
  and the shop still lists exactly the same six Maps in the same order,
  verified in the running game.

  ⚠️ Two things worth knowing. First, the *visual* theme — light/dark, the
  parchment and glass tints — is a completely separate and entirely real
  thing, and was not touched. Second, **your content files still carry the
  empty `theme` field** on 2 Tokens and 7 Maps; those are yours to author, so
  they were left alone. The game ignores the field, so there is no rush, but
  they will disappear naturally next time you save those entries in the CMS.

### Changed

- **Nine comments that described machinery which no longer exists have been
  corrected** (2026-08-24, fix backlog wave 3, CR2-081 / CR2-039 / CR2-066).
  This is the cheapest and least glamorous item in the backlog and probably
  the most valuable: this project has repeatedly been misread because a
  confident comment survived the thing it described. Each one now says what
  the code actually does, dated, so the next reader knows it was checked
  rather than wondering. The notable ones: four comments pointed at
  `LoopRunner`, `StatProcessor` and `WorkProcessor`, all deleted with the card
  system; one claimed heroes have "six equipment slots: hand1, hand2, hat…"
  when they have nine plain numbered ones; and one said a buff-decay listener
  was inert "until Phase 4 lands", which it did.

  ⚠️ **One of these corrections records a real, still-open bug rather than
  hiding it.** A comment claimed that a hero poisoned to zero health is
  routed through the normal defeat handling by `LoopRunner`. `LoopRunner` was
  deleted and nothing took the job over, so off a combat tile that hero just
  keeps working at zero health. The comment now says so in as many words and
  names the ticket (CR2-070). **The bug itself is untouched — this change only
  stops the code claiming it is handled.**


- **A wave of dead code left over from the card era is gone** (2026-08-24,
  fix backlog wave 3). None of it could run, so nothing the player sees
  changes — but several pieces were actively misleading about what the game
  does. In plain terms:

  - **Eighteen invented enemies.** The enemy list the game loaded held 22
    creatures: the 4 you have actually authored, plus 18 hardcoded leftovers
    (Wolf, Boar, Scarecrow and friends) that no Token can summon and no
    screen can reach. Between them they promised 23 items that do not exist.
    They are gone, so the Bestiary and any "pick a random enemy" now count 4.
    This is why the boot-time content check dropped from **61 broken
    references across 35 places to 23 across 17** — every one of the 38 that
    disappeared belonged to those fake enemies. (CR2-117)
  - **The old drop-table registry.** A 131-line table of card-era loot that
    combat still called on every kill and that could only ever answer "no
    such table", because no enemy has ever carried the field it looks up. An
    enemy's rewards come from its own drops list, which is what the content
    actually uses. (CR2-116)
  - **Two thirds of the victory routine.** The function that decides what a
    kill is worth read as though it handled four cases — hordes, dungeons,
    a special reward trait and the normal case — when the only fight object
    the game can build satisfies just the last one. (CR2-077)
  - **A "central configuration" file that configured nothing.** 15 of its 16
    values had no reader, and four of them stated a number the game
    contradicts (5 save slots when there are 3, and so on). A balance pass
    could have spent a session tuning dials that were not connected. Its one
    live value moved next to the game loop it drives. The same museum-piece
    problem in the loop tunables file was cleared too. (CR2-099, CR2-065)
  - **A registry index nobody needed.** Three files imported it, for five
    names between them, and it was the only reason 23 unused crafting
    recipes were parsed on every launch. Those three now import directly.
    ⚠️ The hero-name registry it hid is *live* — it names every hero in the
    game — and was kept and rewired, not deleted. (CR2-119)
  - **Wires connected at one end.** Five quest listeners waiting for events
    nothing publishes, six events announced to an empty room, a nav
    destination ("Collection Binder") with no screen behind it, a card
    lookup cache that always came back empty, a duplicate hook, six unused
    text formatters and a pre-React icon builder. (CR2-088, CR2-092,
    CR2-144, CR2-013, CR2-136, CR2-102, CR2-103)
  - **Comments that described machinery that does not exist** — most
    notably one claiming "the combat info panels read this", when there are
    no combat info panels. Corrected rather than deleted. (CR2-078)

  One small speed-up came along for free: the sprite resolver was rebuilding
  two lookup tables on every icon it drew, once per visible sprite per
  redraw. They are built once now. (CR2-103)

- **The retired content pipeline is gone** (owner decision 10, 2026-08-19,
  CR2-113 and CR2-118). Three leftovers from the old card system, none of
  which any part of the game or the CMS was using:

  - **The rebuild script, `scripts/regenerate_game_package.js`.** This was
    the genuinely dangerous one. Running it would read one specific, very old
    CMS backup file and then overwrite `data/items.json` and
    `data/enemies.json` with card-era shapes, recreate a `data/quests.json`
    that no longer belongs there, and recreate three card folders — silently
    destroying the content authored since that backup was taken. Nothing
    called it and it was not wired to any `npm` command, so it was a loaded
    gun sitting on the shelf. Deleting it is what finally closes the "Sync to
    Game destroys unmodelled content" hazard for good.
  - **`data/schemas/` and `data/templates/`** (six files). These described
    the shape of explore cards and task cards — content types that no longer
    exist. Nothing read them.
  - **`data/archive/cards/`** (fourteen files), the old card content kept as
    a reference copy, plus the two dead loaders that still pointed at where
    those files used to live and the empty `cardFiles` stub beside them, in
    `src/config/DatabaseManager.js`. None had a consumer.

  Nothing the player sees changes. Everything deleted is recoverable from
  git history if the old card data is ever wanted again.

- **Item durability is gone** (owner decision 2026-08-19, CR2-096). Gear used
  to wear out as heroes fought, but the mechanic was retired back at D-118 —
  equipment is permanent now, and losing a fight is the only way gear ever
  leaves a hero. What was left was scaffolding with nothing behind it: an
  empty do-nothing function that combat still called on *every single attack*,
  a pair of unused wear-and-break routines in the Bank code, and a durability
  number quietly attached to every Bank display object that no screen has ever
  shown. All of that is now deleted. Nothing visible to the player changes.
  `dur` stays on each Bank entry in the save file as an unused field, always
  empty, so saves written before this change keep loading — the same treatment
  Influence and `totalRecruits` got. One test mock that existed only to stub
  the durability call was dropped; no test was weakened or removed.

- **Influence is gone** (owner decision 2026-08-19, CR2-093). It was the
  recruitment currency: you started with 10, and the only thing that ever paid
  out more was retiring a hero — which was itself removed in the change below.
  Nothing in the game ever spent it and nothing ever showed it to you, so it
  was a number that sat in the save file doing nothing. Deleted: the
  Influence-specific methods on `CurrencyManager`, the `influence_changed`
  event it published for a listener that never existed, the unused
  `influenceEvents` notification setting, the dead "Add 100 Renown" button on
  the developer test dashboard, and the influence branch in the reward
  processor. Gold is untouched and is now simply the only currency there is.
  `currency.influence` stays in the save file as an unused field so existing
  saves keep loading.

- **Retirement and recruit-purchasing are gone** (owner decision 2026-08-19,
  CR2-086). A hero could be retired from the Hero Edit modal for an Influence
  payout, but only if that payout beat "the recruit cost" — a number that had
  been permanently stuck at 10 because neither of its two inputs was ever
  written by anything. Growing the roster in the Guild Hall already hands you a
  new hero automatically, so the whole buy-a-recruit idea it was priced against
  no longer existed. Deleted: the Retire button, `retireHero`, the retirement
  Influence formula, and all three disagreeing recruit-cost functions.
  `currency.totalRecruits` stays in the save file as an unused field so existing
  saves keep loading.

### Effect Authoring Redesign — Phase 1: the statement grammar

#### Added

- **Statements replace effect blocks.** A Token's rules are now a flat list of
  sentences, each with one fixed shape:
  `[When <event>,] KEYWORD <payload> [to <filter>] [, costing <upkeep>]`.
  Six keywords in this phase: **Provides, Grants, Acts as, Requires, Restocks,
  Converts**. `Cannot` and restrictions are Phase 2.
- **Every statement carries a stable `id`.** Upkeep clocks and trigger cooldowns
  live on the saved board instance and used to be keyed by *position in the
  array*, so reordering a Token's rules in the CMS silently remapped a live
  save's state onto the wrong rule. Statements are sentences and reordering them
  is the normal thing to want, so this had to be fixed here rather than after.
- **`Restocks` is authorable at last.** `Managers.js` has always read
  `def.manages`; nothing ever wrote it, so the Copper Ore Minecart was typed
  `manager`, described as restocking its neighbours, and did nothing at all.
- **Legality is declared, not hoped for.** Each palette entry now says whether
  it may sit inside a triggered statement (`never` / `optional` / `required`),
  so the six number effects that were silently dropped inside a Reaction block
  can no longer be authored there.
- **Content audit tells you what to re-author.** A Token still carrying the
  retired `effectBlocks` shape is named at boot, in words, with the rules it
  needs rebuilding as. It also now catches a capability requirement nothing
  provides (`pikaxe`) and a targeting tag no Token carries — both previously
  silent.

#### Changed

- **One capability channel.** `Acts as` is the authored form; everything —
  engine, board connection lines, the inspection drawer — reads the merged
  `getProvidedTagsWithTiers` helper. This is the fix for a Copper Pickaxe that
  worked mechanically while the board drew no line to the Vein it was feeding.
- **`by category` targeting retired from the editor**, replaced by an `all`
  filter (owner decision Q2). ⚠️ These are not the same reach: the old one meant
  "all adjacent **resources**", `all` means "all adjacent **Tokens**".

### Skill & Class Rework — Phase 8: the promotion and re-training screen

#### Added

- **`JobChangeModal.jsx`**, opened by a **Change job** button on the hero
  sheet. A hero can now be promoted and re-trained by clicking, rather than
  from the console.
- **One screen for both** (D-248). Every reachable job is listed the same way at
  the same price — a step down the tree, a step sideways between siblings, or a
  step back to something held before. There is no "undo" affordance, because
  reversal is not a correction; it is just another job.
- **Ineligible jobs are shown rather than hidden**, each with its exact
  shortfall — *"Needs Mining 12/25, Smithing 12/25, Melee 0/25, Leadership
  0/25"*. A job that silently vanishes from the list teaches nothing; one that
  says what it wants tells the player exactly what to go and do.
- **The trade is on screen before the click, never after.** "You will lose
  Fishing 21" *is* the decision, so the confirm button does not appear until a
  job is selected and its consequences are visible — including whether an
  arriving skill is a restore, and at what level.

#### Fixed

- ⚠️ **Copy bug, caught by driving the flow rather than by a test.** The intro
  line read "swaps two skills for two others". That is true walking down the
  tree and false across it: a lateral move — Fighter to Rogue — swaps **three**,
  because the combat skill and the shared specialist change too. Reworded to
  something true in every case; the per-job panel states the real trade.

### Skill & Class Rework — Phase 7: the hero sheet, and banked skills become visible

#### Added

- **`HeroSkillSheet.jsx`**, mounted at the top of the hero modal: the hero's
  job, the path taken to it (`Recruit → Fighter`), the six skills they hold
  **grouped by layer**, and everything they have set down.
- ⚠️ **"Set aside" — the first time reversibility is visible to the player.**
  Banked skills render greyed and dashed, with the promise spelled out:
  *"Kept at the level they reached. A job that uses one again gets it back
  exactly as it is."* A player who cannot see that a hero still has Cooking 30
  sitting dormant has no reason to believe promotion is anything but permanent,
  and D-71 exists precisely so that it isn't.
- Skills group by the registry's own layer order, so adding a skill or moving
  one between layers needs no edit in the UI. The layers are shown separately
  because they mean different things — Foundation is ordinary work, a combat
  skill decides whether this person can fight at all, and a signature is
  exclusive to one job in the entire tree.

#### Notes

- **Both halves of D-250 confirmed in the running game.** The modal shows held
  *and* banked; the dock card shows only the six a hero can use now. The card is
  a glance surface, and what someone *used* to be able to do belongs where the
  re-training decision is actually made.
- ⚠️ **The roadmap's clutter concern was based on a wrong assumption and is
  void.** It feared "12 heroes × 6 skills = 72 values on screen"; that cannot
  happen, because skill cells render only on a *pinned* card and at most two
  pin at once. Measured at a full 12-hero roster: **12 skill cells and 66
  visible text elements**, against 47 with nothing pinned.

### Skill & Class Rework — Phase 6: roster, recruitment and the Market shift

#### Changed

- **The roster cap rises from 10 to 12** (D-251) — `roster_size` `maxRank`
  5 → 7. The reason is the job tree: twelve advanced jobs each own an exclusive
  signature skill, and at a cap of 10 a fully-built guild could never hold them
  all, so a third of the capstone content would go unseen. ⚠️ The cost is real
  and recorded in the file: D-181 chose a small roster so chain depth would bite
  (a five-step chain was 60% of eight heroes and is 42% of twelve) and so
  recruitment would read as a milestone rather than a transaction. Both soften.
- **The class/trait reveal is gone from recruitment.** It showed one rolled
  attribute per candidate and hid the other, which made hiring a small gamble.
  There is nothing left to gamble on — every recruit is a Recruit holding the
  same six Foundation skills at level 1, and class and trait never affected
  anything. The candidate card now states the job and the skills they actually
  arrive with. ⚠️ **Candidates are interchangeable, and that is the design**
  (D-73): recruitment is a question of *how many*, never *which*. If the
  choice-of-three now reads as a pointless click, the honest fix is to hire
  directly rather than to re-roll differences back in.

#### Added

- **12 tests** over the three Phase 6 rules. Notably they assert the *join*
  between the roster definition and `GuildUpgradeManager.recompute` — those two
  numbers live in different files and nothing previously checked they agreed —
  and they pin the Market rules for the first time: every Market demands
  Commerce, a non-Merchant on one raises `UNSKILLED` and earns no gold,
  **Merchant is the only one of the twelve jobs that brings Commerce**, and raw
  selling still works with no hero, no Token and no skill.
- A guard that a Market must still pay more than selling its own input raw —
  otherwise there would be no reason to want one.

### Skill & Class Rework — Phase 5: promotion, re-training and banking

#### Added

- **`PromotionSystem.js`** — `canPromote`, `promote`, `previewPromotion`,
  `getAvailablePromotions`, `getSkillSheet`, `knownLevel`.
- **Promotion and re-training are the same operation** (D-248). Re-training is
  deliberately *not* an undo — it is entering a job, priced exactly like
  entering it the first time. Treating reversal as special would have made
  "forward" and "back" two systems with two sets of rules. A Knight becoming a
  Warlord is the same act as a Recruit becoming a Fighter.
- **Banking, in both directions** (D-71). A removed skill goes to
  `hero.bankedSkills` **at its level**, and a later job that wants it back
  restores it from there intact rather than starting it at 1.
- ⚠️ **Banked skills count toward a later promotion's gate.** A hero who
  reached Cooking 30 and set it down has not forgotten how to cook, so
  re-training into a job that wants Cooking does not make them earn it twice.
  Without this, "banked, not lost" would be true of the number and false of
  everything that matters.
- **The gate is the skills a job carries forward** (D-262), so promotion is the
  payoff for work already done. Being terrible at a skill the promotion
  *removes* never blocks it. Refusals name which skills are short and by how
  much.
- `previewPromotion` returns what a hero would lose, keep and gain — including
  whether an arriving skill is a restore and at what level — so Phase 8 can
  show the trade before the player commits.
- **22 tests**, covering the gate, the charge, banking both ways, save/load
  round-tripping, a full Recruit → Fighter → Knight run, and sideways
  re-training between siblings.

#### Notes

- Costs are taken only after every check passes, mirroring the Cartographer's
  purchase. A half-paid promotion would be the worst failure available here,
  because what it spends is a hero's skills.
- ⚠️ **Not browser-verified.** Promotion has no screen until Phase 8, and the
  agreed fallback — checking the main folder out to this branch — is blocked
  while the worktree holds the branch. Its one visible effect is covered by
  three tests over the real UI contract instead.

### Skill & Class Rework — Phase 4: the job tree as data

#### Added

- **`jobRegistry.js`** — all 19 entries: the Recruit, 6 base classes and 12
  advanced jobs, with the Tier-2 shared skills evened out per **D-268** (Scout
  `leadership`→`crime`, Paladin `leadership`→`enchanting`, Astromancer
  `leadership`→`nature`).
- ⚠️ **A job declares its complete sheet, not its deltas.** What a promotion
  grants and removes is *derived* by diffing against the parent. That is
  deliberately the opposite of storing deltas: a sheet cannot silently drift out
  of agreement with its own parent, and **re-parenting a job recomputes its
  deltas automatically** — the property the "content is a first draft"
  constraint asks for.
- Everything else derives from each skill's `layer` — which skill is the combat
  one, which is the signature, which are foundation. Nothing outside a `skills`
  array names a skill, so moving a skill between layers needs no edit here.
- **Promotion costs and gates** (D-262): the threshold applies to the skills a
  job *carries forward*, not to an arbitrary hero level. Values are placeholders
  for the balance pass; re-training uses the same cost as entering the job.
- **`JobTree.test.js` — 137 tests** covering every structural rule: sheets
  exactly 6 wide, foundation pairs a subset of the parent's, combat and
  parent-shared carried forward, signatures unique and all 12 granted by
  someone, coverage even at 4 jobs apiece, the tree connected, and a promotion
  never removing the skills it gates on.
- ⚠️ **The suite was mutation-checked rather than merely written green.**
  Reverting one of D-268's swaps failed exactly the two coverage rules it should
  have, which is the evidence that the tests would catch a real regression.

#### Changed

- `HeroGenerator` builds a hero's skills from **the job's sheet** rather than
  the Foundation list, so what a Recruit holds is a one-file edit. `jobId` is
  now the field that means something; `classId` is cosmetic leftover the sprite
  reads, retired in Phase 7/9 along with `traitRegistry`.

### Skill & Class Rework — Phase 3: content, and the Foundation six get something to do

#### Added

- **Three new Map-1 Tokens**, because three of the six Foundation skills had
  nothing to work — Fishing had one Token on Map 2 only, and Crafting and
  Cooking had none anywhere in the game. A skill nothing works can never level,
  so it can never gate:
  - **Trout Stream** (`fishing`) — the one Map-1 Token with unlimited charges.
  - **Stew Pot** (`cooking`) — raw shrimp in, cooked shrimp out.
  - **Workbench** (`crafting`) — wood from Logging *and* ingots from Smithing,
    so Crafting is the first place two chains have to meet.
- **Three content rules** that make the constraint permanent rather than a thing
  to remember: the first Map may demand only Foundation skills; every Foundation
  skill must have something to work on it; and the opening Tray must be workable
  by the single hero a new game starts with.
- `OPENING_TRAY` is exported from `EngineBootstrap` so the tests assert the real
  list rather than keeping a copy — a duplicated list is exactly how the Still
  survived in the opening after Alchemy became a specialist.

#### Changed

- **Three Tokens left Map 1 for the Riverlands pool** (D-261): Bramble Patch
  (`nature`), Woodland Still (`alchemy`) and Lumber Market (`commerce`). All
  three want specialist skills no Recruit holds.
- ⚠️ **The opening Tray is a different shape.** It was Grove, Seam, Still,
  Sawmill — with the Still teaching "stations consume". No Recruit can work a
  Still, and swapping in the Stew Pot broke the chain instead, because nothing
  in the tray caught any shrimp. The Copper Seam gave up its slot to the Trout
  Stream, and the opening is now a genuine two-step: **fish → raw shrimp → Stew
  Pot → shrimp.** Mining is no longer in the opening; the Seam still arrives
  with the first Map, a few minutes away.
- **Map 1 ships no Market** (D-263), so the Woodland pool lost the Lumber
  Market. Early gold comes from selling out of the Bank at base value.

#### Fixed

- A `ReferenceError` on starting a new game: the log line still referenced the
  local `opening` array after it became the exported `OPENING_TRAY`. **Neither
  the tests nor the build caught it** — it only fires inside an event
  subscriber, which swallows the throw. Running the game did.

### Skill & Class Rework — Phase 2: one combat skill, and Recruits cannot fight

#### Changed

- **The Defence skill is gone from combat.** A hero's single combat skill now
  supplies attack, defence, max HP and block — a Melee 30 hero attacks at 30
  and defends at 30. There is no longer a way to build a tanky hero distinct
  from a damaging one *through skills*; defensive building moves entirely to
  equipment, which is what gives the nine gear slots a job.
- **`getHeroCombatSkill` reads the one skill a hero holds**, and its
  `selectedStyle` argument is ignored — kept only so existing call sites
  compile. The equipped weapon no longer selects between four skill bars; it
  only decides which side of the rock-paper-scissors triangle the hero fights on.
- ⚠️ **A hero with no combat skill scores 0, not 1.** A floor of 1 would have
  made Recruits *weak fighters* rather than non-combatants, which is the
  opposite of the intent. **`heroMaxHpFromSkills` still floors at 1** — a
  Recruit stands on the board, takes environmental damage and heals, so a max
  HP of zero would make them unrepresentable.
- ⚠️ **Combat XP is the full award into one skill.** It used to be the full
  award into the style *plus a third again into Defence* — 4/3 of the award
  spread over two bars. There is one bar now, and paying 4/3 into it would have
  silently accelerated combat levelling by a third. `DEFENSE_XP_SHARE` is left
  as a commented tombstone so the old pacing is findable.
- **An unarmed hero fights in their own style**, not a hardcoded melee.

#### Added

- **Recruits cannot fight** (D-249). `BoardCombat` refuses to start a fight for
  a hero holding no combat skill: no fight object, no damage dealt or taken, the
  enemy stays whole. The tile raises `UNSKILLED` so it reads as a rule rather
  than a broken game. This is a **possession** gate, not a difficulty gate — the
  game still never tells a player their hero is outmatched.
- `CombatFormulas.getHeroCombatSkillEntry` and `canHeroFight`;
  `BoardCombat.canFight`.
- 5 tests pinning that a Recruit starts no fight, takes no damage, leaves the
  enemy untouched, says so on the tile, and starts fighting the moment a combat
  skill is granted — plus that a **level-1** fighter still fights, because the
  gate is possession and never level.

### Skill & Class Rework — Phase 1: the 27-skill registry and the possession gate

#### Changed

- **The skill registry is now 27 skills in four layers** — Foundation (6),
  Combat (3), Shared Specialist (6) and Signature (12). Everything derives from
  one `SKILLS` map: layer groupings, id lists, categories. Adding or re-layering
  a skill is a single-file edit, because the list is a first draft and expected
  to move.
- **Six ids deleted**: `labor` → `mining`, `aquatic` → `fishing`, `forge` →
  `smithing`, `explore` → `survival`, `social` → `commerce`, and `defense` folds
  into the hero's combat skill. `occult` and `science` keep their id but are now
  job-exclusive signatures.
- **`SUB_SKILL_TO_PARENT` is gone.** Sub-skills were tags whose XP funnelled
  into a parent; every skill is top-level now. Tag derivation, the modifier
  aggregator's parent walk and the card validator all lost their resolution
  step — an unknown id is a content bug, not something to approximate.
- **Heroes generate as Recruits**: the Foundation six at level 1, and nothing
  else. A Recruit therefore holds **no combat skill and cannot fight**, which is
  the intended end state.
- **Hero Level is the average of the skills a hero holds**, not of four combat
  skills including `defense`. A master smith now reads as a high-level hero.
  ⚠️ This is *not* the combat number — repointing those reads is Phase 2.
- **Villagers hold two Foundation skills** instead of every non-combat skill at
  level 0. Level 0 used to mean "has it but is bad at it"; an absent skill now
  means "cannot do this", so the old seeding would have handed every villager
  the entire production world.
- **The Dock's skills grid renders the skills a hero holds**, not a fixed
  15-cell grid of every skill in the world.
- Tokens re-keyed onto the new ids. ⚠️ **Brought forward from Phase 3** — the
  deleted ids were referenced by every Token, so splitting these across two
  phases would have left the game with no workable producers in between.

#### Added

- **`ALERT.UNSKILLED`** — a tile mark distinct from `ACCESS`. "This hero can't
  do this work" and "this hero isn't good enough yet" are different problems
  with different fixes, and the wording now shuts down the wrong reading:
  *"levelling won't help"*.
- `SkillSystem.heroHasSkill`, `getHeldSkillIds` and `requirementFailure`, which
  reports `POSSESSION` or `LEVEL` rather than a bare boolean.
- ⚠️ **Temporary QA scaffolding**: "Grant Melee/Ranged (temp)" in the dashboard.
  Nobody can fight until promotion exists (Phase 5), so combat would otherwise
  be untestable for three phases. **Delete these when promotion lands.**

#### Fixed

- **`EquipmentValidator` refused everything for the wrong reason.** It compared
  a skill level that is now `null` for an unheld skill, and `null < 1` is true
  only by coercion — so "you don't have this skill" displayed as "your level is
  too low", which no amount of levelling fixes. Possession is now checked first
  and says so.
- **`RetirementFormula` divided total skill levels by a hardcoded `11`** — the
  count of non-combat skills in the old 15-skill system. At 6 skills that
  understated every hero's level badly enough to make retirement impossible.
  It now divides by the number of skills actually held.

### Skill & Class Rework — Phase 0: safety, version and re-pinning

#### Changed

- **Version 0.5.0 → 0.6.0** across all five version files. ⚠️ `Cargo.lock` holds
  a second `version = "0.5.0"` under the `dirs-sys` dependency — only the
  `[[package]] name = "app"` block was touched.
- **Save schema `GAME_VERSION` 0.6.0 → 0.7.0.** The gate is a strict `!==`, so
  the bump alone refuses every existing save, which is what D-253 asks for. No
  migration code: a hero's shape changes too fundamentally for a migration to
  produce anything but nonsense heroes.

#### Added

- `SkillClassBaseline.test.js` (9 tests) — re-pins the behaviour Phases 1 and 2
  relocate, before their homes are deleted: today's `calculateHeroLevel`
  (average of four combat skills including `defense`), the level-only Access
  gate, and the fact that every hero holds all 15 skills.
- `fixture_ungated` — a Token needing a hero but no skill *level*.
- ⚠️ **The baseline found a real hole.** `BoardRunner.heroMeetsRequirement`
  returns early when `skillRequired <= 0` and never consults the hero's skills
  at all, so a hero who does not hold the skill works the Token anyway. Harmless
  while every hero holds every skill; a hole straight through possession the
  moment they hold six of 27. It is pinned by a **passing** test that Phase 1
  must flip.

#### Docs

- [`skill_class_rework_brief.md`](skill_class_rework_brief.md) — the decisions
  (D-248…D-265) and the six contradictions in the colour-pie concept, resolved.
- [`skill_class_rework_roadmap_v1.md`](skill_class_rework_roadmap_v1.md) — the
  27-skill list, the 19-entry job tree, a coverage audit and 11 phases.
- ⚠️ **All decision ids renumbered +11** (D-237…D-254 → D-248…D-265). They were
  written against a registry ending at D-236; merging `token-object` brought the
  real D-237…D-247 with it.
### Playmat — a staffed tile says whether it is working (D-267)

#### Added

- **A staffed tile glows: green while the pairing works, yellow when the hero
  has nothing to do** — on *both* the hero and the Token, so the pair changes
  state as one object rather than being marked separately. An unstaffed Token
  glows not at all: with ~8 heroes across 48 tiles most of the board is
  unstaffed at any moment, and D-149 is explicit that this is not an error.
- **Green pulses; yellow is steady.** Deliberately the opposite of the obvious
  choice: a productive board breathes, and stillness is what makes an idle hero
  stand out against it. This also restores D-172's yellow idle cue, which the
  name chip took with it when D-266 replaced it.
- The state costs nothing to derive. `alert` is only ever set on a *staffed*
  Token that cannot work, so "a hero with nothing blocking them" needs no new
  state, no new event and no extra render. The alternative considered — glowing
  only while a cycle actually ticks — would have meant routing progress through
  React, which is the 48-tile re-render cascade `TileProgressRing` writes
  straight to the DOM to avoid.
- ⚠️ The glow is applied to each sprite's **wrapper**, never to its `<img>`.
  Every sprite carries its contact shadow as an inline `filter` (D-215) and
  `gi-token-land` animates that same property on placement; a third filter on
  the image would be overridden by the landing animation, so the glow would
  blink out exactly when a Token was placed. Verified in-game: through the whole
  380ms landing the wrapper holds its glow and its 24px shift while the
  animation plays on the image.
- ⚠️ **A stuck tile now shows yellow and red together**, the accepted cost of
  glowing both sprites in both states. They are not redundant — yellow means
  *this person is wasted*, red means *this Token cannot run* — but they do fire
  from one condition. If it reads as double-marking in play, the lever is
  dropping the Token's yellow, not the red dot: the dot is the only thing that
  names the cause on hover (D-114).
- Reduced motion stops the green **breathing** but keeps the green. The colour
  is the state; losing it would leave anyone with that preference unable to tell
  a working tile from a stuck one.

### Playmat — the hero on a tile becomes a sprite (D-266)

#### Changed

- **The hero on a board tile is now their portrait, not a name chip.** Drawn at
  the full 128px, the same size as the Token they work, with the pair pushed
  apart: hero 24px left, Token 24px right, overlapping across 80 of their 128
  pixels. `PAIR_OFFSET_PX` and `HERO_HIT_PX` join `boardConstants.js`, which
  already forbids hardcoded sizes so small mode stays a config change.
- **The pair deliberately overhangs its tile by 24px on each side.** 128 + 48
  does not fit in 128, and shrinking either sprite was not available — the scale
  rules allow 64px or 128px and nothing between, because fractional scaling
  blurs pixel art. Two consequences are load-bearing: nothing on the board may
  clip (`Board.jsx` pads its scroll container to 32px for exactly this), and
  paint order does the depth work for free — tiles render in index order, so a
  left-shifted hero lands on top of its left neighbour's Token and each row
  overlaps the row above. That is why there is no `z-index` anywhere near it.
- **A hero on bare ground stays centred.** With nothing to stand beside, the
  off-centre stance is reserved to mean *this person is working that object*.
- The hero's **hit area is smaller than its art** (64px box under a 128px
  sprite). Matching the art would have swallowed the Token's click-to-inspect
  and its tile-to-tile drag.

#### Removed

- **The hero's name is gone from the board**, with the chip that carried it. It
  lives on hover now, alongside the Token's name and charges. Heroes are told
  apart by portrait — which is what the 29-portrait catalogue was for.
- **The yellow idle cue**, which lived on the chip. It was briefly absent
  entirely — **restored by D-267 below**, as a steady yellow glow.

### Playmat Refinement R-3 (slice 5) — Vault Tabs become purchasable (D-243)

#### Added

- **A `token_bank_tabs` Guild Hall node**, "Vault Tabs" — 250g base, ×1.6 growth,
  15 ranks, mirroring `bank_tabs` so 5 free + 15 purchased = 20, the same as the
  Bank. Cost curve is a placeholder like every other node in that file.
- `GuildUpgradeManager.recompute()` writes `board.tokenTabsUnlocked`, and
  `TokenGroups.pad()` grows the strip on its next read.
- ⚠️ **Storage is now four lines, and two of them touch the Vault.**
  `token_bank_tabs` buys *organisation*; `token_bank_slots` buys *capacity*
  (D-137 caps distinct types). The descriptions say which is which, because a
  player who buys the wrong one gets nothing they wanted.
- 7 tests pinning the join rather than the formula: the node's definition has to
  agree with `TokenGroups`' constants, `recompute()` has to write the field, and
  `pad()` has to act on it. Break any link and **nothing throws** — the player
  simply buys an upgrade and gets no tab.

### Playmat Refinement R-3 (slice 4) — The Vault becomes a grid with tabs (D-241, D-242)

#### Changed

- **The Token Vault is an icon grid with a tab strip**, replacing its list of
  rows, so the two banks read as siblings. Same `auto-fill minmax(6rem)` grid as
  the Bank, and the same strip: 20 positions, unlocked ones previewing their
  first Token, locked ones greyed with a padlock.
- **One cell per distinct type with a copy count** — never one per copy. D-137
  caps *types*, so a grid of copies would show forty cells for forty Oakwood
  Groves and misrepresent the thing being capped.
- **Drag a cell onto a tab to file it there.** One drag source serves both
  gestures: onto a **tab** files, onto the **Tray** withdraws (D-244).

#### Added

- ⚠️ **A partial-charge marker on the cell.** A row used to read
  `3 part-used (400, 200 left)` and a cell has no room for that, but dropping
  the fact silently would matter: a Manager restocking from the Vault draws the
  **fullest copy first** (D-77). The cell now carries a small warning dot with
  the counts on hover, and the detail lives in inspection — which is why D-240
  had to keep inspection alive rather than removing it.

### Playmat Refinement R-3 (slice 3) — Token Vault tabs, the state model (D-242, D-243)

#### Added

- **`TokenGroups.js`** — tabs for the Token Vault, mirroring the item Bank's
  grouping deliberately: same shapes, same rules, same not-clever default.
  `InventoryGroupManager` returns `groupOrder[0]` for anything unfiled —
  *"Default: Always go to the TOPMOST group"* — and Tokens behave identically,
  so the two banks teach one rule rather than two.
- **5 free tabs, 20 hard cap**, matching the Bank (D-243). The strip is padded
  to `board.tokenTabsUnlocked` and **never shrinks**, so a tab cannot vanish
  under a filed Token.
- 12 tests covering padding, filing, the cap and repair.

#### Notes

- **A parallel system, not a shared one.** `InventoryGroupManager` is
  item-specific end to end; refactoring it to be entity-agnostic was rejected as
  too risky — it would rewrite a working system the Bank depends on and could
  break item filing as a side effect.
- **No save migration.** State backfills on read, the same route Tray positions
  took (D-226). Verified: a save written before tabs existed loads fine, and the
  new state survives a save/reload round-trip including a filed Token.
- ⚠️ **Correction to D-242.** It said tabs would be "user-managed, mirroring the
  Bank exactly" — but the Bank's tabs are **not** user-created. `BankTabStrip`
  is "the fixed, system-owned bank tabs… No player create/rename/delete", and
  `GuildUpgradeManager._ensureBankTabs` pads them on unlock. The Vault now
  matches that: **the player controls which tab a Token lives in, nothing else.**
  Create/rename/reorder were built, then removed as not-the-mirror.
- Scope is **tabs and filing only** (owner decision). The Vault keeps its
  per-row Sell and does not gain the Bank's search, type filter or bulk sell.

### Playmat Refinement R-3 (slice 2) — Take things out by dragging (D-244…D-247)

#### Added

- **Drag a Token out of the Vault, or a Map off the Cartographer, onto the
  Tray.** One gesture for "take this", across every pane. Both route through
  `TokenBank.withdraw()` / `Cartographer.buyMap()` rather than around them, so
  fullest-copy-first (D-77) and check-everything-before-spending still hold.
- **Buying is the drop** (D-245) — outright, no confirmation. A Map that cannot
  be bought **cannot be lifted** (D-246); the Buy button's disabled state carries
  `canBuy()`'s reason, which is why D-244 keeps the buttons alongside the drag.
- **Drag a Token from the Tray back into the Vault to store it** (D-247).
  **Maps are refused** with *"Maps cannot be stored — open it."* — a purchased
  Map must be opened. Without this the Tray was a one-way street.

#### Fixed

- ⚠️ **Drawer panes could never receive a drop.** `smallestWithin` picked the
  smallest droppable under the pointer, so a 128px board tile always beat a
  1192px drawer pane — and since D-238 the drawer sits permanently *over* the
  board. Every drop meant for the Vault was landing on a hidden tile behind it.
  Drawer-surface droppables now outrank board-surface ones, which is the rule
  `surfaceAtPoint` already stated: *"Drawers win over the board where they
  overlap."* This also fixes the Tray losing drops at narrow widths, where the
  896px board overflows underneath it.

### Playmat Refinement R-3 (slice 1) — The bank drawer comes from the side (D-238…D-240)

Intent spec: [`bank_drawer_intent.md`](bank_drawer_intent.md).

#### Changed

- **The bank drawer slides in from the nav's edge instead of up from the
  bottom.** It covers the notifications column and the playmat, sits **under**
  the nav in z-order (`z-90` against the nav's `z-110`), and **stops before the
  Tray**. Measured live: drawer 150→1344, nav ends 152, Tray starts 1344.
- ⚠️ The Tray is excluded **deliberately**. D-107 makes it load-bearing
  *because* an open Bank covers the board — the only route from storage to a
  tile is Bank → Tray → Board. Whatever fills the Tray's space while a drawer is
  open must leave a drop target, or that flow breaks.
- **One pane at a time** (D-239). Opening the Bank closes the Vault. `panes`
  stays an array so every reader keeps working; it just never holds more than
  one. **Maximise is gone** — a lone pane already fills the drawer.
- **The inspection panel left the drawer and now sits over the Tray** (D-240).
  It had to move in the same change rather than later: it is the only route to
  Token detail from the Vault, Cartographer, Tray *and* board, and D-145
  requires planning before placement. Placement is provisional.
- **The mirrored layout is now a true mirror** — the Tray leads when the nav is
  on the right. Without this the order became board, tray, notifications, nav,
  leaving notifications and playmat **non-contiguous**, which the side drawer
  has to span.

### Playmat Refinement R-4 — The play area is four columns (D-237)

#### Changed

- **The play area now reads nav · notifications · playmat · tray**, left to
  right, mirroring to tray · playmat · notifications · nav when the bubble menu
  is flipped right.
- **Notifications became a real column.** They were a `position: fixed` overlay
  portalled to `<body>` at `z-[9999]`, occupying **zero layout space** and
  floating over the board — so this builds a column rather than reordering one.
  `ToastContainer` renders inline; the old overlay survives behind a `floating`
  prop for anything that still wants a corner.
- The column **reserves its width when empty**. Appearing only when a toast
  arrived would shove the board sideways every time the game spoke, and the
  board cannot absorb it (D-171 fixes it at 896px).

#### Known costs

- The play area wants **~1558px** before the board clips, against ~1302px
  before. Narrow windows are "small mode" (roadmap G-20).
- ⚠️ **`notifications.position` no longer does anything.** Its six corner
  options describe an overlay that no longer exists, and **the Settings screen
  still offers it.** Needs removing or repurposing — left in place rather than
  silently deleted.
- Column width (256px, matching the Tray) is provisional. Its floor is ~240px:
  `Toast` carries `min-w-[220px]`.

### Fixed — RegenSystem crashed every frame on a hero with a missing vital

`RegenSystem.tick` read `hero.hp.current` and `hero.energy.current` unguarded.
Because it runs inside a **GameLoop tick handler**, a single malformed hero
raised `Cannot read properties of undefined (reading 'current')` on *every
frame* rather than failing once — the console filled at the tick rate and regen
stopped for the whole roster, not just that hero.

**Energy is not retired** — `HeroGenerator` gives every hero
`energy: { current: 100, max: 100 }`, and crafting upkeep, consumption and
combat all read it. The trigger is legacy or test-shaped save data whose heroes
carry `hp` but no `energy`. The rest of the codebase already assumed that was
possible (`ConsumptionSystem` and `HeroDockTab` both read
`hero.energy?.current`); `RegenSystem` was the only reader that did not.

- `RegenSystem` now checks a vital exists before comparing it, and a hero
  missing one still regenerates the vital it *does* have.
- `HeroState.modifyHeroHp` / `modifyHeroEnergy` return `NO_HP` / `NO_ENERGY`
  instead of throwing, so every other caller (`effectResolvers`,
  `ConsumptionSystem`) is protected from the same data rather than just this one.
- New `RegenMissingVitals.test.js` (7 cases) pins both, including that one
  malformed hero does not stop the healthy ones beside it regenerating.

### Playmat Refinement R-2 — Drops, collection and the particle fly (D-232…D-236)

#### Added

- **Loot actually flies now.** `scatterFrom()` was computing each sprite's source
  tile and discarding it, so loot materialised at its landing spot — the arc the
  docs described never existed. The origin is kept, and the sprite travels from
  it along a lifted arc, **at exactly the same size in flight as at rest**.
- **Hover collects.** Specified since D-88 and never built: only a click and the
  auto-sweep took loot off the floor. An **item** is taken on the way in; a
  **Token** on the way out — which is D-158's wording, and is forced, since
  collecting a Token on enter would make dragging one to a tile impossible.
- **Board loot reaches the particle system.** New
  `BOARD_EVENTS.SPRITE_COLLECTED`; items fly to the Bank bubble, Tokens to the
  Token Vault bubble (which gained the `id` it needed). `_getRect` accepts a
  board point — previously there was **no way to express "from tile 31"**, which
  is half of why the board never had particles.

#### Changed

- **Collected Tokens go to the Token Vault, not the Tray** (reverses D-158's
  destination). Every burst used to fill the rack with things you never chose;
  the Tray now holds only what you put there. **Maps need no special case** —
  `TokenBank.deposit` refuses them (D-156), so they fall through to the Tray.
- **Auto-collect is off by default.** At 2.5s the sweep beat you to the loot
  every time. The `maxItemStacks` cap still trims regardless, so an unattended
  board cannot bury itself.
- **Tokens float like items.** ⚠️ This strikes D-221, whose float/rest split was
  the replacement for the ring D-219 removed — so **nothing now distinguishes a
  draggable Token from a clickable item on the floor**. Accepted deliberately;
  the cheap fix if it reads too quiet is to give the two floats different weight.

#### Fixed

- `gi-loot-drop` scaled sprites 0.2 → 1.18 → 0.92 → 1, resampling pixel art on
  every drop. Loot was the last place in the game still doing this.
- The particle fires on **successful** collection only. A full Bank leaves the
  item on the floor as D-138's litter signal; a particle flying away from a
  sprite that stayed put would misreport where the player's things are.
- A 40-sprite Collect All would have fired 40 particles on one frame. The
  stagger is now global, capped at 12 drawn — collection itself is unaffected.

### Playmat Refinement — Token motion and the drop (D-230, D-231)

#### Fixed

- **A Token dropped on a tile was drawn twice, in the same place, for a quarter
  of a second.** The drag ghost cross-faded out over the full 280ms *on top of*
  the already-placed Token, because its glide target is the drop point. Measured
  live: state updated at 1ms, the tile drew its Token at ~42ms, the ghost was
  still there at 282ms. On a **successful** drop the ghost now hands over
  instantly; a **miss** still springs back to where it came from.

#### Added

- **Placement lands (D-230).** A Token dropped on a tile falls ~20px, overshoots
  3px on impact, rebounds twice and settles over 380ms, with the shadow snapping
  tight at contact — the lifted/resting shadow vocabulary from D-220, reversed.
  Vertical translation and shadow only: squash would scale the sprite by a
  non-whole number and resample the pixel grid.
- The animation is **stepped, not eased**, across fourteen whole-pixel stops.
  Smooth interpolation between whole-pixel keyframes still lands on fractional
  offsets, and a composited pixel-art layer translated by a fraction of a pixel
  gets resampled by the compositor.

#### Changed

- **Unstaffed Tokens are no longer dimmed (D-231).** They rendered at
  `opacity-55`; they now render at full strength. D-149 is unchanged and still
  governs alert marks — an unstaffed Token is still not an error — it just no
  longer fades the art. ⚠️ Accepted cost: which tiles are actually producing is
  no longer readable at a glance; the progress ring is now the only at-rest cue.

### Playmat Refinement R-1 — Tokens read as one physical object everywhere

Decisions **D-215…D-222**, recorded in
[`token_object_intent.md`](token_object_intent.md) and summarised in
[`playmat_decisions.md`](playmat_decisions.md). Branch `token-object`.

#### Changed

- **Token art now renders at exactly two sizes: 128px in play, 64px in storage.**
  It previously rendered at **six** sizes across **eight** components — 96 on a
  tile, 40 in the Tray, 96/40 on the two drag ghosts, 36 on the floor, 32 in the
  Vault, 22 in the Cartographer, 48 in the inspection header.
- **`ART_PX` 32 → 64 and `TILE_SCALE` 4 → 2.** `TILE_PX` and `BOARD_PX` are
  derived and **unchanged** — the board is still 128px tiles on an 896px grid.
- **No frame around Token art on any surface.** The Tray slot's border and panel
  background, the drag ghost's black panel and white ring, and the loot sprite's
  ring are gone. Every Token carries the same contact shadow instead.
- **Bloom on cross-over is retired.** A carried Token is 128px from pick-up to
  release; being held is expressed by a raised, softened shadow and a small
  upward offset. The shared drag wrapper's `scale: 0.72 → 1` spring and `-4°`
  rotation were removed **for every ghost kind**, heroes and items included.
- **Loose loot: items hover, Tokens rest.** Replaces the ring that used to mark a
  floor sprite as draggable. Under `prefers-reduced-motion` the bob stops but the
  raised shadow stays, so the distinction survives.
- Cartographer pool chips 22 → 32px (a recorded exception for dense listings) in
  slightly larger `w-9` wells; inspection header 48 → 64px.

#### Added

- **`TokenSprite.jsx`** — the single component every surface now draws through,
  with the surface→scale table and the shared resting/lifted shadows. A seventh
  and eighth surface had already drifted before this existed.

#### Fixed

- **The board tile would have rendered blurry the moment real Token art was
  wired in.** 96px against a 64px source is 1.5× — fractional. It looked correct
  only because the game currently draws 32px *skill* placeholders at a clean 3×.
- **The Tray (40px) and floor sprites (36px) were rendering at fractional scales
  and were visibly wrong already.**
- `DragGhost.jsx`'s ⚠️ note from Phase 2 — the ghost frame "still sized to the
  retired banner tiers" — is closed. The box was updated then; the image was not.
- `TokenSprite` sets `max-width: none`. Tailwind's preflight `img { max-width:
  100% }` silently shrinks art to its container, which clamped the 128px drag
  ghost to a 74px Tray slot — bloom reintroduced by accident.

#### Known costs, accepted deliberately

- **Board art now fills the tile edge to edge**, so adjacent Tokens touch, the
  floor art is hidden under them, and the progress ring, alert dot and hero chip
  sit on artwork. Legibility of those marks belongs to **R-7** and **R-6**.
- **A part-full Tray may read as clutter** without its slot frames. Restoring a
  recessed socket on *empty* slots only is the named one-line fallback.
- Real Token art is **still not wired up** — 15 finished 64×64 sprites sit unused
  in `public/assets/tokens/`. Out of scope here by the brief; this work is
  *sized* for them and *verified* with the placeholders.

## [0.5.0] — 2026-08-07

The 7×7 Playmat rework, complete. The Area Deck Loop is gone; the game is a
board you place things on.

### 7×7 Playmat Rework — Phase 10: Polish, Clutter & the First Balance Pass

The phase exists to ask **is the board enjoyable?**, and its deliverable is
[`playmat_balance_report_v1.md`](playmat_balance_report_v1.md) — a written
report rather than a code summary.

#### Measured

- **Risk 7 (clutter) is closed.** On a deliberately worst-case board — 48
  Tokens, 8 heroes, both alert colours, work in progress, loot on the floor —
  **17 elements compete with the Token art; 64 in total.** Against 128 at Phase
  3 and 84 at Phase 4: **the board got quieter as it gained systems.** Two
  mechanisms did it — the progress ring is mounted on all 48 tiles and *drawn on
  4*, and alert marks appeared on exactly the 2 tiles with real problems, because
  D-149 refuses to flag an unstaffed Token.
- ⚠️ **Risk 13 is real but milder than feared.** Under a sustained shortage a
  deep consumer (needs 5) took **48% of the scarce material** against a shallow
  one (needs 2). The fear was deep chains squeezed toward zero; instead
  first-come allocation splits supply almost evenly *by volume*, and the deep
  chain converts its half into fewer, larger outputs — which is what a deep chain
  is for. **The completion count (8 vs 3) is the misleading number** and is the
  one the risk was framed around. No change recommended to D-127; a guard test
  now pins the input share above 30%.
- **Pacing lands on target.** 85 completions across 300 board-seconds with 7
  heroes → 3.53s each; ~3.1s extrapolated to a full 8-hero roster, against
  D-164's 2–3s intent. Every completion is individually legible.

#### Added

- **`src/tests/Risk13Allocation.test.js`** — the risk-13 measurement, kept as a
  permanent regression net so a later allocation change cannot quietly make it
  worse. Measures **input share**, not completions.
- **`ui/components/drawer/TokenInspection.jsx`** — a Token's full detail sheet.

#### Fixed

- **D-145 was never actually implemented.** The inspection panel handled items
  only — its own comment claimed a Token branch was "added in Phase 4", and it
  was not, so the Vault's and Cartographer's inspect clicks silently did
  nothing. Token detail is now available **wherever a Token sits**: Vault, Tray,
  Cartographer pool and board. One sheet carries three requirements at once —
  planning before placement (D-145), **visible pairings** (D-18: a player cannot
  discover "a Smelter needs a Mould" by trial without spending a tile and a
  hero), and **where to restock it** (D-159).

#### Notes

- ⚠️ **Three questions remain open and are the owner's to judge**, not
  measurable: does a Map burst feel like a reward (D-167), is a board with no
  antagonist interesting for an evening (risk 5), and does adjacency read as
  meaningful (risk 2). All three are load-bearing. The report says so plainly
  rather than answering them on the owner's behalf.
- ⚠️ **Only 4 of 18 enemies are usable** — the largest content constraint in the
  game right now, carried over from Phase 9.
- `RegenSystem` regenerates Energy, which nothing consumes, and throws if a hero
  lacks the field — the deferred Energy sweep (`G-8`) showing through.
- Audio for placement, displacement, burst and depletion (§E) is **not done**;
  it is additive and needs no systems work.

### 7×7 Playmat Rework — Pre-Phase-10: Engine fixtures split from shipped content

**Groundwork for the balance pass**, and the fix for the coupling Phase 9
reported as the real shape of risk 17.

Engine tests were asserting against shipped content, which quietly made every
balance change a test-breaking change: retuning the Oakwood Grove failed
assertions in `TokenCycle`, `Managers` and `AdjacencyEffects` that were never
about the Grove. Phase 10 is *a retuning phase*, so left alone it would have
spent its whole length fighting the suite.

#### Added

- **`src/tests/fixtures/testTokens.js`** — 18 `fixture_*` Tokens with stable,
  deliberately legible numbers (a producer that makes exactly 2 every 12s; a
  shallow consumer needing 2 beside a deep one needing 5). **These are
  instruments, not content** — they are not tuned for game feel and must not be.
- **`registerTokenTypes()`** on the Token registry — a seam for fixtures only,
  documented as such. Nothing in `src/systems` or `src/ui` may call it.

The split is now: **engine suites test the machinery against fixtures;
`ContentRules.test.js` tests the content against the authoring rules.** Eight
suites migrated (`TokenCycle`, `AdjacencyEffects`, `BoardCombat`, `Managers`,
`TokenBank`, `Consolidation`, `Placement`, `Market`).

**Verified by doing the thing it exists to allow:** retuning the Oakwood Grove
from 2-per-12s to 5-per-17s — a realistic balance edit — broke **nothing**.
Before this change it would have failed assertions in three files.

#### Fixed

- **A flaky combat test**, caught while re-running the migrated suites. *"Retreat
  returns the enemy to full HP"* sampled enemy HP once after a fixed 4s window,
  and failed roughly one run in twenty. Two opposed causes: damage is rolled, so
  a short window sometimes lands no hit — but a kill triggers an intermission
  that restores full HP (D-103), so a longer window can arrive *after* the
  reset. It now samples every tick and keeps the lowest HP seen, which catches
  the damaged state either way. Confirmed with eight consecutive clean runs.

#### Notes

- `ContentRules.test.js` filters the `fixture_` prefix defensively. Vitest
  isolates module registries per file so no fixture should ever reach it — the
  filter guards against someone later setting `isolate: false` for speed and
  silently turning the content suite into a validator of test scaffolding.

### 7×7 Playmat Rework — Phase 9: Content — Map 1 and Map 2

**The systems finally have something real to run.** Two authored kits replace
the placeholder Tokens, and a new game opens into a playable first minute.

#### Added

- **The Woodland kit (Map 1) — 23 Tokens.** Four barehanded producers, a
  tool-gated one, a Passive Generator, four stations (two of them
  context-driven), five context Tokens, four buffs, two Managers, a Market,
  three enemies and a Mythic. Real chains throughout: ore and charcoal into
  copper ingots, ingots and yew into a 48g Copper Sword — **items are worth
  more used than sold** (D-128) as content rather than as a slogan.
- **The Riverlands kit (Map 2) — 8 Tokens**, deliberately thin. It exists to
  make the price step and the **strength/demand jump** real (D-95): a River
  Delta yields six times an Oakwood Grove's value per second, behind a skill
  wall a starting hero cannot clear, and its Alembic needs two producers
  feeding it where the Woodland Still needs none.
- **Tool-gating (D-213)** — the Yew Stand makes *nothing at all* without a
  Copper Axe beside it, and the axe **wears down** as it serves. That wear is
  what makes the deadlock real, which is why rule 1 exists.
- **`src/tests/ContentRules.test.js` (45 tests)** — the authoring rules,
  asserted mechanically rather than by eye, reading the registries directly so
  a new Token is automatically under every rule:
  * ⚠️ **Every material has a tool-free source** (rule 1). D-213 downgraded
    D-51's promise that deadlock is *structurally* impossible to merely
    *authored*; **this test is the only thing preventing the lock.** Verified
    it actually fires by removing the Yew Copse — three assertions failed and
    named the locked material.
  * ⚠️ **Every Passive Generator is beaten by a staffed producer** of the same
    item (rule 2, risk 11), compared as units per second.
  * **Resources consume nothing, stations always cost, Markets pay only in
    currency** (rule 3, D-97).
  * **Every cycle time inside 10–30s** (rule 4, D-164).
  * Registry integrity: every recipe's context exists, every Manager's targets
    exist and never deplete, every enemy Token resolves, every Map pool is a
    complete kit with producers + Manager + enemies, and **no Map pools a Token
    from another theme**.
- **A new game now opens playable** (D-122, D-123): one hero, 120 gold, four
  Tokens in the **Tray** and an empty board, with the Cartographer opening
  itself. Tokens start in the Tray rather than on the board because placement
  is the one action that teaches the game.

#### Fixed

- **Two Tokens named sprites that do not exist** (`skill_explore`,
  `skill_melee`), which rendered as an invisible Token and a 500 in the network
  log and nothing else. A content rule now asserts every sprite file is real.

#### Notes — the authoring cost, reported honestly (risk 17)

- **23 Tokens for Map 1, not the ~15 the roadmap budgeted.** A complete kit per
  D-139 simply needs more than fifteen once producers, context, tools, buffs,
  two Managers, a Market and enemies are all present.
- ⚠️ **The painful part was not the numbers — it was the couplings.** Tuning a
  Token is quick. What cost the time was that **engine tests pin content
  values**: `TokenCycle` and `AdjacencyEffects` assert specific yields, inputs
  and item ids, so retuning content breaks tests that are not about content.
  **This is the thing to fix before 60 Tokens** — engine suites should run
  against their own fixture Tokens, not shipped content. At 23 it cost an hour;
  at 60 it will be the reason nobody wants to retune anything.
- ⚠️ **Only four enemies are usable, and it is not the four you would guess.**
  `enemyRegistry.js` defines eighteen, but every one drops **legacy item ids**
  (`thorn_vine`, `boar_tusk`, `leather`) that do not exist in `data/items.json`
  — so a kill resolves to no loot at all, silently. Only the four in
  `data/enemies.json` point at real `item_*` ids. This is the duplicate-registry
  problem biting content authoring; enemy variety is capped at four until it is
  resolved.
- **The Forge's chain keeps its placeholder flavour** (coal → Spider Silk) —
  those exact recipes are pinned by `AdjacencyEffects`, so re-flavouring them
  is part of the fixture decoupling above rather than a content edit.

### 7×7 Playmat Rework — Phase 8: The Cartographer & Maps

**Progression, and the game's headline reward beat.** The replacement for the
pack/booster economy: buy a Map, tear it open, and everything in it is yours.

#### Added

- **`config/registries/mapRegistry.js`** — the catalogue. Two placeholder Maps
  (Woodland 200g, River 2,000g), because **one Map cannot prove D-166**: the
  curve is *flat within a theme, stepped between them*, and the step needs a
  second theme to exist at all.
- **`systems/board/Cartographer.js`** — an off-board NPC with a menu (D-98),
  the second and last deliberate exception to "everything happens on the board".
  The Map itself is still a Token, so only the transaction leaves the grid.
  * **Every Map listed from the start, in price order** (D-99, D-101). Nothing
    is ever locked; cost is the only gate, so an unaffordable Map shows its real
    price rather than a greyed-out node.
  * **Materials pull automatically from the Bank** (D-150), reusing
    `InputAllocator` — the same path Token inputs already take. Gold and
    materials are both taken only after every check passes, so a refused
    purchase costs nothing.
  * **Discovery drives the silhouettes** (D-159). Each Map shows its full pool
    with unseen entries as silhouettes, which does two jobs: it makes restocking
    deliberate (a player short of Forests can see which Map yields them — the
    main mitigation for D-154's randomness) and it restores the collection hook
    that died with playsets.
- **Maps as Tokens** — `tokenType: 'map'`, carrying `mapId` the way enemy Tokens
  carry `enemyId`, with **`uses: 1`**. That single charge is what makes a Map a
  *burst* rather than a dispenser (D-155). They have no rarity at all (D-132),
  and **`TokenBank.deposit` now refuses them outright** (D-156) — enforced as a
  rule so no future path can quietly stockpile them.
- **The burst** — double-click a Map in the Tray or on a tile and it tears open,
  scattering 3–6 things across the board as sprites (D-142, D-167). Opening it
  on a tile scatters around where it sat; opening it in the Tray throws them
  onto the grid. Either way it is spent.
- **`ui/components/drawer/CartographerTab.jsx`** — the shop, as a drawer pane
  beside the Bank and Vault (owner decision 2026-08-07). Every refusal states
  its cause on the row: short gold, short materials, or no room in the Tray.
- **Market Tokens (D-141)** — *added at the owner's request; the roadmap does
  not schedule them at any phase.* A Lumber Market is a Token whose **output is
  currency**: goods-specific, with an input list, a hero and a tile like
  anything else. It closes the loop Maps depend on — **board → goods → gold →
  Map** — so gold income is a placement decision rather than a menu action.
  `BoardRunner` now routes a `currency` output to `CurrencyManager` instead of
  the sprite layer, since gold is not an item and has nowhere to land.

#### Notes

- ⚠️ **The one thing these tests cannot pin is the thing the phase is for.**
  D-167 says a 3–6 item burst rests on *presentation, not volume*, and that if
  it reads flat the lever is presentation first and volume second. The
  mechanics are verified; **whether the burst feels like a reward is an owner
  judgement that has not yet been made.**
- ⚠️ **The gold faucet is thin and was thin before this phase.** Maps are the
  primary sink (D-96) against income that was, until the Market landed, just
  selling loot at `baseValue`. One Market pays 34g for 10 Oak Wood worth 20g
  raw — a deliberate premium that buys the tile and the hero, deliberately
  modest so feeding a Market never beats building a chain (D-128). Both numbers
  are placeholders for the Phase 10 balance pass.
- **Doc correction:** D-170 ("Uncommon's defining attribute is undecided",
  marked *needs answering before loot tables are authored*) was **already struck
  by D-175**, whose rationale says so outright — once rarity means only drop
  frequency, Uncommon needs no special identity. D-169 and D-170 are struck but
  carry no strikethrough on their own entries, unlike D-50, so both read as
  live. Marked.

### 7×7 Playmat Rework — Phase 7: Banks, Managers & Guild Upgrades

**The AFK story becomes real.** Until Managers existed an unattended board
simply wound down as charged Tokens ran out. The chain is now closed:
**gold → Token Vault → Manager → board** — the board runs as long as you left
it supplies for, which turns logging off into a decision rather than an event.

#### The change that unblocked the phase

- **A hero's position is now its own state** (`board.heroTiles`), not a
  `heroId` field on the Token instance. The old model had one fatal property:
  **a hero could not outlive the Token they stood on.** When a Forest ran dry
  the instance was deleted and the person went with it, silently, back to the
  Dock — so D-151's "a fresh Forest arrives under their feet and they carry on"
  was unbuildable, and D-57 and D-60 were quietly unimplemented too.
  Consequences, all of them the design's stated intent:
  * A hero stands on an **empty tile** and shows as placed-but-idle rather than
    "Reserve" — a wasted person, not an available one.
  * Moving or lifting a Token **leaves its hero standing there** instead of
    scattering them to the Dock. `recallHero` is still how a hero goes home.
  * Dropping a Token **under** a standing hero puts them to work on it, rather
    than knocking them off — the same courtesy a Manager extends, from the
    player's side.
  * A defeated hero still genuinely leaves: they are carried home.

#### Added

- **`systems/board/Managers.js`** — type-specific restocking on the 8 adjacent
  tiles, never depleting (D-140). Overlapping Managers resolve by ascending
  tile index, which is stable rather than merely arbitrary.
  * ⚠️ **Restocks under a working hero, who resumes with no re-placement**
    (D-151) — verified live: a Forest on its last charge vanished, a fresh one
    arrived from the Vault, and the hero kept producing without being touched.
  * **An empty Vault fails silently** (D-133) — no notification, no retry
    backoff, just the tile's own mark.
  * A **sweep**, not an event handler. Restocking has three independent
    triggers (a Token depletes, a Manager is placed beside an existing vacancy,
    the Vault is restocked while a vacancy waits) and subscribing to all three
    is three chances to miss one. Vacancies are sparse, so the common cost is
    an `Object.keys` on `{}`.
- **`systems/board/TokenBank.js`** — the rules over `BoardState`'s storage
  primitives: **consolidation** (D-77), the slot cap (D-137) and selling
  (D-146). Consolidation re-packs partials into as many full Tokens as possible
  plus at most one remainder, and **totals are conserved exactly** — the rule
  that makes D-54's free repositioning safe, since a round trip through the
  Vault can never gain or lose a charge. Unlimited-use copies never merge.
- **Vacancies** (`board.vacancies`) — a tile that ran dry remembers what
  depleted on it. This is what makes a Manager type-specific without making it
  invasive: a Lumber Camp refills a tile where a *Forest* wore out and **never
  colonises a tile that was simply always empty** (owner decision 2026-08-06),
  so placing one cannot carpet ground you were saving.
- **`ui/components/drawer/TokenVaultTab.jsx`** — one row per distinct type,
  because distinct types are what is capped. Copies are a count, never a list
  of rows. Withdraw is a button rather than a drag: the Vault covers the board,
  so the destination is behind the drawer (UI §2).
- **Guild Upgrades: a third Storage line** (`token_bank_slots`, 12 base + 4 per
  rank) alongside the item Bank's two, and the **Guild Hall tile now opens the
  tree** (D-121) — upgrades are installed on the centre tile, so that is where
  they are bought. The bubble is the second door, not the only one.
- Placeholder Tokens for the new mechanics: two Managers (Lumber Camp, Hunter's
  Blind — the second proving D-104, that **enemies restock like resources**)
  and a Mythic (Heartwood) for the one-placed rule.

#### Changed

- **Mythics sell like anything else** (owner decision 2026-08-06). The
  roadmap's ⚠️ here was justified entirely by "one copy ever", and **D-177
  struck that** — duplicates can be owned, only one may be *placed*. So a sale
  is no longer irreversible and needs no guard. The one-placed rule is enforced
  in `Placement.placeToken`, which is a different thing, and applies to every
  placement path for free.
- **Sell rates are flat per rarity** (owner decision 2026-08-06), not scaled by
  charges remaining. Knowingly the weaker of the two models — running a Token
  to zero before selling loses nothing — but the rate is low enough that the
  "exploit" is worth a handful of gold, and one number per rarity is a number
  the player can learn.
- The Guild Hall screen lost its **Outpost** and **Universal** card sections.
  Both were rank-grants-copies trees for content the deck loop owned; Phase 1
  deleted the content and left two sections that could only ever render empty.

#### Notes

- ⚠️ **Fourth environment trap.** `requestAnimationFrame` never fires in a
  browser tab that is not compositing, and the nav bubbles defer opening by one
  frame to dodge a Headless UI dialog race. **Every bubble looks dead** under
  automated verification for that reason alone. Shim `requestAnimationFrame` to
  run inline before concluding anything is broken.
- Risk 15 checked: with the Vault empty, the emptied tile carries a red mark
  reading *"This tile ran dry and the Vault has no replacement — restock it"*
  and the hero on it carries the yellow one. "I ran out of stock" is
  distinguishable from "something else went wrong".
- ⚠️ Pre-existing, not fixed here: `BoardRunner.isHeroIdle` reports a hero
  **in combat** as idle, because enemy Tokens carry `enemyId` rather than
  `config`. It is currently only read by tests, so nothing surfaces it — but it
  will be wrong the moment it is wired to the yellow mark.

### 7×7 Playmat Rework — Phase 0: Safety, Branch & Test Re-Pinning

Planning and safety work only. **No gameplay behaviour changes in this phase.**
See `playmat_roadmap_v1.md` for the full plan and `playmat_gap_analysis.md` for
the codebase audit behind it.

#### Added

- **`src/tests/ModifierScopes.test.js`** (15 tests) — rescues three modifier
  rules that were pinned only inside `GlobalAuras.test.js`, which Phase 1
  deletes along with the Outpost system it tests. Re-pinned against bare
  aggregators so they survive: duplicates stack additively (D-23), each copy
  needs a distinct source id, and runtime aggregators must rebuild from state
  after a load. Also pins the rule the adjacency work depends on — **every scope
  merges into one set of buckets** rather than resolving separately and
  multiplying (resolving separately gives ×1.95 where ×1.75 is correct).
- **`src/tests/BankOverflow.test.js`** (5 active, 5 skipped) — documents today's
  full-Bank behaviour (items are destroyed; the cycle is refused) and stages the
  D-138 inversion that Phase 3 enables.

#### Changed

- **Version 0.4.2 → 0.5.0** across all five files.
- **Save schema 0.5.0 → 0.6.0** (D-110). Older saves are refused with a message
  rather than migrated — nothing meaningful maps across the board rework.
- Nine superseded docs moved from the repo root to `docs/archive/`, which now
  explains what each was. The archive README also now points at the roadmap and
  gap analysis first, and carries an explicit warning that
  `playmat_skills_concept.md` is design-ahead and **not a build target**.

#### Fixed (documentation)

- **`RegenSystem` heals constantly, not only idle heroes.** Corrected in grid
  concept §8.1, D-136 and hero concept §3.6, all three of which said idle-only
  and derived the retreat mechanic from it. The conclusion survives on different
  grounds — retreat removes the damage source. Risk 14 stays closed.
- **`TokenAxes.js` must be kept, not retired.** Grid concept §10.3 grouped it
  with the card-mutator system; it is generic and is the only consumer path for
  YIELD/WORK_TIME/INPUT_COST. `GlobalModifiers.js` was omitted from §10.3
  entirely and is likewise kept.
- **Hero traits are not deleted** (§10.1) — they are already cosmetic, so the
  brief and the hero spec were right and §10.1 was the outlier.
- **The hero spec's "90 class perks + 90 trait perks re-home" is wrong** — there
  are 9 and 9, they carry no applied modifiers, and their `bonusSkills` name
  three skills that do not exist in the 15-skill system.

### 7×7 Playmat Rework — Phase 6: Combat on the Board

**Ported, not rebuilt** (D-136). The 7-stat engine, status effects, damage
resolution, the Wounded state and passive regen all carry over unchanged — only
the trigger moved, from "hero encounters an enemy card" to "hero is dropped onto
an enemy Token".

#### Added

- `systems/board/BoardCombat.js` — a thin adapter, not an engine. It holds one
  ephemeral card-shaped object per fighting tile so `CombatProcessor` can run
  untouched, rather than fattening every Token to satisfy a signature. Same
  bridge the deck loop used between flyweight slots and the execution engines,
  and never saved: reloading mid-fight restarts the encounter, which is the same
  outcome as walking away.
- **Combat has a tick owner again.** `LoopRunner._tickCombat` was its only
  driver and went in Phase 1; `BoardRunner` now routes enemy Tokens to
  `BoardCombat`. That closes the hole the gap analysis flagged in §2.2.
- Enemy Tokens (Bear, Cow Pasture, Skeleton), **inert until targeted** (D-14).
- **One kill is one cycle** (D-129): kills publish `CYCLE_COMPLETE`, wear
  adjacent support (D-126), and spend a charge (D-104). The progress ring tracks
  the current fight, so it means the same thing on a Bear as on a Forest.
- Combat loot lands **as sprites where the kill happened** (D-40) instead of
  teleporting into the Bank — kills must not be the one thing that skips the
  sprite layer, which would also bypass D-138.
- Defeat routes through the `DefeatPenalties` module extracted in Phase 1: the
  hero is wounded, taken off the board, and the tile is immediately free for
  someone else.

#### Fixed — two bugs the tests caught

- **`servesFrom` silently exempted combat from support wear.** It checked for
  `config`, which enemy Tokens do not have (they carry `enemyId`), so a Weapon
  Rack beside an enemy never wore down. "Runs" now means a work cycle *or* a
  fight.
- **The fight-end hook never fired.** It subscribed to `HERO_MOVED`, which
  publishes `tile: null` on a recall — it names where the hero *went*, not where
  they came from. A damaged enemy would have survived a retreat, letting a
  player chip any boss down across free attempts. The tick now owns ending a
  fight, since it visits every tile anyway.

#### Notes

- Retreat is still **not a mechanic** (`G-3`) — it is unassigning the hero, and
  falls out of Phase 2's placement rules. The enemy returns to full HP (`G-4`),
  which is what gives "watch your first few fights" (D-130) any weight.
- ⚠️ Minor pre-existing issue surfaced by stress-testing: rapid kills interrupt
  the victory SFX. Harmless at real pacing; not addressed here.

### 7×7 Playmat Rework — Phase 5: Adjacency & Effects

**Placement now matters.** Adjacency governs *what*, not *how much* — context
Tokens define what a station makes (binary, decisive), and numerical buffs are a
small optimisation layer on top.

#### Added

- `systems/board/TileModifiers.js` — one runtime aggregator per tile, rebuilt
  from board state on every neighbourhood change and replayed after a load.
  Successor to `AreaModifiers.js`, same discipline, new scope.
- **The three axes now cross scopes (`G-5`).** `YIELD`, `WORK_TIME` and
  `INPUT_COST` read the 8 neighbours, so a Sawmill beside a Forest actually
  changes its output — the thing D-119 describes and the old engine could not do.
  Every scope merges into **one** set of buckets and resolves once; resolving
  separately and multiplying is how small effects quietly become large ones.
- `systems/board/RecipeResolver.js` — context crafting. A Forge with a Helmet
  Schematic beside it makes helmets; with nothing beside it, **nothing at all**
  (D-18). Conflicting context is an **error state**, not a silent priority order
  (D-20). A context Token serves **every** adjacent station (D-113), and wears
  **once per cycle served** (D-126) — one Rack driving three Forges wears three
  times as fast, which is what makes sharing a rate trade rather than free value
  (D-157).
- `ui/components/board/ConnectionLines.jsx` — shown on **hover only** (D-84).
  Gold solid for context, blue dashed for buffs, with the active recipe drawn on
  the line. The board is clean by default; permanent lines across 48 Tokens are
  the unreadable mess that killed the previous spatial playmat.
- Two new alert states: `conflict` and `no_recipe`, both with plain-language
  hover text.
- Placeholder Tokens gain context and buff data — a Forge with two recipes, two
  schematics, a Sawmill, a Tool Rack, a Shrine (`noStackDuplicates`, D-82) and a
  hero-targeted Campfire (D-112).

#### Notes

- ⚠️ **`G-5` was cheap, and the reason matters.** The gap analysis flagged
  widening the three axes as significant work because they were card-local. But
  Phase 4 had already replaced their consumers, so this was three call sites in
  `BoardRunner`/`InputAllocator` rather than a retrofit of `LootSystem`,
  `StatProcessor` and `WorkProcessor`. Rewriting the consumer first made the hard
  problem small.
- Buff numbers are deliberately **tiny** (D-119/D-120). Stacking stays uncapped
  because effects are small (D-23) — eight Sawmills give +40%, not +400%. If
  that ever reads as large, the numbers have drifted, not the rule.

### 7×7 Playmat Rework — Phase 4: Token Cycles & Heroes at Work

**The first playable moment.** A hero stands on a Forest and Wood appears.

#### Added

- `systems/board/BoardRunner.js` — the cycle engine, on its own tick handler.
  Fast path: 99% of ticks only add `delta` to a countdown; paying inputs,
  granting output and spending a charge happen only when a timer hits zero.
  Tiles are sparse, so an early board with four Tokens iterates four times.
- `systems/board/InputAllocator.js` — **inputs are pulled automatically from the
  global Bank** (D-24). No assignment step, no input slots, no dragging items
  onto Tokens; the deck loop's `assignedItems` model is gone. Supply is not
  spatial (D-83). Loot on the floor is consumed when the Bank is short (D-42),
  so lying loot never starves a chain.
- **First-come allocation** (D-127): a Token runs at full speed when it has its
  inputs and **waits** when it does not. No partial cycles. Shortfall resolves
  per item, so a coal shortage only affects coal-burners.
- `ui/components/board/TileProgressRing.jsx` — ref-driven, writing
  `stroke-dashoffset` directly. **Zero React renders**: 48 tiles publishing
  progress several times a second through `useState` is the cascade the deck
  loop's ref-bar pattern existed to avoid. Invisible unless actually progressing.
- **Alert marks** (D-85, D-114, D-149, D-172). One red mark per Token, with the
  cause on hover, raised **only when a Token has a hero and still cannot work** —
  an unstaffed Token is not an error and dims quietly instead. A separate
  **yellow** mark rides on the *hero*, not the tile, so it costs nothing against
  the tile's budget.
- Charges and depletion (D-176/D-118): one charge per completed cycle, `null`
  meaning unlimited and never decremented, and the Token disappearing when spent
  — leaving its hero idle where they stand (D-60).
- Passive Generators run with no hero (D-116), and a test pins that they stay
  **strictly worse per tile** than the same job staffed (risk 11).
- Token registry gains execution config (cycle time, inputs, outputs, XP,
  `skillRequired`). Still placeholders — Phase 9 replaces the contents.

#### Changed

- **Token tiles show the sprite and nothing else** (owner decision 2026-08-06):
  *"just display the sprite, like a little toy."* No name label, no charge
  counter — identification is by art, with the name and remaining uses on hover
  (D-22) and in the inspection panel (D-145). Competing elements on a full board
  went **128 → 84** even though this phase *added* rings and alert marks.
- The Hero Dock names the Token a hero is working ("Rune (Lv1) — Fishing Hole")
  and shows the yellow pip when they are stuck or standing on something inert.

#### Measurement

- ⚠️ **Risk 13 is now measurable rather than theoretical.**
  `InputAllocator.getStarvationStats()` counts blocked ticks per Token type, and
  a test pins the failure mode: with 3 wood available, the Still (needs 2) runs
  while the Deep Kiln (needs 5) starves. The first balance pass gets data, not a
  hunch.
- ⚠️ **G-1 is pinned by a test.** A level-99 hero works a Forest at exactly the
  speed a level-1 hero does. Hero Speed and Efficiency are deliberately deferred,
  and the test exists so nobody fills the hole in by accident.

### 7×7 Playmat Rework — Phase 3: The Sprite Layer

Built **before** anything produces, deliberately: three later systems land
through it (Map bursts D-142, crafted Tokens D-148, and D-138's overflow rule),
so building it first means each is correct on arrival rather than built against
a stub and unwound.

#### Added

- `systems/board/SpriteLayer.js` — loot floating above the grid, occupying no
  tile (D-40). Items pop out on an arc and settle 1–2 tiles from their source;
  same-type items merge into counted stacks after a grace window, so a producing
  board doesn't fill with individual icons. **Tokens never merge** — each carries
  its own charges, and summing two half-spent Forests into "2 Forests" would
  invent or destroy uses.
- **Sprites are persisted**, unlike every other piece of board runtime state. A
  Mythic sitting on the floor because storage was full cannot evaporate on
  reload — that would be exactly the loss D-138 exists to prevent, arriving by a
  different route.
- Routing **by kind** (D-158): items to the Bank, Tokens to the Tray, with
  Tokens cascading Tray → Token Bank → stay on the board.
- **Grab-and-place** — drag a Token sprite straight onto a tile with no trip
  through storage (UI §6). This is what makes opening a Map flow into building.
- `consumeFromSprites` (D-42) so loot on the ground never starves a chain.
  ⚠️ The primitive is built and tested; **Phase 4 wires it** into input
  resolution, since that path is being rewritten there anyway.
- Auto-collect and a visible-stack cap (D-41/D-88), both off a settings entry.
  Collection confers **no mechanical advantage** — manual and automatic are
  identical in outcome, and `maxItemStacks: 0` disables the visual mechanic.
- `gi-loot-drop` keyframes with a real bounce, and a `prefers-reduced-motion`
  opt-out. The overshoot is the point: a burst is only 3–6 things (D-167), so
  the spectacle rests on presentation rather than volume.
- Dev tools: scatter a burst, and the board-clear now also clears sprites.

#### Changed — the D-138 inversion

- **`InventoryManager.addItem` no longer destroys overflow.** It publishes
  `inventory_overflow` and the sprite layer catches it, so the item stays on the
  board until the player makes room. The handoff is an event rather than a call
  because the two modules would otherwise import each other — which does mean
  the guarantee is **one subscriber deep**, so `SpriteLayer.init()` is the first
  thing to check if items ever start vanishing.
- **`CardPreflight` no longer refuses a cycle on output capacity.** The cycle
  completes and the loot lands on the floor. Under the old rule a full Bank
  silently stopped production, which looked identical to a supply problem.
- `CardFailure.test.js`'s capacity-failure cases are retired in favour of
  `BankOverflow.test.js`, which Phase 0 wrote as a skipped spec and Phase 3
  enables. Its input-starvation and success cases are untouched.

#### Fixed

- `SpriteLayer.init()` is idempotent. Subscribing twice created **two** sprites
  per overflow, so the pile doubled on every re-init — and because each sprite
  was individually valid it read as an economy bug rather than a wiring one.

### 7×7 Playmat Rework — Phase 2: The Board — State, Grid & Placement

**The board is manipulable.** Tokens can be placed, shoved around and picked up;
heroes can be stationed and redeployed. Nothing produces anything yet — that is
Phase 4. This is deliberately the earliest possible read on the design's own
most uncertain claim, that *the board itself is enjoyable*.

#### Added

- `systems/board/adjacency.js` — D-81's 8-neighbour rule, the single most
  re-used primitive in the design. Precomputed at module load (the board is a
  fixed size forever) and frozen, so a stray `push` fails loudly instead of
  corrupting every later lookup. `dependentsOf` is the same neighbourhood named
  for wear, which is what D-126/D-157 need.
- `systems/board/BoardState.js` — tile, Tray and Token Bank primitives. Tiles
  are a **sparse map**, so an empty board costs nothing and the tick loop walks
  only what exists. The Token Bank caps **distinct types, never copies** (D-137)
  and draws a full Token before a partial one (D-77).
- `systems/board/Placement.js` — every displacement rule in one module, because
  they interlock. Incoming wins; displaced Tokens go to the Tray, displaced
  heroes to the Dock; any interruption forfeits the cycle (D-54/D-131).
- `config/registries/tokenRegistry.js` — ⚠️ **placeholder** Token types so there
  is something to place. No cycle behaviour; Phase 4 extends the shape and
  Phase 9 replaces the contents.
- `ui/components/board/Board.jsx`, `BoardTile.jsx`, `Tray.jsx` — the live board
  at 128px tiles (896px, D-171), replacing `BoardStub`. The Tray is permanent
  and load-bearing (D-107): an open Bank covers the board, so the only route
  from storage to a tile is Bank → Tray → Board.
- `DRAG_KIND.TOKEN` plus a Token drag ghost that blooms to **exactly tile-sized**
  over the board, so what you carry is already the size of the hole it goes into.
- Dev tools: fill the Tray, clear the board.
- 57 new tests — `Adjacency.test.js` (19, exhaustive across all 49 tiles) and
  `Placement.test.js` (38, every displacement path).

#### Fixed

- **The tile no longer draws a charge counter.** D-85 budgets a tile at exactly
  three things and lists "uses remaining" as *hover only*; a counter per tile put
  36 extra numbers on a full board. Moved to the tooltip — competing text
  elements on a full board dropped **85 → 49**. This is risk 7 (visual clutter
  killed the previous spatial playmat) caught by the standing check rather than
  in Phase 10.
- Removed a dead "Unlock Area Cards" dev button left over from Phase 1; it
  called a state setter that no longer existed and would have thrown on click.

### 7×7 Playmat Rework — Phase 1: Demolition & Dormancy

**The deck loop is deleted.** The game boots to an inert 7×7 board; placement
arrives in Phase 2. This is the clean-break phase — no feature flag, and the
game is deliberately unplayable in the ordinary sense until Phase 4.

#### Removed

- **The loop engine** — all of `systems/loop/` (`LoopRunner`, `DeckSlotManager`,
  `StationManager`, `StationSlotManager`, `OutpostManager`, `SlotFailures`,
  `LoopBuffs`, `AreaModifiers`) and all of `systems/area/`, plus `areaEvents.js`.
- **The card-mutator system** — `TokenRegistry.js`, `SlotTokens.js`,
  `MutatorStamping.js`, `CardTokenOverlay.jsx`. This is what frees the name
  "Token" for board objects.
- **The deck-loop UI** — the whole `banner/` folder (~2,900 lines), the binder
  modal and library, `ActiveCardFace`, `AreaManagerScreen`, `AreaUnlockOverlay`,
  `CardPips`, `CardInspection`, `ItemDurabilityBar`.
- **The pack economy** — `CollectionManager` and `PackOpeningOverlay` (D-153:
  Maps absorbed packs). The roadmap had these surviving until Phase 8 to be
  mined for the Cartographer; they were deleted early instead because the
  mechanics differ in every particular (per-area escalating price and
  pick-1-of-N versus flat within-theme price and a take-everything burst). Git
  history is the reference.
- **Item durability** (D-118) — `DurabilitySystem.js`. Token depletion is now
  the only wear mechanic. Defeat-loss is the only way gear leaves a hero.
- **9 of 14 Guild Upgrade nodes** — the universal-card grant, Outpost banners
  and seven station grants. `stack_size` retired separately: it added +50 to a
  ceiling of 1e12.
- Progression: `BinderManager`, `BinderMastery`. Dev tooling: the card-unlock
  modal and the deck-loop QA buttons.

#### Added

- `systems/board/boardEvents.js` — the board's event vocabulary, successor to
  `areaEvents.js`. Declared ahead of its publishers so surviving systems have
  something to subscribe to; `CYCLE_COMPLETE` is the universal unit of work
  (one kill counts as one cycle, D-129).
- `ui/components/board/BoardStub.jsx` + `boardConstants.js` — an inert 7×7 grid
  at 128px tiles (D-171), Guild Hall fixed at index 24 (D-106), rendered with the
  existing playmat floor art. Exists so the game still boots through the
  demolition, which is the only safety net a no-flag branch has.
- `systems/combat/DefeatPenalties.js` — D-74's rules, extracted from the deleted
  `LoopRunner._applyDeathPenalties` rather than lost with it.
- `ui/components/base/VitalBar.jsx` — rescued from the deleted banner folder.
- `state.board` in the schema (`tiles` / `tokenBank` / `tray`), with `GameState`
  accessors. Save roundtrip verified.

#### Changed

- **`TokenAxes.js` → `EffectAxes.js`** and **`GlobalModifiers.js` →
  `effects/GuildModifiers.js`** — both kept, per the gap analysis. `EffectAxes`
  is the only consumer path for YIELD/WORK_TIME/INPUT_COST.
- **The Hero Dock speaks tiles, not areas.** `describeActivity` takes
  `tile` / `tileStatus` / `tokenName`; its pip vocabulary is unchanged and is
  D-172's yellow idle-hero mark. ⚠️ Tile 0 is a valid index, so placement is
  tested with `== null` — a truthiness check would show a hero working the
  corner tile as "Reserve" forever.
- **Energy is muted** (D-183/D-184). Both cost constants now have zero
  consumers — the cut landed for free once card draws and Outposts were gone,
  needing no removal pass. The pool, Drink category and `tryDrink` stay dormant
  (~180 refs across ~45 files); the Dock's Energy bar is hidden.
- **Quests are muted** — the board tick is unregistered and `QuestTracker`
  short-circuits behind `QUESTS_ENABLED`. ⚠️ Its *area-unlock quest* half was
  deleted outright (§10.1 lists those), which is different from dormant.
- `data/cards/` → `data/archive/cards/`; the card glob is now empty.
- `StatusEffectSystem` decays cycle-duration buffs on `BOARD_EVENTS.CYCLE_COMPLETE`
  instead of a per-area card completion, and no longer clears statuses on
  "leaving an area" — a hero moving between tiles is the game's most frequent
  action, so clearing there would delete a buff the player just bought.

#### Tests

39 files/563 tests → **29 files/341 passing + 5 skipped**. `Mutators.test.js`
trimmed from 130 to 57 (three-bucket maths, tag derivation and the effect axes
survive; slot-token lifecycle, stamping, the Area Anchor and badge data go).
`DefeatPenalties` re-pointed at the extracted module. `SaveRoundtrip`'s
serialization case re-pointed from areas/outposts to board state, including that
an unlimited-use Token's `null` charges must not come back as `0`.

### Changed

- **Banner rows are one card slot narrower.** The width formula reserved six
  card slots, but both banner kinds render five — an area is Info / Hero /
  Active / Next / Deck, an Outpost is Info / Hero / Inputs / Output / Station.
  The sixth was left over from before Outposts split into their own banners
  (D-16), and showed as ~116px of dead space on the right of every banner. At
  the current card width the banner goes 784px → 668px.
- **Notifications default to the top right again**, reversing the earlier move
  to centre-bottom. The migration that used to rewrite stored `top_right`
  values onto `center_bottom` has been removed rather than left fighting the
  value it now rewrites to.
- **Master volume defaults to 0** while the game is in development. A one-time,
  marker-guarded migration also clears any master volume already in
  localStorage, so existing browsers go quiet too; raising it afterwards
  persists normally.
- **The Time Bank widget is hidden.** Parked behind a `SHOW_TIME_BANK` flag in
  `ReactRoot.jsx`, not deleted — the widget and `TimeBankManager` are untouched.

### Changed — Hero Dock

- **The activity badge is now a bare status pip.** Four colours and no words:
  red injured, yellow assigned-but-stopped, green working, blue available. The
  area name moved into the hover tooltip. Yellow deliberately covers *every*
  stopped state — out of inputs, out of energy, bank full, or a banner paused
  by hand — so the rule the player learns is simply "yellow means this hero
  isn't doing anything" (owner decision 2026-08-02).
- **Gear and skills now share the card body behind a toggle.** Both grids used
  to render stacked into a body too short to hold them, silently clipping the
  bottom rows of skills. One section shows at a time; the toggle is dock-wide
  rather than per-card, so two cards pinned for comparison always show the same
  side. The Edit button moved into that toggle row, where it no longer covers
  the ninth equipment slot.
- **HP and energy bars on the dock card header**, using the same `VitalBar` the
  banner hero cards use.
- **The dock now lifts to sit on an open bottom drawer.** It moved inside the
  play area, so it anchors to the bottom of the banner region rather than the
  screen: flush to the screen edge with no drawer open, resting exactly on the
  drawer's top edge when one opens, instead of covering its lowest band.

### Fixed

- **Crash when a hero with an equipped Consumable started a loop.** The Prep
  Phase branch of `ActiveCardCell` read `engine.GameState` in a component that
  never called `useEngine()`, so the banner threw `ReferenceError: engine is
  not defined` the moment an area entered `prepping`. Present since the Prep
  Phase landed (`d4dd4f0`); it only fired for heroes actually carrying a
  potion, scroll or rune, which is why it went unnoticed.
- **Food and drink can be equipped again.** Prepared dishes and drinks authored
  in `data/items.json` carried no `equipSlot`, so `EquipmentManager.equipItem`
  rejected every one of them with "Item cannot be equipped" — before any of the
  drag-and-drop code was reached. This was invisible in testing because the
  legacy item table in `itemRegistry.js` defines a parallel set of food ids
  (`apple`, `blueberry`, `drink_water`) that *do* declare an `equipSlot`; only
  the `item_*` ids the player can actually obtain were affected. Water, the
  three pies and both stew lines (six tiers) now declare `food`/`drink`.
- **Water restores energy again.** `item_water` had a `restoreType` but no
  `restoreAmount`, so drinking it did nothing. It now mirrors its legacy twin
  `drink_water` (20 energy).

### Changed

- **Raw ingredients are no longer hero food** (owner decision 2026-08-02).
  Single berries, carrot, celery, cherry, shrimp and steak stay pure crafting
  materials; only prepared dishes and drinks can be equipped. This is a
  deliberate change from the legacy table, which let heroes eat raw meat.
- `item_cherry_pie` gained a `restoreAmount` of 8, interpolated between
  blueberry pie (5) and blackberry pie (11). **Needs a balance review** — its
  `baseValue` is still 0 and it has no recipe.

## [0.4.2] — 2026-08-01

The **Area Deck Loop rework**, complete. Tagged `v0.4.2`. Outposts became their
own banners, card ownership moved into per-area binders, the economy went
per-area, and defeat has real consequences again.

**⚠ This release breaks save compatibility** — the save schema version moves to
`0.5.0` and older saves are refused, by design. (The save schema and the app
version are deliberately independent.)

### Area Deck Rework — Outposts are their own banners (C-10)

- **Outposts split off from areas.** An Outpost used to be the "stationed" face
  of an area banner, reached by a Wilds/Outpost toggle. It is now a **standalone
  banner** holding one card, and an area banner has a single face with no
  toggle. Outpost effects are guild-wide rather than limited to one region.
- **The playmat is yours to arrange.** Areas and Outposts sit in one list you
  can reorder, and any banner can be taken **off the playmat** — that stops its
  work and returns its hero to the roster, while keeping its deck, installed
  card and progress for when you put it back. Both live in the Area Manager.
- **The station Drink slot is gone.** A hero crafting at an Outpost drinks from
  their own loadout, exactly as they do in the wilds.
- **⚠ Save break.** The save schema version moves `0.4.0` → `0.5.0`, so saves
  from earlier versions are refused and a new game is required. (This is the
  save-schema gate only; it is independent of the app version.)

### Outpost cards come from the Guild Hall (C-12)

- **The guild tree is now the only source of Outpost cards.** They aren't
  crafted, dropped, or pulled from packs — you buy them as tree nodes, and
  **each rank grants another copy**, which is how aura stacking is supplied.
- **New "Outpost Banners" node.** You start with one banner and can establish up
  to four; each new one arrives with a card already installed rather than as an
  empty frame.
- **Cards for regions you haven't reached are hidden**, so the tree grows as you
  explore rather than showing a wall of locked rows.
- The Guild Hall now separates capacity upgrades, Outpost cards and Universal
  cards, and shows how many copies of each card you own.

### Cleanup (C-17, C-18)

- **Fixed: a hero could work two places at once** — staffing an area and an
  Outpost simultaneously, which quietly doubled a deliberately scarce resource.
- **Fixed:** the same hero could be added to the roster twice.
- Retired the leftovers of replaced systems: the unreachable Guild Bonuses
  window, dead map-fragment and pack-cost helpers, and stale fields in the area
  data.

### Losing a hero actually costs you (C-9)

- **A defeated hero comes home.** They're pulled off the banner entirely and
  recover in the roster, so the banner sits empty and clearly marked
  **Defeated** until you decide who goes back in — which may be someone else.
- **Defeat destroys supplies again.** A quarter of each consumable you were
  carrying is lost from the bank. This had quietly stopped working when
  consumables moved onto the hero's loadout grid; it was looking for them in
  the deck, where they no longer live.
- Equipped gear still has a chance to break permanently on defeat.

### Finishing a binder now means something (C-19)

- **Area Mastery.** Collect every card in an area and that area keeps a
  permanent bonus — so a completed region stays worth running once its packs
  stop selling. It shows as a badge beside the binder, fires once, and survives
  reloading.
- **Fixed (again, properly):** cards were still only dropping one item at a
  time. The earlier fix had been applied to the preview code rather than the
  code that actually hands out loot.

### The Whispering Woods opens up (C-16)

- **A second real area.** The Woods went from one card to eight — timber and
  forage routes, a spider-silk haul that poisons you, a woodsman's camp that
  both heals and speeds up everything after it, a Thorn Elemental to fight, and
  two Boosts: one that lights the whole loop and one that marks only the next
  card.
- **Areas now open by trade, not by button.** The Woods unlock when you hand
  over Guild Hall timber and flour; the Misty Mountains want rope braided from
  Woods spider silk. Every region pays for the next one.
- **Everything the Woods produces has a use** — silk becomes rope, glowcaps
  become a drink that keeps a hero working, yew burns down to charcoal.
- **Fixed:** cards were only ever dropping one item at a time no matter what
  their card said, two recipes consumed materials and produced nothing, and the
  Misty Mountains were unreachable because their unlock asked for an item that
  did not exist.

### Big numbers and authored prices (C-15)

- **Stacks no longer cap at 99.** Almost every item was limited to 99 in a
  stack, which quietly made any productive task fail once the bank filled.
  Items now hold effectively unlimited quantities; genuine one-off gear is
  unaffected.
- **Authored pack prices now actually apply.** Each area's hand-set price was
  being ignored, so every region charged the same. The Guild Hall, Whispering
  Woods and Misty Mountains now cost what their data says.
- **Huge numbers read properly** — quadrillions and beyond get short suffixes
  instead of a wall of digits, everywhere in the UI rather than in some places.

### Booster packs are per-area (C-14)

- **Each area sells its own packs, containing only its own cards.** Prices run
  on that area's own curve — the first pack is cheap and each one costs 20%
  more than the last, so completing a region is a real economic arc.
- **Buy at the banner**, next to the binder it fills. The old Pack Shop screen
  is now a read-only overview of every area's progress and next price.
- **Boosts are rare without being rigged.** The pool is drawn from copies you
  still need, so a one-of-a-kind Boost is naturally four times rarer than an
  ordinary card — and gets steadily likelier as the rest of the binder fills.
  No pity timer, no hidden drop table.
- **A finished binder stops selling packs**, and a maxed card never appears
  again.

### Crafting upkeep (C-13)

- **Crafters feed themselves from their own kit.** A hero working an Outpost
  drinks from their loadout grid exactly as they do in the wilds — the
  station-side Drink slot is gone entirely. Keep the bank stocked and they run
  unattended; let it run dry and they stall with a clear "Out of energy" on the
  banner.
- **Fixed a latent stall:** a recipe costing more than a quarter of a hero's
  energy could have hung forever with a full waterskin equipped, because the
  hero never got "low" enough to reach for it.

### Global Outpost auras (C-11)

- **Outpost auras now reach every area.** An installed Outpost card's buff is
  guild-wide rather than helping only the region it sits in — the reason
  Outposts are scarce and worth fighting over.
- **Duplicates stack additively.** Two copies of a +20% aura give +40%, not the
  compounded +44%.
- **Passive Outposts.** Three new cards that craft nothing and exist purely for
  their aura — the Guild Smithy, the Surveyor's Post (which carries *two*
  unrelated auras at once), and the Wayfarer's Rest, which runs with **no hero
  assigned at all**. Whether a card needs a body is now a per-card property.
- **Aura strength is the designer's to set,** with no fixed power tiers, and a
  card may carry a list of effects rather than a single one.
- **Fixed:** station buffs silently stopped working after the Outpost split, and
  a new game could start with no Outpost banner at all.

## [0.4.1] — 2026-07-31

A tooling and planning baseline, tagged `v0.4.1`. **No player-facing changes and
no save break** — the save schema version stays `0.4.0`, so existing saves load
normally. This tag exists as a clean rollback point before the Area Deck Rework
begins.

### CMS Rework (Phases 0–4 core)

The standalone content tool in `cms/` was reworked to catch up with the game and
make authoring faster and sync safe. Plan and decisions live in
`cms_rework_concept.md` and `cms_rework_roadmap_v1.md`.

- **Phase 1 — shared vocabulary.** The CMS now reads the game's own registries,
  so skills, card types, tags and equip slots flow game → CMS rather than being
  duplicated and drifting.
- **Phase 2 — round-trip import.** Game `data/` can be imported back into the
  CMS, giving a reconciliation path.
- **Phase 3 — field-level merge sync.** *The safety phase.* The destructive
  whole-file sync was replaced with a field-level merge plus preview and staged
  deletion. An unchanged import → sync is now a no-op, and edits write only the
  fields that changed, preserving mutators, tokens, `deckSlots` and card tags.
- **Phase 4 (core) — unified card model.** Card type is now derived from content
  (`inferCardType`) rather than hand-set; one unified `CardEditor` replaces the
  per-type editors, with a token picker, `cardType` write-back and an ambush
  guard. Recipe/station unification and the owner UX review remain outstanding.

### Data

- Retired 11 orphaned card files (22 cards) that no registry referenced.
- Resolved the duplicate `task_rocky_outcrop` id — the Misty Mountains
  definition is kept and the Sunken Bog copy removed.

### Documentation

- **Area Deck Rework designed in full** — `area_deck_rework_concept_v3.md`
  records 67 locked decisions with no open questions, and
  `area_deck_rework_roadmap_v1.md` breaks the build into 19 components across
  7 layers with a reuse/rewrite verdict per component.
- `CLAUDE.md` slimmed to working conventions; finished work archived in the new
  `PROJECT_HISTORY.md`.

## [0.4.0] — 2026-07-22

The Hero Dock rework, complete. Tagged as `v0.4.0`. Heroes now live in an
always-visible strip along the bottom of the screen; equipment expanded from
two slots to six; the Bench was retired; and the pop-out Heroes drawer is gone.
**This release breaks save compatibility** — the save schema version is
`0.4.0` and older saves are refused, by design.

### Hero Dock (Phase 0 — reality check & save break)

Groundwork for the Hero Dock rework. Nothing is player-visible yet.

- **Save compatibility is intentionally broken.** The save schema version moves
  from `0.2.0` to `0.4.0` because the coming phases remove the hero Bench
  outright and change hero equipment from two slots to six. Existing saves are
  refused with the standard incompatible-version message rather than migrated —
  the same deliberate choice the Area Deck Loop rework made.
- Architecture findings F1–F9 in `hero_dock_roadmap_v1.md` re-verified against
  the merged v0.3.1 code; none had drifted.

### Hero Dock (Phase 1 — six equipment slots)

**Heroes now carry six pieces of gear instead of two:** two Hands, a Hat, a
Chest, and two Trinkets.

- Either hand takes any weapon and both sets of bonuses count, so a hero
  wielding two weapons gets the benefit of both. Equipping fills the left hand
  first, then the right; a third weapon replaces whatever is in the left.
- Where the game needs to name *one* weapon — which fighting style the hero
  uses, and which weapon wears down when they swing — it uses the **primary**
  weapon, meaning the first occupied hand. A hero with a single weapon behaves
  exactly as before.
- Existing gear was reclassified: the twelve weapons became Hand items and the
  two armours became Chest items. **Hats and Trinkets have no items yet** —
  those arrive in the next phase.
- Armour wear now lands on the Chest slot, and a defender's Hat and Trinkets
  each have a chance to take incidental damage. (That roll previously targeted
  four slots that never existed, so it silently did nothing.)

### Hero Dock (Phase 2 — starter hats and trinkets)

**Eight new items**, so the four new slots have something to put in them.

- **Hats:** Straw Hat, Leather Cap, Miner's Helm, Iron Helm — a small armour
  ladder, with the Iron Helm gated behind Defence 5. These have no artwork yet
  and show their emoji until sprites are drawn.
- **Trinkets:** Sapphire Band (accuracy), Ruby Signet (damage), Emerald Pendant
  (damage reduction), Iron Chain (armour). These reuse the ring and amulet art
  already in the project.
- **Two are findable in normal play:** the Miner's Helm drops from Copper
  Miners, and the Iron Chain from Skeleton Warriors — an enemy that until now
  dropped nothing at all.

Every one of these was checked in-game to confirm it actually changes a number.
Several stat types the game *offers* on items turn out to be wired to nothing —
health bonuses, skill bonuses, evasion, and energy efficiency all register
silently and have no effect. The new gear deliberately avoids them. This is a
long-standing gap rather than a new one, and it is now documented for whoever
adds equipment next.

### Hero Dock (Phase 3 — the Bench is retired)

**There is no Bench any more.** Your roster is your roster: every hero you own
is one you can deploy.

- **Recruiting is refused when the roster is full**, rather than quietly
  parking the new hero on a bench you had to go and find. The message tells you
  what to do about it: retire a hero, or upgrade the Guild Hall for another
  slot.
- **You are never charged for a refused hire.** The check happens before any
  Influence is spent, and the candidates stay on offer, so you can make room
  and come back to them.
- Retiring a hero frees the slot immediately, and Guild Hall roster upgrades
  raise the cap as they always did.
- "Move to Bench" and "Move to Active Roster" are gone from the hero sheet.
  Deploying and retiring are the only roster actions now.

### Hero Dock (Phase 4 — the dock appears)

**Your heroes now live along the bottom of the screen, always visible.** No
more opening a drawer to see who you have.

- Each hero gets a tab showing their portrait, name, level, and what they are
  currently doing — the area they are deployed to, "Reserve" if they are idle,
  "Combat" while their area is fighting, or "Injured" if they are hurt.
- Tabs sit in a fixed order and overlap like cards held in a hand. Hovering one
  lifts it clear of its neighbours so you can read it.
- The dock floats over the play area rather than squashing it, and the banner
  list and Bank drawer both leave room so nothing ends up stranded underneath.

Clicking a tab does nothing yet — pulling a card open to see equipment and
skills comes next, followed by dragging heroes onto banners.

### Hero Dock (Phase 5 — pulling a card open)

**Click a hero's tab and their card pulls up out of the dock**, revealing
their six equipment slots and all fifteen skills underneath.

- **Two cards can be open at once**, side by side, for comparing heroes.
  Opening a third closes whichever has been open longest.
- Equipment shows as item icons in two rows of three; hover any slot to see
  what's in it. Skills show as a grid of icons and levels, with combat skills
  tinted apart from the rest — hover for the full name.
- Clicking a card's header closes just that card. Clicking anywhere outside
  the dock closes them all. Clicking inside an open card leaves it alone.

The card is the same object throughout: the strip shows its top edge, and
pinning slides the whole thing up so the rest comes into view.

### Hero Dock (Phase 6 — drag and drop)

**The dock is now how you move heroes and gear around.**

- **Drag a hero up onto a banner** to deploy them there.
- **Drag them back down onto the dock** to recall them — anywhere on the dock
  works, including onto another hero's tab. There's also a small ✕ in the
  corner of a deployed hero's card on the banner if you'd rather just click.
- **Drag an item from the Bank onto a hero's tab** to equip it. It goes to the
  right slot automatically, and swaps out whatever was there.
- **On an open card, click a piece of gear** to send it back to the Bank, or
  **drag it onto another hero's tab** to hand it straight over.

Dropping something somewhere invalid springs it back and changes nothing.

### Hero Dock (Phase 7 — Edit, and the old drawer is gone)

**The Hero Dock has fully replaced the pop-out Heroes drawer**, which no
longer exists. Neither does the Heroes button in the side menu — your heroes
are always on screen, so there was nothing left to open.

- **New Edit button** on an open hero card. It opens a small window where you
  can rename the hero, pick a new portrait from all 29 available, or retire
  them.
- **Retiring now explains itself.** A hero can only be retired if they're worth
  more Influence than a new recruit costs — previously the button just failed
  when you clicked it. Now it's greyed out and tells you why: *"This hero is
  worth less (1) than a new recruit costs (12). Level them up first."*
- Retirement still asks you to click twice to confirm.

Cards and items are unaffected — the Bank and Cards panes inspect exactly as
before.

### Hero Dock (Phase 8 — small screens and polish)

- **The dock collapses when it runs out of room.** Hero tabs shrink to small
  square portraits with a coloured dot showing whether that hero is deployed or
  hurt. Opening a hero still shows their full card. It only collapses when your
  roster genuinely doesn't fit, so a small guild keeps full-size tabs on a
  narrow window while a large one tidies itself away.
- **Tabs press down when you click them**, so a click feels distinct from the
  start of a drag.
- **Pulling a card open and pushing it closed now have their own sounds.**

### Hero Dock (Phase 9 — cleanup)

Removed the last of the pre-rework hero interface, which had been sitting in
the project unused since the deck-loop rework. No visible change; the game is
six files lighter and there is one less way for a future change to go wrong.

## [0.3.1] — 2026-07-21

The Card Mutators & Tokens feature, complete. Tagged as `v0.3.1`.

> **One check outstanding:** a token badge has not yet been *seen* rendering in
> the live game. Everything upstream of it is verified and the badge logic is
> unit-tested — see the note at the top of `mutator_roadmap_v1.md` for the
> 30-second manual check that closes it out.

### Card Mutators & Tokens (Phase 0 — scaffolding)

Inert groundwork for the Card Mutator system. Nothing is player-visible yet.

- New `CARD_TYPES.ACTION` card type, covering both Mutators (cards that stamp
  Tokens onto other cards) and consumables (cards that apply Status Effects).
  Which one a card is comes from its traits, not a separate field.
- New `src/config/registries/TokenRegistry.js` — the data-driven registry Tokens
  will be defined in. Ships with the schema and documentation only; the actual
  token catalog lands in a later phase.
- New `src/tests/Mutators.test.js` test scaffold.

### Card Mutators & Tokens (Phase 1 — Three-Bucket modifier engine)

The core maths that decides how buffs and penalties stack has been rebuilt.

- **Bonuses now stack in three separate piles, settled in order.** Flat bonuses
  ("+1 shrimp") are added up together with the card's own base value; then
  multipliers ("double it") are added up and applied; then percentages ("+25%")
  are added up and applied.
- **Nothing within a pile compounds.** Two multipliers of ×2 and ×3 give ×5.
  Two percentage bonuses of +25% and +50% give +75%, *not* +87.5% and not
  +175%. A percentage bonus never inflates another percentage bonus.
- Worked example: a task producing 1 shrimp, with a "+1 shrimp" effect, a
  "double fishing output" effect and a "+25% shrimp" effect, produces
  **5 shrimp** — `(1 + 1) × 2 × 1.25`.
- **A card with no modifiers comes out exactly at its base value**, and a pile
  of penalties can never push a result below zero.
- Speed sources that used to be multiplied together in a chain — the hero's own
  bonuses, an area's station buff, an equipped tool, and mastery — now all feed
  these shared piles. Tools and mastery count as percentage bonuses, so two
  +25% speed sources make a task 50% faster rather than 150% faster.
- **Work times and yields will have shifted.** That is expected: all current
  content is test content, and nothing was retuned to preserve the old numbers.

### Card Mutators & Tokens (Phase 2 — Card tags)

Every card now carries a list of descriptive labels — its **tags**. Mutators
will use these to decide which cards they can affect ("the next 3 Aquatic
cards"). Nothing is player-visible yet.

- **Tags are worked out automatically from what a card already says about
  itself.** No card in the catalog had to be hand-labelled. A card's tags come
  from its type, its skill, that skill's parent skill and category, a station's
  subskill, and whether the card can start an unexpected fight.
- Worked examples from the live catalog: *Shrimp River* → `Task, Aquatic,
  Gathering`; *Berry Bush Patch* → `Task, Nature, Gathering, Hazard` (it can
  spring a thorn elemental on you); *Wolf Den* → `Combat`; *Smelting Furnace* →
  `Station, Labor, Gathering, Smelting`.
- **Combat cards are tagged too**, which is what will let a future "Hex" mutator
  find and curse an upcoming fight.
- **Old skill names no longer leak into tags.** A card still written against the
  pre-15-skill `nautical` skill is tagged `Aquatic`, never `Nautical`, so only
  one label for a concept ever circulates.
- **Tags always use the same capitalisation** (`Fishing`, never `fishing`), so
  the same tag can never appear twice in two different spellings.
- A deliberately tiny hand-written override list exists for flavour a card's own
  data cannot express — currently one entry, the *Wishing Well*, which is a
  water card worked with the Nature skill.
- Tags are recalculated from the card catalog rather than saved, so a card
  definition change takes effect immediately and old saves need no migration.

### Card Mutators & Tokens (Phase 3 — Token data model & lifecycle)

The plumbing that lets a Token ride along on a card. Nothing stamps Tokens yet
— that is the next phase — so nothing is player-visible.

- **Tokens attach to deck slots, not to cards.** A card that hasn't been drawn
  yet doesn't exist as an object; a slot is just "this position holds the Shrimp
  River card". So a Mutator marks the *position*, and the mark is applied to the
  real card the moment that position comes up and the card is dealt.
- **A Token remembers almost nothing.** It stores only which token it is, which
  card stamped it, and how many charges it has. What it actually *does* is
  looked up fresh from the token registry every time it is applied — so
  retuning a Token takes effect immediately, everywhere, with no stale copies
  stranded on slots mid-game.
- **Stacking is by count, not by merging.** Five copies of the same Token on one
  card are five separate marks, each traceable back to the Mutator that placed
  it. That is what will later let the UI show a `×5` badge and still explain
  where every one of them came from.
- **Everything is wiped at the end of a Cycle** — one full pass through the
  deck — spent or not. Unused charges are never carried into the next Cycle.
  Tokens are also cleared when the loop is reset (a deck or hero change) and
  whenever a save is loaded.
- **Tokens are never saved.** A Token can live at most one Cycle, and anything
  that interrupts a Cycle clears them anyway, so loading a save always starts
  the Cycle clean. This keeps the save file format untouched.
- Effects are filed into the three stacking piles from Phase 1 — flat,
  multiplier, percentage — exactly as the Token's definition declares, so a
  Token's maths behaves identically to a gear bonus or a station buff.
- Groundwork for the three effect axes a Token can touch — **Yield**, **Work
  Time** and **Input Cost**. They are recorded but nothing reads them yet; the
  systems that spend them arrive in a later phase. Work Time is kept
  deliberately separate from work *speed*, so a Token that makes a card take
  longer can never be misread as making it faster.
- A Token can also be removed by name — the groundwork for cures that counter
  one specific affliction rather than sweeping away all bad effects.

### Card Mutators & Tokens (Phase 4 — ACTION cards & stamping)

Mutators now actually place their Tokens. Still no player-visible effect,
because what a Token *does* (change yield, time, cost) isn't wired until the
next phase — but the placing itself is live and tested.

- **Working a Mutator stamps its Token onto matching upcoming cards.** A
  Mutator is an ordinary card carrying a "stamp this token" instruction. When
  the Hero reaches it and works it, the engine walks the rest of the deck for
  this pass and marks the cards whose tags match — e.g. a Trawler marks the
  upcoming Aquatic cards.
- **Two targeting modes.** *Charges*: mark the first N matching cards, and any
  leftover charges with nothing to mark are wasted, never saved for later.
  *Area*: mark every matching card left in the pass.
- **Only ever looks forward.** A Mutator never affects a card already worked
  this pass, and never reaches into the next pass (which is wiped clean anyway).
  Empty slots and terrain hazards are skipped — there is no card there to mark.
- **Action cards can now be put in decks** (`CARD_TYPES.ACTION` is slottable).
- Groundwork, dormant until content exists: a Mutator can name specific tokens
  to *strip* from a card — a targeted cure, never a blanket cleanse.

### Card Mutators & Tokens (Phase 5 — Yield / Time / Cost axes)

Stamped Tokens now actually **do** something. This is the first phase with a
visible effect: a Token on a card changes what it produces, how long it takes,
or what it costs.

- **Yield** — a Token that boosts output scales the items a card produces
  (e.g. a Trawler doubling a fishing card's catch).
- **Work Time** — a Token that lengthens or shortens a card changes how long
  it takes to work, on top of any tool or station speed already in play.
- **Input Cost** — a Token can raise or lower how many ingredients a card
  consumes.
- **Hard floors (§10), in one place.** A card can never be driven below one
  second however much speed-up is stacked on it, and an input cost can never
  drop below one unit. The floors only bite once a Token has actually acted, so
  a naturally quick card is left alone.
- All three run through the same three-pile maths from Phase 1, so a Token
  stacks cleanly with gear, station buffs and (later) status effects.
- Verified against the real work-cycle pipeline: a 4-second fishing card
  becomes 8 seconds and yields double under a ×2 Trawler, and a ×2 time penalty
  fought with five stacked −20% speed-ups floors at one second rather than
  hitting zero.

### Card Mutators & Tokens (Phase 6 — Failure states)

Cards can now genuinely fail, and a failure costs the player the time they
spent without giving anything back.

- **Fixed: a card could pay out before checking it could afford itself.** Loot
  was granted first and the ingredients were only taken afterwards, so a card
  short on materials still handed over its output. The whole exchange is now
  decided up front — either a card produces *and* pays, or it does neither.
- **A card starved of ingredients fails.** The full work time is spent, nothing
  is produced, and nothing is consumed. Any Token riding that card is wasted
  all the same.
- **A card whose output has nowhere to go fails.** If the bank cannot store
  *any* of what a card could produce, the card fails rather than quietly
  binning the result. A card that could produce several different things only
  fails when there is room for none of them — one full stack no longer throws
  away the outputs that would have fit.
- **A failed card still resolves.** It is a full completion that happens to
  produce nothing, not a skipped turn — which is what later "at the end of a
  card" effects will hang off.
- **A failed card earns nothing at all** — no XP, no reward items, no quest
  progress. Previously a card could fail and still hand over its XP.
  Environmental effects are the exception: a hazard that poisons the hero
  still poisons them, because that is something the card *does* to you rather
  than something it pays you. The tool still takes its wear, since the hero
  spent the full time working.
- A cost-raising Token can now starve a card that would otherwise have
  succeeded, which is the intended trade-off: greedy combos need the supply
  chain to back them up.

Not yet visible: the "Failed!" stamp and the at-a-glance bottleneck view come
with the Token UI work.

### Card Mutators & Tokens (Phase 7 — Combat axis / Hex)

Mutators can now debuff enemies, not just tune the economy.

- **A Hex-style Token applies real Status Effects to the enemy** when the combat
  card comes up. The enemy is already poisoned the moment the fight starts, and
  the poison ticks its health down exactly as it would from any other source —
  it can even finish a weak enemy before the hero swings.
- This deliberately adds **no new combat maths**. The Token hands its statuses
  to the existing status engine, the same route a poison weapon already uses,
  so a hexed enemy is indistinguishable from one poisoned in a fight. Enemies
  have been able to carry statuses since the combat engine landed; this simply
  gives Mutators a way to put them there.
- A combat Token stamped onto an ordinary task card quietly does nothing rather
  than erroring.

### Card Mutators & Tokens (Phase 8 — Area Anchor)

An area can now apply its own global effect through a locked Mutator card
pinned to the front of its deck, instead of an invisible area-wide penalty. The
hero works it first each pass, and it broadcasts to the rest of the deck.

- **No new machinery was needed**, which was the point of this step: areas could
  already pin a locked card into a deck position, the loop already works a
  locked card like any other, and the "affect every matching card" mode built
  earlier does the broadcasting.
- **Fixed: locked cards were being skipped by mutator effects.** "Locked" only
  means *the player can't swap that card out* — the hero still works it. Any
  effect that sweeps the deck was ignoring those cards, which would have made a
  curse-the-next-enemy effect unable to touch the very enemies areas pin in
  place. Empty slots and terrain hazards are still skipped, since there is no
  card there to mark.
- An anchor never marks itself, and its effect is wiped at the end of the pass
  like any other — it has to be worked again next time round.

No area ships with an anchor yet; that arrives with the card catalog.

### Card Mutators & Tokens (Phase 9 — Token badges & failure marks)

The first phase you can actually *see*.

- **A failed card is now stamped "FAILED!"** — a red mark across the card face,
  on the card being worked and on every failed card in the deck view, so a
  supply bottleneck is obvious at a glance rather than something you infer from
  resources not appearing.
- The stamp explains itself on hover: whether the card ran short of materials
  or the bank had nowhere to put what it makes.
- **Tokens show as small badges on the card face**, including on cards not yet
  drawn — you can see what's waiting further down the deck and prepare for it.
- **Identical tokens condense into one badge with a count**, so fifty stacked
  effects read as a single icon with a "×50" rather than fifty icons.
- Hovering a badge traces the whole thing: what it does in numbers, what it
  means in words, and which card put it there.
- Three tokens are authored — Abundance, Trawler and Hex — along with the
  mutator cards that place them. (Cursed and its counter Dam were dropped:
  nothing in the game applies a curse, so both were decoration.)
- **Adding a Mutator to a deck now picks a slot where it can actually do
  something** — one with cards after it, since a Mutator only affects what
  comes later in the pass.

**Not finished:** the token badges have been proven by tests rather than seen
in play — that needs a Mutator sitting ahead of a matching card with the loop
running past it, which is a few seconds' work with a mouse.

### Fixed — crafting stations were classified as gathering

- **Smelting, smithing, toolsmithing, jewelry and baking now count as
  Processing rather than Gathering.** These subskills were still filed under
  the retired pre-15-skill groupings (`industry`, `culinary`), and `industry`
  bundled Mining — which genuinely is gathering — together with the smithing
  lines, which are not. Every crafting station therefore inherited the wrong
  skill category.
- This surfaced through the new card tags: a Smelting Furnace was tagged
  `Gathering`, meaning a future "double all Gathering output" effect would have
  wrongly boosted furnaces. Stations now tag as `Processing`.
- Subskill parents are now canonical 15-skill values throughout, so nothing
  relies on the legacy alias table any more.

## [0.3.0] — 2026-07-19

The Area Deck Loop release. This version replaces the original playmat/grid
system entirely, rebuilds combat and progression on top of it, and closes out a
full codebase review. It is the new baseline: `main` and this tag represent the
canonical game going forward.

### Area Deck Loop rework (Phases 0–9)

The playmat and its 2D grid are gone. Areas are now decks of cards that run on a
backend loop.

- Core data schema and state rebuilt around areas, decks, and cards.
- `LoopRunner` backend loop engine drives area progression.
- Station crafting integrated as a queue.
- Unified booster shop and card collection replacing the old acquisition paths.
- Area Banner Row frontend layout; sidebar retired in favour of a bottom folder
  drawer.
- Time Bank — offline progress is banked and fast-forwarded on return, and every
  timed system scales correctly under it.
- Phase 9 sweep deleted the legacy playmat code and the `USE_DECK_LOOP` feature
  flag; the deck loop is now the only system.

**Save compatibility with pre-0.3 saves is intentionally broken.** Old saves are
refused on load by design.

### Combat and heroes

- New 7-stat combat engine with a registry-driven status effects system
  (7 statuses, 5-second clock, damage-over-time can kill).
- 15-skill model: every hero carries all 15 skills; hero level is the average of
  the 4 combat skills; classes are cosmetic.
- Split combat theatre — hero animates on the hero card, enemy on the combat
  card — with aligned combatant info panels and a live attack-loop bar.
- Curve-explorer prototype for balance calibration.

### Content and systems

- Quest System v2: quest boards, main story quests, procedural quests, refresh.
- Binder rework: owned-only storage, small card tiles, no flicker.
- Pack opening with card-flip reveal, plus an instant-reveal setting.
- Visual-first recipe cards with ingredient icons and bank-reserve bars.
- Fixed bank tabs with sprite strip, select mode, and bulk-sell modal.
- Bank slot capacity is now a real, enforced limit.
- Guild Hall upgrades replace the retired Projects system.

### UI

- UI overhaul: bubble menu, split-pane drawer, sortable tabs, full-screen drawers.
- Hero side drawer as a full-height panel off the bubble bar.
- Pointer-tracked drag-and-drop system (dnd-kit) across cards, heroes, and items.
- Fluid typography pass; SilkPixel as the default face.
- Boot-time asset preloader for instant sprite load-in.
- Compact notification toasts, pinned bottom-centre, with a hide toggle.

### Desktop build

- The game is wrapped in a Tauri desktop shell with an app icon.
- Fonts are self-hosted so the desktop build works fully offline.
- Raw art datasets staged in `raw_assets/` instead of `public/`, so high-res
  masters no longer ship inside the build.

### Code review

A full 8-session review filed 55 tickets (CR-001–CR-055) with zero P0s, all
resolved across six fix waves. Highlights: timer remainders preserved under
time-scaling, hero area assignments always cleaned up on exit, save robustness
and schema cleanup, an infinite render loop in the hero drawer fixed, and a
large dead-code sweep removing orphaned pre-rework machinery. A regression test
net now covers the rework core engine (129 tests).

### Retired in this version

- Playmat / 2D grid system, and the `USE_DECK_LOOP` flag.
- Hero-carried food and drink slots (station Drink slot auto-sips instead).
- Projects system.
- Single active-area concept.
- Area Mastery — shelved dormant, not deleted.
