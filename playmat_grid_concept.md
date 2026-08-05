# Concept: The 7×7 Playmat Grid

The game is replaced by a single, permanent **7×7 board**. The player places **Tokens** on it and stations **heroes** on those Tokens to work them. There are no Areas, no decks, no card loops, and no travel — the board is the entire game.

This document specifies the design. The reasoning behind each decision, including rejected alternatives, is in [`playmat_grid_decisions.md`](playmat_grid_decisions.md); decision IDs (D-nn) below refer to that file.

> **Status:** design settled at the mechanism level. Tuning values, content lists and the hero system's details are deliberately not specified here — see §11.

---

## 1. Design Philosophy

* **The board is the interface.** Placement *is* configuration. There is no recipe menu, no priority dropdown, no assignment screen. To change what a station produces, move a Token next to it. To change what a hero does, move the hero.
* **Optimization, not expansion.** The board is 7×7 forever. Improvement comes from better Tokens in better arrangements, never from more room.
* **Nothing is hidden.** The state of the game is visible on the board. Two deliberate exceptions exist — buying Maps and selling items — and both are called out where they occur.
* **Tokens are the reward.** Items are throughput; Tokens are progression. Acquiring one visibly changes what the board can do.
* **Consumption is a rhythm.** Common Tokens are used up and replaced. The loop has an inhale (acquire) and an exhale (deplete), not a monotonic climb.

---

## 2. The Board

| Rule | Detail |
| :--- | :--- |
| **Size** | Fixed 7×7 = 49 tiles, forever. No expansion mechanic. (D-1) |
| **Guild Hall** | The centre tile is a permanent Guild Hall — not placeable, not removable. **48 tiles are usable.** (D-106) |
| **Occupancy** | One Token per tile. Heroes overlay the Token they work; loot sprites float above the grid. Nothing else stacks. (D-2, D-57) |
| **Terrain** | None. All tiles are identical. (D-55, D-61) |
| **Edges** | No special rule. A corner Token has 3 neighbours and a central one has 8, which is the only positional difference. (D-61) |

### The Guild Hall
The centre tile carries an **upgradable aura** that buffs nearby or all Tokens. It is where **Guild Upgrades** are installed and where board-wide events land. Guild Upgrades survive the rework and live here.

Because the aura is strongest nearby, tiles adjacent to the centre are the board's most valuable.

---

## 3. Tokens

A Token is a placeable object: a resource, an enemy, a crafting station, a context piece, a passive generator, a buff, a structure, or a Map.

**Existing Cards convert to Tokens one-for-one and keep their execution model** (D-79). A *Wishing Well* task card becomes a *Wishing Well* Token: a hero is assigned, it works on a cycle, it produces output. Cycle timing, inputs, outputs, drop tables and XP awards all carry over. A Token is a **card definition plus board state** — the registry holds the type; a light instance holds position, uses remaining, and which hero is on it.

### 3.1 Token Types

| Type | Behaviour | Needs a hero? |
| :--- | :--- | :--- |
| **Resource** | Yields materials when worked. Forest → Wood. | Yes |
| **Enemy** | Fought for loot and XP. | Yes |
| **Crafting Station** | Produces items defined by adjacent context Tokens. | Yes |
| **Context** | Modifies an adjacent producer. Schematics, anvils. Inert alone. | No |
| **Passive Generator** | Produces on its own timer with no hero. | No |
| **Buff** | Buffs adjacent Tokens *or* adjacent heroes. | No |
| **Structure** | Managers, and similar utility. | No |
| **Map** | Worked to yield Tokens rather than items. See §7. | Yes |

**Most Tokens require a hero to work them** (D-53). Passive Generators are the deliberate exception and are scoped as **life-support, not industry** — they produce basic goods that keep a skeleton crew running, never anything a hero-worked Token would make (D-72).

### 3.2 Rarity and Depletion

Rarity is a fixed property of the Token *type*, never a per-instance roll. There is no "Rare Forest" (D-38).

| Rarity | Depletion | Copies |
| :--- | :--- | :--- |
| **Common** | Depletes — finite uses, then consumed | Unlimited |
| **Uncommon** | Depletes, substantially more durable | Unlimited |
| **Rare** | Never depletes | Unlimited |
| **Mythic** | Never depletes | **One copy ever** |

