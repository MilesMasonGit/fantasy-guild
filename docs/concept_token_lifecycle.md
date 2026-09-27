# Concept Document: The Token Lifecycle

**Status:** DRAFT concept **v2.1**, 2026-09-25. v2 was reviewed the same day by
a second agent against the code and the free-playmat roadmap; the findings and
the owner's answers are in **§9**, and each skill's full lifecycle chain is in
**§10**. Where §9 amends an earlier rule, the earlier rule carries a note.
Design only; no code written.
The working direction is the **Spawner System with a Spawner Shop**, proposed by
the owner and tested against every foundational skill. **Every decision here is
leaning**: the owner chose it within this direction, but nothing is locked.
Decisions carry **SP-** numbers; gaps in the numbering are decisions that were
later replaced (see Appendix A).

This v2 replaces the first session's draft (sources, the Source Bar, "Living
Land"), which is summarised in Appendix B. It sits beside
[`concept_free_playmat.md`](concept_free_playmat.md) and
[`free_playmat_roadmap_v1.md`](free_playmat_roadmap_v1.md); **nothing here
changes the free-playmat roadmap until the owner says so** (see §7). The brief
for this work is [`HANDOFF_token_lifecycle.md`](HANDOFF_token_lifecycle.md).

---

## 1. The idea in one paragraph

**Spawner Tokens** sit on the playmat and slowly produce workable Tokens up to a
cap: an Oak Forest grows Oak Trees, a Goblin Camp produces goblins. Heroes work
what appears, the output goes to the Bank, and a used-up Token vanishes so the
spawner can replace it. The player buys spawners, camps and **Foundations**
from a **shop**, paying in **items**, so the skills gate one another: a Mythril
Mineshaft needs Willow Wood. Stations, support Tokens and crop fields are
**built on Foundations** by choosing a recipe. There is no Vault, no bar and no
point pool. Everything lives only on the mat, and removing something refunds all
it cost. Gathering skills stay simple; processing skills and Combat each have
their own mechanical twist.

## 2. Goals

From the owner (see the handoff, §3):

1. **Tokens spend their whole life on the mat.** The Vault goes away.
2. **The player can go and get the specific Token they need** ("I want lots of
   Oak" should not mean opening Maps full of Redberry Bushes).
3. **The first steps must not feel like paperwork.**
4. **The mat should feel like a living place.**
5. **Simple enough for an idle game.** The owner set aside a more elaborate
   direction as "too complicated for an idle game" and does not want
   "unnecessary systems".
6. **Skills feel different mechanically,** not just through different recipe
   lists. This matters most for the processing skills and Combat (SP-33).

**Reframed:** the first session's "sporadic to near-indefinite" arc, in which
upgrades reduce a *leak* rather than add output, is largely replaced. Spawners
run forever and scaling adds output. Only a few places still stop on their own:
Farming without seeds, Smithing's anvils wearing out, and stations without
ingredients.

**Still standing from earlier work:**

* Tokens that leave the loop **vanish cleanly**, with no husk to clear.
* **Nothing is ever destroyed by crowding.** Arrivals push neighbours where
  legal and are otherwise refused (FP-17, FP-46; SP-46).
* **Energy is no longer a mechanic** (owner, 2026-09-24). ⚠️ The code still has
  a lot of energy logic (hero consumption, regen, combat), so check it before
  building on this.

## 3. The core rules

### 3.1 Spawners

* **SP-2 Workable Tokens run out.** A tree or vein has charges, vanishes when
  spent, and its spawner replaces it. This keeps the spawn rate meaningful and
  the mat changing.
* **SP-5 The cap is shared across the whole mat, per kind.** All Oak Trees count
  against *5 × the number of Oak Forests*. New trees appear near a Forest with
  room, and spawn rates add up the same way.
  **Why (owner):** a separate cap per spawner can be exploited by picking a
  spawner up and placing it again to reset it. The rule that closes this: **the
  cap counts the Tokens alive on the mat now, not what a spawner has made.**
* **SP-6 Over the cap after a removal, nothing is removed.** The extra Tokens
  stay and are worked out normally; spawning waits until the count is below the
  cap.
* **SP-46 Spawns push; they only wait at a cap.** The free-playmat rule stands
  (FP-17: bursts and spawns push neighbours). A spawner stops only when a cap is
  reached: its kind's cap (SP-5) or the mat's Token cap (SP-10). If the mat is so
  full that nothing can be pushed, FP-46 applies and the arrival is refused, so
  the spawn waits. *(Replaces SP-7, "no room, no spawn", which had spawns wait
  instead of pushing.)* **Amended by SP-68:** spawns push only other spawned
  Tokens, never anything the player placed.
* **SP-70 Spawners generally have upkeep** (§9.3): an item paid per spawn, such
  as one Oak Seed per sapling, which the spawned Tokens themselves drop.

### 3.2 The Spawner Shop

* **SP-12 The shop is where spawners and stations are made.** It is essentially
  today's **Cartographer's shop**, but instead of buying a Map with gold, the
  player **buys the Token itself with resources** (items from the Bank).
* **SP-13 No recipe unlocks: progression is gated by items.** Everything in the
  shop can always be made; what stops the player is having the inputs. The
  owner's example: **a Mythril Mineshaft requires Willow Wood**, so the player
  must raise Logging high enough to produce Willow Wood first.
* **SP-14 A new save starts with a starter set of spawners already on the mat**
  (e.g. an Oak Forest and a Copper Mine). Everything after that is bought with
  what they produce. This breaks the circle in which every price is another
  skill's items. **The contents are decided after implementation (SP-72):**
  "we'll give the player whatever they need to get started."
* **SP-65 Gold is probably retired; items are the only price** (§9.2). This
  covers the Guild Hall's upgrades too.

### 3.3 Limits and removal

* **SP-9 No point pools.** The owner proposed themed point pools (Nature
  Points and so on) and then dropped them: "I don't really want to add
  unnecessary systems." Their jobs are covered elsewhere: floods by the live cap
  (SP-5), scale by the shop's prices (SP-13).
* **SP-10 A mat-wide Token cap:** a maximum number of Tokens allowed on the
  playmat, which the owner expects to need for performance anyway. It is the
  limit on how far a player can scale. **Amended by SP-67:** only Tokens the
  player **places** count (spawners, stations, Foundations, support Tokens).
  Spawned trees, veins and enemies are already bounded by their kind's cap
  (SP-5), so the total stays bounded, and an idle mat full of trees never blocks
  a purchase.
* **SP-11 Spawners live only on the mat.** There is no bar, catalogue or
  storage for them. **Removing a spawner returns the items it cost** to the Bank,
  so it can be bought again later. *(The refund half is reopened with SP-44; see
  SP-63.)*

### 3.4 A constraint from how heroes work

A hero works **every** task in their flag's radius, shaped by per-skill allow,
disallow and priority rules (FP-71). **The player cannot direct a hero to one
task over another within the same skill**, so no design here may depend on that.
(This ruled out a Mining design in which a hero digs a shaft to expose veins.)

* **SP-52 When a hero's target vanishes** (used up, faded, or a Coast turning
  back), the hero **moves to the next thing in range** by their rules, or idles if
  there is none. This is the natural reading of FP-71; no new rule.

