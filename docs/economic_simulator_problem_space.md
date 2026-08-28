# Economic Simulator — Problem Brief

> **Status:** v1, authored 2026-08-26 from a Q&A session with the project owner.
> Descends from decision **CMS-107** in `cms_rework_v2_decisions.md`, and from
> `solver_levers_brief.md`, which it supersedes as the brief for this work.
>
> **Audience:** an AI architect who will design how this simulator works. No prior
> knowledge of Fantasy Guild is assumed.
>
> **What this document is:** a statement of the *problem*, the *boundaries*, and the
> *acceptance criteria*. It deliberately does **not** propose an algorithm, a pipeline,
> or a lever policy. Designing those is the reader's job.
>
> **The job:** design a **simple yet effective economic simulator that plugs into the
> existing CMS**, working entirely within the restrictions in §5. Simplicity is a
> requirement, not a preference — this is a solo project and the tool has to be
> maintainable and understandable by one person who does not write code. A clever
> architecture that only its author can reason about is a failed one.
>
> **What the reader owes back:** an architecture that solves §6, respects §5, delivers §7, and can be
> demonstrated to satisfy §8.
>
> Items marked **OPEN** are unresolved and flagged for the project owner.

---

## 1. The game in five minutes

Fantasy Guild is an **idle/incremental game**. The player runs a guild on a **7×7 board**
(the "playmat") of 49 tiles.

**Tokens** are the core object. A Token sits on a tile and does something:

| Kind | Behaviour |
| :--- | :--- |
| **Resource** | Creates items from nothing on a repeating work cycle |
| **Station** | Consumes items and produces others |
| **Context** | Defines what an adjacent station makes; produces nothing itself |
| **Buff** | Nudges an adjacent Token's numbers |
| **Manager** | Restocks its neighbours automatically |
| **Market** | Consumes goods, outputs gold |
| **Enemy** | Fought rather than worked; drops loot |
| **Triggered** | No work cycle — reacts to events on a cooldown |

**Heroes** staff Tokens. A hero is a *gate*: most Tokens need one present, holding the
required skill at the required level. Hero level does not affect speed or output — that
is deliberately deferred.

**The core loop:**

1. Buy a **Map** from the Cartographer for gold plus a small material cost.
2. The Map **bursts** into exactly **3** things drawn from its weighted pool — Tokens and
   raw items.
3. Place Tokens, staff them with heroes, arrange them so context and buffs line up.
4. Tokens run work cycles, producing items onto the board.
5. Sell items for gold, or feed them into deeper production chains.
6. Buy more Maps.

**Two facts that shape everything:**

- **Tokens are consumable.** Almost every Token has finite **charges**, spent per
  completed cycle. When they run out the Token is gone. Maps are therefore the ongoing
  supply line, not a one-off purchase.
- **Adjacency does three jobs at once.** It defines recipes (a Smelter with an Ingot Mould
  beside it makes ingots; with nothing beside it makes *nothing*), applies buffs, and
  enables upgrades. Placement is the main strategic decision.

Skills run **1–99**. "Late game" should begin at roughly **one month** of normal play.

---

## 2. Why this tool exists

Content is **hand-authored per Token, with no tier formula** — decision **D-161**, taken
deliberately so each Token has character. The cost is that ~60 Tokens, and every item
they touch, need individually chosen numbers, and hand-authored numbers do not scale or
stay consistent with each other.

The developer is a **designer, not a mathematician**. They want to express *intent* —
"this one is slow but rich," "this one is a rare find," "this one is for training, not
profit" — and have the system work out the numbers that make that intent true and
consistent with the rest of the economy.

---

## 3. The developer's two control surfaces

This is the shape of the tool as the developer wants to use it. The architecture must
serve this workflow.

### 3.1 The Simulator Panel — per Token, and per Recipe

Attached to each Token — and to each Recipe — in the CMS. The developer sets **qualitative guidelines**, not
numbers:

- **Tempo** — how fast the work cycle feels (Fast / Medium / Slow / Heavy). A tempo is a
  *range*, not a fixed number, and the range **shifts with level**: high-tier work feels
  weightier, so a level-70 "Fast" task is slower in absolute seconds than a level-1 "Fast"
  one. The sim picks the exact cycle time inside that range. Most tempos sit in the 10–30s
  band; the heaviest can run far longer (§5).
- **Rarity** — how often this Token turns up in Map bursts (Common through Mythic). The
  developer tags the tier; **the sim computes the actual draw weight.**