> ⚠️ **This four-tier shape is provisional** (D-50). Open: whether Mythic is also hazard-immune, and whether Uncommon differs from Common in anything beyond use count.

**Mythics** are ultra-rare drops from bosses and Maps, and **boss Tokens are themselves Mythic** — one copy ever, never depletes, farmable indefinitely once placed (D-102, D-105). Nothing in progression depends on obtaining one.

### 3.3 Upgrading
**A Token is never upgraded in place.** It produces more because of what sits next to it (D-80).

```
Forest alone                        →  5 Wood
Forest + Sawmill                    → 12 Wood
Forest + Sawmill + Sharpening Post  → 20 Wood
```

Upgrading is therefore an act of placement, using the adjacency system rather than a separate mechanic.

### 3.4 Storage

**Token Bank → Tray → Board**, and back again.

* **Token Bank** — unlimited storage. Tokens stack.
* **Tray** — a permanent staging area, roughly a quarter of the screen. **Load-bearing:** opening a Bank covers the board, so Tokens cannot be dragged from Bank to tile directly. The Tray is what makes placement possible (D-86, D-107).
* **Board** — the live 48 tiles.

**Consolidation (D-77).** When a partially-used Token returns to the Bank, its remaining uses merge with other partials of the same type and re-pack into as many full Tokens as possible plus at most one remainder:

```
Bank has:  Forest (3,000 uses left)        capacity 5,000
Returning: Forest (4,000 uses left)
Result:    1× Forest (5,000, full) + 1× Forest (2,000)
```

Totals are conserved exactly, so picking a Token up and putting it back gains nothing. **Placement always draws a full Token first**; partials are used last.

### 3.5 Repositioning
Moving a Token is free and unrestricted, but **a Token part-way through a cycle loses that cycle** (D-54). This discourages constant micro-adjustment without forbidding deliberate reorganisation.

---

## 4. Heroes

> ⚠️ **Heroes are scheduled for a dedicated replanning session.** The rules in §4.1–4.3 are structural and stable. §4.4 records what is settled about hero *identity* — treat it as provisional.

### 4.1 Placement and Work

* A hero **works exactly one Token and stands on top of it** (D-57). A hero on an empty tile does nothing.
* **One hero per Token, always.** Heroes never double up (D-111).
* **Heroes never move themselves.** A hero works their Token until the player drags them elsewhere — no auto-hop, no seeking, no queue (D-59).
* Heroes are **numerous** — on the order of 10–20 on the board. Roster size is the production ceiling: **the number of actively worked tiles equals the number of heroes** (D-58).
* Heroes have no reach and no adjacency of their own, except that **Buff Tokens adjacent to a hero's tile may target the hero** (D-112).
* Unplaced heroes live in the **Hero Dock** along the bottom of the screen, which is also where jobs, skills and equipment are managed (D-76).

**A hero whose Token stops producing simply idles** until the player returns (D-60). This is accepted as the natural limit of an idle session — the board winds down as Commons deplete, and returning to restart it is the point. Manager Tokens (§6.3) and non-depleting Rares are the mitigations.

### 4.2 What a Hero Contributes
A hero is **primarily a gate** — their presence is what makes a Token run at all — **and secondarily a modifier**. The Token sets what is possible; the hero sets how well it goes (D-62).

Skill level affects three things and deliberately not a fourth (D-67):

| Effect | Detail |
| :--- | :--- |
| **Speed** | Higher skill works the Token faster. |
| **Access** | Tokens carry minimum skill requirements. This is what makes levelling necessary rather than optional. |
| **Efficiency** | Fewer inputs consumed per cycle; slower Token depletion. |
| ~~Quality~~ | **Not a hero effect.** Rare drops and double yields are properties of the Token. |

### 4.3 Defeat
A hero reduced to 0 HP leaves the board, enters the existing **Wounded** recovery state, and may lose equipment permanently. Their tile idles until re-staffed (D-74).

All combat risk is opt-in: enemies never initiate (D-14), and a hero only fights because the player placed them on an enemy Token.

