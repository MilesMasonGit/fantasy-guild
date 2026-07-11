# Combat Balance Targets

> **Document status:** v1 — authored 2026-07-10 from a Q&A session with the project owner.
> This is the **design-intent yardstick** for the combat rework: every number here is a
> target the 7-stat engine's formulas must be tuned to hit, and every flag the SCB
> (`SCB_concept.md`) raises is a comparison against this document.
>
> Owner-locked answers are stated plainly. Values marked **⚠ provisional** were proposed
> by Claude to fill gaps and need owner sign-off — treat them as defaults, not decisions.
> Numbers here express *intent*; exact values get calibrated once the curve-explorer /
> SCB exists, but changes should be deliberate and recorded.

---

## 0. The Reference Fight (definition)

Targets below refer to the **reference fight** unless stated otherwise:

> A hero at level N wearing **full on-level gear**, with **no preparation buffs**,
> fighting a **single level-N enemy** at a **neutral style matchup**.

This is the standard candle. The SCB re-creates it at every level band.

---

## 1. How a Single Fight Feels

| Target | Value | Intent |
|---|---|---|
| **Time-to-Kill (reference fight)** | **10–20 seconds** | "Watchable" pacing — long enough to see the fight play out when attending, short enough to multiply across thousands of kills. |
| **Hit chance (reference fight)** | **~75%** | Misses are routine texture, not rare events — Accuracy gear has real room to matter. |
| **Crit profile** | **5% chance, 2.0× damage** | Rare and dramatic. A crit is a moment, not a metronome. All Crit gear pricing flows from this anchor. |
| **RPS style swing** | **~25%** | Wrong style is clearly felt and worth planning around, but great gear can compensate. Applied as modifiers to the 7 stats per `combat_mechanics_concept.md` / SCB decision A3. |

**SCB checks:** median TTK inside 10–20s at every level band; effective hit rate ≈75%
in reference conditions; style-matchup TTK delta ≈ the 25% swing, no more.

---

## 2. Unattended Play — the Sustainability Doctrine

This section is the heart of the document. The game is *meant to be left running
overnight*.

### The core loop-of-life (owner-locked)

*   **A well-built on-level setup is sustainable forever.** The reward for checking in
    is spending the accumulated loot — not rescuing the hero. *(Answer B1: option (a).)*
*   **HP is a buffer; food is the fuel.** Combat is deliberately chunky — an on-level
    kill costs **~25% of the hero's HP bar** (≈4 kills to zero with no healing) — and
    food healing values are correspondingly large. The hero's health bar cycles hard
    and refills constantly; the *real* resource being spent is the food supply chain.
    The owner explicitly prefers **high damage numbers + high healing numbers** over
    low-attrition trickle combat.
*   **Luck never kills a properly set-up hero.** RNG makes fights interesting; it does
    not decide them. Overnight play means thousands of consecutive fights, so the
    per-fight death probability for a hero meeting the sustainability bar must be
    **effectively zero** — not "rare," zero. Deaths come from mis-setup, never dice.

### The two failure modes (owner-locked)

When a setup is *bad*, how it fails matters:

1.  **Combat mis-setup** (under-geared, wrong level, no healing at all): failure should
    arrive **in minutes** — fast feedback, easy lesson, the player is probably still
    watching.
2.  **Supply-chain mis-setup** (the fights are winnable but the food/consumables
    sustaining them run out): a slow decline **over hours** — the loop worked until the
    fuel ran dry, which teaches the *provisioning* lesson rather than the combat one.

**SCB implication:** the Gauntlet mode's verdict (SCB doc §4, Mode 2) must distinguish
these — **"combat-unsustainable"** (HP loss outruns healing; dies in N fights) vs.
**"economically unsustainable"** (fights fine; supplies deplete after H hours) vs.
**"sustainable"** — because the design intends them to feel completely different.

### Derived numbers