- **Purpose** — what this Token or Recipe is *for*. Three choices, and this tag is
  load-bearing: it decides **which target the derivation aims at**.
  - **GPH — gold per hour.** Earning is the point. Makes trade goods, or a special item or
    Token worth real money.
  - **XPH — XP per hour.** Training is the point. Gold may be low or negative.
  - **IPH — items per hour.** *Volume* is the point. Produces large quantities of things
    that feed deeper chains; individual units are cheap by design.

  **This applies to Recipes as well as Tokens.** A Recipe is not a Token, but it is tagged
  and balanced the same way — some recipes exist to train, some to churn out material, some
  to produce one valuable thing.
- Plus the creative identity the developer authors anyway: name, theme, skill and level
  requirement, which items come out, charges, input requirements.

### 3.2 The Global Dashboard — whole-game dials

A small set of dials governing the shape and tempo of the entire economy. The developer
turns one and the game re-balances around it. Candidates:

- Overall profitability / return on a Map purchase, and how that changes across levels
- Allowed variance — how swingy outputs are permitted to be
- How much better a staffed Token is than a passive one
- Crafting margin — how much value each processing step adds
- Tolerance band — how far off-target a number can drift before the system corrects it

**OPEN:** the full dial list is not settled. Proposing the right set is part of the
reader's job, constrained by: *a designer with no maths background must be able to
predict what turning each dial does.*

### 3.3 What comes out

From those two inputs plus the authored content, the system derives every remaining number
in the economy. The chief output, by a wide margin, is **every item's gold value** — that is
both the deliverable and the mechanism by which everything else balances (§4). Alongside it:
**the XP each Token and recipe awards**, and pool draw weights. What else it is permitted to
touch is the subject of §5.

---

## 4. Where value comes from

**Item value is the simulator's primary output and its primary balancing mechanism.**
Everything else in this document is secondary to it. If you take one thing from this
section, take that.

The developer never types an item's gold value, and does not want to. Deriving it *is* the
tool. The governing relationship, in the developer's words:

> "If a token produces 50 of an item per cycle, then that item should be very low value. If
> it produces one item an hour, that item should have a very high value. **This is where the
> evening out process exists.**"

### The primary mechanism: value absorbs yield

A Token's authored numbers — how many units, how often, how fast — are treated as **given**.
The item's value is then whatever makes that Token earn the target rate for its level:

```
                    target gold per hour for the Token's level
value(item)   =   ---------------------------------------------
                     units the Token produces per hour
```

This is the whole reason the tool works. **The simulator largely does not have to touch the
Token.** Whatever the developer authored — a lavish 50-per-cycle firehose or a single
precious drop — value flexes to meet it, and the authored quantity, chance and cycle time
survive. The developer's creative intent is preserved *because* value is the thing that
moves.

### But gold is an integer

**Gold is always awarded and expressed in whole numbers. An item's value is an integer.**
This is not a rounding detail — it is the reason the other levers exist at all.

Work the example. A Token yielding 3 units per 20s cycle produces 540 units/hour. Against a
1,200 g/hr target at level 1, the ideal unit value is 2.22g. But the only choices are:

| Item value | Actual GPH | Miss |
| :--- | :--- | :--- |
| 2g | 1,080 g/hr | −10% |
| 3g | 1,620 g/hr | +35% |

Neither lands. There is nothing between them.

The severity is **worst where values are lowest**, which means **worst in the early game**.
At a value of 2g the smallest possible change is +50%. At a value of 4,000g the smallest
possible change is +0.025% and value behaves as if continuous. So the simulator faces a
genuinely different problem at the bottom of the curve than at the top, and an approach that
works at level 70 may be useless at level 1.

**This is why value alone cannot do the job**, and why quantity, chance and cycle time have
to be available to close the remaining gap — not as a fallback, but as a routine part of
landing an early-game Token in its band.

### Where value stops being available

Value is a scalar. **Each item gets exactly one.** So the mechanism above works cleanly for
the *first* Token that defines an item's value — its **anchor** — and is spent from that
moment on.

Any *other* Token producing that same item inherits a value it did not set. Its earn rate is
now whatever the arithmetic says, and if that misses its band, the only remaining recourse is
to adjust the Token itself — quantity, chance, cycle time. That is the narrow, secondary
problem the lever policy in §6 P2 exists to solve.

**This is a common situation, not a rare one.** Multiple sources per item is a normal
feature of the design (§9), not an edge case to handle as an afterthought.

### Three quantities, and what each one is for

It is easy to confuse these. They are separate, and each has one job:

| Quantity | Set by | Its job |
| :--- | :--- | :--- |
| **Token acquisition value** | Map price, sliced across the burst pool by rarity (CMS-44/48) | What one copy of a Token is *worth to obtain* |
| **GPH / XPH** | The earn-rate curve, per skill level | How fast a hero working that Token earns |
| **Item value** | Derived (above) | What makes the **ROI on the cycle** come out right |