### 4.4 Identity — Provisional
* Heroes **level the skills they actually use** (D-63). Placement is therefore a compounding decision: leaving a hero on the mine buys tomorrow's better miner as well as today's ore.
* Heroes advance along a **branching class tree** — Recruit → basic class (Fighter, Wizard, Rogue…) → specialised job (Rogue → Thief or Assassin) (D-70).
* **Promotion** requires a skill threshold plus a resource cost. It grants job-specific perks *and changes which skills the hero can learn* — an Explorer promoted to Ranger loses Arcane and gains Fletching (D-68).
* **Removed skills are banked, not lost**, and jobs are reversible (D-71).
* **Traits are cut.** Every difference between two heroes is earned, never rolled. Perks survive, granted automatically by jobs and by skill milestones (D-73).
* **Equipment is 3–4 slots**, retaining the item-tag rule preventing two of the same type (D-65).
* Heroes are **drawn as their job**, not as individuals, so the board's staffing reads at a glance (D-75).

**Open, for the hero session:** the skill list itself (to be designed from scratch), the roster cap and recruitment mechanism, and **whether Energy survives and how food and drink are consumed**.

---

## 5. Adjacency

**One rule everywhere: the 8 surrounding tiles** (D-81). Context, buffs, upgrades and Guild Hall aura all use the same neighbourhood. No ranges, no radii, no orthogonal exceptions.

Adjacency does three jobs, which is why it must be learned only once:

### 5.1 Context Crafting
Adjacent context Tokens define what a station makes. An Iron Anvil and a Helmet Schematic next to a Forge tell it to produce Iron Helmets. No menus (D-18).

* A context Token with nothing relevant adjacent is **inert** (D-19).
* **Conflicting** context Tokens put the station into an error state — it produces nothing and shows a warning until the player resolves it (D-20).
* **A context Token serves every adjacent station.** A schematic between two Forges drives both, so dense clever layouts are mechanically better than sprawling ones (D-113).

### 5.2 Buffs
Buffs stack without cap. Eight Sawmills really do give 8× the effect (D-23). **The cost is spatial and severe** — eight tiles producing nothing, on a board where worked tiles equal hero count — so no cap is needed. Individual Buff Tokens may carry a **"does not stack with duplicates"** flag where 8 copies would break something (D-82).

A Buff Token targets **either the adjacent Token or the adjacent hero**, depending on the Token: a Sawmill speeds the Forge, a Campfire heals the hero, a Shrine speeds their skill gain (D-112).

### 5.3 Feedback
**Connection lines are shown on hover or selection only** (D-84). The board is clean by default; hovering a Token lights up its relationships with the active recipe on the line. Tooltips give full detail on hover or right-click (D-22).

---

## 6. The Economy

### 6.1 Inputs, Not Upkeep
**There is no continuous upkeep drain.** Tokens consume resources **when they work** — inputs per cycle, exactly as the current card system already does. A Forge burning Coal burns it per craft, not per second. Some passive Tokens consume inputs per cycle too. Whether a Token consumes anything, and what, is a **per-Token property** with no category rule deriving it (D-97).

Base resource Tokens generally consume nothing — a Forest makes Wood from nothing. This is a convention of how they are authored, not a law the system enforces (D-51).

Inputs are pulled automatically from the global Bank (D-24).

### 6.2 Depth Costs Area
Because Tokens consume items, and items are produced by Tokens, every consumer implies upstream producers — and every producer costs a tile *and* a hero:

```
Armoury  needs Steel
   └── Forge  needs Iron Ore + Coal
         ├── Iron Mine     (base — no inputs)
         └── Charcoal Kiln needs Wood
               └── Forest  (base — no inputs)
```

**This is the board's central constraint.** A high-tier output requires the whole pyramid beneath it, and 48 tiles with 10–20 heroes makes that a real decision. Every tile spent widening a chain is a tile not spent deepening it.

Three release valves stop deep chains outgrowing the board (D-94):
1. **Rares collapse steps** — a Rare Steelworks does in one tile what three Commons did.
2. **Players specialise** — a mature board runs two deep chains, not eight.
3. **Authored chains stay bounded** rather than growing indefinitely deeper.

