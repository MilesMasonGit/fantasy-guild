# Concept Document: The Token Lifecycle

**Status:** DRAFT concept **v2**, 2026-09-25 (support Tokens, Foundations and a
final round of owner answers added the same day, ready for a fresh review by
another agent). Design only; no code written.
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
  instead of pushing.)*

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
  skill's items.

### 3.3 Limits and removal

* **SP-9 No point pools.** The owner proposed themed point pools (Nature
  Points and so on) and then dropped them: "I don't really want to add
  unnecessary systems." Their jobs are covered elsewhere: floods by the live cap
  (SP-5), scale by the shop's prices (SP-13).
* **SP-10 A mat-wide Token cap:** a maximum number of Tokens allowed on the
  playmat, which the owner expects to need for performance anyway. **Everything
  on the mat counts**: spawned trees, veins and enemies as well as spawners,
  stations and support Tokens. It is the limit on how far a player can scale.
* **SP-11 Spawners live only on the mat.** There is no bar, catalogue or
  storage for them. **Removing a spawner returns the items it cost** to the Bank,
  so it can be bought again later.

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

⚠️ **Exploration, Construction and Farming are not in the skill registry**
(`src/config/registries/skillRegistry.js`); each would be added as its own piece
of work.

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

None of these has been edited; each needs the owner's decision first.

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

## 8. Next steps

1. **A fresh review by another agent** (the owner's request): poke holes in the
   direction and identify issues, before any more detail is added.
2. **Foundations and support Tokens in detail** (§3.5, §3.6).
3. The open questions in §6 and §5, in the owner's order.
4. When the direction is settled, a roadmap with slices.

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
| SP-10 | A mat-wide Token cap; everything on the mat counts | Leaning |
| SP-11 | Spawners live only on the mat; removal returns their price | Leaning |
| SP-12 | The Spawner Shop (the Cartographer's shop, paid in items) | Leaning |
| SP-13 | No recipe unlocks; progression gated by items | Leaning |
| SP-14 | Starter spawners already on the mat | Leaning |
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
| SP-44 | Removing is a full refund (Foundation + building); Guild Hall trickle as backstop | Leaning |
| SP-45 | Exploration gathers rare materials and finds keystones | Leaning |
| SP-46 | Spawns push (FP-17); they only wait at a cap | Leaning |
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