### 3.5 Foundations and Construction

* **SP-42 Foundations.** The shop sells **Foundations**, and a hero works a
  Foundation with **Construction** to turn it into a specific Token (a Kitchen, a
  Furnace, a Tree Nursery). **Scope: stations, support Tokens and Farmland.**
  Spawners and camps are still bought directly at the shop (SP-12).
  The owner's framing: this matches the crafting skills (constructing the Kitchen
  or Furnace), and Farming uses the same pattern (buy Farmland, then turn it into
  an Onion Crop).
* **SP-43 A few kinds of Foundation, tiered:** Stone Foundations, Wood
  Foundations, types of Farmland, and qualities of Bench for Crafting. The kind
  decides what can be built on it.
* **SP-49 What a Foundation becomes is a recipe.** The player **picks the recipe
  on the Foundation**, the same way as on Farmland, a crafting station or any
  other recipe-based Token. **Better stations are simply higher-level recipes:**
  Construction level 1 can only build a Cooking Pot; Construction level 20 can
  build a Kitchen. This settles SP-25 (station tiers).
* **Farmland is planted by Farming, not Construction** (SP-47, §5.5). The owner:
  this isn't an exception, because the finished Field is not worked; it only
  spawns crops.
* **SP-44 Removing is a full refund.** Removing a built Token returns everything
  spent on it: a 25-wood Foundation with a 25-wood Kitchen on it gives back 50
  wood. **Why (owner):** returning everything means a player can never softlock
  themselves. **Alternative backstop (owner):** the Guild Hall's passive
  generation gives a small, constant trickle, so the player can never run out
  completely. Both are recorded; the full refund is the owner's first answer.
  **⚠️ Reopened by the review (SP-63, SP-66):** a full refund on something that
  wears out made wearing out meaningless. The refund is now either **by charges
  left** or **gone entirely** ("Tokens that are disposed of are just gone,
  making the cost of building one a real choice"), and the **Guild Hall
  trickle** becomes the softlock backstop either way.

This is also how the **shop stays short**: stations and support Tokens don't each
need a shop entry, only the few Foundation kinds do.

### 3.6 Support Tokens

Tokens that improve a setup. Early ones already exist: the **Forge Altar** makes a
nearby Forge faster and adds bonus copper, and the **Windmill** gives nearby
fields a 5% chance of double loot.

* **SP-39 Support Tokens take several forms**, all acceptable to the owner:
  * **boosters** that improve a neighbour's numbers (spawn speed, charges, drops),
  * **changers** that change what a neighbour produces (a Beehive beside Farmland
    sometimes makes a Honey Patch),
  * **links** between two skills' setups (a Sawmill makes logging also drop
    firewood for Cooking's fuel),
  * **helpers** that do a small job without a hero (a Farmhand sows slowly).
* **SP-40 Keystones are a rare tier** above everyday support Tokens: a few big
  landmark pieces that reshape the area around them (a Great Oak makes every
  Forest nearby grow faster and spawn rare trees).
* **SP-41 Support Tokens come from the recipe system, not the shop list.** The
  owner: "Cluttering up the shop with too many tokens is just cumbersome." They
  are **built on Foundations with Construction** (SP-42, SP-49). A few upgradable
  ones might also be sold at the shop.

* **SP-55 Managers are retired.** Spawners now replace used-up Tokens
  themselves, which was the Managers' job (FP-19).

*Open:* the actual list of support Tokens per skill; their ranges (Close / Near /
Far) and whether several stack; how helpers relate to heroes; which support
Tokens, if any, are sold at the shop.

## 4. Walkthrough: the life of an Oak

1. The new save's mat already has an **Oak Forest** (SP-14). Later Forests are
   **bought at the shop** with items.
2. The Forest grows **saplings** near itself, up to 5 Oak Trees in total.
3. A sapling **matures** into an Oak Tree. Only mature trees can be logged.
4. A hero whose flag covers the tree **logs** it. Each cycle puts Oak Logs in the
   Bank and uses one charge.
5. The used-up tree **vanishes**, and the Forest grows a new sapling (back to 2).
   Loggers who cut faster than the forest grows run out of mature trees and
   wait, unless something else they can work is in range.
6. **More Oak:** buy another Forest. Two Forests allow up to 10 Oak Trees and grow
   saplings twice as fast (SP-5). Growth stops at the mat's Token cap (SP-10).
7. **Remove a Forest:** its price returns to the Bank; the trees it leaves behind
   stay until they are logged and are not replaced (SP-6).

## 5. The skills

### 5.1 Summary

| Skill | Where its Token comes from | Its mechanic |
|---|---|---|
| **Logging** | Shop: a Forest (Oak Forest) | Spawns saplings that grow into trees; rewards letting it regrow |
| **Mining** | Shop: a Mineshaft | Spawns veins; reliable, can be left alone |
| **Fishing** | Shop: a Coast | **Transforms** into a Shrimp Coast for a while; fish while it lasts |
| **Farming** | Farmland, planted into a crop Field | The Field spawns patches, one seed each; it can run dry |
| **Combat** | Shop: a camp | Spawns enemies from a weighted list; they fight back |
| **Cooking** | A Kitchen built on a Foundation | Burns fuel; recipe chosen in the Kitchen |
| **Crafting** | Its Bench, built on a Foundation | No fuel; makes parts for every skill, plus Ranged gear and tools |
| **Smithing** | A Furnace built on a Foundation, plus tiered Anvils from the shop | Smelt, then smith; Anvils wear out; climbs using its own bars |
| **Construction** *(new)* | Works Foundations | Builds stations and support Tokens **in place** from a recipe picked on the Foundation |
| **Exploration** *(new)* | Shop: a Map | Works a Map until its charges run out; rare materials and keystones |

* **SP-33 The gathering skills stay simple.** The owner is content for Mining,
  Logging, Fishing and Farming to be "simpler, resource generating activities.
  It's okay that they're less distinct from each other."

### 5.2 Logging

The Forest spawns **saplings that grow into trees**. Only mature trees can be
logged. **Resting a forest comes from layout, not a rule:** loggers who outpace
the growth run out of trees and fall idle, unless another kind of task is in
range. Because a hero works everything in range (FP-71), a Mineshaft beside the
Forest keeps its loggers busy while saplings grow.

### 5.3 Mining

A **pure spawner**: the Mineshaft spawns veins, and miners can be left alone. It
is deliberately the plain, reliable skill. *Open:* "depth" (a shaft that improves
as it is worked) was called interesting.

### 5.4 Fishing

* **SP-18 A fishing Token is a permanent feature that transforms.** A **Coast**
  becomes a **Shrimp Coast** for a few minutes, then turns back. The owner: it
  "makes it feel like the coast is a consistent feature while still giving
  fishing opportunities."
* **SP-17 The transformed state runs on a timer, not charges.** The player wants
  to fish as much as possible before the opportunity passes, and **it ends when
  its time is up, whatever heroes are doing.** Yield depends on how quickly
  heroes get there and how fast they fish.
* **Fishing is outside the spawner pattern**: nothing spawns, so it needs no cap.
  More fishing means buying more Coasts, each changing on its own.

* **SP-50 A Coast turns into one of several, from its list** (a Shrimp Coast or
  a Crab Coast, weighted), like a camp's list. *(Replaces SP-16, "one kind of fish
  per spot".)*
* **SP-51 A cycle in progress when the Coast turns back is lost.** Strict timing.

*Open:* how long each state lasts; whether anything can be fished in the plain
state.

### 5.5 Farming

The chain: buy **Farmland** (a Foundation kind) → pick a crop recipe on it → a
Farming hero **plants** it, turning it into an **Onion Field** → the Field
**passively spawns Onion Patches**, each using one Onion Seed from the Bank, up to
its cap → a patch grows to ripe → any Farming hero in range **harvests** it → the
used-up patch vanishes → the Field spawns another while there are seeds.

* **SP-19 Seeds come from harvests and from other skills.** A patch sometimes
  returns seeds; seeds also turn up while working other skills, which is where a
  player's **first** seeds come from.
* **SP-47 A Farming hero plants the Field.** Farmland is turned into a crop
  Field (Onion Field) by Farming work, from a recipe picked on the Farmland
  (SP-49). The finished Field is not worked.
* **SP-48 The Field spawns patches passively, one seed per patch.** It spawns
  only if the seed is in the Bank. Heroes work the patches, not the Field.
  *(Replaces SP-20, sowing as repeated hero work, and SP-21, the crop as a
  setting.)*
* **SP-22 A ripe patch gives several harvests** (charges).

Farming is **the one gathering skill that can stop on its own** (no seeds), and
every patch costs a seed, so re-placing a Farmland is not an exploit.

*Open:* which skills drop which seeds; the seed return rate; a Field's cap;
harvests per patch; how a player switches crop (presumably removing the Field for
a full refund, SP-44, and planting again); whether planting the Field itself
costs seeds.

### 5.6 Combat

The chain: buy a **camp** (Goblin Camp, Bandit Outpost, Red Dragonspire; bigger
camps cost higher-tier items) → it **spawns enemies from its list** up to its
cap → Combat heroes in range fight automatically (FP-74) → a defeated enemy
vanishes and drops loot to the Bank → the camp spawns a replacement. If heroes
lose, FP-42 applies: the hero goes home wounded, the flag comes down, and one
message says who fell and what was lost. Enemies do not move, so an unattended
camp fills to its cap and waits.

* **SP-34 Camps spawn enemies from a list.**
* **SP-35 A camp's cap is shared per camp kind and counts live enemies** (as
  SP-5).