### 6.3 Supply Shortfall
When a Token cannot get its inputs, it **slows proportionally** rather than hard-stopping (D-48). A Token receiving 70% of what it needs runs at 70% speed. Shortfall is resolved **per item**, so a Coal shortage slows only coal-burners — and throttling cascades downstream naturally, with no explicit cascade logic.

Because base Tokens need no inputs, a chain that runs dry always restarts from the bottom. **Supply deadlock is structurally impossible** (D-51).

**Diagnosis is on the Token** (D-114). A Token that cannot work shows a **glowing red alert mark**; hovering states exactly what it lacks and by how much. There is no aggregate supply dashboard.

### 6.4 Supply Is Not Spatial
Chains route through the **global Bank**. A Forest in one corner supplies a Forge in the other exactly as well as a neighbour would. There is no locality bonus, no routing, no range (D-83).

> **What a Token makes is spatial. Where its materials come from is not.**

### 6.5 Gold

**Sources** (D-93) — three, with deliberately different cost profiles:
* **Market Tokens** — best rate, but cost a tile and a hero.
* **Selling from the Bank UI** — convenient, always available, poorer rate. *An off-board exception, kept deliberately worse than the on-board option.*
* **Enemy drops.**

**Sinks** (D-96):
* **Map purchases** — the primary sink, and the one that scales with play forever.
* **Guild Upgrades.**
* **Themed restock packs.**

### 6.6 Restocking
Commons deplete constantly, and hand-replacing them would be the busywork that sinks the game. **Themed packs** solve this: the player buys a *Woodland Pack* for gold and receives woodland Commons, randomised within the theme (D-49, D-87). Restocking becomes a transaction rather than a chore.

**Manager Tokens** automate it further. A Manager is type-specific — a Lumber Camp auto-replaces exhausted Forests from the Bank; a Goblin Camp refreshes Goblin-type enemy Tokens (D-35, D-104). Managers are the mid-game automation reward and the main mitigation for idle heroes.

---

## 7. Cartography and Maps

**This is the replacement for the pack/booster economy.** It is how the player acquires new Token types, and it is the game's progression system.

### 7.1 The Cartographer
The Cartographer is an **off-board NPC with a menu** — not a Token, not a board object (D-98). The player opens the menu and buys Maps. This is the second deliberate off-board exception; the **Map itself is a Token** that is placed and worked, so only the transaction leaves the board.

### 7.2 The Menu
**Every Map is listed from the very start, in price order** (D-99, D-101).

```
THE CARTOGRAPHER
  Woodland Map ......... 200g + a few basic goods   ← affordable now
  River Map ............ 2,000g + goods
  Mountain Map ......... 20,000g + goods
  Volcanic Map ......... 200,000g + goods           ← visible from day one
```

* **Nothing is ever locked.** Cost is the only gate.
* **Price order is the guidance.** The top entry is the obvious first purchase; the list below is the visible future. No tutorial, no recommendations, no greyed-out nodes.
* Maps cost **mainly gold, plus a small material component** (D-100).

### 7.3 Working a Map
A Map is a Token. A hero works it like any other, and instead of items the player receives a **Token drawn from that Map's loot pool**. Maps have **durability** — a set number of uses — and are consumed when spent (D-37).

**A Map's loot pool is the only meaning "biome" has.** There are no biome systems, biome bonuses or biome mechanics. A "Woodland Map" is simply a Map whose pool contains woodland-flavoured Tokens. Names are flavour.

### 7.4 Progression Shape
Progression is **a price curve**. The player's board produces goods, goods become gold, gold buys the next Map, and that Map yields Tokens that make the board produce more. Advancement is therefore gated by **how well the board runs**, and the player is free to save for anything they can see.

Later Maps yield Tokens that are **stronger and more demanding** — higher output, but deeper chains, more inputs and higher skill requirements (D-95). Power grows and so does its footprint, which is what keeps a fixed 48-tile board meaningful at every stage.

---

## 8. Combat

Combat happens when a hero is placed on an enemy Token.