So the Map-price chain runs *downward and stops at the Token*:

```
Map price (+ its material cost)
  -> total value one burst should be worth
  -> allocated across the pool by rarity     (rarer entry = bigger slice)
  -> cost to acquire one copy of a Token          <- it ends here
```

It does **not** continue down into item value. Item value comes from the yield-vs-earn-rate
mechanism above. The two meet at the **return on a Token**: what the Token cost to acquire,
against what it produces over its whole life.

Downstream of root items, value propagates through production chains with a margin per
processing step.

The genuine difficulty this creates is §6 P0.

---

## 5. Boundaries — what the simulator does not get to touch

**These are settled design decisions. They are constraints, not options. Do not propose
architectures that require re-opening them.**

| Ref | Constraint |
| :--- | :--- |
| **D-161** | Every Token's identity is hand-authored. No tier formula generates content. The system **corrects**; it does not **invent**. |
| **D-164 (revised)** | **10–30 seconds is the normal band, not a hard ceiling.** Most Tokens live there, and it exists for board rhythm — with eight heroes working it gives roughly one completion every two or three seconds. But **longer cycles are allowed and get rarer as they get longer**, including cycles of several minutes: a deliberate design space for high-reward work, or for work meant to be cut down by powerful late-game buffs. There is no fixed upper bound. *(Note: `ContentRules.test.js` currently hard-fails anything over 30s and needs relaxing to match this.)* |
| **D-175** | **Rarity means drop frequency only.** It is not a power tier. A Common Token may legitimately out-produce a Rare one. |
| **D-176** | **Charges are hand-authored per Token** and independent of rarity. `null` means unlimited. The field is **`charges`** — some records also carry a legacy `uses` field, which is dead and being removed; ignore it. |
| **CMS-14** | The system **auto-corrects without asking.** There is no review-and-approve step for routine corrections. |
| **CMS-16** | Recalculation is **on demand**, never live as you type. |
| **CMS-44/48** | Value derives from Map price — anchored in aggregate first, then allocated per pool entry by rarity. |
| **CMS-47** | Solving is **iterative until stable**, not a single top-down pass. |
| **CMS-51** | Enemy loot is judged on **lifetime value vs. acquisition cost, with no time dimension.** "How fast" is a deferred combat question. |
| **CMS-86** | An item with no derivation chain is a **critical error**, never a hand-typed number. |
| **CMS-103** | The rarity premium is strong: per-copy value is roughly inverse to draw weight. |
| **Map price** | Hand-authored per Map. This is the one number in the economy nothing else derives. |
| **CMS-104** | Unlimited-charge Tokens are valued via an assumed-lifetime dial. |
| **CMS-108** | The Map anchor uses gold **plus** material value, knowingly accepting the circularity this creates. |

### Gold flows one way

**The player can sell items, but cannot buy them.** Gold leaves the economy only through
Maps. There is no vendor to buy an item back from, so there is no route to purchase an
input, craft it, and sell the output at a profit. This removes an entire class of
arbitrage exploit by construction — but it also means **the only gold sink in the game is
Map purchases**, which puts more weight on getting Map pricing and return right.

### Ownership is absolute

**Anything the simulator derives, the simulator owns.** There is no pinning, no hand-typed
override of a derived value, no per-value escape hatch. The developer's stated position:

> "If a value is derived by the simulator, the sim owns it fully. I don't want to touch or
> tinker with individual values. My control can come from giving the token a different
> purpose, or rarity, or the skill requirement."

This is a hard requirement, not a preference. If a result is wrong, the fix is a different
tag or a different dial — never a different number. Design accordingly: **the tags and
dials must be expressive enough to be the only steering wheel there is.**

### The authored/derived line

| Developer authors | Simulator derives |
| :--- | :--- |
| Map price (per Map, by hand — this is the anchor) | **Every item's gold value — the primary output and primary lever** |
| Map material cost | XP per cycle and per craft |
| Which Tokens are in which Map's pool | Draw weight of each pool entry (from the Rarity tag) |
| Charges | Drop quantity |
| Skill, level requirement, inputs, outputs | Min/max range — *only where one was authored* |
| Tempo, Rarity and Purpose tags (on Tokens *and* Recipes) | Exact cycle time, within the tempo band for that level |
| **Whether an output is variable at all** | Drop chance — *only where one was authored* |
| The global dashboard dials | |

### Variance is authored, never invented

**The simulator may not make a Token random.** If an output is authored at 100% chance and
a fixed quantity, it stays a metronome. The sim may adjust a chance or a min/max range only
where the developer already made that output variable — it can move the dial, it cannot
install one.

