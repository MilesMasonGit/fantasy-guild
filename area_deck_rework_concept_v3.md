# Concept Design: 4-Slot Area Palette, Hero 9-Slot Loadout & Outpost System (v3)

This document outlines the finalized design concept for Fantasy Guild Idle's **Area Deck & Loop System**, replacing complex card-deck building and tree paths with a streamlined **4-Slot Local Area Palette** for adventuring, a **9-Slot Hero Loadout Grid** for gear and consumables, **Area Card Packs** for collection, and **standalone single-slot Outpost Banners** whose auras apply game-wide.

> **Living document — design COMPLETE.** Decisions **D-1 … D-67** in Appendix A are LOCKED, settled across fifteen design rounds on 2026-07-30/31. Do not re-litigate them. Where a later decision supersedes an earlier one (D-26 → D-46), the earlier entry is struck through and annotated. **There are no open design questions.** Appendix C records the economy's shape; Appendix D holds the watch list of implementation risks. The build plan is [`area_deck_rework_roadmap_v1.md`](area_deck_rework_roadmap_v1.md).

---

## 1. Vision & Core Philosophy

* **Scoped Local Card Palettes:** Players no longer manage a massive global card binder. Instead, each Area features a localized **Area Card Palette** (4–8 cards) tailored strictly to that region's environment and lore.
* **Area Card Packs:** Players acquire and expand their regional card collection by opening **Area-Specific Packs** (e.g., *Iron Crags Pack*, *Farmlands Pack*).
* **Immediate 4-Slot Banner:** Every Area Banner provides 4 Card Slots immediately upon region unlock (`[ Slot 1 ] [ Slot 2 ] [ Slot 3 ] [ Slot 4 ]`). **All four slots are free and identical** — any owned card from that area's palette may go in any slot, and this never changes (see D-1, D-2).
* **Task Cards vs. Boost Cards:**
  * 🎣 **Task Cards:** Actions such as gathering, combat, or resting.
  * 🌟 **Boost Cards:** Utility cards placed on the banner that enhance performance across the 4-card loop.
* **No Mastery Bonuses — Repetition Is Its Own Reward:** Stacking 4 copies of the same Task Card is *not* rewarded with a bonus multiplier (see D-5). If a card is your best yield-per-second, running it four times is already the optimal play; it needs no extra incentive layered on top.
* **Boost Cards Are Uniques:** Because four copies of a Boost card would have nothing to boost, a Boost exists **only once in an area's pool** (see D-6). They are a deliberate trade — you spend one of your four slots to make the other three better — and they come in two archetypes (Aura, Next-Card), so **slot order matters**.
* **Own What You Slot:** Filling all four slots with the same Task card requires **four owned copies** (see D-9). The 4× farm loop is an earned end state for an area, not a day-one default.
* **Hero 9-Slot Loadout Grid (Equipment + Consumables):** Heroes manage gear and consumables within a single **fully flexible** 9-slot inventory panel — any slot takes any item (see D-7). This is the **only** consumable system in the game (see D-4).
* **Consumption Is Visible:** Every act of eating, drinking or quaffing renders as a **card**. Potions are drawn in a quick **Prep Phase** at the head of each loop (~2s each); food and drink fire on need below **25% HP / Energy** — and eating mid-combat hands the enemy a free hit (see D-17, D-20, D-25b, D-27).
* **Standalone Outpost Banners with Global Auras:** Outposts are **their own banners**, fully separated from adventure areas (see D-16). Each holds a **single card** unlocked on the Guild Hall tree — a crafting station, a boost, or a passive — and its aura applies **globally, across every area**.
* **Scarcity Is the Spine:** Heroes always trail the number of banners (see D-24), and Outpost banners cap at a handful (see D-21). Deciding *where to put your people* is the game's central ongoing choice.
* **One Forward Journey:** No prestige, no resets (see D-40). Power comes from reaching higher-tier areas, and the economy escalates exponentially between them (see Appendix C).

---

## 2. Area Banner Structure

An **Area Banner** (e.g., *The Iron Crags*, *The Farmlands*) is now **adventure only**. The old Adventure/Outpost split-banner toggle is retired (D-16): an area banner shows its 4-Slot Card Banner, its assigned Hero, and its loop status — nothing else.

Outposts live on separate banners of their own; see §6.

### Slot Model (LOCKED — see D-1, D-2)

Every area has exactly **four identical, unrestricted slots**, permanently. The legacy slot *types* are retired:

| Legacy slot type | Fate under v3 |
| :--- | :--- |
| `regular` | Becomes the only slot type. |
| `specialized` (tag-gated) | **Retired.** Area identity now comes purely from the area's card palette, not from slot restrictions. |
| `locked` (+ hazard payload) | **Retired as a slot type.** All 4 slots are usable the moment the area unlocks. The hazard *mechanic* survives, re-homed onto Task cards (see D-8). |

Slot count never grows. All progression is expressed through **card levels, hero gear, consumables, and Outpost boosts** — never through a bigger banner. Every banner is the same size on screen, forever.

### Adventure Card Categories (Area-Specific Palette)

| Card Category | Copies | Purpose | Examples | Execution & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Task Cards** | Usually 4 — **one owned copy per slot used** (D-9) | Primary gameplay actions (Gather, Fight, Rest) | *Shrimp Fishing, Mine Iron Ore, Fight Bear, Rest* | Hero executes the task; yields resources or heals. May also carry a **hazard** or a **buff** (D-60). |
| **Boost Cards** | Usually 1 (D-6) | Utility buffs and status modifiers | *Shrine of Luck, Campfire, Sharpening Altar* | Buffs other cards on the banner. Two archetypes — see below. |

### Cards Are Composable, Not Typed (LOCKED — see D-60, D-61)

**"Task" and "Boost" are labels, not capability classes.** A card carries a **list of effects**, and any card may carry any combination:

| Effect | What it does |
| :--- | :--- |
| **Work output** | Yields resources, gold, or XP. |
| **Aura buff** | Buffs from this card to the end of the loop. |
| **Next-card buff** | Buffs only the following card. |
| **Hazard** | Damages the hero on execution (D-11). |
| **Heal / restore** | Recovers HP or Energy. |

So a card can *give an output **and** buff later cards* — that hybrid is a first-class design target, not a special case. The labels survive only to drive **pack pools** and **display**.

**Copy limits are authored per card (D-61).** Each card declares its own `maxCopies` — 4 for a typical Task card, 1 for something special — independent of what effects it carries. A powerful hybrid can be made unique; a simple buff card can allow four. This value drives the pip count (D-49) directly.

> **Why this matters for the build:** the engine must never branch on card *type* to decide what a card can do. New card concepts should be **authoring work, not engine work** — this is the single most important architectural constraint on the card system, and the direct analogue of D-54's requirement for equipment categories.

### Copy-Limited Slotting (LOCKED — see D-9)

**You must own a copy for every slot you fill.** Four Shrimp Fishing cards on the banner requires four owned Shrimp Fishing cards in that area's binder. Owning one copy lets you run it once per loop.

This makes the pure 4× farm loop an **earned end state** for an area, not a starting option — a newly unlocked region is played with a thin, mixed hand, and grows toward focused mass-farming as its packs are opened. Every duplicate pulled from a pack has immediate, obvious value.

### Boost Card Archetypes (LOCKED — see D-10)

Boosts are not one mechanic. Sequencing matters, and different boosts reward different placements:

| Archetype | Effect | Optimal placement |
| :--- | :--- | :--- |
| **Aura Boost** | Switches on when the hero reaches it and stays active for the remainder of the loop. | **Slot 1** — placed first, it effectively buffs the whole deck. Placed in slot 4 it does almost nothing. |
| **Next-Card Boost** | Buffs only the single card immediately following it. | Directly *before* the card you most want amplified — pure sequencing play. |

This restores slot **order** as a genuine design dimension: the banner is a sequence, not a set.

### Hazard Task Cards (LOCKED — see D-8)

Hazards move from slots onto **Task cards**, becoming an opt-in risk/reward choice rather than an unavoidable slot tax:

> *Deep Mine Shaft — yields double ore, but bleeds 4 HP each pass.*

**Damage fires once per execution of that card** (D-11). Slot four Deep Mine Shafts and the hero takes four hits per loop; slot one and they take one. Risk scales exactly with the reward taken.

This pairs naturally with the sustain loop: a hazard card is affordable if you also slot a *Rest*, or feed the hero healing consumables. The player chooses to take the damage; the area never imposes it.

---

## 3. Banner Loop Strategies

The 4-Slot system naturally supports three distinct player strategies. With mastery bonuses removed (D-5), these compete on **raw arithmetic** — throughput vs. multiplier vs. sustainability — not on a bonus the design hands out:

