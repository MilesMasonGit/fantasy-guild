# Token & Map Content Notes

**What this is.** Until the CMS rework's Phase 0 (CMS-82), Token and Map
definitions lived as hand-authored JavaScript in
`src/config/registries/tokenRegistry.js` and `mapRegistry.js`, carrying ~190
lines of inline design commentary explaining *why* each number was what it was.
Phase 0 moved the definitions into `data/tokens.json` and `data/maps.json` so
the CMS can author them. JSON has no comments, so the commentary moved here
(CMS-88).

**Status of the content itself.** Per CMS-4, the shipped Token/Map content is
hand-authored placeholder to be re-authored inside the CMS. **The rules in
Part 1 and Part 4 are binding and outlive the content; the worked examples in
Parts 2, 3 and 5 explain numbers that the CMS will retune, so treat them as
reasoning to honour, not as figures to preserve.**

Decision references (`D-nnn`, `G-nn`) point at
[`playmat_decisions.md`](playmat_decisions.md).

---

## Part 1 — The Token authoring rules

These are the durable half. `ContentRules.test.js` enforces rule 1
mechanically; the rest are honoured by authoring discipline.

1. ⚠️ **Every material must have at least one TOOL-FREE source** (D-213).
   Tool-gating downgraded D-51's promise that supply deadlock is
   *structurally* impossible to merely *authored*: a player who burns their
   last axe with no logs banked could otherwise hard-lock. A barehanded route
   back must always exist. `ContentRules.test.js` asserts this rather than
   trusting the eye — it is the only thing preventing the lock.
2. ⚠️ **Every Passive Generator is strictly worse than its staffed
   equivalent** (D-116, risk 11) — worse output per tile, checked explicitly.
   If an unstaffed Token ever beat a staffed one, the optimal board would
   become mostly unstaffed and heroes would stop being the ceiling, which
   unpicks D-115, D-181 and §6.2 at once.
3. **Creates-from-nothing is free; transforms cost** (D-97, risk 10). No rule
   enforces this — inputs are a per-Token property with no category rule — so
   consistency is the only kindness available to a player who has no principle
   to reason from and must learn each Token individually.
4. **Cycle times stay in D-164's 10–30s band.** With eight heroes working this
   is roughly one completion every two or three seconds across the board: an
   unhurried rhythm where every drop still registers.

### Every number is hand-authored (D-161)

Yield, cycle time, uses and input costs are set **individually per Token**.
There is no tier formula and no curve. This is the expensive option, chosen
knowingly: every Token gets its own character, at the cost of hand-tuning
roughly 60 of them eventually.

### Tiers are not versions of each other (D-178)

There is no Oakwood Grove → Uncommon Grove → Rare Grove ladder. There is a
Grove, and separately a Yew Stand, and separately a Heartwood — related things
with their own behaviour and reasons to exist. A per-Token ladder would have
tripled the authoring load under D-161, and it is exactly the "same thing with
a bigger number" that D-175 removed rarity's power to say.

### The three independent axes (D-175, D-176, D-95)

```
RARITY  →  how often you find it   (drop frequency, nothing more)
CHARGES →  how long it lasts       (per-Token, independent of rarity)
THEME   →  how strong it is        (Woodland < Riverlands)
```

Rarity is **not** a power tier and must never become one. A Common Riverlands
producer far outproduces a Rare Woodland one — that is the design working.

### Use counts are a statement about unattended runtime

`5000 uses × 12s ≈ 16 hours`; `2200 × 25s ≈ 15 hours`. That is the number that
matters for the AFK story, and it is why support Tokens wear so much faster
than producers: a Mould at 60 uses is the thing that runs out first and sends
you back to the Cartographer.

### The execution config

```jsonc
config: {
  skill: 'nature',          // which skill gates and gains from it
  skillRequired: 1,         // ACCESS (D-67) — the only hero property that
                            // reaches the board; Speed and Efficiency are
                            // deferred (roadmap G-1)
  cycleTimeMs: 12000,
  xp: 4,
  inputs:  [{ itemId, quantity }],          // pulled from the Bank automatically (D-24)
  outputs: [{ itemId, quantity, chance }]   // or { currency: 'gold', ... }
}
```

**`requiresHero` defaults to true** (D-53). A Token with **no `config`** is
inert by design: Context, Buff and Manager Tokens work by being adjacent to
something, not by running.