* **SP-36 Camps spawn forever.**
* **SP-37 Weighted spawning with rare leaders:** mostly goblins, rarely a
  **Goblin Chief**.
* **SP-38 A leader is a tougher enemy with better loot.**

Combat is the only skill whose worked Token fights back, and the only spawner
with a mixed list, which suits a fight. Its loot can gate other purchases in the
shop.

*Open:* each camp's loot and what it gates; whether camps lean toward one combat
style (Melee, Ranged, Magic).

### 5.7 Cooking

The chain: buy a **Foundation** and build a **Kitchen** on it (SP-42) → **choose
a recipe inside it** → a Cooking hero in
range works it, each cycle taking ingredients (and fuel) from the Bank and
putting the dish in the Bank → with nothing to cook, it waits.

* **SP-23 Stations are permanent.** Paid for once at the shop. (Today station
  Tokens carry charges: the Cooking Pot 1,000 uses, Grandma's Kitchen 5,000.)
* **SP-26 Fuel is a per-skill trait: Cooking and Smithing burn fuel; Crafting
  does not.** Logging feeds both fire-based skills.
* **Station tiers are recipes (SP-49).** **Cooking Pot → Range → Kitchen** are
  higher-level Construction recipes on a Foundation, and each step **lowers the
  failure chance**. A per-Token failure chance already exists as an effect axis
  (`FAIL_CHANCE`, read in `BoardRunner.js`). Upgrading presumably means removing
  the Pot (full refund, SP-44) and building a Range.

*Open:* whether other stations get the same ladder; what food is *for* now that
energy is gone (outside this concept, but it decides how much Cooking matters).

### 5.8 Crafting

* **SP-27 Crafting makes parts for the other skills** (planks, rope, glass). Its
  recipes pull from many skills, and its outputs are what the shop and other
  stations ask for. It ties the economy together.
* **SP-28 Crafting makes things for heroes:** tools and equipment.
* **SP-53 Tools are carried by heroes.** A pickaxe is equipment a hero carries,
  not a Token sitting near a vein. Context Tokens remain only for station helpers
  such as the Anvil (SP-29).
* No fuel (SP-26).

### 5.9 Smithing

The chain: build a **Furnace** on a Foundation (SP-42) → a Smithing hero smelts ore into **bars** (no Anvil
needed) → spend bars on a **Copper Anvil** at the shop (SP-56) → place it near the
Furnace → copper weapons, armour and tools can now be smithed → the Anvil **wears
out** and is bought again → **bronze bars buy a Bronze Anvil**, and so on.

* **SP-29 Smithing keeps context Tokens.** A context Token works by sitting near
  the Token it helps (as the Copper Pickaxe does today; tools themselves move to
  heroes, SP-53). The **Anvil is a context Token**: a Furnace can be built without
  limit and smelts on its own, but needs an Anvil nearby to smith gear.
* **SP-56 Anvils are bought at the shop**, not built on Foundations.
* **SP-30 Anvils are tiered and wear out.** An Anvil's metal decides the tier it
  can smith, and Anvils have charges. **Smithing climbs using its own output.**
  An exception to SP-23, for the Anvil only.
* **SP-31 Two steps: smelt, then smith.** Smelting needs no Anvil, which is what
  lets the first Anvil be bought.
* **SP-32 The gear split with Crafting:** **Crafting makes some tools and Ranged
  equipment** (bows, fishing nets); **Smithing makes some tools and Melee
  equipment** (pickaxes, swords). Crafting feeds Fishing and Ranged; Smithing
  feeds Mining and Melee.
* Burns fuel (SP-26).

*Open:* Anvil charges, and whether higher metals wear it faster; whether one
Anvil can serve several Furnaces, and what "nearby" means (Close / Near / Far).

### 5.10 Construction (new skill)

Works **Foundations** into stations and support Tokens (SP-42), from a recipe
picked on the Foundation (SP-49). Its mechanical identity: its work happens **at
the destination**. The player places the Foundation where the building should
stand, and a Construction hero builds it there, so placement is chosen first and
nothing is stored. **Construction level gates the recipes** (a Kitchen needs
level 20). Each building has its own cost on top of the Foundation (the owner's
example: a 25-wood Foundation plus a 25-wood Kitchen).

*Open:* build time; the build list for each Foundation kind and tier.

### 5.11 Exploration (new skill)

* **SP-45 Exploration gathers rare materials and finds keystones.** It is worked
  like a gathering skill, but yields rare materials (e.g. a Beeswax Comb or an
  Ancient Seed) that support-Token and keystone recipes need, which keeps
  everything gated by items (SP-13). It is the only way to find **keystones**
  (SP-40).

* **SP-54 Maps are kept, for Exploration.** A Map is bought at the shop,
  placed, and worked by an Exploration hero; it **has charges and vanishes when
  they run out**, so it is bought again. Each Map (the 8 authored today: Oak
  Forest, Bronze Hills, Volcanic Island, …) yields its own rare materials and a
  chance of keystones. Maps no longer burst into random Tokens. Maps are the one
  source Token that is used up.

*Not taken up:* Exploration growing the mat (edges or Token cap); Exploration
discovering recipes (it would go against SP-13); Maps that last forever;
retiring the Maps.

*Open:* each Map's yields; whether keystone finds can be aimed (by choosing the
Map) or are pure chance; Map charges and prices.