* **1. Pure Stacking (The 4x Farm Loop):** `[Shrimp] [Shrimp] [Shrimp] [Shrimp]`
  * *Effect:* Maximum raw throughput of one task. Correct whenever a single card out-earns any combination.
* **2. Boosted Loop (Quality Farming):** `[Shrimp] [Shrimp] [Shrimp] [Shrine of Luck]`
  * *Effect:* Trades one task execution for a multiplier across the other three. Correct when the Boost's multiplier beats the 4th card's raw output.
* **3. Balanced Expedition (Sustainability):** `[Fight Bear] [Fight Bear] [Rest] [Sharpening Altar]`
  * *Effect:* Balances combat damage, healing, and attack status buffs to run high-level monsters indefinitely. Correct when the hero cannot survive the loop otherwise.

Because all 4 slots are unrestricted in every area (D-1), all three strategies are available everywhere — the choice is always the player's, never the area's. **Design obligation:** since nothing rewards stacking artificially, Boost card multipliers and Rest values must be tuned so that Strategies 2 and 3 genuinely beat Strategy 1 in the situations they're meant for. If a Boost is weaker than a 4th task card, it is dead content.

### Editing the Loop (LOCKED — see D-25)

**The banner cannot be edited while it runs.** Changing a card **stops the loop**; once the player is done arranging, the loop **restarts from the beginning** — prep phase first, then Slot 1.

*Why:* it removes every mid-loop edge case at a stroke — no partial auras, no re-triggered potions, no "is this card active yet" ambiguity — and it makes deck-building a deliberate act with a real cost (lost loop time) rather than something to fidget with continuously.

---

## 4. Hero 9-Slot Loadout System & Automatic Consumption

Every Hero features a **9-Slot Inventory Grid** on their character panel:

```
[ Sword  ]  [ Sword      ]  [ Chestplate ]
[ Hat    ]  [ Spicy Stew ]  [ Haste Elixir ]
[ Beer   ]  [ Scroll     ]  [ (Empty)    ]
```

### A. Equipment Restrictions & Consumable Flexibility (LOCKED — see D-7, D-54, D-55)
* **Fully Flexible Grid:** All 9 slots accept **any** item. There are no reserved gear rows and no reserved consumable rows.
* **Equipment Limits:** the only constraint is **per-category caps** (D-55). Most categories allow **1**; a few allow **2**.

**Equipment categories are data-driven and expected to grow (D-54).** An item declares a category via `equipSlot`; the hero's grid enforces that category's cap. The set is deliberately open:

| Category | Cap | Status |
| :--- | :--- | :--- |
| `hand` | 2 | Live — dual-wield, bonuses stack |
| `hat` | 1 | Live |
| `chest` | 1 | Live |
| `trinket` | 2 | Live — **planned to split into `ring` (cap 2) and `amulet` (cap 1)** |
| `quiver`, `gloves`, `boots` | 1 | Planned |

> **Architectural requirement:** the category list and its caps must be **data**, not hardcoded constants. New categories should be addable by authoring alone, with no engine change. This is the single most important constraint on how C-7 is built.
* **The Strategic Dial:** because gear caps at roughly 6 pieces but **Consumables are uncapped** (D-56), the grid genuinely bends. A player can run heavy gear + few buffs, light gear + a wall of buffs, or any mix. That trade is the whole point of merging the two into one grid.
* **No Duplicate Stacking (LOCKED — D-18):** carrying two *Spicy Stews* does not double the buff — the same consumable applies once. **One of *each* equipped consumable** fires per loop, so variety pays and duplication doesn't. Surplus copies stay in the Guild Bank for restocking.

### The Three Consumable Classes (LOCKED — see D-56)

| Class | Examples | Cap | When it fires |
| :--- | :--- | :--- | :--- |
| **Food** | Bread, stew | 1 (category cap) | On need — HP below 25% (D-17) |
| **Drink** | Beer, water | 1 (category cap) | On need — Energy below 25% (D-17) |
| **Consumable** | Potions, **scrolls, runes, summons** | **Uncapped** | **One of each, at the start of every loop** (D-20) |

**"Consumable" is a whole item class, not just potions.** It is the open-ended slot for anything the hero *expends* for effect rather than eats for sustenance — which is what makes a buff-stacking build possible: fill six slots with six different scrolls and runes, and all six fire every loop.

### B. Consumption — Two Models by Item Class

Consumables split into **sustenance** (food, drink) and **potions** (buffs), and they behave differently.

**B1. Food & Drink — Automatic, Need-Based (LOCKED — D-17, D-27)**

**Heroes feed themselves,** and every act of consumption is **rendered as a card** — nothing happens invisibly. The two have different timing, because they solve different problems:

| | **Drink (Energy)** | **Food (HP)** |
| :--- | :--- | :--- |
| **Trigger** | Energy below 25% | HP below 25% — **anywhere**, in combat or not |
| **When it happens** | **At the draw.** Energy is what pays to draw the next Task card, so a thirsty hero drinks *first*, then draws. | Immediately on dropping below the threshold. |
| **Cost** | The drink card's time. | The food card's time — **plus, if in combat, a free hit for the enemy.** The attack cycle pauses to eat; the fight doesn't. |
| **Frequency** | As needed. | **Uncapped** (D-31) — as often as the threshold is crossed. |