⚠️ **`isTool: true` marks a context Token as a GATE rather than a recipe.** The
distinction is D-18 versus D-213: a Mould defines *what* a station makes, a
tool decides *whether* a resource can be worked at all. Rule 1 only counts
tools, which is why a Mould-gated ingot is fine and an axe-gated log is not.

---

## Part 2 — The Woodland kit (Map 1, the starting theme)

### Resource producers — create from nothing, cost nothing (D-51)

These are the economy's floor and its recovery guarantee: a chain that runs dry
always restarts from the bottom, so no escape-hatch mechanic is needed anywhere
in the game.

- **Yew Copse** — ⚠️ the tool-free route to Yew Log (rule 1). Slow and thin
  next to the axe-gated Yew Stand, and that is the entire point: the barehanded
  way back is never *good*, it just always exists.
- **Yew Stand** — three times the Copse's yield in three-quarters of the time,
  but it does nothing at all without an axe beside it.
- Whether a resource needs a tool is a **per-Token property**, deliberately not
  a category rule — the same register D-97 sets for input costs. Some seams
  yield barehanded; some stands need an axe.
- Access, and only access (D-67), is the one hero property that reaches the
  board this pass. A level-1 hero is refused outright rather than being slow,
  because Access is a gate and Speed is deferred (G-1).
- **Bramble Patch** — ⚠️ moved off Map 1 (D-261). Foraging folded into
  `nature`, a Ranger's specialist; no Recruit holds it, and the first Map may
  demand only the Foundation six.

### The Foundation six all need something to work (D-193)

Mining, Logging and Smithing were already covered on Map 1. Fishing, Crafting
and Cooking were not — Fishing had one Token on Map 2 only, and the other two
had none anywhere in the game. A Recruit holding a skill with nothing to work
is a skill that can never level, so three Tokens exist to close that.

⚠️ **Deliberately plain.** The skill list is a first draft; these are sized to
prove the system runs, not to be good content. Expect to redo them.

- **Trout Stream** — water never depletes (the premier low-maintenance
  gathering node), so this is the one Map 1 Token with unlimited charges.
- **Workbench** — sits downstream of BOTH other Foundation makers: wood from
  Logging, ingots from the Smelter. That makes Crafting the first place two
  chains have to meet.

### Passive Generators (D-116)

⚠️ **Strictly worse per tile than the staffed equivalent**, on purpose and by a
wide margin: the Grove makes 2 Oak Wood every 12s staffed (0.167/s); the
generator makes 1 every 30s (0.033/s), a fifth of the rate. Tiles are abundant,
so anything closer would make the optimal board mostly unstaffed and heroes
would stop being the production ceiling.

### Stations — transforms, so they cost (rule 3, D-97)

- **Woodland Still** — ⚠️ moved off Map 1 (D-261). Alchemy is the Alchemist's
  specialist, so no Recruit can work a Still; it belongs with the Riverlands
  Alembic.
- **A deep consumer** needs FIVE where the Still needs two. ⚠️ This pair is
  what makes **risk 13** measurable — under sustained shortage, D-127's
  first-come allocation starves the *expensive* chains first, which is the
  opposite of the pressure §6.2 intends. `InputAllocator.getStarvationStats`
  counts it so the balance pass has data rather than a hunch.

### Context-driven stations (D-18)

**Adjacency's real job is definition, not amplification.** A Smelter with a
Mould beside it makes ingots; the same Smelter with nothing beside it makes
**nothing at all**. That is binary and decisive, and it is what makes placement
matter more than any buff number does.

- **The Forge chain** is the deepest Woodland chain and the most profitable:
  ore and wood in at the bottom, a 48g sword out at the top. **Items are worth
  more used than sold** (D-128) — this is that rule as content rather than as a
  slogan.

### Context Tokens — recipe-defining

Not tools. These decide **what** a station makes, never whether it can run —
which is why rule 1 does not count them. They wear once per cycle they SERVE
(D-126), so one Mould driving three Smelters wears three times as fast: sharing
is a rate trade, not free value (D-157).

### Context Tokens — TOOLS (D-213)

⚠️ `isTool` is what rule 1 counts. A tool decides **whether** a resource can be
worked at all, so a material reachable only through one is a material a player
can be locked out of.

