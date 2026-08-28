# Economic Simulator — Design Plan v1

> **Status:** draft v1.1, authored 2026-08-27, answering
> [`economic_simulator_problem_space.md`](economic_simulator_problem_space.md) (the brief).
> Revised the same day by a self-review pass (findings F1–F11, listed in §20) —
> the pass found one wrong claim (the progression guard, §13.5), three unhandled
> cases (Token-output recipes, enemies in pools, item entries in scrap
> allocation), and one fresh brief/code disagreement (burst size, §1).
> Written to be attacked — §18 lists where it is weakest.
> **v1.2, 2026-08-28:** fourteen owner rulings from a design interview are folded in —
> §21 is the ledger. The big ones: bursts are always exactly 3 with at least one Token
> guaranteed; Epic joins the rarity ladder; downcycling replaces the flat loop refusal;
> the earn curves are floors, not averages; and ranges become the authoring default.
> **v1.3, same day:** the interview's second half re-founded the XP pacing (a focused
> skill hits 99 in ~55 back-loaded hours; the one-month anchor is economic; the
> 800-hour trophy is maxing all 12 heroes) and captured the owner's starting values
> for the deliberately-owner-set dials (early Map return ~10×, late ~1.5×, scrap
> ~40% with no per-copy cap, craft margin ~15%).
>
> **Session decisions already taken by the owner (2026-08-27), which this plan builds on:**
> 1. The stale decisions **CMS-109–116** are struck wholesale; this plan's decisions land
>    as **CMS-117 onward** once the plan is approved.
> 2. The simulator's numbers assume a **worker at the Token's required level** (the
>    worker-speed bonus is real: +0.5% per skill level since the recipe rework).
> 3. A gold-per-hour target means **profit after input items only** — charge wear is
>    judged separately, by the lifetime-return check, never inside item prices.
> 4. "Normal play" means the board running and staffed **about 8 hours a day**.
>    ~~"Late game begins" was first read as main skills reaching ~level 70 at ~240
>    board-hours~~ — **corrected by the 2026-08-28 interview**: the one-month mark is
>    an *economic* milestone (top-tier Maps come into reach), while XP runs a faster,
>    per-skill track — one focused skill reaches 99 in roughly 50–60 board-hours,
>    and the true long game is breadth (§13.2).

---

## 1. Corrections to the brief (not applied to it, per instructions)

The Recipe & Charges rework (`1a13e2d`, v0.5.1) merged after the brief was written.
Per its handoff table (roadmap §5.2, ticket CR2-201), four claims in the brief are stale:

| Brief says | Game now |
| :--- | :--- |
| Hero level does not affect speed | A worker's **skill level scales work speed**: +0.5%/level (`SKILL_SPEED_FACTOR`), so a level-99 worker is ~1.5× faster than a beginner. This plan solves at the required level (session decision 2) and lets the tolerance band absorb over-levelling. |
| A Context Token decides which recipe a station runs | **The player selects the recipe** from a menu; context tokens are inputs that *gate* it. For balancing this is good news: each recipe is balanced individually, and the sim never has to guess which recipe "wins" a tile. |
| Recipes live in `data/recipes.json` | That file is deleted. The single source is `data/tokenRecipes.json`, a flat array keyed on skill. |
| A Station is a Token kind that "consumes and produces" | A station is now an authored **statement** carrying a skill; its pool is every recipe of that skill. Recipes also cost **charges** (station charge cost, context `chargeCost`, statement `chargeDelta`, where absent means −1). |

One disagreement found in review is now **ruled (owner, 2026-08-28): a burst is
always exactly 3 things, and at least one of the 3 is always a Token.** The code
currently draws 3–5 (`BURST_MIN`/`BURST_MAX` in `Cartographer.js`) with no
composition guarantee, and D-167's comment says "3–6" — both are now wrong and the
game-side fix is filed as its own task. The guarantee means a Map purchase can never
deal a dud of three raw items: the player's supply line always advances. For the
maths, the first draw renormalises over the pool's Token entries only; the other two
stay free weighted draws (§7).

Two more facts the brief doesn't carry:

- **The rarity vocabulary had four tiers** (`common, uncommon, rare, mythic` in
  `tokenConstants.js`), not the five the brief names. **Ruled (owner, 2026-08-28):
  Epic is added** — five tiers, §13.4's table as written. `TOKEN_RARITIES` gains
  `epic` in sitting 1 (§17), and `ContentRules.test.js` and the CMS dropdown pick it
  up through the existing CMS-5 machinery.
- **The brief quietly supersedes CMS-54** (pool weight as free hand-typed input): its
  authored/derived table moves draw weight to the derived column. This plan follows the
  brief; CMS-54 is proposed struck (§19, CMS-124).

---

## 2. The design in one page

The whole simulator is **one assembly line, run left to right, on demand**:

```
1. TIME     Pick every cycle time from its Tempo band.        (no values needed)
2. ANCHOR   Elect exactly one anchor source per item.          (no values needed)
3. PRICE    Walk the chain bottom-up: anchors set item values,
            crafted items price as inputs + purpose profit.    (each value set once)
4. TUNE     Every non-anchor source is tuned into band with
            the lever policy, or refused with a remedy.
5. CHECK    Maps: scrap total vs cost, productive total vs
            cost. XP: derived per cycle. Nothing changes here —
            failures become refusals.
```

The load-bearing property: **steps 1 and 2 don't depend on any value, and step 3 sets
each item's value exactly once, reading only values already set.** There is no feedback
loop from later steps into earlier ones. That is what makes convergence a property of
the design rather than a hope about iteration (§3.4) — the brief's oscillation problem
(P3) is dissolved, not damped.

The developer's two surfaces are exactly the brief's: per-Token/per-Recipe **tags**
(Tempo, Rarity, Purpose, plus an optional Anchor flag) and the **Dashboard dials**
(§14). Every number the sim writes is regenerated from authored intent on every run —
the sim never reads its own previous output, so re-running without editing anything
changes nothing (§11).

---

## 3. How value derivation works (deliverable 7.1, problems P0 and P3)

### 3.1 Step 1 — Time

For every Token and Recipe, the sim resolves the **Tempo tag** to an exact cycle time:

- Look up the tempo band for the entity's skill level requirement (§13.3).
- Take the **middle of the band**, snapped to whole seconds. That is the default and
  the sim only moves off it as the last-resort lever in step 4 — and then only inside
  the band, so a Slow token is always recognisably slow (acceptance criterion 8).

Units-per-hour for each output then falls out arithmetically:

```
units/hour = avg quantity × chance ÷ cycle time × 3600 × speed(required level)
```

where `speed(L) = 1 + 0.005 × L` — the worker-at-required-level assumption. A hero
20 levels over the gate earns ~+10% over target; the tolerance band (§13.5) is wider
than that on purpose.

### 3.2 Step 2 — Anchor election (problem P5)

**Rule: an item's anchor is its lowest-level source; ties break to the more common
rarity, then Token before Recipe. A designer can override with an explicit Anchor
flag on one output. Passive and deferred Token kinds can never anchor.**

Plain-language story: *an item is worth what its everyday source makes it worth.* The
lowest-level, most common producer is the one most players meet first and the one that
must never be net-negative to run. Anchoring there preserves the baseline Token's
authored feel perfectly (§4 of the brief: value absorbs its yield), and pushes the
tuning burden onto rarer, higher-level sources — which are exactly the ones with room
to be tuned, and whose per-cycle generosity is *supposed* to differ (the Oak Forest
case).

Why the alternatives lost:

- **CMS-45's "cheapest acquisition path"** is circular (cheapest in what currency,
  before values exist?) and, when the earlier pass tried it, elected a Mythic firehose
  as anchor and squeezed the common grove toward impossible yields. Proposed struck
  (§19, CMS-119).
- **Always-explicit anchor tag**: maximum control, but ~100 items × one more mandatory
  decision each is authoring drag, and a forgotten tag is a refusal. Kept as the
  *override*, not the rule — the default rule needs no thought and the flag exists for
  the cases where the designer disagrees with it.
- **Purpose-tag-decides**: collapses when two sources share a Purpose, and entangles
  "what is this Token for" with "who prices this item", which are different intents.