* **Drinking is a gate, not an interrupt:** it slots cleanly between cards, at exactly the moment energy is needed.
* **Eating is universal, but combat makes it expensive:** the same 25% rule applies everywhere, so a hero on a fight-free gathering loop is never stranded by hazard chip damage. What changes in combat is the *price* — healing mid-fight always hands the enemy a swing.
* ⚠ **Watch item (D-31):** uncapped eating plus a free enemy hit can produce a visible death spiral — eat, get hit, eat, get hit, never attack. This is working as designed (a hero who can't out-heal the damage should lose) but it may *read* as broken. If testing shows it looks bad, the fix is a short cooldown between meals.
* **Auto-Replenish from Guild Bank:** as long as the Guild Bank stocks the assigned consumable, the hero's slot restocks automatically. If stock runs out, the hero goes without — and visibly falters.
* **Why this shape:** sustenance is a *supply-chain* problem (keep the bank stocked), not a *timing* problem — the correct shape for an idle game — while the combat-eating rule keeps HP management genuinely tense.

**B2. Consumables — The Prep Phase (LOCKED — D-20, D-25b, D-56)**

Consumables (potions, scrolls, runes, summons) are expended for effect, not sustenance. **One of each equipped Consumable** is spent in a visible **Prep Phase** at the head of every loop:

```
[ Prep: Elixir ] [ Prep: Scroll ] [ Prep: Rune ]  →  [ Slot 1 ] [ Slot 2 ] [ Slot 3 ] [ Slot 4 ]  →  shuffle  →  ↺
       ~2s              ~2s             ~2s              ~5s        ~5s        ~5s        ~5s
```

* Each equipped Consumable is **drawn as its own card** in the prep phase and consumed — roughly **2 seconds each**, notably quicker than a normal ~5s task card.
* The effect lasts **that loop's duration** (e.g. *Haste Elixir* = +30% task speed for 1 loop).
* Consumables restock from the Guild Bank like anything else; if stock is out, the hero runs without that effect.
* **The prep phase is the cost, and it's what balances an uncapped class.** Consumables have no category cap (D-56), so a hero could carry six — but that's ~12 seconds of prep before any work happens, every single loop. Buff strength is therefore always weighed against loop time lost. **This is the only brake on consumable stacking, so prep time and buff potency must be tuned together.**
* **Prep cards cost no energy (D-28).** Energy is spent drawing *Task* cards only. This is deliberate: a hero too drained to drink the thing that restores their energy would be a dead-end trap state.

> **Reverses CR-029** (2026-07-16), which retired hero food/drink slots and moved drinking onto the station. The station-side Drink slot and auto-sip are gone; the hero's own grid does the job everywhere.

### C. Defeat Penalties (LOCKED — see D-19, D-57)

If damage — including hazard-card bleed (D-11) — takes a hero to 0 HP:

* **25%** of each slotted consumable's banked stack is destroyed.
* **10% chance per equipped gear piece** of permanent loss.
* **The hero is unassigned and returns to the roster (D-57).** They do not stay on the banner; the player must consciously re-deploy them.

This is deliberately harsh: it is what makes hazard Task cards a real gamble and sustain loops worth building. Note the flexible grid (D-7) raises the exposure — a hero carrying 6 pieces of gear risks all 6.

> ⚠ **Combined severity is worth watching.** Defeat now costs banked consumables, possibly permanent gear, the production time, *and* a manual re-deployment — while heroes are deliberately scarce (D-24). That is four penalties stacked on one event. Intended, but it makes the difficulty of any area with hazard cards a high-stakes tuning problem.

---

## 5. Area Card Packs & Unlocks

* **Regional Card Packs:** Players acquire card packs specific to an Area (e.g., *Iron Crags Pack*).
* **Collection, Not Levelling:** Opening a pack awards new card types or duplicate copies. **Cards have no levels** (D-12) — a duplicate's entire value is that it lets you slot that card one more time.
* **Zero Binder Clutter:** Opening a card slot on a banner *only displays cards owned for that specific region*.
* **Completable Binders:** Every card caps at **4 owned copies** — exactly enough to fill a banner — and a maxed card is **removed from that area's pack pool** (D-13). Packs therefore always deliver something you still need, and an area's binder reaches a genuine 100% complete state.

### A. Ownership Scope (LOCKED — see D-3)

Cards are **area-exclusive by default, with a small universal set**:

* **Area cards** declare exactly one home area. They appear only on that area's banner and drop only from that area's pack.
* **Universal cards** (a deliberately short list — *Rest*, *Campfire*, and similar baseline utilities) live in a separate **Universal Bucket** (D-46), outside every area binder and outside every area pack pool.
* This replaces the current **global unified pack** with per-area packs.

### D. The Universal Bucket (LOCKED — see D-46)

The one deliberate exception to per-area ownership. Universals are **owned and counted like any other card — but globally, and allocated across areas by the player.**

* **Owned, not free.** The player must acquire copies. Universals are not a handout.
* **Global pool, player-allocated.** Own four *Campfires* and you may slot all four into a single area, or spread them one each across four areas. The bucket is the supply; the banners are the demand.
* **Not in any binder, not in any pool.** Universals never appear in an area's binder page and never dilute an area's pack pool — area pools stay purely regional.
* **Copy-limited like everything else.** Slotting a universal consumes one of your owned copies for as long as it sits there, exactly as D-9 governs area cards.
* **Acquired on the Guild Hall tree (D-51).** Ranked nodes, exactly as Outpost cards work (D-37): rank 3 of *Campfire* means you own three. RNG-free, and it frames universals as guild infrastructure rather than regional loot.
* **Capped at 4 copies (D-52)** — the same ceiling as every other card in the game.
* **Displayed in a side panel (D-53)** running alongside the banner list, scrolling independently of it.

*Why this shape:* it keeps the guarantee that a hero can always build a sustain loop anywhere, while making *where to spend your Rests* a genuine allocation decision — the same scarcity logic that governs heroes (D-24) and Outpost banners (D-21). It is also the only place the old "global pile" model survives, and it survives on purpose.

> **The cap is a scarcity mechanic, not an oversight.** Once the game has more than four areas, four Campfires cannot cover them all — and that is the point. Universals become another thing you must decide *where to spend*, sitting alongside scarce heroes (D-24) and scarce Outpost banners (D-21). **Balance consequence:** because 4 is a fixed ceiling in a game whose area count is deliberately large (D-40), universals get *relatively* scarcer as the world grows. Watch that late-game areas without a Rest are still survivable through gear, potions and Boost cards.

> ✅ **This closes the earlier concern.** D-46 supersedes D-26 (which seeded universals into every pack pool). Area pools stay regional with zero dilution, and a new area is never stranded without a sustain option.

### B. Per-Area Binders (LOCKED — see D-6, D-41 … D-45)

Collection is organised as **one binder per area**, not one global collection. **This is the heart of the rework** — the system being replaced is the current *global* binder, where every card sits in one pile of user-filed tabs and can be deployed to any area.

**What an area binder is:**

* **One flat page per area (D-41).** No tabs, no manual filing. The area *is* the organisation. The current player-created tab system exists only because all cards share one pile; scoping cards to areas removes its reason to exist.
* **It lives on the area banner (D-42).** The binder sits with the 4 deck slots it feeds — you pick from your local palette exactly where you use it. There is no cross-UI drag from a global drawer.
* **Cards are bound to their area forever (D-43).** Where a card was found is where it lives. Cards never transfer between binders.
* **The whole pool is visible (D-44).** Unowned cards show as locked silhouettes, so the player can always see the finish line — the visible gap is the motivation to buy packs.
* **Packs are bought right there (D-48).** The buy button sits next to the progress it advances.

**The Four-Pip Indicator (D-45).** Every card in the binder carries four pips — one per possible copy (D-13's cap). Each pip has three states:

| Pip | Meaning |
| :--- | :--- |
| ○ Empty | Not collected. |
| ● Full | Collected and **available** to slot. |
| ⬤ Coloured | Collected and **currently in the deck**. |

This single control answers every question the player has at once: how far through the area's collection they are, how many copies they own, and how many are still free to slot. An uncollected card shows ○○○○; a fully-collected, fully-deployed card shows ⬤⬤⬤⬤.

* A **Boost card can be found only once within an area** — its own pool contains exactly one. This is what makes Boosts rare in the overall card economy.
* The *same* Boost design may also appear in a **different** area's pool. If so, the player can obtain a second copy there — but it lives in that area's binder and is usable only on that area's banner.
* Task cards are freely duplicated within an area's pool, since copy-limited slotting (D-9) gives every duplicate a job.
* **The Boost is a rare pull with a pity guarantee** (D-14): it sits in the pack pool at a low rate, but a counter guarantees it by pack *N* so no player is permanently locked out by bad luck.

### C. The Shape of an Area's Progression

Because levelling is cut (D-12) and binders complete (D-13), an area's card chase has a **definite arc with an end**:

1. **Thin hand.** Area unlocks with 4 free slots but few owned cards — loops are mixed out of necessity.
2. **Filling out.** Packs add card types and duplicates; the player starts choosing between breadth and doubling up on the best earner.
3. **The Boost lands.** Sequencing decisions open up (Aura first vs. Next-Card placement).
4. **Binder complete.** All cards at 4 copies; the pool is empty and packs for this area are no longer sold — and completion grants that area a **permanent Mastery bonus** (D-66).

Ongoing power after step 4 comes from **elsewhere** — hero gear, consumables, Outpost cards and their global auras, and moving on to the next area. This is deliberate: there is no infinite card grind.

### D. Binder Mastery (LOCKED — see D-66)

Completing an area's binder grants that area a **permanent bonus** — the payoff for finishing the collection, and a second reason (alongside D-30's resource demand) that a completed area stays worth running.

* It is a **one-time, permanent** unlock per area, not a repeatable grind.
* It rewards the *completion*, not the repetition — which is why it doesn't conflict with cutting stacking mastery (D-5) or card levelling (D-12). Those cut bonuses for **doing the same thing over and over**; this rewards **finishing something**.
* **Tuning note:** the bonus must be worth the last few expensive packs without making the completed area strictly better than the next tier up — the tier curve (D-65) should still dominate.

**What keeps a completed area alive: demand (D-30).** Areas are the *only* source of raw materials — the ore, hides and herbs that Outpost crafting, gear and consumables all consume. A finished binder doesn't retire an area; it just means the area has become a pure production site. **Design obligation:** this hangs entirely on the crafting economy having a deep, ongoing demand chain. If demand ever dries up, a completed area genuinely is dead content — the economy must be tuned with that in mind.

---

## 6. Outpost Banners (LOCKED — see D-16)

**Outposts are separated from areas entirely.** The split-banner Adventure/Outpost toggle is gone. An Outpost is now **its own banner**, sitting alongside area banners rather than hiding behind one — an **ordinary banner row**, not a pinned or privileged one (D-58). The player places it wherever they like via the Area Manager.

### A. Structure — One Card, One Choice

Where an Area Banner has four slots, an **Outpost Banner has exactly one**. The player picks a single card for it from their **unlocked Outpost card list**. Three kinds of card can go there:

| Outpost Card Type | What it does | Example |
| :--- | :--- | :--- |
| **Crafting Station** | Turns the banner into a production line — pick a recipe, loop output into the Guild Bank. Some also emit a **small** global buff. | *Smithy*, *Alchemist Lab*, *Wood Kiln* |
| **Passive** | Crafts nothing. Its **only** effect is a **strong** global aura. | *Trade Post: +5% gold from all sales* |

The single slot is the whole design: an Outpost is a **commitment to one thing at a time**, and switching it is the strategic act.

**The core Outpost choice (D-62):** *does this Outpost make things, or make everything better?* A Crafting Station produces goods and may carry a small incidental aura; a Passive gives up all production for a much stronger one. Passives are also the natural home for the unstaffed cards of D-22 — with no work to do, there's nothing for a hero to do there.

> ~~**Aura strength has three tiers, and they must stay separated in tuning:**
> **Station incidental buffs** (small) < **Passive Outpost auras** (strong, global) < **Boost cards in the deck** (most powerful, but local to one banner and costing a slot).~~
>
> **SUPERSEDED by D-68 (2026-08-01).** There are no power tiers. Effects vary
> wildly in kind and magnitude — *"0.1% chance to roll Pirate Treasure Loot on
> Fishing tasks"* and *"+20% work speed on Areas with an Elite Enemy"* are both
> legitimate auras — and the designer sets the numbers freely per card.

### B. Where Outpost Cards Come From (LOCKED — see D-34, D-35, D-36)

**The Guild Hall upgrade tree.** Outpost cards are not crafted, not pulled from packs, and not dropped by areas — they are **unlocked as nodes on the guild upgrade tree** (D-34). This keeps them RNG-free, entirely predictable, and puts the Outpost layer on the same guild-wide progression spine as the banners themselves.

* **Every Outpost unlock ships with a card (D-35).** Unlocking an Outpost banner always grants one Outpost card alongside it, so a new banner is never an empty frame and the player is productive immediately.
* **Nodes are gated behind area unlocks (D-36).** An Alchemist Lab node only becomes available once you've unlocked the region it belongs to. Outpost progression therefore paces itself against exploration without needing a separate gating system.
* **Nodes have repeatable ranks (D-37).** Buying rank 2 of the Smithy node grants a *second* Smithy card, rank 3 a third, at escalating cost. This is how the additive aura stacking of D-23 is supplied, and the rising rank cost is what balances how far a player can specialise.
* **Swapping is free and instant (D-38)** — but it stops that Outpost's production while you rearrange, exactly as editing a banner does (D-25). Any unlocked card may be installed at any time.

### C. Supply & Staffing (LOCKED — see D-21, D-22)

* **Scarce and guild-wide (D-21):** Outpost banners are **not** per-area. The player starts with **one** and unlocks a small handful (≈3–4) through guild progression. Because the auras are global, scarcity is what makes the choice bite — picking Smithy over Trade Post has to hurt.
* **Most Outposts need a hero (D-22):** staffing is a **per-card property**. Crafting Stations always need a hero, and most Boost/Passive cards do too — a global aura normally costs you a body off the adventure roster. A small number of **special passive Outpost cards** are the exception and run unstaffed.

### D. Global Auras — Not Regional

An Outpost card's effect applies **globally, to every area in the game** — not just to a neighbouring region. The "Passive Regional Boost" from the v3 draft is replaced by a **Passive Global Aura**.

*Why this matters:* it makes Outpost cards genuinely valuable rather than a local footnote, and it means the player's Outpost choices are a **guild-wide strategic layer** sitting above the per-area card loops.

**Duplicates stack additively (D-23).** Two Smithies give double the mining bonus. This is a legitimate **specialisation** play rather than a trap, precisely because the cost is steep: a second Smithy consumes one of your ~3–4 total Outpost banners *and* a second hero. Doubling down means giving up an entire other aura to do it.

### E. Crafting Loop

When a Crafting Station card is installed:

* Assign a Hero to the Outpost banner.
* Pick an unlocked recipe (e.g. *2× Iron Ore + 1× Coal → 1× Iron Ingot*).
* Production loops into the Guild Bank.
* The hero feeds themselves from their own 9-slot grid via the 25% rule (D-17) — no station-side food or drink slot exists.

**Recipe gating is retained (D-63).** Recipes are tied to a **subskill** with a `levelRequirement`, and each station carries a `skillCap` that tiers how far it can take you. 21 recipes are already authored this way. Crafting therefore rewards hero specialisation, and better stations are a real upgrade axis.

**Station cards carry no `areaId` (D-64).** Gating lives entirely in the guild tree's node structure (D-36); card data describes the card, the tree describes progression. Any owned Outpost card installs in any Outpost banner.

**Crafting costs energy (LOCKED — D-29).** Each craft draws on the hero's energy (currently ~15 per craft). When the crafter drops below 25% they drink from their own grid and continue. Outpost output is therefore gated by the **drink supply chain** — the Guild Bank's consumable stock is what keeps production lines running, and an unsupplied crafter stalls. This gives the bank's consumable stock a second job and makes Outposts feel like real production lines rather than free money.

---

## Appendix A — Locked Decisions Log

Decisions here are settled. Each records the call, the date, and the reasoning.

### Round 1 — 2026-07-30 (Structural forks)

**D-1 — All four banner slots are free and identical.**
Any owned card from the area's palette fits any slot. The `specialized` (tag-gated) and `locked` (hazard) slot types in current area data are retired.
*Why:* the banner reads at a glance, the 4× Stacking Mastery is reachable in every area, and areas differentiate through their card palette rather than through restrictions the player can't act on.
*Cost accepted:* existing specialized/locked slot authoring is deleted; hazards lose their current home.

**D-2 — The slot count is permanently 4.**
No area, upgrade, or late-game system ever grants a 5th slot.
*Why:* keeps "Stacking Mastery = 4 identical copies" one fixed rule, keeps every banner visually uniform, and forces progression into card levels / gear / consumables / Outpost boosts.
*Cost accepted:* no "my deck got bigger" progression beat.

**D-3 — Cards are area-exclusive, plus a small universal set.**
Each card declares one home area; a short universal list (Rest, Campfire, and similar) is available everywhere.
*Why:* preserves tight regional palettes and the "zero binder clutter" promise, while guaranteeing a newly unlocked area is playable before its pack pool is deep.
*Cost accepted:* the global unified pack and its global cost curve are replaced by per-area packs.

**D-4 — One consumable system: the hero's 9-slot grid.**
The station-side Drink slot and its auto-sip are retired. A hero stationed at an Outpost consumes from their own grid.
*Why:* one rule in one place; consumables behave identically wherever the hero is.
*Cost accepted:* craft-energy pacing must be reworked, since it currently depends on the station auto-sip. Reverses CR-029.
*Refined in Round 5 by D-17 — the trigger is need-based, not loop-based.*

### Round 2 — 2026-07-30 (Loop math & hero grid)

**D-5 — Stacking Mastery bonuses are CUT.** *(Owner call — reverses the v3 draft.)*
There is no +50%/+25% bonus for filling the banner with identical cards, and no tiered 2×/3×/4× version.
*Why (owner):* mastery bonuses crept into the design without ever being committed to. Running four copies of your best card is already the optimal play — it doesn't need a bribe on top.
*Cost accepted:* the design must now carry its own weight through tuning — Boost cards and Rest have to be numerically worth a slot on their own merits (see §3).

**D-6 — Boost cards are uniques, scoped per area.** *(Owner call; scope settled Round 3.)*
A Boost card exists exactly **once in a given area's pool**, so a player can only ever own one copy of it *for that area*. The same Boost design may appear in another area's pool, where it is a separate find living in that area's separate binder.
*Why:* four copies of a Boost would have nothing to boost, and one-per-area keeps Boosts genuinely rare in the overall card economy without forcing the player to shuttle a single global copy between regions.
*Consequence:* the collection model is **per-area binders**, not a global collection with area tags.

**D-7 — The 9-slot hero grid is fully flexible.**
Any slot holds any item; only gear type-uniqueness constrains it. No fixed gear rows, no consumable cap.
*Why:* the gear-vs-consumables ratio becomes a real strategic dial the player controls.
*Cost accepted:* the buff ceiling per loop is uncapped, so consumable potency and Guild Bank drain must be tuned against a maximum-consumable build.

**D-8 — Hazards move onto Task cards.**
Cards may carry a hazard payload (e.g. *bleeds 4 HP per pass*), typically paired with an above-curve reward.
*Why:* converts a slot tax the player couldn't avoid into an opt-in risk/reward choice, and gives Rest cards and healing consumables a clear job.
*Cost accepted:* new card authoring, and the UI must surface where damage is coming from.

### Round 3 — 2026-07-30 (Collection & sequencing)

**D-9 — Copy-limited slotting: own N copies to slot N times.** *(Owner call.)*
Filling all four slots with the same Task card requires four owned copies in that area's binder.
*Why:* it gives every duplicate pulled from a pack immediate, obvious value and makes the 4× farm loop a goal you build toward per area rather than a day-one default.
*Cost accepted:* a newly unlocked area is deliberately played with a thin, mixed hand; early-game pack pacing must not leave it unplayable. Note this **conflicts with §5's original "duplicates level cards"** promise — resolved in Round 4.

**D-10 — Boost cards use two archetypes, and sequence matters.** *(Owner call — supersedes the single-scope options offered.)*
*Aura Boosts* activate on arrival and persist to the end of the loop (best in slot 1, where they cover the whole deck). *Next-Card Boosts* buff only the card immediately after them (pure sequencing play).
*Why:* variety across the Boost pool, and it restores slot order as a real decision — the banner is a sequence, not a set.
*Cost accepted:* the UI must make each Boost's archetype and reach obvious, or placement becomes guesswork.

**D-11 — Hazard damage fires once per execution of the hazard card.**
Four hazard cards = four hits per loop; one card = one hit.
*Why:* risk scales precisely with the extra reward the player chose to take, and it's trivially predictable.

### Round 4 — 2026-07-30 (Card economy)

**D-12 — Card levelling is CUT.** *(Owner call — removes §5's original "duplicates upgrade efficiency" promise.)*
Cards have no levels or tiers. A card's power is fixed by its design.
*Why:* duplicates already have a job under D-9; layering levelling on top would double-dip and re-introduce exactly the kind of un-committed bonus system that mastery bonuses were (D-5).
*Cost accepted:* a fully-collected area gains no further card power — progression must come from gear, consumables, Outposts and new areas.

**D-13 — Copies cap at 4; maxed cards leave the pack pool.**
Each card can be owned at most 4 times (exactly a full banner). Once maxed, it is removed from that area's pack pool.
*Why:* every pack is guaranteed to advance the collection, and an area's binder reaches a real, satisfying 100%.
*Cost accepted:* packs grow stronger as an area nears completion; and once the pool empties, that area's packs stop being sold.

**D-14 — The area Boost is a rare pack pull ~~with a pity guarantee~~.** *(Pity clause superseded by D-69.)*
~~Low drop rate in the area pool, with a counter guaranteeing it by pack *N*.~~ The Boost is rare, but nothing is authored to make it so — see D-69.
*Why:* keeps one unified chase and makes pack-opening exciting, while removing the possibility of being locked out by bad luck.
~~*Cost accepted:* the pity counter needs tuning and clear communication.~~ No counter exists to tune.

**D-15 — The loop always restarts at Slot 1.**
Fixed cycle: slot 1 → 2 → 3 → 4 → shuffle pause → slot 1.
*Why:* makes Aura Boost placement deterministic, gives the Card 1 consumable trigger an unambiguous home, and matches the engine's existing shuffle-on-wrap behaviour.

### Round 5 — 2026-07-30 (Outposts split off; consumption goes automatic)

**D-16 — Outposts become standalone banners with a single card and global auras.** *(Owner call — replaces the split-banner architecture in §2 and the regional-boost model in §6.)*
Area banners are adventure-only. An Outpost is its own banner holding **one** card, chosen from an unlocked list — a Crafting Station, a Boost, or a Passive — and its effect applies **across all areas**, not just a neighbouring region.
*Why:* separating the two removes a mode toggle and a whole class of "which face am I looking at" confusion; a single slot makes the Outpost a real commitment; and global auras raise Outpost choice into a guild-wide strategic layer above the per-area loops.
*Cost accepted:* the existing Adventure/Outpost mode system, per-area station slots and the "outpost upgrades unlock more station slots" progression are all superseded. Global auras are far more powerful than regional ones and must be balanced accordingly.

**D-17 — Food and drink are consumed automatically on need: the 25% rule.** *(Owner call.)*
When a hero falls below **25% HP** they eat; below **25% Energy** they drink. Same behaviour in adventure loops and at Outposts.
*Why:* no timing, no ritual, no micro-management. Sustenance becomes a supply-chain concern (keep the bank stocked) rather than a per-loop event, which is the correct shape for an idle game.
*Scope:* applies to food and drink only — potions are covered by D-20.

**D-18 — Duplicate consumables do not stack.**
Two *Spicy Stews* in the grid apply the buff once.
*Why:* prevents the degenerate "fill the grid with the single best potion" build and keeps mixed loadouts interesting.

**D-19 — Existing defeat penalties stand.**
At 0 HP: 25% of each slotted consumable's banked stack destroyed, plus a 10% chance per equipped gear piece of permanent loss.
*Why:* hazard cards (D-8, D-11) need a real downside or their above-curve rewards are free; harsh stakes are what make sustain loops worth building.
*Cost accepted:* the flexible 9-slot grid (D-7) increases exposure — a heavily geared hero risks more. Losing gear to an unattended idle loop is a known bruise; watch player reaction in testing.

### Round 6 — 2026-07-30 (Outpost economy & the potion trigger)

**D-20 — Potions fire at the start of each loop.** *(Owner call.)*
Food and drink follow the 25% rule; **potions** are consumed at Slot 1 of every loop and buff that loop's duration.
*Why:* potions restore neither HP nor Energy, so the need-based trigger can never fire them — they need a schedule of their own, and loop start is the natural one.
*Cost accepted:* two timing models coexist, so the UI must make clear which items are need-based and which are per-loop. The re-trigger exploit this opened was closed in Round 7 by D-25 (no mid-loop editing).

**D-21 — Outpost banners are scarce and guild-wide.**
Not one per area. Start with 1, unlock a small handful (≈3–4) through guild progression.
*Why:* global auras are powerful, so scarcity is the balancing force — the choice between two good auras must actually hurt.
*Cost accepted:* an unlock track needs designing, and Outposts are no longer tied to area progression.

**D-22 — Staffing is a per-card property; most Outposts need a hero.** *(Owner call.)*
Crafting Stations always require a hero. Most Boost and Passive cards do too. A small set of **special passive cards** run unstaffed.
*Why:* a global aura should normally cost a body off the adventure roster — that opportunity cost is what keeps auras honest — while a few unstaffed passives give the player something to fall back on when the roster is thin.
*Cost accepted:* "does this one need a hero?" becomes per-card information the UI must surface.

**D-23 — Duplicate Outpost cards are allowed and their auras stack additively.** *(Owner call.)*
Two Smithies = double the bonus.
*Why:* with only ~3–4 Outpost banners (D-21) and a hero required for most (D-22), doubling down is a genuine specialisation trade — it costs a whole other aura plus a second hero — rather than the free stacking that would make variety pointless.
*Watch:* if any single aura is strong enough that stacking it always beats diversifying, that aura is mistuned. This is the balance risk to monitor.

### Round 7 — 2026-07-30 (Roster, loop editing, the Prep Phase)

**D-24 — Heroes stay scarce; you cannot staff everything.**
The roster grows slowly through guild upgrades and always trails the number of available banners (area banners + Outposts, most of which need a body per D-22).
*Why:* deciding *which* areas and Outposts get a hero becomes a core ongoing decision and gives the whole game a resource-allocation spine.
*Cost accepted:* a player who unlocks an area but can't staff it may feel blocked — the UI must signpost this as a choice, not a bug.

**D-25 — No mid-loop editing; changes stop and restart the loop.** *(Owner call — supersedes the "edits take effect next loop" options offered.)*
Touching the banner halts the loop. When the player finishes arranging, it restarts from the top: prep phase, then Slot 1.
*Why:* eliminates every mid-loop edge case — partial auras, re-triggered potions, ambiguous card states — and makes deck-building a deliberate act that costs loop time.

**D-25b — The Prep Phase.** *(Owner design.)*
Potion consumption is **visible as cards**: at the head of each loop, every equipped potion is drawn as its own quick card (~2s each, against ~5s for a normal task) and consumed.
*Why:* it makes buffing a legible part of the loop rather than invisible bookkeeping, and it prices potions in the currency the loop actually cares about — **time**. Four potions means ~8 seconds before any work begins, so potion count is a real trade-off.

**D-26 — ~~Universal cards live in every area's pack pool.~~ SUPERSEDED by D-46 (Round 12).**
~~*Rest*, *Campfire* and similar appear in each area's pool alongside its native cards.~~ Universals were moved outside the binder system entirely; they are never collected and never appear in pools.

### Round 8 — 2026-07-31 (Consumption as cards; upkeep)

**D-27 — All consumption renders as a card; drink gates the draw, food costs a hit in combat.** *(Owner design; refined Round 9.)*
**Drink** fires at the draw: energy pays for the next Task card, so a hero below 25% energy drinks first, then draws. **Food** fires whenever HP drops below 25%, in combat or out — but eating *during* a fight pauses the attack cycle while the fight continues, **giving the enemy a free hit**.
*Why:* nothing about consumption is invisible bookkeeping. Drinking slots naturally into the gap between cards where energy is actually spent. Food works everywhere so a hero on a fight-free gathering loop is never stranded by hazard chip damage — but combat prices it, which keeps HP management tense without needing a separate rule.
*Cost accepted:* *Rest* cards are no longer the sole out-of-combat heal, so they must earn their slot on healing *rate* and on avoiding the free-hit penalty rather than on being the only option.

**D-28 — Prep and consumption cards cost no energy.**
Energy is spent drawing **Task** cards only.
*Why:* a hero too drained to drink the thing that restores their energy would be an unrecoverable trap state.

**D-29 — Crafting costs energy; the drink supply chain feeds it.**
Each craft spends hero energy (~15). Below 25% the crafter drinks and continues; with no stock, production stalls.
*Why:* gives the Guild Bank's consumable stock a second job and makes Outposts real production lines with upkeep rather than free money.
*Cost accepted:* a stalled crafter needs unmistakable UI signalling.

**D-30 — Completed areas stay relevant through resource demand.**
Areas remain the sole source of raw materials feeding crafting, gear and consumables.
*Why:* the economy, not a bolted-on challenge mode, is what keeps a finished area worth staffing.
*Cost accepted:* this is entirely contingent on a deep, well-tuned demand chain. Shallow demand = dead areas.

### Round 9 — 2026-07-31 (Upkeep edges, pricing, logistics)

**D-31 — Eating is uncapped.**
No cooldown, no per-fight limit: the hero eats every time HP crosses below 25%.
*Why:* simplest possible rule, and self-balancing in principle — a hero who cannot out-heal incoming damage is supposed to lose.
*Cost accepted:* the common failure mode becomes a visible eat/get-hit spiral. Flagged as a watch item in §4B1; a meal cooldown is the fix if it reads as broken in testing.

**D-32 — Each area's pack has its own curve, but baselines escalate steeply by area.** *(Owner clarification, Round 10.)*
Every area runs an independent curve over packs bought *in that area* — but the **starting price** of that curve rises dramatically with area tier. The Farmlands pack might be 100 gold, then 120. The Astral Volcano pack **starts at 100 million** and climbs from there.
*Why:* within an area, collecting stays a smooth affordable climb; across areas, price is what expresses tier. Reaching a new region is a genuine economic milestone, not a lateral move.
*Implication:* this is an **exponential idle economy**, not a linear one. Gold income, resource yields and every other number must scale in the same order of magnitude per tier, or late areas are unreachable. Number formatting (K/M/B/T) and big-number safety are a real requirement, not a polish item.

**D-33 — Heroes reassign freely; doing so stops that banner's loop.**
Pulling a hero halts their loop exactly as editing cards does (D-25); they can be placed anywhere immediately.
*Why:* consistent with the editing rule, and keeps allocation a pure strategic choice rather than a logistics chore.
*Cost accepted:* there's no friction on reshuffling, so optimal play may involve moving heroes often.

### Round 10 — 2026-07-31 (Outpost acquisition; economy shape)

**D-34 — Outpost cards are unlocked on the Guild Hall upgrade tree.** *(Owner call — resolves the question deferred in Round 7.)*
Not crafted, not from packs, not dropped by areas. They are guild upgrade nodes.
*Why:* RNG-free and fully predictable on a system with only ~3–4 slots, and it puts Outpost cards on the same guild-wide progression spine that already grants the banners.
*Duplicates:* supplied by repeatable node ranks — see D-37.

**D-35 — Unlocking an Outpost always grants an Outpost card with it.**
A new Outpost banner never arrives empty.
*Why:* the player is productive immediately and learns the system by using it; no dead frame waiting on a separate unlock.

**D-36 — Outpost card nodes are gated behind area unlocks.**
An Alchemist Lab node appears once its region is unlocked.
*Why:* paces the Outpost layer against exploration for free, without a second gating system.

### Round 11 — 2026-07-31 (Final structure)

**D-37 — Guild tree nodes have repeatable ranks; rank N grants N copies.**
This is how D-23's additive aura stacking is supplied.
*Why:* reuses the existing ranked guild-upgrade machinery, keeps one acquisition system, and escalating rank cost is the natural brake on specialisation.
*Cost accepted:* the tree UI must clearly show owned copies per card.

**D-38 — Outpost cards swap freely and instantly; swapping stops production.**
Any unlocked card can be installed at any time; the Outpost halts while rearranging, as with banner edits (D-25).
*Why:* consistent with every other rearrangement rule, and keeps "which aura do I need right now" a live question.
*Cost accepted:* no friction, so players may swap often.

**D-39 — Area access is gated by unlock quests demanding the previous tier's materials.**
No hero-level requirements, no lethality-as-gate.
*Why:* the existing unlock-quest system already does this; gating becomes economic and self-pacing, with no new systems.
*Cost accepted:* unlock quests must be authored carefully for every area — the pacing of the entire game runs through them.

**D-40 — No prestige. One continuous run.**
No resets, nothing reclaimed. The exponential curve is a forward journey.
*Why:* everything in this design assumes permanence — completable binders (D-13), a cumulative guild tree, a slowly growing roster. A reset would directly undercut the completion payoff D-13 was built to deliver.
*Cost accepted:* **authored content length is the game's ceiling.** With no infinite loop, the area sequence must be long enough to carry the whole experience — this makes area count a foundational planning number, not a content decision to defer.

### Round 12 — 2026-07-31 (The Area Binder — the core of the rework)

*Context: the system being replaced is the current **global** binder — one pile of all owned cards, organised into player-created tabs (`collection.binder`), deployable to any area.*

**D-41 — Binder tabs are retired; one flat page per area.**
No manual filing, no renamable tabs, no per-card tab overrides.
*Why:* the tab system exists solely to impose order on one large global pile. Scoping cards to a 4–8 card area palette removes its reason to exist — filing machinery for eight cards is more UI than the content justifies.
*Cost accepted:* retires `collection.binder`, `BinderTabManager`, and the Guild Hall "binder tabs" upgrade node.

**D-42 — The binder lives on the area banner.**
Opening an area shows its 4 deck slots *and* its binder together.
*Why:* strongest expression of "these cards belong to this place", and it eliminates dragging across the whole UI from a global drawer.
*Cost accepted:* the Cards drawer tab loses its purpose.

**D-43 — Cards are permanently bound to their area.**
No transfers between binders, ever.
*Why:* where a card was found is where it lives — trivially simple to reason about and display, and it's the assumption the per-area pack economy already rests on.
*Cost accepted:* retires `DeckSlotManager.moveCardBetweenAreas`.

**D-44 — The binder shows the area's whole pool, including unowned cards.**
Uncollected cards render as locked silhouettes.
*Why:* binders complete (D-13), so the player must be able to see the finish line. The visible gap is the entire motivation to buy packs.

**D-45 — The Four-Pip copy indicator.** *(Owner design.)*
Each card shows four pips: **○ empty** = not collected, **● full** = collected and available, **⬤ coloured** = currently in the deck.
*Why:* one control answers collection progress, copies owned, and copies free to slot — the three things copy-limited slotting (D-9) makes the player ask constantly.

**D-46 — Universal cards live in a global Universal Bucket.** *(Owner call — supersedes D-26.)*
*Rest*, *Campfire* and similar sit outside every area binder and every area pack pool, in one global bucket. They **are owned and must be acquired**, and the player allocates their copies across areas freely — four Campfires can all go in one area or be spread one each across four.
*Why:* keeps the guarantee that any area can build a sustain loop, keeps area pools purely regional with zero dilution, and turns "where do I spend my Rests" into a real allocation decision — the same scarcity logic as heroes (D-24) and Outpost banners (D-21).
*Note:* this is the **only** place the global-pile model survives, deliberately. Copy-limited slotting (D-9) still applies; a slotted universal consumes a copy.
*Effect:* closes the watch item raised against D-26.

**D-49 — Pip count reflects a card's actual maximum.**
Task cards show four pips; unique Boosts (D-6) show one.
*Why:* the indicator stays truthful and signals "this is a unique" with no extra label or explanation.
*Cost accepted:* variable-width indicators, so the binder layout can't assume a fixed pip-row size.

**D-51 — Universal copies come from ranked Guild Hall tree nodes.**
Rank N of the *Campfire* node = N owned copies, matching the Outpost card mechanism (D-37).
*Why:* reuses machinery already chosen, keeps the safety-net cards RNG-free, and frames universals as guild infrastructure.

**D-52 — Universals cap at 4 copies, like every other card.** *(Owner call.)*
One consistent copy rule across the whole game, displayed with the same four-pip indicator.
*Cost accepted, and intended:* with more than four areas, four Campfires cannot cover them all. Universals therefore become a genuine allocation decision rather than a blanket — the same scarcity philosophy as D-21 and D-24. **Watch:** late-game areas running without a Rest must remain survivable via gear, potions and Boosts.

**D-53 — The Universal Bucket renders as a side panel beside the banner list.** *(Owner design.)*
A column alongside the banners that scrolls independently of them.
*Why:* universals apply to every banner, so they can't live *inside* one — but they must stay adjacent to the slots they feed, preserving D-42's "no cross-UI drag" principle.
*Cost accepted:* it competes for horizontal space with the existing always-visible inspection column; that layout conflict needs resolving.

**D-50 — The Guild Hall's existing cards become a normal collectible pool.**
Nothing is cut; the player simply picks 4 of them, as in every other area.
*Why:* no content discarded, and the Guild Hall teaches the same choice every other area presents.
*Cost accepted:* cards that were previously always-on become a selection decision, which changes early-game pacing.

**D-47 — The Guild Hall is a normal area.**
4 slots and its own binder, like everywhere else.
*Why:* no special cases. Its existing task cards become its starting palette.
*Cost accepted:* it drops from 6 deck slots to 4, so some current Guild Hall content needs re-homing.

**D-48 — Packs are bought at the area banner.**
The buy button sits beside the binder it fills.
*Why:* everything about one area happens in one place — see "5 of 8 collected", buy, watch it land.
*Cost accepted:* the global Pack Shop screen retires or becomes a summary view.

### Round 13 — 2026-07-31 (Layer 3 review — the hero grid)

*Context: the concept's example grid named Weapon/Chestpiece/Boots/Helmet, but the codebase models four categories — `hand`, `hat`, `chest`, `trinket` — with 22 items already tagged against them. The code won; the doc's example was illustrative prose written before the survey.*

**D-54 — Equipment categories are data-driven and expected to grow.** *(Owner call.)*
Current live set: `hand` (2), `hat` (1), `chest` (1), `trinket` (2). **Planned additions:** `quiver`, `gloves`, `boots`; and `trinket` is expected to split into `ring` (2) and `amulet` (1).
*Why:* the category list is content, not architecture. The owner intends to keep adding gear types, so the engine must never hardcode them.
*Requirement:* adding a category must be an authoring change only — **no engine edit**. This is the primary constraint on how C-7 is built.

**D-55 — Per-category caps: most 1, a few 2.**
`hand` and `ring` allow 2; everything else allows 1.
*Why:* preserves dual-wielding and paired rings while keeping the general rule simple. The cap is a property *of the category*, so it travels with the data (D-54).

**D-56 — Three consumable classes; "Consumable" is uncapped.** *(Owner call — broadens D-20.)*
**Food** and **Drink** are capped sustenance on the 25% rule. **Consumable** is a third, *uncapped* class covering potions, **scrolls, runes and summons** — one of *each* equipped Consumable fires at the start of every loop.
*Why:* it's the open-ended slot for anything expended for effect, and being uncapped is what makes a genuine buff-stacking build possible against a gear-heavy build.
*Balance:* the **only** brake on stacking is prep time (~2s per Consumable, every loop). Prep duration and buff potency must therefore be tuned as a pair — nothing else limits this class.

**D-57 — A defeated hero is unassigned and returns to the roster.** *(Owner call — resolves the retreat path orphaned by D-16.)*
Defeat removes the hero from the banner entirely; the player must re-deploy them.
*Why:* defeat becomes impossible to miss and forces a deliberate decision about whether that area was a mistake.
*Cost accepted:* with scarce heroes (D-24), re-assignment friction lands on every defeat — and it stacks with the item and gear losses of D-19. See the severity warning in §4C.

---

## 7. The Playmat — Banner Membership & Order (LOCKED — see D-58, D-59)

Every banner — area or Outpost — is an equal citizen of the **playmat**, the player's workspace. The existing **Area Manager** governs it.

**Membership is what controls running (D-59):**

| State | Runs? | Purpose |
| :--- | :--- | :--- |
| **On the playmat** | ✅ Yes | The active workspace. Order is player-chosen. |
| **Off the playmat** | ❌ No | Removed to keep the workspace clean. **Its hero is unassigned** (D-67). Re-addable at any time. |

* **Order is the player's** — Outposts aren't pinned above or below areas (D-58). Put a production line between two farming areas if that's how you think.
* **Taking a banner off the playmat is the tidying tool**, and it's the only display action that stops work. A late-game player with a dozen unlocked areas curates down to what they're actually running.
* **Removing a banner frees its hero (D-67).** This makes playmat curation a genuine strategic act rather than housekeeping: mothballing an area you're done with **returns a scarce hero** (D-24) to the roster for redeployment somewhere that matters.
* **Nothing else is lost** — the binder, the deck arrangement and all progress persist, waiting for the banner to be put back. Only the hero assignment is released.

> **One consistent rule across the design:** a hero returns to the roster whenever their banner stops being a valid workplace — on defeat (D-57), and on playmat removal (D-67). Assignment is always free to redo (D-33), so nothing is ever stranded.

### Round 14 — 2026-07-31 (Layer 4 review — Outposts)

**D-58 — Outpost banners are ordinary banner rows, not pinned.**
They sit in the same list as areas, ordered by the player.
*Why:* one mental model — "banners are where work happens" — and it reuses the existing banner stack wholesale.

**D-59 — The playmat governs what runs.** *(Owner design.)*
A banner **on** the playmat can run; taking it **off** removes it from the workspace and stops it. It can be put back any time with everything intact. Order and visibility within the playmat are the player's.
*Why:* a late-game player with a dozen unlocked areas needs a tidying tool, and membership — rather than a hidden "off switch" — makes the consequence unambiguous.

**D-67 — Removing a banner from the playmat unassigns its hero.** *(Owner call.)*
The hero returns to the roster; the binder, deck and progress persist untouched.
*Why:* it makes curation strategically useful rather than cosmetic — mothballing a finished area **hands a scarce hero back** (D-24) for redeployment. It also completes a single consistent rule: a hero returns to the roster whenever their banner stops being a valid workplace, whether through defeat (D-57) or removal.
*Cost accepted:* re-adding a banner is a two-step action (put it back, then re-assign) — acceptable given reassignment is free (D-33).

**D-60 — Card effects are composable; type is a label.** *(Owner call — major architectural decision.)*
A card carries a **list of effects** (work output, aura buff, next-card buff, hazard, heal) in any combination. A Task card that yields resources *and* buffs later cards is a first-class design target. "Task" and "Boost" survive only as labels for pack pools and display.
*Why:* the owner intends broad card diversity, and a type-branching engine makes every new card idea an engine change. Effects-as-data makes it authoring work.
*Requirement:* **the engine must never branch on card type to decide capability.** Direct analogue of D-54 for equipment categories.

**D-61 — Copy limits are authored per card.**
Each card declares `maxCopies` — typically 4, sometimes 1 — independent of its effects. Drives the pip count (D-49).
*Why:* full authoring control; a powerful hybrid can be unique while a simple buff card allows four. Refines D-6, which described uniqueness as a property of "being a Boost".

**D-62 — Passives trade production for power.** *(Tier clause superseded by D-68.)*
~~Station incidental buffs (small) < Passive Outpost auras (strong) < Boost cards in the deck (most powerful, but local and slot-costing).~~ A **Passive** Outpost card crafts nothing at all — its only effect is its aura, which is also why it's the natural home for D-22's unstaffed cards.
*Why:* gives the single Outpost slot a real question — *make things, or make everything better?* — and stops Crafting Stations from strictly dominating by doing two jobs.
*Still live:* the Passive-vs-Crafting distinction. *Retired:* the fixed tier ordering (see D-68).

**D-63 — Recipe gating is retained.**
Recipes are gated by subskill + `levelRequirement`; stations carry a `skillCap` that tiers them. 21 recipes are already authored this way.
*Why:* real, already-built progression depth that rewards hero specialisation and gives stations an upgrade axis.
*Cost accepted:* hero skill becomes a second gate alongside area unlocks (D-36).

**D-64 — Station cards drop `areaId`; the guild tree defines gating.**
Card data describes the card; the tree describes progression. Any owned Outpost card installs in any Outpost.
*Cost accepted:* gating info lives away from the card, so authoring touches two places.

### Round 15 — 2026-07-31 (Layers 5 & 6 review — economy, long tail, cleanup)

**~~D-65~~ — ~~Scaling is a formula on tier index, not a hand-tuned table.~~** **SUPERSEDED by D-71 (2026-08-01).**
~~Every scaling value derives from one function of the area's tier index: pack baseline, resource yields, gold, gear values, craft outputs.~~
*What survives:* area count still never has to be committed to — for the simpler reason that nothing is derived from it.
*What was wrong:* there is no scaling function. Economic values are authored and tuned per card and per area (D-71).

**D-66 — Completing a binder grants a permanent Area Mastery bonus.** *(Owner call — revives a shelved system.)*
Finishing an area's collection unlocks a permanent bonus for that area.
*Why:* gives binder completion (D-13) a mechanical payoff beyond packs simply stopping, and gives a completed area a second reason to keep running alongside resource demand (D-30).
*Not a contradiction of D-5/D-12:* those cut bonuses for **repetition** — stacking identical cards, grinding card levels. This rewards **finishing**, which is a different thing.
*Cost accepted:* the dormant `MasterySystem` reads schema structures the rework replaces, so this is a **rewrite against new data, not a revival**. Tune so the bonus is worth the last expensive packs without letting a completed area beat the next tier up — the tier curve (D-65) must still dominate.

### Round 18 — 2026-08-01 (How the economy actually scales)

**D-71 — Economic values are authored, not derived; growth comes from THROUGHPUT.** *(Owner call — supersedes D-65.)*
There is no scaling function on tier index. Pack prices are set by hand, area by area. Card yields are authored per card and tuned by the designer. **"Tier" is not a calculation.**
*The correction that matters:* an item's **value never changes** — a Copper Ore is worth what a Copper Ore is worth, forever. What grows is **how much a task outputs**. A later, higher-level task yields *more of the item*, and that is where the exponential economy comes from. Nothing is repriced by tier.
*Scale:* roughly **48 areas** is the target, so there is a lot of authored content and the numbers get large.
*Why this is better than a formula:* a curve function would have to be right for everything at once, and would fight the designer every time one card wanted to be an exception. Authoring is testable card by card.
*Consequence for the engine:* since values can be anything the designer writes, the engine's job is **not to break** — big-number formatting, generous stack ceilings, and precision safety (watch item **W-7**) are the whole of the work. There is no curve to implement.

### Round 17 — 2026-08-01 (Pack economy)

**D-69 — Boost rarity is emergent from copy counts; there is no pity counter.** *(Owner call — supersedes the pity clause of D-14.)*
The pack pool is drawn from **copies still owed**, not from a flat card list. A regular card wants 4 copies (D-13) and a Boost wants 1 (D-61), so a Boost is naturally four times rarer than a fresh regular card — with no rarity table, no drop-rate constant and no pity counter to tune.
*Why:* the rarity the design wanted already exists in the data. Authoring a second mechanism on top would be tuning a number that the copy limits already imply.
*Bonus property:* it is **self-correcting**. As regular cards fill up their weight falls, so the Boost's relative odds RISE the nearer an area gets to completion — which is the anti-lockout guarantee the pity counter existed to provide, arriving for free. Measured in play: a Boost appears in ~8% of packs at the start of an area and 100% once it is the only thing left.

**D-70 — The in-area pack curve is geometric (×1.2), not linear.** *(Owner call, resolving the ambiguity in D-32's "100 gold, then 120".)*
`cost = areaBaseline × 1.2 ^ (packs bought in that area)`.
*Why:* D-32 already states this is an exponential idle economy. A linear curve turns late packs into pocket change once tier income scales, so finishing an area would stop being a decision.
*Note:* the **baseline** stays the per-tier dial and is still C-15's job (D-65). Growth is shared by every area; price is how tier is expressed.

### Round 16 — 2026-08-01 (Aura authoring)

**D-68 — Aura power is free-form; there are no tiers.** *(Owner call — supersedes the tier clause of D-62.)*
The designer sets each effect's kind and magnitude per card, with no fixed band a card must sit in. The intended spread is wide: a *0.1% chance to roll Pirate Treasure Loot on Fishing tasks* and a *+20% work speed on Areas with an Elite Enemy* are both ordinary auras.
*Why:* the effect space is far more varied than a single power axis, so any fixed ordering would either bar legitimate designs or be quietly ignored in authoring.
*Consequence:* the engine must be **expressive rather than pre-tuned**. `passiveBuff` accordingly accepts one modifier **or a list** (C-11), the same composability D-60 gave card effects.
*Open gap:* the current UMI expresses flat/multiplier/percentage modifiers against a target category. It cannot yet express **conditional** auras ("on Areas with an Elite Enemy") or **chance-to-trigger** auras ("0.1% to roll X"). Both are named in this decision as intended designs, so the modifier schema needs extending before they can be authored — tracked as **W-10**.

---

## Appendix C — Economy Shape (implication of D-32)

The pack-price clarification in D-32 reveals the game's intended economic shape, which affects far more than packs:

* **Within an area:** gentle linear-ish scaling (100 → 120 → …).
* **Across areas:** enormous baseline jumps between tiers (Farmlands ~100 gold; Astral Volcano ~100,000,000).

This makes Fantasy Guild an **exponential idle economy**. Consequences to design against:

1. **Throughput is what scales, not prices (D-71).** Item values are fixed; higher-tier tasks output *more units*. Gold income therefore climbs because production climbs. Pack prices are authored to sit against that curve, so a new area is neither unreachable nor trivial — but this is a matter of authoring and testing, not of a shared multiplier.
2. **Big-number handling is a requirement.** K/M/B/T formatting, and safety against floating-point precision loss, are core — not polish.
3. **Global Outpost auras are percentage multipliers**, so they stay relevant at every tier automatically. This is a point in favour of the D-16 global-aura model.
4. **Area tier, not card level, is the power curve.** Since card levelling is cut (D-12), moving to a higher-tier area is *the* way power grows. Area unlock pacing is therefore the single most important progression lever in the game.
5. **Access is gated economically, not by hero level (D-39).** Unlock quests demand turn-in materials that can only come from the previous tier, so the economy paces itself. No hero-level walls.
6. **There is no prestige layer (D-40).** This is one continuous forward run. The exponential curve is a *journey*, not a loop to be reset.
7. ~~**The curve is a formula on tier index (D-65).**~~ **Corrected by D-71:** there is no curve function. Pack prices and card yields are **authored per area and per card**. Crucially, item *values* never change — a later task simply **outputs more of the item**, and that throughput growth is where the exponential economy comes from. Area count still never has to be committed to, because nothing is derived from it. The engineering requirement is therefore **big-number safety**, not curve design.

---

## Appendix D — Open Questions

*None outstanding.* Every question raised across all fifteen rounds is resolved. The watch items below are not open design questions — they are known risks to monitor during implementation and testing.

### Watch List

| # | Risk | Trigger to act |
| :--- | :--- | :--- |
| ~~W-1~~ | ~~Universal cards dilute area pools (D-26).~~ **CLOSED** by D-46 — universals left the pool system entirely. | — |
| W-2 | **Eat/get-hit death spiral (D-31)** — uncapped eating plus a free enemy hit may look broken even when working as designed. | If it reads badly in testing, add a short cooldown between meals. |
| W-3 | **Boost cards must beat a 4th Task card (D-5)** — with mastery bonuses cut, a weak Boost is dead content. | Tune Boost multipliers against raw 4× throughput before authoring the Boost pool. |
| W-4 | **A dominant Outpost aura breaks variety (D-23)** — if stacking one aura always beats diversifying, that aura is mistuned. | Compare stacked vs. mixed Outpost configurations during balance passes. |
| W-5 | **Shallow crafting demand kills completed areas (D-30)** — the long tail rests entirely on the demand chain. | Audit that every tier's raw materials have ongoing sinks before shipping an area. |
| W-6 | **Gear loss on unattended loops (D-19)** — permanent loss from an idle loop the player wasn't watching is a known bruise. | Watch player reaction; the tuning hook already exists in `DEFEAT_PENALTY`. |
| W-7 | **Big-number safety (Appendix C)** — 100M+ baselines arrive early in the area sequence. | Formatting and precision handling must be in place before high-tier areas are authored. |
| W-8 | **Content length is the ceiling (D-40)** — no prestige means the game ends when the areas do. **Softened by D-65:** the formula-driven curve means areas can be added without retuning, so the ceiling moves with content. | Get the tier *function* right; area count itself no longer needs committing to. |
| W-9 | **Binder Mastery could outshine the tier curve (D-66)** — a completed low-tier area shouldn't beat the next tier up. | Tune the completion bonus against D-65's per-tier multiplier; the curve must dominate. |
| W-10 | **Conditional and chance-based auras are not yet expressible (D-68)** — the UMI covers flat/multiplier/percentage against a target category, but neither *"on Areas with an Elite Enemy"* nor *"0.1% chance to roll X"*, both named in D-68 as intended designs. | Extend the modifier schema with a condition predicate and a chance roll before authoring those cards. Blocks nothing already built. |