* **Enemies are inert until targeted.** They never initiate, never aggro (D-14).
* Combat is a **distinct real-time system** using the existing 7-stat combat engine, not a Token cycle — it has its own pacing, damage rolls and status effects (D-90).
* **Enemies fight back and the hero can lose** (D-13). See §4.3 for defeat.
* Combat is strictly **1-on-1** — automatic, since a hero stands on one Token (D-15).
* **A short rest follows every kill.** This is a deliberate rate limiter: an over-levelled hero who one-shots a goblin still waits, so they cannot blitz thousands of low-tier enemies (D-103).

> **Consequence:** hero power does not increase kill rate. It buys survivability and access to tougher enemies. Combat output scales through **more Tokens and more heroes**, exactly as production does.

* **Enemy Tokens deplete** like any other Common and are refreshed by Managers (D-104).
* **Bosses** are 1×1 Mythic Tokens found in Maps, farmable indefinitely once placed (D-25, D-105).

---

## 9. Loot and Presentation

### 9.1 The Loot Piñata
Items produced by any source drop as **floating sprites** on the board (D-40). They are real objects, not banked until collected.

* Items pop out with a small physics arc and land 1–2 tiles away; same-type sprites merge into counted stacks after a moment.
* **Collection is by hover**, by click-drag sweep, or by a Collect All button. It confers **no mechanical advantage** — manual and automatic collection are identical in outcome.
* Hover therefore does three things at once — tooltip, connection lines, and collection. This is accepted precisely because collection is mechanically free (D-88).
* A **Max Item Stacks** setting caps visible stacks; above it the game auto-collects the least interesting first. Setting it to zero disables the mechanic entirely, which is acceptable (D-41).
* If the Bank lacks an item a Token needs, it is pulled from any matching sprite on the board (D-42).

### 9.2 The Tile Information Budget
A tile always shows exactly three things (D-85):

| Always | On hover / selection |
| :--- | :--- |
| Token art, and the hero on it drawn as their job | What the alert refers to |
| A progress ring for the current cycle | Uses remaining |
| **One** alert mark if anything is wrong | Connection lines and active recipe |

**One alert mark, not several.** Whatever the cause — no inputs, a context conflict, anything else — the tile shows a single "look at me" mark, with the specific reason on hover.

### 9.3 Layout
The board dominates the screen. The **Hero Dock** runs along the bottom; the **Tray** takes roughly a quarter of the screen and is permanent. The Token Bank, item Bank and Cartographer menu **overlay the board** when opened — which is exactly why the Tray exists (§3.4).

---

## 10. What This Replaces

### 10.1 Deleted
Areas and everything scoped to them — the World Map, map fragments, area unlock quests, area-scoped card pools, per-area binders. Area Banners. The deck loop, its slots, draw and shuffle timing, and the Prep Phase. Adventure/Stationed mode. Outpost Banners. Playsets and Mastery bonuses. Hero traits. Biomes and biome modifiers as systems.

### 10.2 Survives
The global item Bank and the item economy. The 7-stat combat engine and the status-effect engine. Heroes, equipment, tools and durability. Guild Upgrades — re-homed to the Guild Hall tile. The card *schema and execution model*, which becomes the Token model. The nav bubble menu, drawers and inspection panel.

### 10.3 Requires Rebuilding

**The buff/modifier system.** The existing system applies effects to **downstream cards in a deck** — `LoopBuffs.js` uses an `EFFECT_REACH` of `loop` (active until the loop wraps) or `next_card`. With decks and loops gone, that targeting layer is meaningless and requires a near-complete rebuild.

| Keep | Replace |
| :--- | :--- |
| `ModifierAggregator` and the **Three-Bucket math** — `(Base + Σflat) × (Σmultipliers) × (1 + Σpercentages)`, already covered by tests | `EFFECT_REACH` targeting — `loop` / `next_card` becomes **the 8 adjacent tiles** |
| `EFFECT_TYPES` — SPEED, YIELD, WORK_TIME, INPUT_COST, DAMAGE, DEFENSE, XP_BONUS and the rest | `LoopBuffs.js` and `AreaModifiers.js`, both of which assume a deck and an area |

The effect maths is sound and tested. It is the delivery mechanism that changes.