### Buff Tokens (D-119/D-120)

⚠️ Numbers here are deliberately **tiny**. A typical buff nudges output a few
percent; real power comes from acquiring a better Token, never from stacking
modifiers. Stacking stays uncapped precisely *because* the effects are small —
eight Sawmills give +40%, not +400%. If that ever reads as large, the numbers
have drifted, not the rule.

Token buffs are inert while their target is idle; hero buffs always apply
(D-152) — a Campfire helping a resting hero is exactly when healing matters
most, and it is what makes retreat-and-recover a real tactic.

- **Shrine** — D-82: repetition would be degenerate here, so duplicates do not
  stack.

### Managers (D-35, D-104, D-140)

Type-specific, covering the 8 adjacent tiles, and **never depleting** — a
restocker needing restocking would be exactly the chore it exists to remove.
Managers are rare finds, which is what makes automation something bought
cluster by cluster rather than all at once.

Enemies are NOT a special case (D-104): they deplete like resources, restock
like resources and automate like resources. One economic model covers the whole
board.

### Markets (D-141)

A Token whose **output is currency**, goods-specific with an input list like
anything else.

**The rule (owner, 2026-08-20): a Market pays roughly a 20% premium over the
Bank's sell price for the same goods.** The premium buys the tile, the hero and
the logistics; it is deliberately modest, because a Market that beat crafting
would make every chain pointless.

⚠️ **Corrected 2026-08-20.** An earlier version of this rule — "a Market's gold
output must stay under 3× the raw value of its inputs, a limit of 30" — was
never set by the owner and should not be designed against. The worked example
that used to sit here (10 Oak Wood → 20g raw, 34g from the Market) is a 70%
premium, not 20%, and in any case describes content that is no longer authored:
**there is currently no Market Token at all**, and every item in
`data/items.json` has `sellPrice: 1`. Retune to the 20% rule when a Market is
authored.

⚠️ **Markets demand Commerce, the Merchant's exclusive signature** (D-259),
which sits two promotions deep. **Map 1 therefore ships no Market at all**
(D-263) and the Lumber Market moves to the Riverlands kit — D-139's "every kit
contains a Market" now reads "every kit from Map 2 on".

The opening economy runs on raw selling instead: `CommerceSystem.sellItem`
moves goods from the Bank at base value with no hero, no Token and no skill. A
Market is the *premium* path, not the only one — and promoting the first
Merchant becomes a genuine economic turning point.

### Enemies

These run on the 7-stat combat engine, not a work cycle. **Fighting one is a
cycle** for every board system outside combat (D-129), so adjacent support
wears per kill exactly as it wears per craft, and enemy Tokens deplete like
anything else (D-104).

**Inert until targeted** (D-14): they never initiate and never aggro, so an
unstaffed enemy tile does nothing at all.

⚠️ **Only four enemies are usable as content**, and it is not the four you
would guess. `enemyRegistry.js` defines eighteen, but every one of them drops
LEGACY item ids (`thorn_vine`, `boar_tusk`, `leather`) that do not exist in
`data/items.json` — so a kill would resolve to nothing at all. The four in
`data/enemies.json` are the only ones whose drop tables point at real `item_*`
ids. Authoring against the others is a silent no-loot bug, not a compile error.

### The Woodland Mythic

⚠️ Note the charges: **rarity says nothing about how long a Token lasts**
(D-176). A Mythic with a use count is the clearest way to say so. Unique on the
*board*, not to own (D-177) — spares are spares.

---

## Part 3 — The Riverlands kit (Map 2, deliberately thin — G-12)

It exists for one reason: to make the **price step** and the **strength/demand
jump** real. Without a second price point, the whole progression model is
untested and the 200g → 2,000g curve is a guess.

⚠️ **Later Maps yield Tokens that are stronger AND more demanding** (D-95).
Power growth alone would just mean swapping Tokens and having spare tiles;
because later content also costs **more board** — deeper chains, more inputs,
higher skill floors — the player faces a real choice about what to run. Map 2
must demonstrate that, not merely cost more.

Compare: an Oakwood Grove is 4g of wood every 12s at skill 1. A River Delta is
40g of fish every 20s at skill 14 — six times the value per second, behind a
skill wall a starting hero cannot clear.

- **Silt Dredge** — tool-gated, and the tool is Riverlands-only. Copper Ore
  still has its barehanded Woodland source: rule 1 holds **across** themes, not
  within them.