**Stickiness (problem P9):** once elected, an anchor is *stored* and kept on later runs
even if a new, lower-level source is added. The new candidate produces an **Info row**
("Willow Sapling would now out-rank Oakwood Grove as Oak Wood's anchor — click to
re-elect"). Re-electing is one click and re-prices the item's whole chain; not
re-electing costs nothing. This is the single deliberate exception to "the sim never
reads its own output", and it exists to satisfy acceptance criterion 6: adding one
Token must not silently re-price a chain.

**Where the election lives (F4):** it *is* the `valueSource` field the sim writes on
each item (§16) — one field doing both jobs, provenance and standing election. Because
it syncs with the data, elections survive a CMS store reset and round-trip like any
other content; a wiped CMS never causes a silent mass re-pricing.

**The Wind Trap wrinkle** (brief §5): a passive Token can produce an already-anchored
item; it simply never anchors, and — since passives are out of scope for v1 — it is
not tuned either. It appears in the audit as a deferred-scope Info row so it isn't
silently forgotten. An item whose *only* source is a deferred kind is a **Critical**
row (CMS-86: no derivation chain).

### 3.3 Step 3 — Pricing

Prices are set in **dependency order**: root items first (produced from nothing), then
each crafted item once all its inputs are priced. This is a topological walk of the
recipe graph. A genuine cycle in that graph (A needs B, B needs A) cannot be priced
bottom-up and is **refused** as a content error — see §12; the refusal names both
recipes — **with one deliberate exception, ruled in the 2026-08-28 interview:
downcycling.** A recipe flagged `downcycle` (smelting a sword back into some of its
ingots) is allowed to point backwards, because it never *prices* anything: every item
it touches already has a value, it can never anchor, and it stands entirely outside
the topological walk. Its derived numbers come from one rule — the total value of
what comes back is capped at the global **recovery ratio** dial (§14) times the value
of what goes in, and the sim derives output quantities to fit under that cap. Strictly
losing value on every pass is what makes a loop safe: gold cannot be duplicated by
construction, and one-way pricing stays intact because the return leg only reads
values, never writes them. Its XP derives normally (§8) — recycling is honest
training.

**Root items.** The anchor Token's target earn rate is:

```
target profit/hour = GPH curve(required level) × purpose factor(Purpose tag)
```

Purpose factors (dials, §14): GPH-tagged 1.0 — earning is the point. IPH-tagged 0.35 —
it feeds chains, so its gold rate sits well under the curve and its items come out
cheap *because the same target is spread across many units*. XPH-tagged 0.10 — it
pays in XP (§8), barely in gold.

Worth stating plainly: **the gold factor is the only thing that makes the Purpose tag
economically real.** Under value-absorbs-yield, a 50-per-cycle IPH firehose and a
1-per-hour GPH treasure would earn identically if their targets were the same — the
quantity difference washes out into the price. The tag's meaning *is* the target gap;
the "volume" identity comes from the authored quantity, which the sim preserves.

For a single-output anchor: ideal value = target profit/hour ÷ units/hour. Then the
integer problem (P4, and the brief's early-game example): the sim tries the two
neighbouring integers; if either lands the Token inside its tolerance band, done —
prefer the closer one. If neither lands (routine at values of 1–4g), the sim keeps the
*nearer* integer and closes the residual by tuning the anchor's own output with the
lever policy (§5) — this is the brief's "routine part of landing an early-game Token",
not a failure. Only if the levers also cannot close it does it refuse.

**Multi-output anchors** (the Trout Stream shape): outputs whose items are already
priced elsewhere contribute their inherited value; the remaining target is split
across the outputs this Token anchors, **inversely proportional to abundance**
(avg quantity × chance) — the scarcer output takes the bigger per-unit slice. This is
the same arithmetic the struck CMS-112 reached and the old `taskSolver.js` used for
its non-balanced outputs; it survives because it needs no new schema and reads
naturally ("the rare drop is the valuable one").

**Crafted items** (anchor is a Recipe — problem P6, resolved in §6):

```
value × units = input item value + target profit per cycle,   floored at
value × units ≥ input item value × (1 + craft margin per step)
```

Purpose picks the profit target exactly as for Tokens. Because purpose factors are
never negative, **a crafted anchor can never price below its own inputs** — the pure-
loss case P6 worries about is impossible by construction for anchors. (Non-anchor
recipes *can* run at a loss; §5 and §6 bound it.)

**Recipes that output a Token (found in review, F5): refused in v1, as a named
deferral.** The brief's GPH examples include "a special item *or Token* worth real
money", and the schema supports Token outputs — but pricing a Token-as-product needs
its *productive lifetime value*, which isn't known until after the tuning pass, and
that tangles the one-way ordering this design's convergence rests on. No shipped
recipe outputs a Token today (CR2-199), and CR2-200 separately shows the runtime path
would mint unlimited-charge Tokens for 14 of 39 definitions. Until both are designed
on purpose, a Token-output recipe raises a Critical refusal ("deferred shape —
outputs must be items for now"), which also fences off CR2-200's trap for free.

**What Map price does and does not touch.** Per the brief's §4: nothing above reads
Map price. Map price drives only the **acquisition side** — each pool entry's slice of
`(gold + material value) `, allocated by rarity (CMS-48, §9 here) — which supplies
Token scrap values (feel-only, CMS-103) and the return-on-Token check (§7). Since
material values are item values, and item values are fully settled before this step
runs, CMS-108's circularity costs one extra sequential pass, not an iteration.

### 3.4 Why this converges (problem P3)

There is no loop to converge. Time and anchors are value-independent; pricing is a
one-way walk that assigns each value exactly once; tuning changes Token outputs but
never re-opens a price; the Map pass reads prices and writes nothing back. Integer
snapping cannot oscillate because nothing downstream of a snap feeds anything upstream
of it. The two places iteration *could* have appeared are closed deliberately:
recipe cycles are refused rather than iterated (§3.3), and anchor election is
value-independent by design (§3.2). Termination (criterion 2) is therefore a proof by
construction, and speed (criterion 3) is trivial — one pass over ~60 Tokens and ~100
items is milliseconds, far under the 5-second budget.

### 3.5 The P0 answer: which of the two jobs gives

**The gold-per-hour job wins. The lifetime-return job becomes a check, not a target.**

Item value is set so the cycle economics are right (above). A Token's lifetime return —
value × units × charges vs its Map-slice acquisition cost — is then *whatever it is*,
and the sim **reports** it rather than solving for it, because every quantity that
could make it solvable is spoken for: charges are the developer's (D-176), the earn
curve is global, and value is spent. The aggregate guard lives at the **Map level**
(§7): the burst's expected productive value must clear the Map's cost. When it
doesn't, that is a refusal handed to the developer with the three remedies that
actually exist — Map price, pool composition, or charges — never a silent adjustment.

This deliberately leaves room for the settled Oak Tree / Oak Forest case: two Tokens
with identical cycles and 10× different charges have 10× different lifetime returns,
and no per-Token return target ever flattens that.

---

## 4. What each pass writes

| Pass | Writes | Never touches |
| :--- | :--- | :--- |
| Time | `cycleTimeMs` on Tokens; `durationMs` on Recipes | anything outside the tempo band |
| Anchor | the stored anchor per item (+ provenance) | — |
| Price | every item's `value` (integer); Token scrap values | Map price, charges, authored identity |
| Tune | non-anchor outputs' derived qty range / chance; last-resort cycle time | reliability of a metronome Token (§5); the authored spread of a range |
| Check | XP per cycle; pool draw weights; audit rows | any price already set |

---

## 5. The lever policy (deliverable 7.1, problem P1)

Applies to any source that inherits a value it did not set — the second and third
Tokens on an item, and every non-anchor Recipe — plus anchors closing an integer
residual (§3.3).

**The band judges the whole Token, not each output** (clarified in review, F2): a
source is in band when its *total* profit/hour across all outputs lands, so a
high-level Token carrying a cheap low-level material as a side drop is fine as long
as its main output carries the earnings. Only when the miss is real does the policy
tune, starting with the output that contributes most.

Compute the correction ratio `r` = required units/hour ÷ current units/hour, then:

**Step 0 — the band may already forgive it.** Non-anchor sources get a band **twice**
the anchor width (dial: non-anchor band multiplier, default 2×). Most inheritors land
inside it untouched; the policy below is for the rest.

**Step 1 — quantity range (owner-preferred, always available).** If the output has an
authored min/max range, slide the **midpoint** while preserving the authored spread
(max − min stays fixed) — half-unit steps of expected value. If the output is a fixed
integer, step the integer. Stop the moment the source is in band.

**Step 2 — chance (owner-preferred, only where authored variable).** If the developer
authored this output with a chance under 100%, tune the chance, snapped to legible
steps: multiples of 10% first, then 5%, then 1% (the old `taskSolver.js` snapping,
kept because it worked), with a floor of 5% on a primary output. **A 100%-chance
output is never made random** — the sim may move a dial that exists, never install
one (brief §5, firm).

**Step 3 — cycle time (last resort).** Move off the band midpoint, whole seconds,
never outside the tempo band. This preserves "a Slow token is slow" while giving the
policy real travel — the revised D-164 makes the upper half of Heavy bands generous.

**Step 4 — refuse** (§12), naming the miss and the remedies.

**Budget and ordering rules:** one lever at a time, in this order, each snapped before
the next is considered; the sim never moves two levers when one suffices, so a diff
reads as one change per Token. If `r` is worse than 3× (or better than ⅓) the sim
skips straight to refusal — a correction that large means the *authoring* is wrong
(wrong anchor, wrong item, wrong Purpose), and grinding the levers to their stops
would technically land the number while destroying the Token's authored character,
which is the tool failing criterion 8 while passing criterion 4.

**One exemption to the 3× cap (F2): quantity moves on IPH-tagged sources.** The cap
exists to protect a Token's authored character — but *volume is an IPH Token's
character*. A level-40 firehose feeding a chain with a 2g material legitimately needs
many multiples of a level-1 gatherer's rate, and stepping its quantity from 5 to 18 is
exactly what its tag asks for. So: on an IPH source, the quantity-range lever may
travel as far as it needs; chance and cycle time stay capped. The refusal for
everything else gains the matching remedy: "tag it IPH and raise its base quantity."
**Ruled (2026-08-28): any exempted quantity move beyond 3× files a Warning row** —
not Info — so the one place the character guard is off is always visible in the audit
panel after a recalculate.

**Authoring habit, ruled the same day: ranges are the default.** Re-authored resource
outputs carry min/max ranges (1–2, 2–4) unless a Token is *deliberately* a metronome.
This is a content guideline rather than a sim rule, but it is load-bearing for this
policy: it puts the preferred lever on nearly every Token, and it mostly dissolves the
early-game hard case below (a fixed-1, reliable, Fast non-anchor barely exists once
1–2 is the natural way to write it). The accepted cost is a slightly swingier
moment-to-moment board as the game's normal texture.

**Purpose mismatch across sources (F3):** the most common driver of hard tuning is two
sources of one item carrying different Purpose tags — their targets differ ~3× (the
factor gap) before any yield difference. The sim doesn't forbid it (a GPH gatherer and
an XPH training recipe on the same item is a legitimate design), but it files a
standing Info row per mismatched item so that when tuning strains, the cause is
already named.

**Does the policy differ by kind?** Only in what exists: Resources usually have
ranges (step 1 rich), Recipes usually have fixed outputs (step 1 coarse, step 3 does
more work). Enemies are out of scope (CMS-51). No kind gets a different *order* —
one policy, one explanation.

**Honest answer to P1's open question — can these levers hold the band?** Mostly yes,
because of three compounding reliefs: the doubled non-anchor band, half-unit EV steps
from ranges, and real cycle-time travel under revised D-164. The residual hard case is
a **reliable, fixed-quantity-1, Fast** non-anchor early game — its coarsest possible
steps meet its lowest values. For that shape the refusal explicitly suggests the two
authored fixes that dissolve it: give the output a 1–2 range, or tag the Tempo slower.
If play-authoring shows that case is common, the smallest relaxation is a wider early-
game non-anchor band (one dial, already exists), not a new mechanism.

---

## 6. Crafted items and margins (problem P6)

§3.3 gave the pricing rule; what remains is the tension P6 names.

- **The floor.** The craft-margin dial (developer's number, deliberately no
  recommendation — brief §7.2) is a *minimum markup per processing step*: a crafted
  anchor's price is lifted to at least inputs × (1 + margin) even when its Purpose
  target implies less. Turning it up makes every chain step visibly worth more than
  its parts and strengthens the craft-don't-sell-raw incentive; turning it down lets
  Purpose targets dominate and keeps deep chains from compounding into monsters. When
  the floor, not the target, decides a price, the sim files an Info row so the
  developer can see the dial doing work.
- **The ceiling.** A GPH recipe needs no separate ceiling: its price *is* its target;
  it cannot run away because nothing multiplies it after the fact.
- **Chains.** `Ore → Ingot → Blade → Sword`: each step re-applies the same rule, so
  margin compounding is *visible in one dial* rather than scattered. The failure mode
  the developer should watch: at four steps, a 25% margin floor compounds to ×2.4 over
  raw inputs before any Purpose profit — the Dashboard's chain inspector (§15.2) shows
  cumulative markup per chain precisely so this is seen, not discovered.
- **Training losses.** An XPH-tagged *non-anchor* recipe may inherit prices that make
  it gold-negative. That is allowed by design (training costs money), but bounded: a
  dial caps the loss per hour as a fraction of the level's GPH curve (default 25%).
  Beyond the cap it refuses — a training recipe that eats a level's whole income is a
  content mistake, not a trade-off.
- **Intermediates** are expected to be unprofitable to sell raw (brief P6). The
  profit bar in the Map/chain checks applies to **end products** — items no recipe
  consumes — only.

---

## 7. Maps: the two-sided check (problem P2)

For every Map, after pricing:

```
scrap side:       Σ (pool share × entry scrap value)  ×  expected burst size
productive side:  Σ (pool share × entry productive value)  ×  expected burst size
```

Burst size is **exactly 3, with the first slot guaranteed to be a Token** (owner
ruling, §1). So the maths is: slot one draws over the pool's *Token* entries with
weights renormalised among them; slots two and three draw over the whole pool. The
check still reads the constants live rather than hardcoding 3, so a future change
shows up as a changed verdict, not a stale formula.

An entry's **productive value** is its lifetime profit: profit/hour (from its solved
cycle) × lifetime hours (charges × cycle time; unlimited-charge Tokens use the
assumed-lifetime dial, CMS-104). An entry's **scrap value** is its rarity-allocated
slice of the Map's cost × the scrap-ratio dial (CMS-48 aggregate-first allocation, §9).

Two entry kinds need their own rule (found in review):

- **Raw item entries (F10)** contribute their item value to *both* sides, and are
  excluded from the rarity allocation — the premium formula distributes only the
  scrap budget that remains after the item entries' contribution. If item entries
  alone exceed the whole scrap budget, the pool is item-heavy and the Map raises a
  Warning ("burst scrap exceeds the scrap bound before any Token is counted").
- **Enemy entries (F6)** are out of tuning scope (CMS-51), but they sit in real
  pools, and skipping them would make any Map containing one uncheckable. Their
  productive value is CMS-51's own definition — lifetime loot value: drops × charges
  at derived item values, with no time dimension — which is computable without
  touching a single combat number. Their scrap value joins the allocation normally.
  **Ruled (2026-08-28): v1 also band-checks each enemy** — lifetime loot value
  against its Map acquisition slice, warning when wildly generous or a rip-off — so
  a nonsense loot table is flagged before it poisons a Map verdict, even though
  combat balance proper stays deferred.

**Unlimited-charge Tokens in pools (ruled 2026-08-28): unlimited is a rare, special
design space and never appears in an ordinary Map pool.** The assumed-lifetime dial
stays for valuing them (CMS-104), but an unlimited Token found in a burst pool now
raises a **Warning** — it quietly opts out of the Maps-as-supply-line loop that this
whole check exists to protect. The eight shipped unlimited Tokens (Trout Stream
included) get finite charges or a deliberate special home when re-authored.

The two bounds are dials the developer owns (brief §7.2 — mechanism only, numbers
theirs), each expressed as **two pins, early and late, smoothly interpolated over Map
level**:

- **Scrap ratio** — burst scrap value as a fraction of Map cost (must stay well under
  1; turning it up makes rare finds feel pricier to sell, and nothing else — CMS-103).
- **Productive return** — burst productive value as a multiple of Map cost (the main
  profitability dial; the early pin generous, the late pin tighter, exactly the
  compression P2 describes; turning the early pin up makes the opening more explosive,
  turning the late pin down slows late-game compounding).

A Map's **level** is derived: the pool-share-weighted mean of its entries' skill
requirements, shown on the Map screen so the developer knows where on the curves it
sits. Both bounds are **checks on the hand-authored Map price** — a violation is a
refusal naming the gap and the remedies (price, pool, rarity tags, charges), never an
adjustment, because every input to the check is authored.

---

## 8. XP (problem P7)

XP per cycle is pure arithmetic once time is fixed:

```
xp per cycle = XPH curve(required level) × purpose XP factor × cycle time in hours,
               rounded, minimum 1
```

Purpose XP factors (dials): XPH 1.0, IPH 0.5, GPH 0.3. Together with the gold-side
factors this makes the Purpose tag a **seesaw a designer can feel**: GPH pays gold and
teaches little; XPH teaches fast and pays a trickle; IPH sits between on XP, low on
gold, high on stuff. No conflict is possible because XP is derived, never targeted
independently — exactly P7's framing.

The XPH curve itself is built from the pacing anchor (§13.2), against the game's real
threshold curve (`floor(l + 300·2^(l/7))/4` cumulative — ≈738k XP to level 70).

**Known granularity wobble (F8):** the minimum-1 rule means a Fast, GPH-tagged Token
below roughly level 10 over-teaches — 1 XP per 10s cycle is ~360 XP/hour against a
~170 target. Accepted rather than engineered around: those levels take minutes
anyway, the waypoints already call the opening fast, and the alternative (running XP
through the lever machinery) buys precision exactly where the brief says precision is
cheapest. Documented so nobody later mistakes it for a bug.

---

## 9. Rarity (problem P8)

The Rarity tag does exactly two derived things, and the design keeps them apart:

1. **Draw weight.** A global tier → weight table (§13.4) replaces per-Map hand
   weighting (CMS-54 struck). Weights are relative within a pool, so expected copies
   per burst = 3 × weight ÷ pool total weight. Tagging one Token Mythic thins every
   other entry's share slightly — that is unavoidable in any relative-weight scheme
   and the Map screen shows the recomputed shares after every run so it is visible.
2. **Scrap premium.** Per CMS-48/103: the burst's scrap total is anchored first (Map
   cost × scrap ratio), then allocated so each entry's per-copy slice is proportional
   to `weight^(−premium)`, premium a dial defaulting to 0.8 — "roughly inverse", with
   the dial giving travel between flat (0) and hard inverse (1). Sell-side only; no
   production number reads it, which is what keeps D-175 true — a Mythic is scarcer
   and prices higher to *sell*, and not one erg stronger.