⚠️ **Corrected by the review (§9.1):** Construction *is* in the skill registry
(`src/config/registries/skillRegistry.js`), but as a **signature** skill: second
promotion, one job only. Farming and Exploration are not. Recruits hold exactly
6 skills (Mining, Logging, Fishing, Smithing, Crafting, Cooking) and **no combat
skill**. The owner will **overhaul the skills list once this design says which
skills the game needs** (SP-58); §10.12 is that list.

## 6. Open questions

**Support Tokens** (§3.6): the list per skill, ranges and stacking, helpers
versus heroes.

**Foundations** (§3.5): the build list for each Foundation kind and tier.

**Skill-level gates versus SP-13.** SP-13 says progression is gated by items with
no recipe unlocks, while SP-49 gates Foundation recipes by Construction level
(a Kitchen at level 20). Recipes already carry a skill requirement today
(`skillRequired`), so this is probably consistent, but a reviewer should check
the two read together.

**The shop:**

* **The length of the list.** Foundations (SP-42) keep stations and support
  Tokens off it, but spawners and camps are still listed one by one. How the
  shop is laid out needs a pass.
* **Whether milestones, quests or Guild Hall upgrades still give spawners or
  Foundations** as rewards alongside the shop (**left open by the owner**). A
  free one would still refund its full price when removed (SP-44), which is a
  loophole to watch.
* **Prices:** which items each spawner and station costs, which is where the
  skills' gating (SP-13) is actually authored.

**The mat:**

* **The mat Token cap (SP-10):** its size, and whether it rises with
  progression. Spawners near the cap stop refilling, which the player must be
  able to see.
* **Spatial consequences** of Tokens vanishing, reappearing and pushing:
  neighbouring buffs and "Cannot" rules (spawns and transforms do not check
  "Cannot" rules today).

**Hero gear and tools:**

* **SP-57 Magic equipment is made by a future skill** (e.g. Enchanting or
  Alchemy), not by Crafting or Smithing.
* **Moving tools onto heroes (SP-53)** touches every Token whose work needs a tool
  nearby (`acceptedTokens` today) and the hero equipment slots.

**Economy:**

* Spawners never run dry and scaling adds output, so the economic simulator will
  model **rates** rather than finite stocks.

Per-skill open questions are listed under each skill in §5.

## 7. What this changes in existing plans

✅ **Carried out by the implementation (2026-09-26):** see
[`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md) §8, slices 9.1–9.4 and 7.0–7.7.
Map bursts, the Vault, the Tray and Managers are gone; the free-playmat roadmap carries a
superseded banner. Tool Tokens remain (tools-as-equipment, SP-53, is later work). The table below
is kept as the record of what was planned.

| Existing item | Effect |
|---|---|
| **Map purchase and burst** (`Cartographer.js`, `data/maps.json`) | Bursting is replaced by the Spawner Shop (SP-12). The 8 Maps stay as Exploration Tokens with charges (SP-54) |
| **The Vault; FP-37** (the Vault is decided at stage 3) | The Vault goes (goal 1) |
| **Slice 1.9 / FP-45** (Tray retired; Vault ↔ mat by drag) | The Vault half is no longer needed |
| **Slice 1.8 / FP-16–18** (arrivals land on the mat and push; bought Maps burst beside the Hall) | Shop purchases and spawns are the new arrivals and **push, as FP-17 says** (SP-46); spawners stop only at a cap. Bought Maps no longer burst |
| **FP-19** (Managers restock in the exact spot) | **Managers are retired** (SP-55) |
| **`tokens.json` charges (`uses`)** | Veins at 500–1000 uses and stations with charges don't match SP-2 / SP-23; numbers change through the CMS, never by hand |
| **Tool Tokens** (e.g. the Copper Pickaxe) | Tools become hero equipment (SP-53); context Tokens stay only for station helpers like the Anvil |

⚠️ **Do not start slices 1.8 or 1.9 as written** until the owner decides how far
this concept replaces them.

⚠️ **Out of date (review, §9.5):** slices 1.8 and 1.9 are not "unstarted". The
roadmap marks both **PARTIAL** (reconciled 2026-09-21, `v0.8.0` tagged): bursts
and spawns already land on the mat and push, bought Maps land beside the Hall,
the Tray UI is gone, and the **Vault is live**, since loot pickup and
right-click send Tokens to it. The question is what to *undo*, not what to skip.
**FP-70** (a hero waits on an empty spot for its Manager) also goes with SP-55.

## 8. Next steps

0. **The first build is planned in
   [`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md)**
   (2026-09-25), which settles SP-63 for that build as **no refunds** (TL-1).
1. ~~**A fresh review by another agent**~~ **Done 2026-09-25** (§9).
2. **The skills overhaul** (SP-58), using the list in §10.12.
3. **Decide the refund rule** (SP-63: by charges left, or no refund).
4. **Foundations and support Tokens in detail** (§3.5, §3.6), including
   which skill makes each support Token once the skills list settles.
5. The open questions in §6, §5 and §9.6, in the owner's order.
6. When the direction is settled, a roadmap with slices. Rebuild the starter
   set and the Guild Hall trickle **after** implementation (SP-72).

---

## 9. Review (2026-09-25, second agent)

A design-only review of v2 against the code on `main` (`ab9487b`) and
[`free_playmat_roadmap_v1.md`](free_playmat_roadmap_v1.md), followed by an
owner interview. Every answer below is **leaning** unless it says **open**.

### 9.1 Blockers: a new save could not progress

| # | Found | Owner's answer |
|---|---|---|
| R-1 | **Nobody could build.** Construction is a signature skill (second promotion, one job), so Recruits can't turn a Foundation into a Kitchen or Furnace. | **SP-59 Every Recruit gets Construction.** |
| R-2 | **Nobody could farm.** There is no Farming skill; Nature ("herbs, crops and livestock") comes at first promotion. | **SP-60 Farming is a new starting skill.** |
| R-3 | **Nobody could explore.** There is no Exploration skill; Survival replaced the old `explore` id and now means "forward camps and outposts". | **SP-61 A new Explore skill, if Maps are kept.** Later the same day, **SP-74:** Explore is a **starting** skill, Maps are kept, and each cycle spends supplies (food, torches) for diverse themed loot. |
| R-4 | **Nobody could be promoted.** The Fighter's and Wizard Academies come out of Map bursts (`map_cozy_hamlet` holds the Fighter's Academy), which v2 removes. No promotion means no combat and no advanced skills. | **SP-62 Academies are built on Foundations**, as a recipe like any station. |
| R-5 | **The skill slots don't fit.** Adding two starting skills makes 8, but a hero holds exactly 6 (`HERO_SKILL_SLOTS`). | **SP-58 The skills list is an output of this design.** "We'll be overhauling the skills list once we know what skills we need, and which skills are needed at the Recruit level." §10.12 is the input to that. |
| R-6 | **Recruits can't fight.** Recruits hold no combat skill, so a camp is useless until someone is promoted. | No change asked; recorded in §10.6. Camps are post-promotion content. |