- **Alembic** — the demand half of D-95 made concrete: two Riverlands producers
  feeding one station, at a skill floor no starting hero can reach. Three tiles
  and three heroes for one output stream, where Woodland's Still is one tile
  and one hero.
- **River Market** — 4 Draughts sell for 120g raw; the Market pays 150, a 25%
  premium, close to the 20% rule above. ⚠️ Not currently authored.
- **Drowned Prospector** — the last of the four usable enemies. Its copper
  drops sit naturally beside the Silt Bed, the other Riverlands source of ore.

---

## Part 4 — Maps

### The curve: steps between themes, flat within one (D-166)

**A theme's price never rises, however many times you buy it.** This is what
lets one curve do two jobs without them fighting:

- **Restocking stays cheap and predictable forever.** A player grinding
  Woodland Maps for supply is never punished for it.
- **Advancing to the next theme is a genuine saving-up**, and the gap reads as
  a milestone rather than a slightly larger number.

Rising-per-purchase pricing was rejected: it discourages spamming one Map, but
makes restocking progressively punishing, which is directly against the supply
role D-153 gave Maps when it retired packs.

**The prices** (owner decision 2026-08-06): Woodland 200g, Riverlands 2,000g —
flat within a theme, ×10 between them, calibrated against roughly 1,200 g/hr
for one hero on an Oakwood Grove selling raw output. **Tune the numbers freely;
do not make the price rise within a theme.** That half is the rule, not the
number.

### A Map's pool is a complete kit (D-139)

Producers, their Context Tokens, their Buff Tokens, **their Manager**, and the
enemies that belong there. Buying a Map is buying access to a self-contained
set — a strategic commitment rather than a lottery ticket, and one purchase
eventually yields everything needed to run that theme properly, including the
automation that lets it survive unattended.

**A Map's loot pool is the only meaning "biome" has.** There are no biome
systems, bonuses or mechanics anywhere in the game. Names are flavour.

### Maps sit outside the rarity system entirely (D-132)

Never Common, never Mythic: always consumable, always bought, never placed to
produce. `weight` is drop frequency **within this pool**, which is what rarity
means now (D-175) — it is not a power tier.

A Map is a Token only so it can sit in the Tray and on a tile; `mapId` points
at the catalogue in `data/maps.json`, mirroring the way enemy Tokens carry
`enemyId`.

⚠️ **`uses: 1` is what makes a Map a single burst** (D-155). Multiple charges
would make it squat on a tile and read as a dispenser rather than a package,
which loses the pack-opening moment entirely.

### Map costs

Mainly gold plus a SMALL material component (D-100). Materials are pulled
automatically from the Bank (D-150) exactly as Token inputs are — one
consistent way the game consumes items, and no inventory management on a
purchase.

---

## Part 5 — Pool weighting notes

### Woodland pool

- **Producers first, and weighted highest**: a Map that mostly hands out
  support Tokens reads as a bad Map however good the support is.
- ⚠️ **Every Token here must be workable by a Recruit** (D-261) — the first Map
  may demand only the Foundation six. The Bramble Patch (Nature) and the
  Woodland Still (Alchemy) moved to the Riverlands pool for exactly that
  reason, and the Trout Stream / Workbench / Stew Pot exist so Fishing,
  Crafting and Cooking have anything to work at all.
- ⚠️ **The axe is what makes the Yew Stand work at all** (D-213), so it is
  common on purpose. A kit that sold the gate more rarely than the thing it
  gates would read as broken rather than as scarce.
- **Buffs** — small effects, so they can be frequent without mattering much
  (D-119/D-120).
- **Enemies** belong to their theme like anything else (D-139).
- **The automation** is the reason one Map eventually runs a theme unattended.
  Rare finds, so buying it is a long-run reward.
- ⚠️ **No Market in this kit** (D-263) — see Part 2's Markets section.
- **The Heartwood**: one copy ever placed, and vanishingly rare to find
  (D-177).
- **A little raw material**, so a burst is never entirely Tokens.

### Riverlands pool

- The Berry Bush, Woodland Still and Lumber Market are **inherited from the
  Woodland kit**, which may only demand the Foundation six (D-261). All three
  want specialist skills, so this is where a promoted guild starts finding a
  use for them.