| Target | Value | Status |
|---|---|---|
| HP loss per on-level kill | **~25% of max HP** | Owner-locked |
| Food healing throughput | Must fully replace combat attrition indefinitely when the supply chain is provisioned | Owner-locked (direction) |
| Sustainability safety margin | Recovery throughput ≥ **1.5×** average HP-loss rate, so unlucky streaks are absorbed by margin rather than luck | **⚠ provisional** |
| Death red line | **0 deaths in 100,000** simulated reference-condition kills for any setup the SCB labels "sustainable" | **⚠ provisional** (implements the owner's "comfortably safe overnight") |

---

## 3. Where Power Comes From

| Source | Target | Notes |
|---|---|---|
| **Gear vs. levels** | **Huge gap — gear is vital.** Proper gearing is what gives collected items their value. | Owner-locked (direction). **⚠ provisional magnitude:** full on-level gear ≈ **5×** the effectiveness of a naked same-level hero — to be calibrated as the first act of curve tuning. |
| **Preparation buffs** (food buffs, potions, hexes — the Cooking/Alchemy/Occult layer) | **~25%** improvement for a fully-prepped hero over an unprepped one | Owner-locked. Skipping prep clearly leaves value on the table without making prep mandatory per fight. |
| **Style matchup (RPS)** | **~25%** swing | Owner-locked (see §1). |

Note the deliberate hierarchy: **gear ≫ prep ≈ style-matchup**. Gear is the foundation;
prep and matchup are meaningful multipliers on top of it. The SCB's Reference Build
Library and delta tests should confirm this hierarchy holds at every level band.

---

## 4. Fighting Up and Down in Level

### Punching down (owner-locked)

Farming below your level is **allowed and self-limiting** — no artificial punishment.
A level-40 hero one-shotting chickens all day is fine because three natural forces
already discourage it:

1.  **Loot value:** raw chicken and feathers aren't worth much to a level-40 guild.
2.  **XP curves:** XP awards scale steeply with enemy level — killing one 3,000 XP
    Goblin Captain per minute beats killing ten 15 XP chickens per minute. On-level
    content should always be the XP-optimal choice.
3.  **Loop overhead:** draw/shuffle delays put a floor on cycle time — once TTK drops
    below a few seconds, the loop's own pacing (not the fight) is the bottleneck, so
    "kills faster" stops converting into "earns faster."

**SCB implication:** the Value Rate metric (loot + XP per hour) must include loop
overhead, not just TTK, or it will misprice punching down. Enemy XP awards should be
audited against force #2 (on-level optimal).

### Punching up (owner-locked)

*   A **well-geared** hero can squeeze out a few kills against enemies **~10–20% above
    their level** (note: *relative* gap — +3 levels at 20, +12 levels at 70).
*   The wall is as much **economic** as lethal: sustaining above-level fights burns
    high-level food and consumables in quantities that make it **net-negative value** —
    you can do it, briefly, for a reason (a quest, a specific drop), but you can't
    *live* there.
*   Risk of death is a real factor at the top of that range — this is the one place
    "the hero might actually die" is intended design.

**SCB implication:** Gauntlet runs at +10%/+20%/+30% relative level should show,
respectively: expensive-but-survivable, a few kills then forced stop, and clearly
lethal. Value Rate at +10–20% should come out *negative* once consumable costs are
priced in.

---

## 5. Luck & Volatility

*   **RNG flavors fights; it never decides them** (owner-locked). The dice make the
    fight log interesting, not the outcome uncertain.
*   **⚠ provisional volatility envelope:** 90% of reference fights should fall within
    roughly **±30% of median TTK**. (With ~75% hit chance and 5% crits over the ~6–12
    attacks of a 10–20s fight, this is about the natural spread — anything wider means
    a single roll is carrying too much weight.)
*   The death red line from §2 applies: volatility may stretch a fight, never end a
    properly-provisioned hero.

**SCB implication:** the `VOLATILE` flag (SCB doc §8) fires when a fight's TTK or
HP-loss spread exceeds this envelope, or when any "sustainable"-rated setup shows a
nonzero death rate.

---

## 6. Scale of the Whole Game

| Target | Value | Status |
|---|---|---|
| Skill level range | **1–99** | Owner-locked |
| Late game begins | **~1 month** of normal play | Owner-locked |
| Level bands for auditing | Early ≈ 1–30, Mid ≈ 31–70, Late ≈ 71–99; SCB standard checkpoints at levels **5, 10, 20, 35, 50, 70, 90** | **⚠ provisional** |

The checkpoint levels are where the SCB re-creates the reference fight and re-verifies
every target in this document. Seven checkpoints keeps the audit grid small enough to
read (per SCB doc §11, information-overload risk) while covering the curve.

---

## 7. Target → SCB Check Summary

| # | Target (this doc) | Becomes this SCB check |
|---|---|---|
| T1 | Reference TTK 10–20s | Median TTK in range at all 7 checkpoints |
| T2 | Hit chance ~75% | Observed hit rate in reference conditions |
| T3 | Crit 5% / 2.0× | Observed crit rate & damage multiplier; Crit-gear pricing anchor |
| T4 | RPS swing ~25% | TTK delta across style matchups ≈25% |
| T5 | 25% HP loss per kill | Mean HP-loss-per-kill at checkpoints |
| T6 | Sustainable-forever when provisioned | Gauntlet verdict = "sustainable" for reference builds with supplied recovery |
| T7 | Two distinct failure modes | Gauntlet distinguishes combat-unsustainable (minutes) vs. economically unsustainable (hours) |
| T8 | Zero luck deaths | 0 deaths / 100k kills in any "sustainable"-rated setup *(⚠ threshold provisional)* |
| T9 | Gear ≈ 5× naked *(⚠ magnitude provisional)* | Geared-vs-naked effectiveness ratio at checkpoints |
| T10 | Prep buffs ≈ +25% | Full-prep delta test vs. unprepped baseline |
| T11 | Punching down self-limiting | Value Rate (incl. loop overhead + XP curve) favors on-level content |
| T12 | Punching up: few kills at +10–20% level, net-negative value | Gauntlet + Value Rate at +10/+20/+30% relative level |
| T13 | Volatility envelope ±30% TTK *(⚠ provisional)* | `VOLATILE` flag threshold |

---

## Appendix — Provisional values awaiting owner sign-off

| Value | Current default | Where |
|---|---|---|
| Gear-vs-naked effectiveness multiplier | ≈5× | §3 |
| Sustainability safety margin | recovery ≥ 1.5× average loss | §2 |
| Death red line sample size | 0 in 100,000 kills | §2 |
| Volatility envelope | 90% of fights within ±30% of median TTK | §5 |
| Audit checkpoint levels | 5, 10, 20, 35, 50, 70, 90 | §6 |

These don't block anything — they're sensible defaults that get pressure-tested the
moment the curve explorer or SCB Phase S1 produces real numbers. Sign-off can happen
then, with data on the table.