### 9.2 Exploits, softlocks and the economy

| # | Found | Owner's answer |
|---|---|---|
| R-7 | **A full refund cancels wearing out.** Use an Anvil (or an academy) down to one charge, remove it for a full refund, buy a fresh one. | **SP-63 (open between two):** refund **by charges left**, *or* **no refunds at all**, "making the cost of building one a real choice". Either closes the exploit. The second also closes R-9's free-Token loophole. |
| R-8 | **Build, remove, rebuild farms Construction XP for free.** | **SP-64 Accept it.** It is a manual loop, not idle. |
| R-9 | A spawner given free (by a quest or milestone) would refund a price it never cost (already noted in §6). | Closed by either form of SP-63 if "refund" means *what was paid*. |
| R-10 | **Without refunds, a player can spend their last Oak on a bad building** and have nothing left to buy with. | **SP-66 The Guild Hall trickle is the backstop**, including (probably) one kind of seed. Its contents are tuned after implementation. ⚠️ The Hall produces nothing today (`token_guild_hall` has no config); this is new work. |
| R-11 | **Gold has no clear source.** Guild Hall upgrades (Bunk Beds 500 g, rising ×1.8) cost gold; gold came from Map rewards, loot and selling. | **SP-65 Gold is probably retired; items are the main gate.** "I would rather have a Token cost 1000 wood instead of 900 GP and 100 Wood." Guild Hall upgrades get item prices. ⚠️ **Commerce** (markets that turn goods into gold) loses its purpose; see §10.12. |

### 9.3 Idle play

| # | Found | Owner's answer |
|---|---|---|
| R-12 | **The mat cap would stay full.** Spawners fill up to SP-10's cap on their own, so an idle player would return to a shop that refuses every purchase. | **SP-67 The cap counts only placed Tokens.** Spawned Tokens are bounded by per-kind caps × spawners. |
| R-13 | **Spawns slowly wreck the layout.** Pushing (SP-46) shoves support Tokens and stations out of Close/Near range over hours. | **SP-68 Spawns push only other spawned Tokens.** A spawner boxed in by placed Tokens waits (FP-46) and should say so. |
| R-14 | **An unwatched leader stops a flag.** A rare Goblin Chief kills a gatherer overnight and FP-42 furls the flag. | **SP-69 Intended.** "This is what makes combat dangerous and needs supervision." FP-74 stands; the player keeps camps away from weak heroes or watches them. |
| R-15 | **Upkeep can die out.** (Raised by the new upkeep rule, SP-70.) A tree with 10 charges and a 20% seed drop gives **2 seeds on average** for the 1 it cost, so a Forest's seed stock grows. But **~11% of trees drop none** (0.8¹⁰), so a first Forest started from one seed stalls about one time in nine. | **Caught by SP-66's trickle** (one seed kind). |