This is a feel decision and it is firm. **Read §6 P1 for what it costs.**

### Scope of the first version

In scope: **Resource, Station and Context Tokens, and Recipes.** Recipes are not Tokens but
carry the same Purpose tag (§3.1) and are priced and balanced the same way.

Deferred, and explicitly out of scope: **Enemy** loot tables (CMS-51 governs them, and they
have no time dimension), **passive/unstaffed** Tokens, and the modifier kinds — **Buff,
Manager, Market, Triggered**. The last group is deferred because they change *other* Tokens'
numbers, which would make every Token's real output depend on its neighbours.

*Note a wrinkle this creates:* `Wind Trap`, a passive Token, is one of the three sources of
Oak Wood. Deferring passives does not remove them from the multi-source problem in P5 — it
only defers deciding what to do about them.

### The single most important piece of context

The owner's framing, recorded as CMS-103:

> "Selling the tokens is really secondary. It almost doesn't matter what they sell for, as
> in optimal play the player is almost never selling tokens, always using them for their
> full value. I still want to give rarer drops a higher value so it feels right, but
> getting this slightly off really doesn't matter to gameplay."

**Precision on the sell side is not the goal.** It exists so a rare find feels right. The
numbers that matter are the ones governing whether a *production chain is worth running*.
Any proposal that buys sell-side accuracy at the cost of complexity elsewhere is a bad
trade.

### Known traps

Things that look like good ideas and have already been rejected:

- Deriving numbers from a tier formula (D-161)
- Making rarity drive power (D-175)
- Adding a time dimension to combat loot (CMS-51)
- A review-and-approve step for corrections (CMS-14)
- Live recalculation as you type (CMS-16)
- Optimising sell-side accuracy (CMS-103)

---

## 6. The problems to solve

### P0 — One number, two jobs

This is the central problem. Everything else is downstream of how it is answered.

**Item value appears in both of the economy's governing equations**, and satisfying one
decides the other:

```
gold per hour        =  item value  x  units produced per hour
lifetime return      =  item value  x  units per cycle  x  charges
return on a Token    =  lifetime return  /  Token acquisition value
```

Set item value so a Token hits its GPH target, and its lifetime return is thereby fixed —
whatever that turns out to be relative to what the Token cost from a Map. Set item value so
the return on a Token is right, and the GPH is fixed instead. There is one value and two
requirements.

The quantities that could absorb the difference are each spoken for:

- **Token acquisition value** comes from Map price sliced by rarity. Map price is
  hand-authored (the developer's), the rarity tag is the developer's, but **the slice itself
  is the simulator's** — so this has some give.
- **Charges** are hand-authored and the simulator may not touch them (D-176).
- **Units per cycle** is the narrow lever set of P1, and mostly unavailable.
- **The earn-rate curve** is a global dial, not a per-Token adjustment.

So the reader must answer: when a Token's GPH target and its target return cannot both be
met, **which gives, and what absorbs the difference?** And when nothing can absorb it, what
does the tool tell the developer to change?

Note that one case is already settled and is *not* a failure: a 25-charge Oak Tree and a
250-charge Oak Forest producing the same item at the same rate will have wildly different
lifetime returns, and that is intended (see P2). Any answer here must leave room for that.

### P1 — Which lever, and when? (non-anchor Tokens only)

**Scope this correctly.** For the *anchor* Token of an item there is no lever problem at
all — value absorbs whatever was authored (§4). This section is only about the **second and
third sources** of an item that is already priced — including, commonly, a *Recipe* that
crafts an item some Token also produces directly (§9).

For such a Token producing item *X*, earnings are roughly:

```
gold per hour  =  (value(X) x quantity x chance) / cycleTime x 3600
```

Four terms, four levers, all constrained:

| Lever | Nature | Constraint |
| :--- | :--- | :--- |
| **Value** | continuous | **Already spent.** This is the primary lever (§4), but it was used to price the item against its *anchor* Token. A second Token producing the same item cannot re-set it. |
| **Cycle time** | continuous (ms) | Constrained to the Token's authored tempo band for its level, not to a global ceiling. **Available, but the owner dislikes it — treat as a last resort.** |
| **Quantity** | small integer | Coarse: 1→2 is +100%, 2→3 is +50%. Min/max ranges are supported *and in use* (1–2, 1–4), giving finer expected-value steps. **Owner-preferred.** |
| **Chance** | continuous % | Fine-grained but **changes how a Token feels** — 100% is a metronome, 40% is a slot machine with the same average. Only available where the developer authored that output as variable (§5) — on a fully reliable Token it does not exist at all. **Owner-preferred** where it exists. |

The problem is a **policy**, not a single answer: which lever, in what order, under what
conditions, and how much may move at once. Does the answer differ by Token kind? By the
size of the correction? What happens when a lever hits its limit?

**Note how narrow what remains actually is.** Value is spent. Chance is only available on
outputs the developer already authored as variable, so on a reliable Token it is absent
entirely. That leaves min/max quantity ranges — finer than whole integers, and the owner's
preferred lever — and cycle time, which has real travel upward (§5) but is the lever the
owner least wants used.

This is survivable partly because it is a *minority* case: most Tokens are anchors and never
reach this code path. But **whether these levers can hold a tolerance band on the non-anchor
minority is an open question**, and answering it honestly is part of the job. If the
conclusion is that they cannot, say so and name what would have to give — a wider band for
non-anchor Tokens, a different choice of which source anchors, or authored variance on the
Tokens that need it.

Related and unresolved: **CMS-45 says an item anchors to its "cheapest acquisition path."**
Under the bottom-up mechanism in §4 it is not obvious what "cheapest" means, or that it is
the right choice — the anchor decision determines which Tokens get an easy ride and which
get squeezed through this narrow gate.

### P2 — What a Map must be worth

A Map's return is not a single target to hit. It is a **two-sided constraint**, in the
developer's words:

> "We need to ensure the raw sell value of the Tokens that drop from a map are significantly
> less than the cost of the map, to prevent the player from just buying maps and selling the
> tokens to make money. Likewise, we need to ensure that the total productive value of the
> tokens is more than the cost of the map, otherwise the player will lose money when they
> purchase a map."

So, for every Map:

```
sum of scrap sell value of the burst   <<  Map cost      (or buying-to-scrap is free money)
sum of productive value of the burst    >  Map cost      (or buying a Map is a loss)
```

**The gap between those bounds shifts with level: generous early, tighter later.** An
early-game Map returns a large multiple of its price — the player is awash with opportunity
and each Map plainly funds several more. As levels rise the *percentage* return compresses,
while the *absolute* profit grows enormously. A late-game Map costing millions still returns
far more gold than an early one in absolute terms, so high-tier Maps stay strictly optimal
and early Maps become irrelevant — but the tightening margin stops wealth compounding into
hyper-inflation.

**The actual numbers are the developer's to set by feel** (§7.2). What is needed here is the
*mechanism*: how the two bounds are computed and checked, how the curve between them is
expressed as a dial, and what the developer sees when a Map violates either bound. This is
the main profitability dial in the game, so it needs to be legible — turning it should do
something a designer can predict.

This interacts with the per-Token earn-rate band, because `lifetime value = earn rate ×
lifespan` and lifespan is set by hand-authored charges. Pinning one pins the other.

**One case is already settled.** A 25-charge *Oak Tree* and a 250-charge *Oak Forest* both
produce Oak Wood, so the Forest returns 10× the lifetime value. **That is intended.** The
Forest is a bigger, rarer find and should be worth far more; the sim reconciles it through
the draw weight — Forests are rare — not by making a Forest produce less per cycle. Do not
propose flattening lifetime returns across a pool.

### P3 — Circularity

A Map's price includes materials. Those materials are priced from Tokens found inside that
Map. A Map costing gold **plus 5 Oak Wood** cannot be priced until Oak Wood is priced, and
Oak Wood cannot be priced until the Map supplying its Token is priced. CMS-108 accepts this knowingly; CMS-47 requires iterating to stability. The
problem is guaranteeing that iteration **converges** rather than oscillating — especially
once results get snapped to integers or round percentages, which can trap the loop in a
two-state cycle that never settles.

### P4 — Discrete numbers vs. how it feels

The maths is continuous; the game is not. **Item values are integers** (§4) and quantities
are integers — you cannot output "1.37 Oak Wood," and you cannot price it at 2.22g. And two
Tokens with identical expected value can feel entirely different: 100% chance of 1 item is
a steady supply; 20% chance of 5 items is a stall that starves every station downstream of
it. Legibility matters too — authored values should stay round enough for a human to read
and reason about.

### P5 — Which source anchors an item?

Many items have more than one source, by design rather than accident — several Tokens may
gather the same material, and a **Token and a Recipe commonly produce the same item**, one
generating it directly and the other crafting it from inputs (§9). **Only one source may set
the value.**

That second shape is the awkward one: the two sources are not merely differently efficient,
they are *differently derived* (§4, §6 P6). Any anchor rule has to handle it. Every other source then inherits it and must be reconciled
through the narrow levers of P1.

Two things follow, and both are unresolved:

1. **Choosing the anchor is a real decision, not a technicality.** It determines which
   Tokens get an easy ride and which get squeezed. The existing rule (**CMS-45**: anchor to
   the *cheapest acquisition path*) predates the derivation model in §4 and it is no longer
   clear it means anything useful — nor that it is desirable, since a fast efficient source
   can price an item so low that the slower baseline Token becomes net-negative to run.
2. **The project owner has explicitly deferred this to the reader.** In their words: *"This
   is a good open question for the next agent to solve. I'm not sure what the best method
   would be."* Candidates raised and not chosen between: an explicit anchor tag the designer
   sets; the lowest-level or most common source; the source whose Purpose tag says so; or
   keeping CMS-45. **Propose one, and say what it costs.**

### P6 — Crafted value, and margins across long chains

A crafted item has two plausible prices: **inputs plus a craft margin**, or **whatever makes
the station hit its target**. These will not agree.

**The Purpose tag decides which target the derivation aims at.** A Recipe carries the same
GPH / XPH / IPH tag as a Token (§3.1), and it means the same thing: a GPH recipe exists to
produce something valuable, an XPH recipe exists to train a hero, an IPH recipe exists to
churn out volume cheaply. The rule aims at the tagged target.

That resolves the *ambiguity* but not the *tension*, and the follow-on questions are open:

- If an IPH recipe's items are cheap by design, and an XPH recipe's gold return is low or
  negative, **what stops a crafted item pricing below its own inputs** — making the craft a
  pure loss and the recipe pointless to run?
- Conversely, does a GPH-tagged recipe need a floor, a ceiling, or both?

Then the chain problem on top of it. `Ore -> Ingot -> Blade -> Sword`: each step costs hero
time, so each needs a margin. **The size of that margin is the developer's dial to set, not
a number to recommend** (§7.2) — what is needed is the mechanism and its failure modes. Too small and the player sells raw materials and never crafts.
Too large and margins compound across four steps until late-game crafted goods trivialise
everything else.

**Intermediate goods are not expected to be profitable to sell raw.** Nails and leather
strips pay off through the XP earned making them plus the finished product's margin. Only
complete end products need to clear a profit bar.

### P7 — XP

Every cycle produces both gold and XP. **XP is not an independent constraint** — it is
derived from the Token's level and its Purpose tag, so gold and XP targets cannot conflict.
An XPH-tagged Token or Recipe awards a lot of it; a GPH-tagged one awards modestly.

The open part is narrower: what relationship between level, Purpose and XP produces a
levelling pace consistent with **"late game begins at about one month of normal play"**?
That is the only stated pacing anchor in the game, and the XP curve is what delivers it.

### P8 — Rarity is doing two jobs at once

The Rarity tag now sets a Token's **draw weight**, and per CMS-103 per-copy value runs
roughly inverse to draw weight — so rarity also sets what a copy is **worth**, which feeds
straight into the value of the items it produces. Yet D-175 insists rarity is **not** a
power tier: a Common Token may legitimately out-produce a Rare one.

So the same tag must make a Token scarce and expensive without making it strong. Whatever
it *does* produce then has to be reconciled back into its level's earn-rate band by the
other levers. Pool composition compounds this: weights are relative, so tagging one Token
Mythic changes what every other entry in that pool is worth.

### P9 — Re-running without chaos

The developer will add one Token and press recalculate. If every price in the game shifts,
the output is unreviewable and the tool is unusable. Small authoring changes should produce
small, explainable diffs. Since there is no override mechanism (§5), an unstable result
cannot be patched by hand — it can only be re-tagged and re-run.

### P10 — Refusing well

Some authored combinations are simply impossible — an item must be worth 10g, but its Token
cannot cycle slower than 30s or drop less than one unit. The system auto-corrects without
asking (CMS-14) and the developer cannot hand-fix a value (§5), so knowing when to **stop**
and hand the problem back matters as much as its reach. A refusal must tell a designer who
does not read formulas which *tag or dial* to change — that is the only remedy available.

---

## 7. What to deliver

Five things. Written for a reader who designs games and does not write code — plain
language, worked reasoning, no unexplained notation.

### 7.1 The solving algorithm

The core of it: how item values get derived, how the iteration converges without
oscillating, which lever gets pulled when, how an item's anchor source is chosen, and what
happens at the boundaries. This is the irreducible ask.

### 7.2 Baseline curves

Numbers, not just shapes — the dials need somewhere to start, and the developer needs a
sane default to react to rather than a blank field.

**Earning and progression:**

- **Gold per hour by level, 1–99.** Existing content assumes ~1,200 g/hr at level 1 rising
  to ~176,000 g/hr at level 71+. Sanity-check that, complete it, and say whether its
  steepness is defensible.
- **XP per hour by level, 1–99**, tuned so that **late game begins at roughly one month of
  normal play** — the only stated pacing anchor in the game (§1).
- **Tolerance band width by level** — how loose "loose within a level" actually is, and how
  tight "tight across levels" actually is (§8, criterion 4). Integer gold (§4) means this
  probably cannot be one number for the whole curve.

**Token character:**

- **Tempo bands in seconds, by level.** What Fast / Medium / Slow / Heavy mean at level 1,
  at level 40, at level 90. Most sit in the 10–30s band; the heaviest may run far longer
  (§5).
- **Rarity tier to draw weight.** What weight a Common, Uncommon, Rare, Epic and Mythic
  entry gets in a burst pool, and how that interacts with pools of different sizes.
- **Rarity to value premium.** How much more a Rare copy is worth than a Common one from
  the same pool (CMS-103 says roughly inverse to draw weight — propose the actual curve).

**Deliberately *not* your numbers to pick.** Two dials are the developer's to set by feel,
and they want the mechanism without a recommended value: **the Map return curve** (P2) and
**craft margins** (P6). Design how they work, expose them as dials, explain what turning
them does — but leave the numbers to the developer.

### 7.3 UI specification for the two panels

What the **Simulator Panel** and the **Global Dashboard** (§3) actually contain: which
controls, in what arrangement, showing what feedback. Include what the developer sees when
the tool **refuses** something — since they cannot hand-fix a value (§5), a refusal has to
point at the tag or dial that would fix it.

### 7.4 Data schema changes

Precisely which fields are added to Tokens and Recipes, which existing fields become
read-only derived outputs, and how derived values are stored and regenerated. Concrete
enough to hand to whoever writes the code.

### 7.5 Build order

What to build first, what can be deferred, and where the natural checkpoints are — the
project runs in small self-contained sittings, so a plan that only pays off when finished
is not usable. Say what a minimal first version does and what it deliberately leaves out.

### On the boundaries in §5

Work within them. But if one of them genuinely makes the problem unsolvable, **say so
explicitly, name the smallest relaxation that would unblock it, and leave the decision to
the developer.** Do not quietly design around a constraint, and do not treat a wall as
permission to redesign the game. One such wall is already known: the 10–30s cycle rule in
`ContentRules.test.js` needs relaxing to match §5.

A worked example on real content is **not** required.

---

## 8. Acceptance criteria

The design is finished when it can be shown to satisfy these. Numbers marked (?) are
provisional and need owner sign-off.

1. **Completeness.** Every item in the database receives exactly one gold value, derived
   through a traceable chain. No item is orphaned (CMS-86).
2. **Termination.** Recalculation reaches a stable result — no infinite loop, no
   oscillation between two states — on the current content set and on a deliberately
   adversarial one.
3. **Speed.** A full recalculation completes fast enough to sit behind a button in the CMS.
   (?) target: **under 5 seconds** for ~60 Tokens / ~100 items.
4. **In band — loosely within a level, tightly across levels.** Two Tokens at the same
   level may differ from each other by a fair margin; that reads as variety, not as a bug,
   and given integer gold (§4) it is often unavoidable. What must hold tightly is
   **progression**: the average earn rate at level 20 sits clearly and consistently below
   level 30, which below level 40, all the way up the curve. The tool protects pacing, not
   per-Token fairness. Anything it cannot place is reported as a refusal with a reason.

   *(OPEN: the actual width of "loosely" and the tightness of "clearly below" are unset.
   Propose them.)*
5. **Maps are worth buying, and not worth scrapping.** For every Map: the burst's total
   scrap value is well under the Map's cost, and its total productive value is comfortably
   over it. (Buy-side arbitrage is impossible by construction — see §5 — so this is the
   whole of the "no free money" requirement.)
6. **Stability.** Adding or editing one Token changes a small, bounded fraction of existing
   values. (?) target: **under 10%**.
7. **Legibility.** Output numbers are round enough for a human to read: integer quantities,
   chances on sensible steps, cycle times not at odd millisecond values.
8. **Feel preserved.** The Tempo, Rarity and Purpose tags the developer set on the
   Simulator Panel are still recognisable in the result. A Token tagged Slow is slow; one
   tagged XPH trains noticeably faster than one tagged GPH. No Token that was authored as
   reliable comes out random.
9. **Rules hold.** `ContentRules.test.js` stays green. (Its cycle-band rule needs relaxing
   first — see §5 — but every other content rule stands.)
10. **No circular calibration.** No curve, band, weight or ratio is fitted to existing
    placeholder content (§9). Targets come from stated design intent, not from whatever
    happens to sit in `data/` today.
11. **Explainability.** For any derived number, the tool can show the developer where it
    came from in terms they can act on.

---

## 9. How the data is shaped

> ### Do not calibrate to existing content
>
> The Tokens, Items and Maps currently in `data/` are **placeholder, sparse, and not
> diverse enough to generalise from.** They are mid-re-authoring. Their counts, their price
> spreads, their cycle times and their yields are **not** evidence about how the game should
> be tuned — they are the arbitrary state of a half-built content set.
>
> **Do not fit any curve, band, weight or ratio to them.** The whole point of this tool is
> to *produce* good content data. Deriving the tool's own targets from bad data would close
> a circular loop and bake today's placeholders into the design permanently.
>
> Design the curves in §7.2 from first principles and from the stated design intent in this
> document. Existing content is shown below only so you know what the **records look like**.

### What a Token record looks like

```json
{ "name": "Copper Ore Vein", "tokenType": "resource", "rarity": "common",
  "requiresHero": true, "charges": 500, "xp": 10,
  "acceptedTokens": [ { "tag": "pickaxe", "minTier": 1 } ],
  "config": {
    "skill": "mining", "skillRequired": 1, "cycleTimeMs": 12000, "xp": 10,
    "inputs": [],
    "outputs": [ { "itemId": "item_copper_ore", "chance": 100,
                   "minQty": 1, "maxQty": 2 } ] } }
```

Useful things this shows, all of which are structural rather than content-dependent:

- **`rarity`, `xp`, `chance` and `minQty`/`maxQty` fields already exist** in the schema. The
  simulator is writing into a shape that is mostly already there.
- **A Token can be gated on adjacency.** `acceptedTokens` means this Token produces
  *nothing at all* without an adjacent Pickaxe. Adjacency is a hard gate, not a bonus.
- **Cycle time, skill and level requirement live on the Token**, alongside its outputs.
- Data lives in `data/tokens.json`, `data/items.json`, `data/recipes.json`,
  `data/maps.json`, and is loaded through the registries listed in §10.

### Structural facts worth knowing

These hold regardless of what content exists:

- **Maps cost gold *plus materials*.** That is what makes P3's circularity structural rather
  than incidental — a Map's price genuinely depends on the value of items found inside it.
- **An item can be produced by a Token *and* by a Recipe.** One generates it directly, the
  other crafts it from inputs. These two sources are not merely differently efficient, they
  are *differently derived* (§4, §6 P6), and this is a common shape rather than an oddity.
  Any anchor rule has to handle it.
- **A Context Token beside a Station decides which recipe runs.** Both use the Station's own
  cycle time.
- **Skills run 1–99.**

### The one number to check rather than trust

Existing configuration assumes an earn-rate curve of roughly **1,200 g/hr at level 1 rising
to ~176,000 g/hr at level 71+**. Treat this as an *inherited assumption to be sanity-checked*
(§7.2), not as a target to preserve. If a better-paced curve disagrees with it, propose the
better curve and say what changes.

---

## 10. Prior art

An earlier solver exists and **worked**, for a card-based version of the game that no
longer exists. Retained as reference, not as a verdict:

| File | What it did |
| :--- | :--- |
| `cms/src/engine/taskSolver.js` | Balanced entities against gold-per-hour targets by tuning **chance first**, falling back to **cycle time** at 0%/100%. Snapped chances to round numbers so authored values stayed legible. **This already implements one answer to P1 — read it before proposing something new.** |
| `cms/src/engine/valuePropagator.js` | Iterative value propagation from root items downstream |
| `cms/src/engine/evCalculator.js` | Gold and XP per minute |
| `cms/src/engine/connectivityAuditor.js` | Dangling-reference and unreachable-item detection |

Runtime side:

| File | Relevance |
| :--- | :--- |
| `src/systems/board/BoardRunner.js` | The cycle engine — shows exactly how quantity, chance, cycle time and modifiers combine at runtime |
| `src/config/registries/tokenRegistry.js` | Token definitions; output-range helpers |
| `src/tests/ContentRules.test.js` | Mechanically enforced content rules. **Any output must keep this green.** |

---

## 11. Recording the outcome

Results land as **new numbered decisions from CMS-109 onward** in
`cms_rework_v2_decisions.md`. CMS-107 (the unresolved lever-policy decision this brief
descends from) should be marked resolved and point at them.

House style for that log:

- State the decision as a claim, not a description of a discussion.
- Always record the **rejected** alternatives — the most useful part when revisiting months later.
- Name the cost being accepted, rather than presenting a choice as free.
- If a decision supersedes an earlier one, say so and leave the old one struck through.