The tension P8 names — a rare Token's output still has to land in a band — is handled
by the machinery already described: if it anchors, value absorbs its generosity; if it
inherits, the lever policy tunes it inside the *doubled* non-anchor band, which is
wide enough to let a Rare feel juicy without breaking level pacing.

---

## 10. Integers and feel (problem P4)

Collected rules, all already used above: item values are integers; quantities are
integers or authored ranges (spread preserved); chances snap 10 → 5 → 1%, floor 5% on
primary outputs; cycle times are whole seconds; XP is a whole number, minimum 1. The
sim closes integer residuals with levers rather than wishing values were continuous
(§3.3), and the tolerance bands (§13.5) are set wide enough at the bottom of the curve
that a ±1g snap at value 3 is inside band rather than a refusal storm.

Feel is protected structurally: reliability is never invented away (chance lever only
where authored), spreads are never flattened (range lever slides midpoints), tempo
identity is never crossed (cycle lever stays in band).

---

## 11. Re-running without chaos (problem P9)

**The rule that does the work: authored intent and derived results are separate
fields, and the sim reads only intent** (§16 has the schema). Every run regenerates
all derived values from scratch, so:

- Re-running with no edits changes nothing, byte for byte. (There is no drift,
  because there is nothing to drift from.)
- Editing one Token changes: its own derived numbers; the values of items it
  *anchors* and their downstream chain; the tuning of other sources of those items;
  and the checks of Maps containing any of these. Nothing else — the blast radius is
  the item's chain, which the churn report (§15.2) prints after every run ("14 values
  changed; largest: Oak Wood 2g → 3g; 3 Tokens re-tuned; 1 new refusal").