**SP-70 Upkeep (owner's idea, new).** "Generally spawners come with an upkeep
cost", decided **per Token** (in the spirit of *guidelines, not laws*): an Oak
Forest pays one Oak Seed per sapling; its trees drop Oak Seeds, so it sustains
itself. **The code already has this:** a rule can carry an item upkeep on its
own clock, and when the Bank can't pay, the rule switches **off** until stock
returns (`BlockUpkeep.js`, CMS-60 and CMS-97). A spawn rule with a per-spawn
upkeep is that mechanism with the clock set to the spawn. Upkeep also makes
Logging and Farming the same shape, which §10 uses. **Open:** whether stations'
fuel (SP-26) becomes upkeep too; the owner raised upkeep in answer to the fuel
question.

**SP-71 Seeds are separate items,** except where the crop *is* the seed
(Coconuts plant Coconut Trees). **SP-73 Fruit goes into Orchards:** planted on
Farmland like a crop Field, spawning fruit trees and bushes, harvested by
Farming. The 17 authored fruit Tokens become Orchard spawns.

**Food** is already implemented as eaten to regain health and sustain long
fights (owner). This is recorded here because it is Cooking's reason to exist
on the skills list.

### 9.4 Contradictions resolved on reading

* **SP-13 versus level gates (§6).** Consistent. SP-13 forbids *unlock events*
  (a recipe that must be discovered or bought). A Construction level
  requirement is the existing `skillRequired` on a recipe, visible from the
  start. Both gates apply: the items **and** the level.
* **SP-46's "the spawn waits" versus FP-46's "a spawn is skipped".** The same
  outcome: nothing is lost and the spawner tries again next time.
* **Kind caps with two spawners of the same kind.** SP-5 says 5 × Oak Forests;
  a keystone that also grows Oak Trees needs a rule. *Proposed, open:* a kind's
  cap is the **sum of the allowances of every spawner that makes it**.

### 9.5 Conflicts with the code and the free-playmat roadmap

Recorded for the roadmap; none needs an answer yet.

* **Slices 1.8 and 1.9 are partly built** (see the note under §7), and the
  **Vault is live**. Retiring it means re-homing loot pickup, right-click
  deposit, and FP-46's "a burst that doesn't fit drops as loot".
* **FP-70** (a hero waits on an empty spot for its Manager) goes with SP-55.
* **Tutorial quests** reward Guild Hall Maps (all 13 in
  `tutorialQuests.js`) and count `token_placed` and `token_exhausted`. They need
  item rewards and new triggers.
* **Today's Forests are workable Tokens.** `token_oak_forest` is logged directly
  (100 uses, gives Oak Wood). As a spawner it changes meaning, and so do the
  Birch, Fir, Maple and Mahogany Forests. **All reauthoring goes through the
  CMS**, which must learn spawner caps and per-spawn upkeep before any content
  moves.
* **Tools on Token recipes.** Recipes already output Tokens (the Copper Pickaxe
  recipe makes `token_copper_pickaxe`), and workable Tokens require nearby tools
  (`acceptedTokens`, e.g. the Oak Forest needs an axe). SP-53 moves both onto
  hero equipment.
* **Transforms and spawns ignore "Cannot" rules** (§6). The Coast already has
  one (no more than 2 Coasts together), and Coasts transform.
* **Energy code remains** in hero consumption, regen and combat (goal list, §2).
* **Names:** the items are **ingots**, not bars (`item_copper_ingot`).
* **Registry overlaps** worth knowing for the overhaul: Engineering is
  "Managers, drones and clockwork" (Managers are retired, SP-55); Survival's
  "outposts that supercharge a neighbour" are boosters (SP-39); Nature's crops
  are now Farming.

### 9.6 Still open after the review

* **SP-63:** refund by charges left, or no refunds.
* ~~**Maps:** kept and reworked, or retired (SP-61).~~ **Kept** (SP-74).
* **Fuel:** an ingredient, as the code does today, or station upkeep (SP-70).
* **Bank slots.** The Bank has limited slots (64, +32 per rank). Seeds for
  every crop and tree, plus rare materials, add item kinds. What happens to an
  output when the Bank is full decides whether an idle mat stalls.
* **The kind-cap sum rule** (§9.4).
* **Which items each spawner pays as upkeep**, and whether camps have any.

---

## 10. Skill lifecycles and chains

Where every Token comes from and what happens to it, skill by skill. The chains
use today's item names where they exist; **items that don't exist yet are
marked ✱**. Tiers follow the items already authored. Nothing in this section
adds a decision beyond §9: it is the owner's rules laid out end to end, with
**suggested** details marked as such.

### 10.1 The shared shapes

Every Token on the mat follows one of five shapes.

| Shape | Obtained | On the mat | Worked by | Ends |
|---|---|---|---|---|
| **Spawner** | Bought at the shop | Spawns workable Tokens up to its kind's cap, paying upkeep per spawn | Nobody (heroes work what it spawns) | Removed by the player (SP-63) |
| **Spawned Token** | Made by a spawner | May grow first (sapling → tree), then waits to be worked | Its gathering skill | **Vanishes** when its charges run out; the spawner replaces it |
| **Transformer** | Bought at the shop | Changes into a workable state for a while, then turns back | Its skill, while transformed | Permanent; removed by the player |
| **Built Token** | A Foundation (shop) plus a recipe picked on it | Built in place by Construction (or planted by Farming), then works as a station, support Token or academy | Its skill (stations) or nobody (support) | Permanent, except Tokens with charges (academies), which vanish when used up |
| **Consumable Token** | Bought at the shop | Worked until its charges run out | Its skill | **Vanishes**; bought again (Anvils, Maps) |

And one special Token: the **Guild Hall**, on the mat from the start, the
upgrade board, and (SP-66) a slow trickle of basic items and one seed kind.

### 10.2 Logging

```
Shop: Oak Forest (paid in items)
  └─ spawns an Oak Sapling  ── upkeep: 1 Oak Seed✱ per spawn
       └─ matures into an Oak Tree (10 charges)
            └─ Logging: each cycle → Oak Wood, 20% → Oak Seed✱
                 └─ tree vanishes at 0 charges → Forest spawns again
```

* **Self-sustaining:** 2 seeds per tree on average, against 1 spent (§9.3).
* **Feeds:** Construction (Wood Foundations, buildings), Crafting (planks✱,
  Charcoal for fuel), shop prices (SP-13's Mythril Mineshaft needs a higher
  wood).
* **Tiers from existing items:** Oak → Birch → Fir → Maple → Cedar → Mahogany →
  Ebony (the order is a suggestion). Each Forest is priced in the wood below it
  plus another skill's items.
* **Stalls when:** no seeds (the trickle restarts it), or cap reached.

### 10.3 Mining

```
Shop: Copper Mine (paid in items)
  └─ spawns a Copper Vein  ── upkeep: decided per Token (suggested: none early,
  │                            Timber Supports✱ from Crafting later)
       └─ Mining: each cycle → Copper Ore
            └─ vein vanishes at 0 charges → Mine spawns again
```

* **The plain, reliable skill** (SP-33). No growth stage.
* **Feeds:** Smithing (ore → ingots), Crafting (Quartz → glass✱, Clay →
  ceramics), Construction (**Stone✱**, which Stone Foundations need but no item
  provides today), fuel (Coal).
* **Tiers from existing items:** Copper → Iron → Silver / Gold → Mythril →
  Adamantine → Darkmetal, with side mines for Coal, Clay and Quartz.
* **Gap:** a Stone item, and whether it comes from a Quarry spawner.

### 10.4 Fishing

```
Shop: Coast (permanent)
  └─ on a timer, turns into one of its list (Shrimp Coast, weighted; Crab Coast✱)
       └─ Fishing: each cycle → Raw Shrimp, until the timer ends
            └─ turns back into a Coast; a cycle in progress is lost (SP-51)
```

* **No spawns, so no cap and no seed upkeep.** More fishing = more Coasts.
  *Suggested, open:* upkeep in the form of **Bait✱** per transformation.
* **Feeds:** Cooking (Raw Shrimp → Shrimp).
* **Tiers:** only Raw Shrimp exists today. Higher Coasts (Reef, Deep Water)
  need new fish items.

### 10.5 Farming (crops and fruit)

```
Shop: Farmland (a Foundation kind)
  └─ pick a recipe on it: Wheat Field, Onion Field✱, Apple Orchard✱ …
       └─ a Farming hero PLANTS it → the Field (permanent, not worked)
            └─ spawns a patch or fruit tree  ── upkeep: 1 seed per spawn
                 (Wheat Seed✱; Coconut plants Coconut, SP-71)
                 └─ grows to ripe (several charges, SP-22)
                      └─ Farming: each cycle → the crop, sometimes its seed
                           └─ patch vanishes → the Field spawns again
```

* **The same shape as Logging** once upkeep exists; the differences are that
  the spawner is *planted* rather than bought, and one Farmland can grow many
  kinds.
* **First seeds** come from other skills' work (SP-19) and the trickle.
* **Feeds:** Cooking (Wheat → Flour → Dough; fruit → pies and juices),
  support Tokens (Windmill already boosts Fields).
* **Existing Tokens that fit:** Wheat Field, 11 fruit trees, 6 berry bushes and
  vines, Watermelon Patch (SP-73).
* **Switching crops:** remove the Field and plant again (subject to SP-63).

### 10.6 Combat

```
Shop: Goblin Camp (paid in items)
  └─ spawns from its weighted list: Goblin (common), Goblin Chief (rare)
     ── upkeep: decided per Token (open whether camps have any)
       └─ a PROMOTED hero in range fights it (Recruits hold no combat skill)
            ├─ win → enemy vanishes, loot to the Bank, camp spawns again
            └─ lose → hero goes home wounded, flag comes down (FP-42)
```

* **Dangerous by design** (SP-69): leaders need watching.
* **Needs:** promotion (academies, §10.9), Cooking's food to sustain long
  fights, Smithing and Crafting gear.
* **Feeds:** shop prices (loot as a gate), Cooking (Raw Beef from the Cow),
  Bones.
* **Styles:** whether a camp leans Melee, Ranged or Magic is open.

### 10.7 Cooking

```
Shop: Foundation → pick Cooking Pot / Range / Kitchen (Construction level-gated)
  └─ Construction builds it in place (permanent)
       └─ pick a recipe in the station
            └─ Cooking: each cycle takes ingredients (+ fuel, SP-26) → a dish
                 └─ waits when an input is missing
```

* **Station tiers lower the failure chance** (§5.7).
* **Inputs:** Fishing, Farming, Combat (beef), Water (the Wishing Well, a Guild
  Hall upgrade today).
* **Output's purpose:** food restores health in combat (already implemented).
* **Drinks** (Beer, Lemonade) exist as items; which skill makes them is open.

### 10.8 Crafting

```
Shop: Foundation (Bench quality) → Construction builds a Workbench / Kiln
  └─ pick a recipe → Crafting: inputs → parts, tools, Ranged gear (no fuel)
```

* **The connector skill** (SP-27): Oak Wood → Charcoal (fuel for Smithing and
  Cooking; the Campfire does this today), Clay → ceramics (Ceramics Kiln),
  Quartz → glass✱, planks✱, rope✱, Timber Supports✱, Bait✱.
* **Feeds:** almost every price, Smithing and Cooking (fuel), Fishing and Ranged
  (nets, bows), Mining (supports, if used as upkeep).

### 10.9 Smithing

```
Shop: Foundation → Construction builds a Furnace (permanent)
  └─ Smithing SMELTS: Copper Ore ×4 + Coal (fuel) → Copper Ingot  (no Anvil)
       └─ Copper Ingots buy a Copper Anvil at the shop (consumable, charges)
            └─ placed near the Furnace → Smithing SMITHS melee gear and tools
                 └─ Anvil vanishes at 0 charges → bought again
                      └─ higher ingots buy higher Anvils (climbs on its own output)
```

* **Feeds:** Mining (pickaxes), Melee (weapons, armour), Construction (ingots
  in higher building prices).
* **Refunds matter most here:** the Anvil is the Token that forced SP-63.

### 10.10 Construction

```
Shop: Foundation (Wood / Stone / Bench qualities; tiered, SP-43)
  └─ placed where the building should stand
       └─ pick a recipe on it (Construction level-gated, SP-49)
            └─ Construction builds it in place → a station, support Token or academy
```

* **Builds:** every station (§10.7–10.9), support Tokens (SP-41), and
  **academies** (SP-62).
* **Inputs:** Logging (wood), Mining (Stone✱, ingots via Smithing), Crafting
  (parts), and rare materials for support Tokens and keystones.
* **Promotion chain:** Stone Foundation → Fighter's Academy (10 charges) → each
  promotion uses one → the academy vanishes when used up → built again.

### 10.11 Explore (a starting skill, SP-74)

```
Shop: a Map (consumable, charges)
  └─ an Explore hero works it; each cycle SPENDS supplies from the Bank
     (food from Cooking, Torches✱ from Crafting …)
       └─ → diverse loot themed to the Map (a coastal Map drops coastal things),
            rare materials (Beeswax Comb✱, Ancient Seed✱), sometimes a keystone
            └─ Map vanishes at 0 charges → bought again
```

* **Explore is the skill that spends.** The gathering skills make items from
  nothing; Explore turns other skills' products (food, torches) into **variety**:
  a wide, themed loot table instead of one output. It is the natural sink for
  Cooking and Crafting before Combat exists.
* **Feeds:** support-Token and keystone recipes, and any item the player can't
  yet spawn themselves.
* **Open:** the supplies each Map asks for (per Token, like upkeep); Map charges
  and prices; whether keystones can be aimed by choosing the Map.

### 10.12 What skills the game needs (input to the skills overhaul)

The chains above call for these, **before** any promotion:

| Needed at Recruit level | Why a Recruit needs it |
|---|---|
| Logging | Wood is in nearly every early price, and the first fuel |
| Mining | Ore, Coal, Clay, Quartz, Stone✱ |
| Construction | Nothing past the starter set exists without it |
| Crafting | Charcoal (fuel) and parts; the connector |
| Smithing | Ingots gate higher prices; pickaxes |
| Farming | Crops and fruit for Cooking; seeds |
| Fishing | Cooking's first ingredient that needs no Foundation |
| Cooking | Food sustains combat, so it must be ready **before** the first promotion; it also supplies Explore |
| Explore | Owner (SP-74): spends food, torches and the like on Maps for diverse themed loot |

That is **9 at Recruit level**, against 6 slots today. Candidates to trim, if
the overhaul wants fewer: Fishing (Cooking could start on crops) or folding
Smithing's smelting into Crafting. Neither is recommended here; both are
options for the overhaul.

**Needed after the first promotion:** one combat style (Melee, Ranged, Magic);
a magic-gear skill (SP-57).

**No chain uses them yet** (the overhaul decides whether to cut, merge or give
each a chain): Leadership, Faith, Nature (its crops moved to Farming), Crime,
Alchemy, Armory, Occult, Inscription, Beastmaster, Survival, Commerce (no gold
to make, SP-65), Brewing, Summoning, Astrology, Science, Engineering.

**An observation for the overhaul, not a proposal:** several of those
descriptions already read as **support Tokens** (SP-39). Survival's outposts
"supercharge a neighbour" (boosters), Engineering's clockwork works "the board
unattended" (helpers), and Astrology's lenses "bend what the world drops"
(changers). If promoted heroes need a job, *making support Tokens* is one that
the chains leave open. SP-41 currently has Construction build them all.

---

## Appendix A: Decision index

All decisions are **leaning** unless marked otherwise.

| ID | Decision | Status |
|---|---|---|
| SP-1 | Spawners unlocked once, then free to place | Replaced by SP-11/SP-12 |
| SP-2 | Workable Tokens run out and are replaced | Leaning |
| SP-3, SP-4 | Themed point pools, and what costs points | Replaced by SP-9 |
| SP-5 | Cap shared across the mat per kind, counting live Tokens | Leaning |
| SP-6 | Over the cap after a removal, nothing is removed | Leaning |
| SP-7 | No room, no spawn (spawns wait instead of pushing) | Replaced by SP-46 |
| SP-8 | Earn the first spawner, craft the rest (recipe unlocks) | Replaced by SP-12/SP-13 |
| SP-9 | No point pools | Leaning |
| SP-10 | A mat-wide Token cap | Leaning, amended by SP-67 (placed Tokens only) |
| SP-11 | Spawners live only on the mat; removal returns their price | Leaning; the refund is reopened by SP-63 |
| SP-12 | The Spawner Shop (the Cartographer's shop, paid in items) | Leaning |
| SP-13 | No recipe unlocks; progression gated by items | Leaning |
| SP-14 | Starter spawners already on the mat | Leaning; contents decided after implementation (SP-72) |
| SP-15 | Shoals around the edge of a Pond | Replaced by SP-18 |
| SP-16 | One kind of fish per spot | Replaced by SP-50 |
| SP-17 | Fishing runs on a timer, not charges | Leaning (now the transformed state's timer) |
| SP-18 | Fishing spots transform (Coast ↔ Shrimp Coast) | Leaning |
| SP-19 | Seeds from harvests and other skills | Leaning |
| SP-20 | Sowing is hero work | Replaced by SP-47/SP-48 |
| SP-21 | The crop is a setting on the Farmland | Replaced by SP-47/SP-49 |
| SP-22 | Patches give several harvests | Leaning |
| SP-23 | Stations are permanent | Leaning |
| SP-24 | No fuel | Replaced by SP-26 |
| SP-25 | Station tiers: one Kitchen, or an upgradeable blueprint | Settled by SP-49 (tiers are recipes) |
| SP-26 | Cooking and Smithing burn fuel; Crafting does not | Leaning |
| SP-27 | Crafting makes parts for other skills | Leaning |
| SP-28 | Crafting makes things for heroes | Leaning |
| SP-29 | Smithing keeps context Tokens; the Anvil is one | Leaning |
| SP-30 | Anvils are tiered and wear out | Leaning |
| SP-31 | Smelt, then smith | Leaning |
| SP-32 | Gear split: Crafting = some tools + Ranged; Smithing = some tools + Melee | Leaning |
| SP-33 | Gathering skills stay simple | Leaning |
| SP-34 | Camps spawn enemies from a list | Leaning |
| SP-35 | Camp caps shared per kind, counting live enemies | Leaning |
| SP-36 | Camps spawn forever | Leaning |
| SP-37 | Weighted spawning with rare leaders | Leaning |
| SP-38 | A leader is a tougher enemy with better loot | Leaning |
| SP-39 | Support Tokens: boosters, changers, links, helpers | Leaning |
| SP-40 | Keystones as a rare tier | Leaning |
| SP-41 | Support Tokens come from recipes, not the shop list | Leaning |
| SP-42 | Foundations bought at the shop, built with Construction (stations, support Tokens, Farmland) | Leaning |
| SP-43 | A few kinds of Foundation, tiered | Leaning |
| SP-44 | Removing is a full refund (Foundation + building); Guild Hall trickle as backstop | **Reopened** by SP-63 / SP-66 |
| SP-45 | Exploration gathers rare materials and finds keystones | Leaning |
| SP-46 | Spawns push (FP-17); they only wait at a cap | Leaning, amended by SP-68 (push only spawned Tokens) |
| SP-47 | A Farming hero plants Farmland into a crop Field | Leaning |
| SP-48 | The Field spawns patches passively, one seed per patch | Leaning |
| SP-49 | What a Foundation becomes is a recipe; station tiers are higher-level recipes | Leaning |
| SP-50 | A Coast turns into one of several, from its list | Leaning |
| SP-51 | A cycle in progress when the Coast turns back is lost | Leaning |
| SP-52 | A hero whose target vanishes moves to the next thing in range | Leaning |
| SP-53 | Tools are carried by heroes | Leaning |
| SP-54 | Maps kept for Exploration: bought, worked, charges, then vanish | Leaning |
| SP-55 | Managers retired | Leaning |
| SP-56 | Anvils are bought at the shop | Leaning |
| SP-57 | Magic equipment comes from a future skill | Leaning |
| SP-58 | The skills list is an output of this design; the registry will be overhauled (§10.12) | Leaning |
| SP-59 | Every Recruit gets Construction | Leaning |
| SP-60 | Farming is a new starting skill | Leaning |
| SP-61 | A new Explore skill works Maps, if Maps are kept | Settled by SP-74 (Maps kept) |
| SP-62 | Academies (promotion Tokens) are built on Foundations | Leaning |
| SP-63 | Refund by charges left, or no refunds at all | **Open** between the two |
| SP-64 | The build-remove-rebuild XP loop is accepted | Leaning |
| SP-65 | Gold retired; items are the only price, Guild Hall upgrades included | Leaning ("may be retired") |
| SP-66 | The Guild Hall trickle is the softlock backstop, including one seed kind | Leaning; contents tuned after implementation |
| SP-67 | The mat cap counts only placed Tokens | Leaning |
| SP-68 | Spawns push only other spawned Tokens | Leaning |
| SP-69 | Leaders are dangerous by design; combat needs supervision | Leaning |
| SP-70 | Spawners generally have upkeep (an item per spawn), decided per Token | Leaning |
| SP-71 | Seeds are separate items, except where the crop is the seed | Leaning |
| SP-72 | Starter set and trickle contents decided after implementation | Leaning |
| SP-73 | Fruit grows in Orchards planted on Farmland, worked by Farming | Leaning |
| SP-74 | Explore is a starting skill; it spends supplies (food, torches) on Maps for diverse themed loot | Leaning |

## Appendix B: History, and ideas set aside

Kept so these ideas are not rediscovered from scratch. None of them is the
current direction.

**First session (2026-09-24 and the morning of 2026-09-25).** A layered chain:
*sources* (Birch Forest, Mineshaft, Map, Blueprint) spawning *nodes*, with a
live cap and a finite budget that went dormant and was refilled. Then the
**Source Bar** (a small fixed bar of repeatable producers, targeted expeditions,
seeds, sources that grow and spread as zones) and an alternative, **Living Land**
(sources and buildings packed into kits in the Bank, seeds that paint a biome
region, pick-of-three offers, flag skill biasing what spawns). The per-skill
leanings from that session (Mining nodes lasting minutes, Logging stumps,
Fishing stock that refills, Farming's seed leak, fuel-fed stations) fed into the
skill tests in §5.

**Charters (2026-09-25).** The player owns *rights* ("up to 3 Oak Trees") held
in a small bar and planted as markers; groves mature by being worked; only rate
leaks; expeditions to chosen regions; planting slots. **Set aside by the owner as
too complicated for an idle game.**

**Ten radical models (2026-09-25).** The Tide (the mat resets on a rhythm),
heroes bringing their own work, merge-to-upgrade, a river of drifting Tokens, a
buried world uncovered by digging, camps that are used up and moved on from
(prestige), orders that spawn the Tokens they need, nothing arrives and
everything transforms, an ecosystem that feeds itself, and one Token per skill
that grows. **The owner liked two of them:** "nothing arrives,
everything transforms" and "an ecosystem that feeds itself". The ecosystem is
the desired *feel*: the player organises resources and effort to point it where
they need to progress.

**Ecosystem mechanics explored.** Of the engines, **neighbour rules** (Tokens
change based on what is Close or Near) appealed; succession, food webs and
"becomes the next thing" did not. Of the levers, **where heroes work, placement
and keystone Tokens** appealed; mat-wide dials did not. Triggers: **slow
conditions on a timer** appealed. Effects: **transform, spread and claim, and
feed** appealed; breeding and withering did not. These may return when support
Tokens are designed, since that is where an ecosystem feel can live.

**Where spawners come from, before the shop.** Considered and not taken up: one
spawner per skill with a variety setting; spawners upgrading in place; a
catalogue, build menu or Codex; heroes carrying the know-how; copying a spawner
already on the mat; idle heroes finding spawners; spawners forming from
conditions; taking over a camp or shaft; the Bank holding packed spawners;
earning the first spawner and crafting the rest (SP-8). Map bursts and a gold
shop were disliked; the shop was accepted once it was **paid in items**.

**Per-skill ideas not taken up.** Mining: prospecting (ruled out by §3.4),
cracking boulders. Logging: older trees yielding more; saplings pausing near
active loggers. Fishing: shoals around a Pond (SP-15); a spot with a refilling
stock. Farming: a Field spawning crops or plots by itself; a starter stock of
seeds; the shop selling seeds. Combat: separate caps per camp; camps that can be
cleared; escalating spawns; waves; camps that grow stronger when ignored; a
leader that buffs others. Processing: stations spawning orders or workable
Tokens; Crafting as the only source of support Tokens; Crafting as big
multi-hero projects; Smithing heat, quality rolls and hot ingots that cool.
