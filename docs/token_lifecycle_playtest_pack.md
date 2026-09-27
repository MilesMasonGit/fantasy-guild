# Token Lifecycle — playtest pack (first build)

*Written 2026-09-26 for slice 10.2 of [`token_lifecycle_roadmap_v1.md`](token_lifecycle_roadmap_v1.md).
Everything here is a first build for testing the basic mechanics. Every number is a placeholder
(TL-5). Your feedback becomes roadmap v2.*

---

## 1. Starting it

1. In the project folder, run `npm run dev` and open the address it prints (usually
   http://localhost:5173).
2. Start a **New Game** in an empty slot. **Old saves are not supported** by this build (DP-10):
   they load, but their Vault, Tray, Map bursts and gold are dropped.
3. You begin with the **Guild Hall**, an **Oak Forest** and a **Copper Mine** on the mat, and
   **3 Oak Seed, 10 Oak Wood, 2 Wheat Seed** in the Bank. The Guild Hall slowly pays out seeds
   (see §4).

The **QA** button (bottom right) is the dev panel: *Give item*, *Advance timers* (skip up to two
hours per click) and *Spawner kinds*. Use it to speed things up, not to fill gaps: everything in
this build is reachable without it.

## 2. What to try (in roughly this order)

The tutorial quests follow the same path, so you can also just follow them.

- [ ] **Recruit** your first hero at the Guild Hall (free) and **plant their flag** by the Oak
      Forest.
- [ ] Watch the Forest: **saplings** appear (each costs 1 Oak Seed), grow into **Oak Trees**, and
      stop at 5. The hero logs them with **no axe**. A tree lasts 10 logs, then vanishes and is
      replaced.
- [ ] **Collect loot** by hovering over it (TL-9). Nothing reaches the Bank until you do.
- [ ] Let the Forest run out of seeds: a **yellow icon** on it names the missing item, and the
      Hall's seed trickle restarts it.
- [ ] Open **Item Bank → Upkeep** to see what your spawners are costing per minute and how long
      your seeds will last.
- [ ] Open the **Shop** (the old Cartographer). Buy a **Quarry** and a **Coal Mine**.
- [ ] Recruit more heroes: Guild Hall upgrades now cost **Oak Wood**, not gold.
- [ ] Buy a **Wood Foundation**, click **Choose what to build** and pick the **Workbench**. A hero
      builds it in place. Craft **Charcoal** and **Torches**.
- [ ] Buy **Farmland** and plant a **Wheat Field** (1 Wheat Seed) or an **Apple Orchard**
      (1 Apple Seed). Harvest **Ripe Wheat** (3 harvests each) and **Apples**.
- [ ] Buy a **Coast**. Every 2 minutes it becomes a **Shrimp Coast** for 1 minute. Fish it while
      it lasts: a catch in progress when it turns back is lost.
- [ ] Buy a **Stone Foundation**, build a **Furnace**, smelt **Copper Ingots**. Buy a **Copper
      Anvil** (5 ingots), place it near the Furnace and smith **Copper Nails**. The Anvil wears
      out.
- [ ] Build a **Cooking Pot** and cook **Shrimp** (burns Charcoal).
- [ ] Buy the **Oak Forest Map** and let an Explore hero work it: each trip spends a Shrimp and a
      Torch for mixed loot, and the Map is used up after 5 trips.
- [ ] Buy a **Goblin Camp**. Give a hero a combat skill with the QA panel's **Grant Melee**
      (Recruits hold none, TL-3) and send them in. Watch for the rare **Goblin Chief**.
- [ ] **Remove** something you placed (inspection panel → Remove). It is gone for good and
      nothing comes back (TL-1).
- [ ] Build a **Fighter's Academy** on a Stone Foundation and promote a hero. They keep all
      nine starting skills (TL-7).

## 3. What to watch for

- **Does it feel like a living mat?** Spawners filling up, trees growing, Coasts turning, camps
  refilling.
- **Pacing.** In a scripted run with no dev items, every chain had been used once by about game
  minute 28, and the Anvil by about minute 43. Too fast, too slow?
- **Prices and gates.** Is Oak Wood doing too much of the work? Does any purchase feel pointless
  or impossible?
- **Seeds and upkeep.** Do Forests and Fields stall too often, or never?
- **Idle play.** Leave it running (or skip an hour): does anything jam, overflow or stop?
- **Heroes choosing work.** With several kinds of work in one flag's range, heroes may favour one
  kind and leave another idle (§6). How annoying is it?
- **Danger.** Goblin Chiefs can beat a fresh hero on purpose (SP-69). Too harsh?

## 4. Every placeholder number, and where to change it

**In the CMS** (`npm --prefix cms run dev`), the only safe way to change content. Never edit
`data/*.json` by hand.

- A Token's **spawner, grows, turns, Foundation, Shop price and trickle** are in the Token editor's
  **Spawning and Building** section.
- **Charges** are the Token's uses.
- A worked Token's **cycle time and outputs** are in its work settings.
- **Recipes** (costs, times, levels, which Foundation they build on) are in the **Recipes** tab.

**In code** (ask me to change these):

- **Guild Hall upgrade prices:** `src/config/guildUpgrades.js`. Rank *n* costs 10 × *n* Oak Wood;
  the first recruit and the first Wishing Well rank are free.
- **The opening:** `OPENING_ITEMS` and the starter Tokens in `src/systems/core/EngineBootstrap.js`.
- **The placed-Token cap:** Mat Tuner → *Token cap* (default 40).

### Shop

| Token | Section | Price |
|---|---|---|
| Oak Forest | Logging | 10 Oak Wood |
| Copper Mine / Coal Mine / Quarry | Mining | 15 Oak Wood each |
| Coast | Fishing | 10 Oak Wood |
| Farmland | Farming | 10 Oak Wood |
| Wood Foundation | Construction | 15 Oak Wood |
| Stone Foundation | Construction | 10 Stone + 5 Oak Wood |
| Copper Anvil | Smithing | 5 Copper Ingot (20 uses) |
| Oak Forest Map | Explore | 5 Oak Wood + 1 Torch (5 trips) |
| Goblin Camp | Melee | 10 Stone + 10 Oak Wood |

### Spawners

| Spawner | Spawns | Cap | Every | Upkeep per spawn |
|---|---|---|---|---|
| Oak Forest | Oak Sapling → Oak Tree (30 s) | 5 | 20 s | 1 Oak Seed |
| Wheat Field | Wheat Sprout → Ripe Wheat (30 s) | 3 | 30 s | 1 Wheat Seed |
| Apple Orchard | Apple Sapling → Apple Tree (45 s) | 2 | 45 s | 1 Apple Seed |
| Copper Mine / Coal Mine / Quarry | Copper Ore Vein / Coal Vein / Stone Outcrop | 3 | 30 s | none |
| Goblin Camp | Goblin (95) or Goblin Chief (5) | 3 | 30 s | none |

**Coast:** turns into a Shrimp Coast every 120 s, for 60 s.
**Guild Hall trickle:** 1 Oak Seed and 1 Wheat Seed every 5 min, 1 Apple Seed every 10 min.

### What gets worked

| Token | Uses | Cycle | Gives |
|---|---|---|---|
| Oak Tree | 10 | 16 s | Oak Wood 1–2, Oak Seed 20% |
| Copper Ore Vein / Coal Vein / Stone Outcrop | 10 | 16–20 s | Copper Ore / Coal / Stone 1–2 |
| Shrimp Coast | — | 16 s | Raw Shrimp 1 |
| Ripe Wheat | 3 | 16 s | Wheat 1–2, Wheat Seed 40% |
| Apple Tree | 5 | 16 s | Apple 1–2, Apple Seed 30% |
| Oak Forest Map | 5 | 20 s, spends 1 Shrimp + 1 Torch | Oak Wood 2–4; Oak Seed 40%; Apple, Wheat Seed 25%; Copper Ore 25%; Beeswax Comb 5% |
| Goblin | 1 life | 12 s | Bones; Copper Ore 30% (each drop rolls on its own, TL-10) |
| Goblin Chief | 2 lives | 12 s | Copper Ingot 1–2, Bones; Beeswax Comb 25% |

### Recipes (all level 1 unless noted)

| Where | Recipe | Cost → result | Time |
|---|---|---|---|
| Wood Foundation | Build Workbench / Build Cooking Pot | 5 Oak Wood | 15 s |
| Stone Foundation | Build Furnace | 5 Stone | 15 s |
| Stone Foundation | Build Fighter's Academy | 10 Stone + 10 Oak Wood | 15 s |
| Farmland | Plant Wheat Field / Plant Apple Orchard | 1 Wheat Seed / 1 Apple Seed | 15 s |
| Workbench | Charcoal | 2 Oak Wood → 1 Charcoal | 12 s |
| Workbench | Torch | 1 Oak Wood + 1 Charcoal → 1 Torch | 12 s |
| Furnace | Copper Ingot | 4 Copper Ore + 1 Coal → 1 Ingot | 16 s |
| Furnace + Anvil nearby | Copper Nails | 1 Ingot + 1 Coal → 2 Nails | 16 s |
| Furnace | Copper Pickaxe (lvl 2) | 4 Copper Ingot → a Pickaxe Token beside the Furnace (TL-8) | 12 s |
| Cooking Pot | Shrimp | 1 Raw Shrimp + 1 Charcoal → 1 Shrimp | 16 s |
| Cooking Pot | Apple Juice | 4 Apple + 1 Charcoal → 1 Apple Juice | 16 s |

## 5. What changed from before

- **Gold is gone.** Everything is priced in items (SP-65).
- **The Vault, Tray, Managers and Map bursts are gone.** Tokens live only on the mat, and a Token a
  station makes is placed beside it (TL-8).
- **Recruits hold nine skills:** Construction, Farming and Explore are new. Promotion keeps all nine
  (TL-7).
- **Tools are not needed** to gather (TL-2). Tools as hero equipment is later work.

## 6. Known issues and limits

- **Heroes can't be steered between tasks of one skill.** With several vein kinds, or trees next to
  a Foundation, in one flag's range, a hero may work one kind and ignore another. Space things out,
  or use the flag's per-skill rules.
- **Loot waits on the mat** until you hover over it (TL-9). An idle mat fills with loot, and the
  Shop counts loose loot as "have".
- **Descriptions are generic.** The CMS writes Token descriptions automatically and doesn't know the
  new blocks, so spawners read "Operates passively without requiring a hero." and some Tokens read
  "A token for the guild playmat."
- **Combat numbers are soft on purpose.** At full strength a level-1 Goblin beats a fresh Recruit,
  so Goblins and Chiefs are scaled down (`budgetScale` in the CMS). Enemy *level* barely changes
  toughness today.
- **Two old Tokens now do nothing:** the Copper Ore Minecart (it was a Manager) and the Map Tokens
  other than the Oak Forest Map. They are unsold, and only reachable through old content.
- **Some things don't speed up with *Advance timers*:** loot collection and auto-collect, status
  effect expiry and quest cooldowns run on the real clock.
- **Recipe levels on ordinary stations aren't enforced.** Only a Foundation's recipe level is.
- **Placeholder art:** the Goblins use skeleton sprites, and the Stone Foundation uses the loose-ore
  sprite.
- **Promotion gaps (until the skills overhaul):** no promoted job is designed around Farming or
  Explore, and the Warlord has no signature skill.
- **The economic simulator is out of date** for the new content (unpriced items, Map passes). It
  doesn't affect play.