- The one stored derived fact is the **anchor election** (§3.2), precisely so that
  adding content cannot silently re-price an existing chain. Criterion 6's under-10%
  target is met by construction for any edit that doesn't change an anchor, and
  anchor changes only happen by explicit click.

---

## 12. Refusing well (problem P10)

A refusal is a card in the audit panel (the existing AuditPanel shape, CMS-74), and
each one must pass this test: *a designer who reads no formulas knows which tag or
dial to change next.* Every card has three parts: **what** ("Yew Stand can't reach its
band"), **why in game terms** ("it inherits Yew Log's value from Yew Copse, and even
at its slowest allowed cycle it earns 2.1× its level's band"), and **remedies, ranked**
— each a concrete tag/dial action with its predicted effect ("Tag it Heavy · make its
output 1–3 instead of 2 · flag it as Yew Log's anchor instead · widen the non-anchor
band dial").

The refusal catalogue:

| Refusal | Trigger | Remedies offered |
| :--- | :--- | :--- |
| Out of band, levers exhausted | §5 step 4 | slower/faster Tempo; add a range; re-anchor; widen band dial |
| Correction too large (>3×) | §5 budget rule | re-anchor; different item; different Purpose |
| Orphan item | no source at all (CMS-86) | give it a producer — Critical |
| Deferred-only item | only passive/deferred sources | give it an in-scope source, or accept unpriced — Critical |
| Recipe cycle | A needs B needs A | break the loop — Critical |
| Token-output recipe | a recipe outputs a Token (§3.3, F5) | deferred shape; output items for now — Critical |
| Map underwater | productive side < bound | raise price? no — *lower* price, enrich pool, raise charges |
| Map scrap-rich | scrap side > bound | raise price, thin pool, lower scrap ratio |
| Training loss over cap | §6 | raise XPH gold factor; cheaper inputs; accept via cap dial |
| Anchor candidate changed | §3.2 stickiness | one-click re-elect, or dismiss |

Severities follow the existing panel: Critical (unpriceable content), Warning
(in-game but off-target), Info (the sim exercised judgment you may want to see —
margin floor engaged, anchor candidate, deferred-scope source).

---

## 13. Baseline curves (deliverable 7.2)

Numbers to react to, not to keep. None are fitted to `data/` (§9 of the brief) — they
come from the stated anchors: 1,200 g/hr at level 1, late game at ~240 board-hours,
the 10–30s rhythm band, and the integer-gold constraint.

### 13.1 Gold per hour by level

The inherited curve (1,200 → ~176,000 at 71+) is **defensible in slope but lumpy in
shape**: it implies ~7.4% compounding per level overall, but the old brackets deliver
it as 1.5%/level for ten levels, then ~7%, then ~10% — three different games. Proposal:
smooth it to a **flat 7.5% per level to 70, then 2% per level to 99**:

| Level | 1 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 85 | 99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GPH | 1,200 | 2,300 | 4,750 | 9,800 | 20,200 | 41,600 | 85,800 | 177,000 | 238,000 | 314,000 |

This lands within rounding of the inherited 176k at 71, so existing intuitions
survive, while the early game stops being a ten-level flatline. The post-70 flattening
is deliberate: late game is where P2's return compression lives, and a curve still
compounding at 7.5% there would fight it. Stored as pinned points, interpolated —
the developer edits pins, not 99 cells.

Two rulings (2026-08-28) fix what this curve *means*:

- **It is a floor, not an average.** The sim balances the just-qualified worker;
  a hero levelled past the gate out-earns the curve through the speed bonus (and
  will more, once the planned 25/50/75 milestones land), and that overshoot is the
  player's earned reward, deliberately unmodelled. Every dashboard figure reads as
  "at least this much".
- **One curve for every skill.** Any level-40 work earns level-40 money; skill
  choice is flavour and chain position, never a pay grade. Per-Token variation comes
  from the Purpose tag alone, so there is exactly one way to make a Token pay
  differently, not two overlapping ones.

### 13.2 XP per hour by level *(re-founded by the 2026-08-28 interview)*

The first draft of this section aimed a flagship skill at level 70 in a month. **That
was the wrong model of the game**, and the interview corrected it: skills are *fast*
individually and the long game is *breadth*.

The ruled pacing:

- **One focused skill goes 1→99 in roughly 50–60 board-hours** — a dedicated first
  week of normal play earns the first 99.
- **The climb is classically back-loaded**: early levels fall in minutes, the 90s
  take an hour-plus each, and the last ten levels cost roughly a quarter to a third
  of the whole climb.
- **"Late game begins at one month" is an economic milestone, not an XP one** — see
  the note below.
- **The 800+-hour trophy is emergent breadth**: ~6 held skills × 12 heroes is 72
  climbs at ~55 hours each; even worked in parallel by the whole roster, with
  realistic inefficiency, completely maxing every hero lands comfortably past 800
  play-hours. Nothing tunes *toward* 800 — it falls out.

The curve that delivers it is pleasingly simple: **XPH compounds at 7.5% per level —
the same growth rate as the gold curve — from a base of ~700 XPH at level 1.**
Because the XP thresholds themselves grow at ~10.4%/level, time-per-level creeps up
~2.7%/level, which produces exactly the classic back-loaded shape: level 2 falls in
~7 minutes, a level in the mid-90s takes ~90, the last ten levels are ~a quarter of
the total, and the sum lands at ~55 hours. One growth number (7.5%) now governs both
curves, which is one fewer thing to hold in your head.

| Level | 1 | 20 | 40 | 60 | 80 | 99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Target XPH (XPH-tagged work) | 700 | 2,750 | 11,800 | 50,300 | 214,000 | 837,000 |

These are the targets for **XPH-tagged** work; the Purpose factors (§8) mean a hero
parked on GPH-tagged money-makers trains at ~0.3× this — which is what makes the
week-one 99 a *choice* ("only for one skill on one hero", in the owner's words)
rather than something that happens to every skill incidentally.

**The one-month anchor, relocated.** "Late game begins at roughly one month" now
binds the *gold* side: around day 30 the player should afford and run the highest
tier of Maps. That is delivered jointly by the GPH curve (§13.1) and the hand-authored
Map price ladder, and it is made visible rather than hoped for: the Map screen gains
an **"estimated day this comes into reach"** line — Map price against projected
income from the curves at 8 h/day — so the developer pricing a top-tier Map can see
"day 32" and nudge the price until the ladder lands where they want it.

### 13.3 Tempo bands in seconds, by level

Bands scale by ×(1 + level/70): weightier work at higher tiers, per the brief.

| Tempo | Level 1 | Level 40 | Level 90 |
| :--- | :--- | :--- | :--- |
| Fast | 8–12s | 12–19s | 18–28s |
| Medium | 12–20s | 19–31s | 27–46s |
| Slow | 20–30s | 31–47s | 46–69s |
| Heavy | 30–120s | 47–188s | 69–274s |

Fast/Medium/Slow keep most of the board inside the 10–30s rhythm at low levels, which
is where most simultaneously-worked Tokens live; Heavy is the deliberate long-cycle
design space revised D-164 opened, with no hard top (the band top shown is where the
sim will place things; a designer wanting minutes-long epics tags Heavy at high level).
`ContentRules.test.js`'s 30s hard-fail must be relaxed to "inside the token's tempo
band" — the one known wall the brief already flagged.

### 13.4 Rarity: weights and premium

| Tier | Weight | ≈ share of a 5-tier pool | Scrap premium at 0.8 (per copy, relative) |
| :--- | :--- | :--- | :--- |
| Common | 100 | ~62% | ×1 |
| Uncommon | 40 | ~25% | ×2.1 |
| Rare | 12 | ~7.5% | ×5.5 |
| Epic | 4 | ~2.5% | ×13 |
| Mythic | 1 | ~0.6% | ×40 |

Pool-size interaction: shares renormalise within each pool, so a pool of six Commons
and one Mythic still bursts Mythic ~1 time in 600 draws — pool composition, not tier,
sets the actual experience, and the Map screen shows computed shares per pool. Five
tiers are **confirmed** (owner ruling, §1): `epic` joins `TOKEN_RARITIES` in
sitting 1.

### 13.5 Tolerance bands

Integer gold forces the band to widen where values are small (brief §4), so:

| Anchor level | Band around target (anchors) | Non-anchors (×2 dial) |
| :--- | :--- | :--- |
| 1–10 | ±25% | ±50% |
| 11–30 | ±15% | ±30% |
| 31+ | ±10% | ±20% |

**Across levels** (criterion 4's real promise): the progression guard asserts that the
band *ceiling* at level L sits below the band *floor* at level L+10 everywhere on the
curve. **Corrected in review (F1): this holds for anchor bands only.** With the
7.5%/level curve: anchors at level 10 top out at ~2,875 while anchors at 20 bottom at
~4,040 — clean. But the *doubled non-anchor* band overlaps at the seams (level 10's
non-anchor ceiling ~3,450 sits just above level 20's non-anchor floor ~3,325). So the
guard as shipped checks anchor bands, and the small non-anchor overlap is accepted,
named, and defensible: criterion 4 itself calls within-level spread "variety, not a
bug", and a rare outlier source straddling a decade boundary is that variety — the
*averages* the criterion actually protects stay strictly ordered. The guard runs as
part of the check pass and refuses dial combinations that break the anchor-band
ordering (the one refusal aimed at the developer's dials rather than content).

### 13.6 The owner's dials — now with the owner's numbers

Per the brief these were deliberately not mine to pick, and they are no longer
blank: the 2026-08-28 interview captured the owner's starting feel, and the dials
ship pre-set to it (still fully theirs to turn):

| Dial | Owner's starting value | The feel chosen |
| :--- | :--- | :--- |
| Map productive return, early pin | ~10× | Each early Map plainly funds several more |
| Map productive return, late pin | ~1.5× | Hard compression: late Maps barely clear cost, efficiency is the margin — the named "stingy if sloppy" risk was accepted |
| Map scrap ratio | ~40% | Soft scrap loss; rare finds sell high. **No per-copy cap** — a Mythic windfall approaching the Map's price is an accepted, wanted story |
| Craft margin per step | ~15% | Crafting always beats selling raw; four steps compound to ~×1.75, no runaway |

---

## 14. The dials, complete list (§3.2's open question)

Grouped as the Dashboard shows them. Every dial states its feel-effect; that is the
predictability test §3.2 demands.

**Pace** — *how fast the game moves*
1. **Earn curve** (pinned GPH-by-level, §13.1). Up = everything pays more; steeper =
   levelling matters more.
2. **Skill mastery time** (default ~55 hours to 99, §13.2). Up = every 99 is a
   longer project; the whole 800-hour trophy stretches with it.
3. **Hours per day** (default 8). Descriptive of your player, not of the game; the
   "day in reach" projections regenerate from it.

**Purpose** — *what the tags mean*
4. **Purpose gold factors** (GPH 1.0 / IPH 0.35 / XPH 0.10). The gap between them is
   how strongly a tag is felt in gold.
5. **Purpose XP factors** (XPH 1.0 / IPH 0.5 / GPH 0.3). Same, in XP.
6. **Training loss cap** (default 25% of the level's GPH). How expensive training may
   be.

**Value chain**
7. **Craft margin per step** (owner-set: ~15%, §13.6). Up = crafting beats selling
   raw, chains compound harder.
8. **Map scrap ratio** (owner-set: ~40%, no per-copy cap, §13.6). Up = rare finds
   sell for more; nothing else moves.
9. **Map productive return** (owner-set pins: ~10× early → ~1.5× late, §13.6). The
   profitability of buying Maps, early vs late.
10. **Rarity premium** (0–1, default 0.8). How steeply scrap value tracks scarcity.
11. **Assumed lifetime, unlimited Tokens** (default 16h). Only feeds the Map check —
    and unlimited is now a rare, special space, never in ordinary pools (§7).
11b. **Downcycle recovery ratio** (developer-set; anything under 100%, sensibly well
    under). The one number governing all recycling: what fraction of a thing's value
    comes back when you break it down. Up = recycling matters; at 100% or above it
    would duplicate gold, so the dial refuses to go there.

**Tolerance** — *how hard the sim tries*
12. **Band widths** (per level bracket, §13.5) and **non-anchor multiplier**
    (default 2×). Wider = fewer corrections and refusals, swingier economy.
13. **Rarity weights** (five numbers, §13.4). How lopsided bursts feel.

Interactions worth knowing, printed on the Dashboard itself: 1×2 together set gold
*per level of effort* (raising GPH while slowing XP makes levels rich and long); 4
interacts with 7 (a high margin floor can override low IPH/XPH targets — the Info row
says when); 12 interacts with everything (it is the "how much do I trust the sim"
dial). Deferred with their Token kinds: the staffed-vs-passive dial (brief §3.2's
candidate) belongs to the passives pass, not v1.

---

## 15. UI specification (deliverable 7.3)

### 15.1 The Simulator Panel (per Token, per Recipe)

A card on the existing editor screens, two halves:

**You set** — Tempo (four buttons), Rarity (five), Purpose (three, with one-line
meanings), and where relevant the Anchor flag per output ("this sets the item's
value"). Plus everything they already author: outputs, ranges, variability, charges,
skill, level.

**The sim answered** (read-only, filled by the last Recalculate; grey "stale — 
recalculate" badge if edited since):
- Cycle time chosen, shown inside its band ("22s · Medium band 19–31s").
- Per output: the item's value with an **anchor badge** ("sets Oak Wood = 3g") or
  **inherits badge** ("Oak Wood = 3g, set by Oakwood Grove — click to view"), and any
  tuning applied, stated as a diff ("range 1–3 → 2–4").
- On an anchor output, one standing caption (F9): *"changing this yield changes Oak
  Wood's price, not this Token's earnings"* — because value-absorbs-yield is the one
  behaviour of this tool that inverts a designer's instinct, and the churn report
  after the fact is too late to be the first warning.
- The earn line: profit/hour and XP/hour against the band, drawn as a simple gauge —
  a dot inside a bracket, no numbers required to read it.
- Lifetime line: charges × cycle → lifetime profit vs its Map acquisition slice
  ("lives ~3.1h · returns ~14× its find cost"). **Hours-first is the ruled way to
  think about charges** (2026-08-28): the translation always shows beside the raw
  count, and soft Info rows flag scale outliers — a Common living over about a day,
  anything living under about ten minutes — so the old content's 1-to-8,000 spread
  can't recur unnoticed. Charges themselves stay hand-typed (D-176 untouched).
- If refused: the refusal card (§12) inline, not just in the panel.

### 15.2 The Global Dashboard

One screen, four zones:
- **Dials** (§14's groups) with plain-language captions, and the curve editors as
  draggable pins over a drawn curve.
- **The Map table** — one row per Map: derived level, cost, scrap side vs bound,
  productive side vs bound, pass/fail, and **"estimated day in reach"** (§13.2) —
  the ladder of these dates across all Maps *is* the game's pacing, visible on one
  screen.
- **The churn report** — after every Recalculate: how many values moved, the largest
  movers, new/cleared refusals. This is criterion 6 made visible.
- **The audit panel** — the refusal cards, severity-sorted, click-to-jump (existing
  CMS-74 shape, repopulated per run).
- A **chain inspector** reachable from any item: the item's derivation path drawn as
  a sentence trail ("Oak Wood 3g ← anchors: Oakwood Grove (L1, Medium, GPH) → Charcoal
  6g = 4×3g inputs ÷ 2 + margin…") — criterion 11's explainability surface.

Recalculate stays a button (CMS-16), auto-applies (CMS-14), and the panel is where
you *see* what it did (CMS-75).

### 15.3 What the player sees (ruled 2026-08-28)

**Rarity only.** Rarity shows in-game the way players expect (colour/label). Tempo
and Purpose stay entirely backstage — no badges, and the CMS-66 description
generator does **not** name them or paraphrase them; players learn what a Token is
for by watching it work. The accepted cost, named at ruling time: an XPH Token's
"train here" signal is invisible until noticed. The tags are the designer's
vocabulary, not the game's.

---

## 16. Data schema changes (deliverable 7.4)

Principle (§11): **authored intent in one set of fields, derived results in another;
the game reads derived, the sim reads intent, the CMS edits intent.**

**Tokens** (`data/tokens.json`) — new authored fields: `sim.tempo`
(fast|medium|slow|heavy), `sim.purpose` (gph|xph|iph); existing `rarity` gains `epic`
if the owner takes the five-tier table. Per output, authored intent moves to:
`baseQty {min,max}` (a metronome authors min = max), `variable: true|false`, and
optional `anchor: true`. Derived (sim-written, read-only in the CMS, consumed by the
game unchanged in today's shapes): `config.cycleTimeMs`, `config.xp`, and per output
`minQty`, `maxQty`, `chance`. Charges, inputs, skill, level, identity: authored,
untouched.

**Recipes** (`data/tokenRecipes.json`) — new authored: `sim.tempo`, `sim.purpose`,
per-output intent as above, plus **`downcycle: true`** where a recipe is a return
leg (§3.3): it exempts the recipe from the cycle refusal and anchor election, and
switches its pricing to the recovery-ratio cap. Derived: `durationMs`, `xp`, output qty/chance. The nine
legacy EV fields (`targetEV`, `calculatedEV`, `autoBalance`, `fieldLocks`, …) are
**deleted** — this design replaces the machinery that read them, and the recipe-sync
bypass built to protect them (`recipeSync.js`, the seam the handoff §5.1 names) is
retired so recipes flow through the economy pass like everything else. Shipped
recipe outputs also carry **`isPrimarySource`** — the struck CMS-110 era's anchor
flag; it is migrated to the new `anchor` intent flag where `true` and deleted
otherwise, so the old vocabulary doesn't survive as a second, dead way to say
"anchor".

**Items** (`data/items.json`) — `value` becomes fully derived (already CMS-86's
stance); new derived provenance: `valueSource` (the anchoring token/recipe id, for
the chain inspector and the sticky election).

**Maps** (`data/maps.json`) — pool entry `weight` becomes derived from the entry
Token's rarity; authored fields unchanged (price, materials, pool membership).

**CMS store/globals** — the §14 dials in the global store; the stored anchor
elections; the last churn report. Sync writes all four data files wholesale (CMS-53).

**Tests** — `ContentRules.test.js`: relax the 30s rule to tempo-band membership; add
assertions that derived fields match a fresh solve (drift alarm), and that every item
has a `valueSource`.

---

## 17. Build order (deliverable 7.5)

Sittings, each self-contained and verifiable, minimal version = 1–4:

1. **Schema and tags.** Intent fields, vocabulary (`epic`?, tempo, purpose), CMS tag
   pickers, ContentRules relaxation. *Checkpoint: content is taggable; game unchanged.*
2. **Time + anchors, report-only.** Passes 1–2 plus a read-only report of proposed
   cycle times and elections. *Checkpoint: the developer reviews elections on real
   authoring, before anything writes.*
3. **Pricing, write-back.** Pass 3, item values and cycle times land in data; chain
   inspector minimal. *Checkpoint: a priced economy from tags — the tool's core value
   exists here.*
4. **Lever policy + refusals.** Pass 4, audit cards, churn report. *Checkpoint:
   multi-source items reconcile or refuse legibly.*
5. **Map economics.** Pass 5's checks, rarity weights and scrap allocation, the Map
   table, the two developer-set curves. *Checkpoint: criterion 5 demonstrable.*
6. **XP + pacing.** §8 and the waypoint editor. *Checkpoint: criterion on pacing.*
7. **Polish.** Sticky-anchor UX, dashboard captions, progression guard, adversarial-
   content test set (criterion 2's second half).

Deliberately out of v1 (per the brief, restated so nothing drifts in): passives,
Buff/Manager/Market/Triggered, enemy loot, and any modelling of adjacency buffs on
output — the sim balances the *unbuffed* token; buffs ride on top as player skill.

---

## 18. Where this design is weakest — attack here

1. **The anchor default is a heuristic.** Lowest-level-then-common is right for the
   baseline-producer story, but content will eventually produce a case where the
   "everyday" source isn't the lowest-level one. The escape (explicit flag) exists,
   but if flags become routine the default has failed and should be revisited.
   *(Interview 2026-08-28: the Info-row-plus-click friction on anchor drift is
   confirmed as intended.)*
2. ~~**Refusing recipe cycles** assumes circular crafting is always a mistake.~~
   *Answered by ruling: downcycling is wanted, and §3.3's recovery-ratio rule handles
   it without reopening one-way pricing. The residual weakness is narrower: all
   recycling is equally lossy — an "unusually efficient recycler" Token has no home
   until the dial grows a per-recipe exception.*
3. **The early-game reliable-single-unit non-anchor** (§5) — *mostly dissolved by the
   ranges-by-default ruling*: once 1–2 is the natural authored shape, the fixed-1
   metronome that trapped the levers is a deliberate rarity. The case survives only
   on Tokens purposely authored as metronomes, where refusal-with-remedy is the
   honest outcome.
4. **Worker-speed drift**: solving at required level under-states a maxed roster's
   income by up to ~30–45% late game. The band does not fully absorb the top of that.
   If late-game play consistently runs far over target, the fix is solving at
   required-level-plus-a-dial, one line.
5. **Purpose factors are three numbers doing a lot of work.** If GPH/IPH/XPH turn out
   to need per-skill or per-tier variation, the flat factors are the first thing to
   crack. Deliberately not built now — it would triple the dial surface on
   speculation.
6. **The productive-return check treats a burst as its expectation.** Variance in
   bursts (a run of bad draws) is not modelled; with 3–5 items per burst and pools
   of 20+, a genuinely unlucky player can eat a real loss streak the check never
   sees. Accepted for v1: modelling it buys accuracy on the side CMS-103 says not to
   optimise.
7. ~~**The IPH quantity exemption (F2) is a hole punched in the character guard.**~~
   *Answered by ruling: exempted moves beyond 3× file a Warning row (§5), so the hole
   is fenced and lit. Remaining cost: intentional firehoses carry a permanent Warning
   until an acknowledge-per-Token affordance exists.*
8. ~~**Enemy lifetime-loot values (F6) rest on unvalidated inputs.**~~ *Answered by
   ruling: v1 band-checks each enemy's lifetime loot against its acquisition slice
   (§7), catching garbage before it reaches a Map verdict. Combat balance proper
   stays deferred.*

---

## 19. Proposed decisions for the log (CMS-117 onward)

To transcribe into `cms_rework_v2_decisions.md` in house style when this plan is
approved (CMS-109–116 are already struck; CMS-107 re-points here in the interim):

- **CMS-117** — CMS-109–116 are superseded wholesale by the economic-simulator plan;
  compatible ideas are restated below under new numbers. *Rejected:* keeping the
  compatible subset (inherits assumptions from a pass built on rules the brief
  reopened). *Cost:* some sound arithmetic (multi-output split, range-preserving
  levers) is re-decided rather than reused.
- **CMS-118** — Value derivation is feed-forward: time, then anchors, then a one-way
  bottom-up pricing walk; iteration is eliminated rather than damped, and recipe
  cycles are refused. *Rejected:* iterate-until-stable over the whole graph (CMS-47's
  letter — kept in spirit as "the pass runs to a stable result", but the mechanism is
  ordering, not repetition). *Cost:* deliberate circular crafting is unsupported.
- **CMS-119** — Anchor = lowest-level source, ties to commoner rarity, Token before
  Recipe; explicit per-output flag overrides; elections are sticky with an Info row.
  **Supersedes CMS-45 (struck).** *Rejected:* cheapest-path (circular, elected
  firehoses), always-explicit (authoring drag), purpose-decides (ambiguous).
  *Cost:* a heuristic default that content may eventually outgrow.
- **CMS-120** — Lever order for inheritors: band first (non-anchors get 2× width,
  judged on the Token's total earnings), then quantity-range midpoint (spread
  preserved), then authored-variable chance (10/5/1 snapping, 5% floor), then cycle
  time within band; one lever at a time; >3× misses refuse immediately — except
  quantity moves on IPH-tagged sources, which are uncapped because volume is that
  tag's character. *Rejected:* chance-first (old taskSolver — chance often doesn't
  exist now), multi-lever solves (illegible diffs), uncapped travel everywhere
  (destroys character to land a number). *Cost:* some solvable cases refuse on
  principle, and an IPH mis-tag can reshape a producer without a refusal in the way
  (§18.7).
- **CMS-121** — P0 resolves as: GPH is solved, lifetime return is checked, at Map
  granularity; refusals hand the developer the three real remedies (price, pool,
  charges). *Rejected:* per-Token return targets (would flatten the intended Oak
  Tree/Forest spread), letting acquisition slices absorb it (slices are sell-side
  feel, CMS-103). *Cost:* individual Tokens can be poor buys inside a healthy Map.
- **CMS-122** — Crafted anchors price at inputs + Purpose profit, floored at inputs ×
  (1 + margin dial); training losses allowed on non-anchor XPH recipes, capped by
  dial. *Rejected:* pure cost-plus (ignores Purpose), pure target (can price below
  inputs). *Cost:* the floor can override a tag; an Info row is the only tell.
- **CMS-123 (revised in v1.3)** — XP is derived from cycle time × XPH curve ×
  Purpose factor. The XPH curve compounds at 7.5%/level (the gold curve's rate) from
  ~700 at level 1, tuned so one focused skill masters 1→99 in ~55 back-loaded
  board-hours; the one-month anchor binds the gold side instead (top-tier Maps in
  reach ~day 30, shown as a "day in reach" projection per Map); the 800-hour
  full-roster trophy is emergent (~6 skills × 12 heroes), never tuned toward.
  *Rejected:* independent XP targets (P7 forbids the conflict), the v1 waypoint
  model aiming a flagship skill at 70-in-a-month (wrong model of the game — skills
  are fast, breadth is the game), steady time-per-level (kills the idle-game
  opening hook). *Cost:* the pacing rests on an assumed player, and late-game XPH
  numbers get astronomically large (accepted — XP is display, not economy).
- **CMS-124** — Rarity maps to draw weight through one global table; **supersedes
  CMS-54 (struck)**; scrap premium is weight^(−dial). *Rejected:* per-Map hand
  weights (the control the brief moved to the derived column). *Cost:* two Maps
  cannot weight the same Token differently — pool membership is the remaining
  per-Map control.
- **CMS-125** — Tolerance is banded by level (±25/15/10%), non-anchors ×2, plus a
  cross-level progression guard (band ceilings below the floor ten levels up).
  *Cost:* early game is officially swingy.
- **CMS-126** — Authored intent and derived results are separate fields; the sim
  reads only intent; elections are the sole stored derivation. Re-runs are idempotent
  by construction. *Rejected:* solving in place over previous output (drift), full
  statelessness including anchors (criterion-6 churn). *Cost:* schema carries two
  parallel shapes per output.
- **CMS-127** — The dial set is §14's thirteen, grouped Pace / Purpose / Value chain /
  Tolerance; Map return pins and craft margin ship unset and required. *Cost:* the
  first Recalculate demands two decisions before it runs.
- **CMS-128** — Token-output recipes are refused in v1 as a named deferred shape;
  enemy pool entries are valued in the Map check by CMS-51 lifetime loot (drops ×
  charges, no time dimension) **and band-checked against their acquisition slice
  (2026-08-28 ruling)**; raw item pool entries contribute at item value and stand
  outside the rarity allocation. *Rejected:* pricing Token products by acquisition
  value (understates the GPH intent) or productive value now (breaks the one-way
  pass ordering); skipping enemy entries (leaves any Map containing one unchecked);
  orphan-checks-only for enemy drops (garbage loot poisons Map verdicts unflagged).
  *Cost:* the "craft a Token worth real money" design space stays shut until it gets
  its own pass, and the enemy band is a number combat will later rebalance.
- **CMS-129** — A Map burst is always exactly 3 things, and at least one is a Token
  (slot one draws over Token entries only, renormalised). **Supersedes D-167's 3–6
  range.** *Rejected:* pure weighted draw (dud bursts of three raw items strand a
  broke player), authored slots per Map (three more decisions per Map for control the
  weights already give). *Cost:* raw-item-heavy pools land gentler than their weights
  suggest, and the burst roll gains one branch.
- **CMS-130** — Downcycling is a supported loop shape: a `downcycle`-flagged recipe
  prices under one global recovery-ratio dial (output value ≤ ratio × input value,
  strictly under 100%), can never anchor, and stands outside the topological pricing
  walk. All other recipe cycles stay refused. *Rejected:* refusing all loops (the
  owner wants recycling), per-recipe authored recovery (needs the global ceiling
  anyway — two mechanisms for one idea), true iterative loops (reopens oscillation
  for no current content). *Cost:* all recycling is equally lossy; no
  "efficient recycler" character space yet.
- **CMS-131** — Unlimited charges are a rare, special design space: never in an
  ordinary Map pool (Warning row), with the assumed-lifetime dial retained for
  valuing them. The eight shipped unlimited Tokens are re-authored finite or given a
  deliberate special home. *Rejected:* rooting unlimited out entirely (loses a wanted
  reward space), keeping it as a normal choice (designs permanent leaks into the
  Maps-as-supply-line loop). *Cost:* CMS-104's special case lives on.
- **CMS-132** — The Bank sells items at full derived value, always; Markets, when
  they arrive, are a premium/volume upgrade (SELL_BONUS), not the gate. *Rejected:*
  Markets-only selling (makes GPH unrealizable without modelling Market throughput),
  discounted bank sell (splits "item value" into two numbers). *Cost:* Markets need
  a reason beyond "the only way to sell".
- **CMS-133** — The earn curves are floors, not averages: the sim balances the
  just-qualified worker and over-level speed (plus future milestones) is earned,
  unmodelled player upside. One curve serves every skill; the Purpose tag is the only
  per-Token pay lever. *Rejected:* baking typical overshoot into targets (punishes
  freshly qualified heroes at every gate), capping the speed bonus (a game nerf
  wearing a balancing excuse), per-skill multipliers (a second overlapping way to set
  pay). *Cost:* late-game real income runs structurally above the dashboard's
  curves, on purpose.
- **CMS-134** — The player sees rarity only; Tempo and Purpose are designer
  vocabulary, absent from badges *and* from generated tooltips. *Rejected:* all three
  tags visible (Tokens read as stat blocks), woven tooltip hints (still leaks the
  taxonomy the owner wants backstage). *Cost:* an XPH Token's training identity must
  be discovered by playing it.
- **CMS-135** — Charges are reasoned about hours-first: the panel always shows
  lifetime-in-hours, with soft Info rows for scale outliers (a Common living over ~a
  day; any Token under ~10 minutes). Charges themselves stay hand-typed (D-176
  untouched). *Rejected:* authoring lifetime and deriving charges (reopens D-176),
  display with no warnings (recreates the 1–8,000 spread unnoticed). *Cost:* two
  more heuristics to tune.
- **CMS-136** — Authored ranges are the default output shape for re-authored
  content; a fixed quantity is a deliberate metronome choice. A content guideline,
  not a sim rule — recorded because the lever policy's strength depends on it.
  *Cost:* a slightly swingier board is the game's normal texture.
- **CMS-137** — The owner-reserved dials ship at the owner's interviewed values:
  Map productive return ~10× early compressing to ~1.5× late, scrap ratio ~40% with
  **no per-copy cap** (a Mythic scrap windfall near the Map's price is an accepted
  story), craft margin ~15%/step; Purpose gold gaps confirmed at 1.0/0.35/0.10; a
  Common Token's normal lifetime is ~30–90 minutes (the hours-first warnings
  calibrate to it). *Rejected:* shipping the dials blank-and-required (the owner has
  now chosen; blankness was only ever a guard against *my* numbers), capping
  per-copy scrap or flattening the premium (both dull the rare-find feel to close an
  edge the owner explicitly accepts). *Cost:* the scrap-fishing edge exists and is
  owned, and 1.5× late-game returns punish sloppy boards by design.
---

## 20. Self-review findings ledger (v1 → v1.1)

For the owner's attack round — what the review pass changed and where:

| # | Finding | Disposition |
| :--- | :--- | :--- |
| F1 | §13.5's progression-guard claim was **wrong** for non-anchor bands (seam overlap at 10/20) | Corrected: guard checks anchor bands; overlap named and accepted |
| F2 | Band scope was ambiguous; 3× cap blocked legitimate late-game IPH volume sources | Band judges token totals; IPH quantity exempted from the cap (§5, §18.7) |
| F3 | Purpose mismatch across an item's sources is the top driver of hard tuning, unnamed | Standing Info row per mismatched item |
| F4 | Sticky elections stored only in the CMS store would die with it | Election = `valueSource` in synced data |
| F5 | Token-output recipes unpriceable; CR2-200 trap adjacent | Refused in v1 as named deferral (CMS-128) |
| F6 | Enemy pool entries made their Maps uncheckable | Valued via CMS-51 lifetime loot |
| F7 | Burst size: brief "exactly 3" vs code 3–5 vs D-167 "3–6" | Check reads live constants; discrepancy flagged to owner (§1) |
| F8 | Min-1 XP over-teaches on fast cycles below ~L10 | Accepted, documented (§8) |
| F9 | Value-absorbs-yield inverts designer instinct on anchor edits | Standing caption on anchor outputs (§15.1) |
| F10 | Raw item pool entries vs rarity allocation was unspecified | Items outside the allocation; item-heavy pools warn (§7) |
| F11 | §13.1/§13.2 tables were malformed markdown | Fixed |
| — | `isPrimarySource` survives on shipped recipes from the struck CMS-110 era | Migrated to the new `anchor` flag (§16) |

---

## 21. Owner interview rulings (2026-08-28, v1.1 → v1.2)

Fourteen rulings from a design interview aimed at rooting out pre-simulator ideas
and settling the weak points. Each is folded into the body; this table is the index.

| # | Question | Ruling | Landed in |
| :--- | :--- | :--- | :--- |
| 1 | Burst size | Always exactly 3 | §1, §7, CMS-129; game fix filed as its own task |
| 2 | Burst composition | At least 1 Token guaranteed | §1, §7, CMS-129 |
| 3 | Unlimited charges | Rare and special; never in ordinary pools | §7, CMS-131 |
| 4 | Where selling happens | Bank sells at full derived value; Markets premium later | CMS-132 |
| 5 | Rarity tiers | Five — Epic added | §1, §13.4, CMS-124 |
| 6 | Anchor drift friction | Info row + click confirmed | §3.2, §18.1 |
| 7 | Crafting loops | Downcycling only, one global recovery dial | §3.3, §6, §14, §16, CMS-130 |
| 8 | Worker-speed overshoot | The player's reward; curves are floors | §13.1, CMS-133 |
| 9 | Curve per skill | One curve for all skills | §13.1, CMS-133 |
| 10 | Player-facing tags | Rarity only; Tempo/Purpose fully backstage, even in tooltips | §15.3, CMS-134 |
| 11 | Charges scale | Hours-first display + soft outlier warnings | §15.1, CMS-135 |
| 12 | Enemy loot in v1 | Lifetime-value band check | §7, CMS-128, §18.8 |
| 13 | Authoring default | Ranges by default; metronome is a deliberate choice | §5, §18.3, CMS-136 |
| 14 | IPH exemption noise | Warning row past 3× | §5, §18.7, CMS-120 |

Second sitting, same day (dial feels and the pacing correction):

| # | Question | Ruling | Landed in |
| :--- | :--- | :--- | :--- |
| 15 | Early Map return | ~10× | §13.6, CMS-137 |
| 16 | Late Map return | ~1.5× — hard compression, risk accepted | §13.6, CMS-137 |
| 17 | Scrap ratio | ~40%, and **no per-copy cap** — Mythic windfalls are a wanted story | §13.6, CMS-137 |
| 18 | Craft margin | ~15% per step | §13.6, CMS-137 |
| 19 | Purpose gold gaps | Confirmed 1.0 / 0.35 / 0.10 | CMS-137 |
| 20 | Common Token lifetime | ~30–90 minutes is normal | §15.1, CMS-137 |
| 21 | **Pacing model** | **Corrected**: one skill 99 in ~50–60 back-loaded hours; the month anchor is *economic*; 800h trophy = maxing all 12 heroes (~6 skills each), emergent | §13.2, CMS-123 revised |
| 22 | Skills held per hero | ~6 of 27, per the current game | §13.2 |