**The card-mutator "Token" system** (`TokenRegistry.js`, `SlotTokens.js`, `TokenAxes.js`) stamps modifiers onto **deck slot indices** and wipes them at the **Cycle boundary**. Both concepts are deleted by this rework, so the system most likely retires with the loop — freeing the name "Token" for grid objects. If the *concept* is wanted on the board, it needs a name that does not collide with `statusRegistry`, `effectRegistry` or `LoopBuffs`; **Mark**, **Sigil** and **Condition** are free.

**The CMS** will be almost completely rebuilt, **after** this rework and out of its scope (D-109). Token content is hand-authored in JSON meanwhile. ⚠️ The CMS's "Sync to Game" destroys unmodelled content and **must not be run against hand-authored Token data**.

### 10.4 Saves
**Existing saves are wiped.** The save version gate is bumped and older saves are refused with a clear message (D-110). Nothing meaningful maps across — heroes lose traits and gain jobs, cards become Tokens with board state, and the board replaces areas entirely.

---

## 11. Open Questions

**Deferred to the hero replanning session**
* The skill list, designed from scratch rather than migrated.
* Roster cap and recruitment mechanism.
* **Whether Energy survives, and how food and drink are consumed.**
* Class/job tree contents.

**Deferred until the board is playable**
* **Hazards, Events and Invasions** — the entire system is suspended to test whether the board needs an antagonist at all. The 30 authored Threat debuffs are orphaned but not deleted; the Guild Hall is already the landing site if they return.
* **Offline progress.** Note that combat pacing is known not to scale under time acceleration, and combat is now permanent on the board — whatever model is chosen must address that deliberately.
* **Quests** — may be cut. They rewarded map fragments, which no longer exist.

**Tuning and authoring, not design**
* Tray capacity and whether it grows.
* Whether Token numbers are hand-authored or generated from a tier formula.
* The Map price curve.
* The explicit card → Token conversion table.

**Still genuinely undecided**
* The four-tier rarity shape (§3.2) is provisional.
* The Hero Dock's ergonomics at a 15–20 hero roster.
* Whether other off-board services (merchant, recruiter, trainer) become NPCs like the Cartographer.

---

## 12. Build Constraints and Known Risks

**First build target:** one Map's worth of content — roughly 15 Token types, a handful of heroes, progression stubbed (D-108). The most uncertain claim in this design is that **the board itself is enjoyable**; that needs testing before content is authored against it.

| # | Risk | What to watch |
| :--- | :--- | :--- |
| 1 | **The board gets solved.** A fixed board with uncapped stacking and free repositioning may have one optimal arrangement. | If experienced boards all look identical, vary context Token shapes and requirements rather than capping stacking. |
| 2 | **Shared context converges layouts.** A context Token serving all neighbours makes an alternating checkerboard likely optimal everywhere. | Same fix as above. |
| 3 | **The price curve is the entire progression system.** With Maps paid for mainly in gold, strong income from any source lets a player skip ahead. | If skipping beats developing, raise the material component of Map cost. |
| 4 | **The design penalises absence.** Heroes idle when their Token depletes, so a long absence winds the board down. | Manager Tokens must arrive early enough to matter, and Rares must meaningfully extend unattended runtime. |
| 5 | **The board is purely constructive** while hazards are suspended. Nothing external threatens what the player builds. | This is the experiment. If it reads as unchallenging, the suspended hazard system is the answer. |
| 6 | **One Map cannot test progression.** The price curve and the strength/demand curve are invisible until a second Map exists. | Do not leave the second Map behind polish. |
| 7 | **Visual clutter** killed the previous spatial playmat. This board carries more per-tile information than that one did. | Mock a worst-case full board early — 48 Tokens, heroes, progress rings, alert marks and loot sprites together. |
| 8 | **Drag is the only verb.** No fallback exists for touch or small screens. | Decide whether click-to-place is needed. |
| 9 | **Hand-authored JSON** is the only content pipeline until the CMS is rebuilt. | Tolerable at ~15 Tokens; reassess before the second Map. |
| 10 | **Per-Token input rules give players no principle to reason from** — they must learn each Token individually. | Author consistently anyway: creates-from-nothing should be free, transforms should cost. |
