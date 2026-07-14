# Combat Formula Specification (7-Stat Engine)

> **Document status:** v1 — drafted 2026-07-10 from an owner Q&A session (12 decisions,
> logged in Appendix A). This turns `combat_mechanics_concept.md`'s derivation matrix
> into actual curves and formulas, tuned to hit `balance_targets_concept.md`.
>
> **How to read this:** the *structures* (what derives from what, the fight pipeline,
> the budget splits) are owner-locked. The *specific constants* (base values, the 4.5%
> growth rate, armor numbers) are **⚠ provisional** — they are Claude's first
> calibration, shown with worked examples proving they hit the balance targets on
> paper. They get validated by the curve-explorer prototype / SCB Phase S1 and
> adjusted with owner sign-off. Change constants freely with data; change structures
> only by re-opening the decision.

---

## 1. The Growth Curve — one dial for the whole game

Everything scales from a single compounding curve:

> **G(L) = 1.045^(L−1)** — every level multiplies a stat budget by ~4.5%. **⚠**

*   G(1) = 1.0 → G(99) ≈ **75×** — squarely in the owner-chosen "moderate growth"
    band (×50–100 total power; late-game hits in the thousands once crits and
    preparation buffs land).
*   One dial to rule them all: if the game ever needs bigger or smaller number
    spectacle, this one constant moves and every budget follows coherently.

Checkpoint values used throughout this doc:

| Level | 5 | 10 | 20 | 35 | 50 | 70 | 90 |
|---|---|---|---|---|---|---|---|
| **G(L)** | 1.19 | 1.49 | 2.31 | 4.47 | 8.64 | 20.8 | 50.0 |

---

## 2. Combat Level

> **Combat Level (CL) = average of the 4 combat skills** (Melee, Ranged, Magic,
> Defense), range 1–99. *(Owner-locked.)*

*   This is the number areas and enemies are measured against, and the "hero level"
    every other document refers to.
*   **Deliberate consequence:** a pure specialist (99 Melee, 1 everything else) has
    CL ≈ 25 — enormous damage, paper HP. Breadth *is* toughness; glass cannons are a
    choice, not a bug. The reference hero (all 4 skills equal) is the balance anchor.
*   Roster assumption baked into all pacing math: a mid-game player fields **3–5
    specialist heroes** who collectively cover the three styles. *(Owner-locked.)*

---

## 3. Naked Hero — the 7 stats from skills alone

A hero with no equipment is a complete fighter (SCB decision A6). With all combat
skills at level L (the reference hero), the naked budgets are:

| Stat | Formula | Reference value at CL 20 | Notes |
|---|---|---|---|
| **HP** | 30·G(CL) + 20·G(Defense) | ≈ 115 | Two compounding terms: general combat experience + Defense skill. All-equal hero: 50·G(L). **⚠ constants** |
| **Damage** (per hit) | 4·G(active style skill) | ≈ 9 | Scales off the skill matching the equipped weapon type (unarmed counts as Melee). **⚠** |
| **Speed** (attack interval) | 2.5 s unarmed | 2.5 s | Fixed baseline; weapons redefine it (§5). **⚠** |
| **Accuracy** | 0 (baseline hit chance handled in the pipeline, §7) | — | Skill difference vs. the enemy shifts hit chance ±0.25%/level. **⚠** |
| **Armor** | 0 | 0 | Gear-only, per the concept doc. |
| **Block** | Defense × 0.125% innate | ~2.5% | **Owner deviation 2026-07-12:** small innate Block from Defense (~12.4% at 99) so Block exists before the gear pass. Gear Block stacks on top, amplified per §4. |
| **Crit** | 0 naked; the global crit anchor is **5% chance, 2.0× damage** | 5%/2× | Gear/buffs add chance on top of a small innate 5%. **⚠ innate value** |

**Design consequence worth stating loudly:** with these numbers a *naked* hero
fighting an *on-level* enemy roughly breaks even — the fight takes ~25s and costs
nearly the whole HP bar; it's a coin flip. That is intentional and matches the
owner-locked "gear is vital" doctrine (targets doc §3): naked heroes farm *below*
their level; on-level farming is what gear buys you.

---

## 4. Gear — the 5× multiplier, split six ways

*(Owner-locked structure: Classic 6 slots — Weapon, Offhand, Helmet, Chest, Boots,
Trinket — with an **even six-way power split** and full kit ≈ **5× naked**
effectiveness.)*

Even split means each slot contributes an equal share of power: 5^(1/6) ≈ **×1.31
per slot**. Slots deliver that power in different currencies:

*   **Offensive slots (Weapon, Trinket):** together ×1.7 damage output
    (5^(2/6) ≈ 1.71). The weapon carries damage + attack speed + its style identity;
    the trinket carries quirk stats — Crit chance, Accuracy, status effects. **⚠ split**
*   **Defensive slots (Offhand, Helmet, Chest, Boots):** together ×2.9 survivability
    (5^(4/6) ≈ 2.92), delivered as:
    *   **Armor** (flat reduction, mostly Helmet/Chest/Boots) — sized so full on-level
        armor absorbs **~35–40%** of an on-level enemy's raw hit. **⚠**
    *   **Block** (avoidance, mostly Offhand) — **~12%** base from a full on-level
        kit, amplified by Defense skill: effective Block = base × (1 + Defense/200),
        i.e. up to ~1.5× at Defense 99. **⚠**
    *   **HP bonuses** — roughly **+40%** over naked from the kit combined. **⚠**
    *   Combined effect: full defensive gear ≈ **halves** incoming damage-per-second
        versus naked *(owner-locked target)*: armor takes ~40% off each hit, block
        dodges ~1 hit in 8, and check: ×2.9 survivability ≈ (1/0.6 armor) × (1/0.88
        block) × 1.4 HP ≈ 2.65–2.9 ✓.

Sanity check of the whole budget: ×1.71 offense × ×2.9 survivability ≈ **×4.96 ≈ 5×** ✓.

### Item families (owner-locked: families + uniques)

*   Bread-and-butter gear comes in **generated tier families** (Copper → Iron →
    Steel…), one tier per **5-level enemy band** (§6), each tier's stats = the slot's
    budget share at that band's level (i.e., multiplied by G). The SCB audits the
    ~25 family scaling rules, not every generated item.
*   **Uniques** are hand-authored on top, priced against the same slot budget:
    a unique may exceed its slot budget in one dimension only by paying for it in
    another (slower, conditional, status-risky). Uniques are the excitement layer —
    every unique gets an individual SCB audit.
*   Level requirements: an item requires its band's level in the matching skill
    (weapons → style skill; armor/offhand → Defense). **⚠ requirement rule**

---

## 5. Weapon Archetypes — Speed as identity

*(Structure per concept doc: Speed is largely a fixed weapon identity.)* All weapons
of a tier share the same **damage-per-second budget**; they differ in rhythm: **⚠ all**

| Archetype | Interval | Per-hit damage vs. budget | Feel |
|---|---|---|---|
| Fast (dagger, wand) | 1.8 s | ×0.72 | Rapid chip; loves flat-damage bonuses; hurts most against Armor |
| Standard (sword, bow) | 2.5 s | ×1.00 | The reference rhythm all math in this doc assumes |
| Heavy (hammer, greatstaff) | 3.5 s | ×1.40 | Big slow hits; punches through Armor; hates Block (each miss/block costs more) |

This creates honest gear texture *within* the even slot budget: archetypes are
equal on the target dummy, different against real mitigation profiles — exactly what
the SCB's Power Profiles are built to expose.

---

## 6. Enemy Budgets — banded every 5 levels

*(Owner-locked: enemies are authored at ~5-level bands — 5, 10, 15 … 95 — ≈19 budget
points; enemies are stat blocks + style + optional statuses, no ability scripting.)*

Band budgets (tuned against the reference fight, worked math in §8): **⚠ all constants**

| Enemy stat | Formula | Value at band 20 |
|---|---|---|
| HP | 32·G(band) | ≈ 74 |
| Damage per hit | 9·G(band) | ≈ 21 |
| Attack interval | 3.0 s typical (2.2–4.0 by personality) | 3.0 s |
| Armor / Block / Accuracy / Crit | 0 by default; individual enemies buy deviations (tanky, dodgy, accurate…) by paying HP or Damage out of the same budget | 0 |
| Style | melee / ranged / magic — drives RPS (§9) | varies |
| Statuses | optional (e.g., poison-on-hit), priced by the SCB as a budget deviation | — |

The **budget trade rule** is what creates enemy variety without new systems: a
"Golem" at band 20 might spend 30% of its HP budget on Armor; a "Goblin" trades
Damage for Block. Total budget value stays constant per band — the SCB's job is
verifying deviations were actually paid for (its mis-leveling audit, SCB doc §7).

> **Implementation note (2026-07-12):** the engine derives every enemy's stat
> block from a `level` field at registry load. Per-stat budget trades await the
> status-system pass; in the interim an optional `budgetScale` field scales
> HP/damage/XP together (e.g. tutorial skeletons at 0.25 — below-band pushovers
> the G-curve can't express, since there is no level 0).

XP award per kill scales **super-linearly** with band — ≈ 12·G(band)^1.15 **⚠** — so
on-level content is always XP-optimal and punching down is loot-limited, per the
owner's D1 answer in the targets doc ("one 3,000 XP Goblin Captain beats ten 15 XP
chickens").

---

## 7. The Fight Pipeline (order of operations)

The engine resolves each attack in this exact order — this section is effectively
the engine's core loop spec:

1.  **Timers:** each combatant's action timer fills; on reaching its attack interval,
    it attacks and resets. (Simulated clock, per SCB doc §3B.)
2.  **Hit roll:** hit chance = **75** (base, owner-locked)
    ± 0.25 per level of (attacker style skill − defender Defense) **⚠**
    + attacker Accuracy − defender effective Block, then RPS modifier (§9),
    clamped to **5–95**. One roll; a miss/block ends the attack.
3.  **Damage roll:** per-hit damage × uniform **0.85–1.15** spread. **⚠**
4.  **Crit roll:** crit chance (innate 5% + gear); on success ×2.0 damage.
    *(Owner-locked anchor.)*
5.  **Armor:** subtract defender's flat Armor (after crit — crits are for punching
    through armor, per the concept doc). Minimum 1 damage. **⚠ ordering**
6.  **Statuses:** on-hit statuses roll last; periodic statuses tick on the clock,
    not on attacks.

No energy anywhere in this pipeline *(owner-locked)*: combat costs HP only; food is
the fuel, energy stays a loop-task resource. (This resolves SCB open question B3.)

---

## 8. Proof Against the Balance Targets — the reference fight at CL 20

Geared reference hero (all skills 20, full band-20 kit) vs. band-20 enemy:

*   **Hero:** HP ≈ 161 (115 × 1.4) · damage ≈ 15.7/hit (9.2 × 1.71) · 2.5s interval ·
    hit 75% · crit 5%/2× · armor absorbs ~8/hit · block ~12%.
*   **Enemy:** HP 74 · damage 21/hit · 3.0s interval · hit 75%.

**Time-to-Kill:** hero DPS = 15.7 × 0.75 × 1.05 ÷ 2.5 ≈ 4.9 → TTK ≈ 74 ÷ 4.9 ≈
**15.0 s** ✓ (target T1: 10–20s).

**HP cost:** in 15s the enemy attacks 5 times, lands ~3.75, block saves ~0.45 →
~3.3 hits × (21 − 8 armor) ≈ 43 HP ≈ **27% of max HP** ✓ (target T5: ~25%).

**Sustainability:** ~43 HP lost per ~20s cycle (fight + loop overhead) must be met by
food throughput ≥ ~65 HP/cycle for the 1.5× provisional margin (target T6/T8) — this
becomes the anchor for pricing cooked food healing values when consumables are specced.

**Naked check (target T9):** naked hero vs. same enemy — DPS 2.9 → TTK ≈ 26s, while
absorbing ~5.6 unmitigated hits ≈ 118 HP vs. 115 max: a near-certain narrow loss.
Geared-vs-naked ≈ 5× effectiveness ✓, and "gear is vital" is literal.

**Verified 2026-07-11 by the curve-explorer prototype** (`tools/curve_explorer.html`,
Monte Carlo, 2,000 fights/cell, seeded): at all seven checkpoints the reference fight
lands at 15.0s median TTK, 22–24% HP cost per kill, 100% win rate, and exactly ~4
kills-to-death with no healing; the naked hero wins only ~32% on-level ("gear is
vital" confirmed); punching up matches target D2 (at CL 50: +10% level = expensive,
+20% = 1–2 kills, +30% = 25% win rate — **owner reviewed and signed off on these
punch-up numbers as balanced**). Kill-time volatility measured ±50% at the 90% band;
owner accepted this as the design (targets doc T13 updated from the ±30% provisional).
The ⚠ constants remain first-calibration values, but they now have empirical backing.

---

## 9. RPS Modifiers

*(Owner-locked swing: ~25% felt difference.)* **Melee > Ranged > Magic > Melee**
*(owner-locked 2026-07-10 — the classic orientation: warriors close on archers,
archers pick off mages, mages melt armored warriors).*

Favorable matchup: **+10% damage, +7 hit chance**; unfavorable: **−10% damage, −7 hit
chance**. Net effect on TTK ≈ ±25% between best and worst matchup ✓. Applied as the
final step of the hit roll and damage roll. **⚠ exact split**

---

## 10. XP Curve

*(Owner-locked pacing: first 99 in ~6 weeks of focused play; endgame = maxing many
skills across the 3–5 hero roster.)*

*   XP to advance level L → L+1: **X₀ · 1.09^L** with X₀ ≈ 80. **⚠**
*   XP income grows too (≈ G^1.15 per kill, §6, and kill rate is roughly constant),
    so *time per level* stretches gently rather than exploding: early levels take
    minutes, band-70 levels take a day-ish, the last few levels take several days
    each.
*   Rough integration target: **level ~70 at ~4 weeks** (late-game entry, matching
    the targets doc §6), **99 at ~6 weeks** focused. Non-focused/roster-split play
    stretches proportionally. **⚠ needs curve-explorer verification** — this is the
    least certain math in the document because it depends on kill-rate assumptions
    the loop's pacing (draw/shuffle overhead) ultimately controls.

---

## 11. What This Document Deliberately Leaves Open

1.  **Consumable/food numbers** — the §8 sustainability anchor (≥ ~65 HP restored
    per fight cycle at CL 20, scaling with G) is the requirement; actual food items,
    tiers, and costs belong to a provisioning/economy spec.
2.  **Status-effect catalog** — the registry vocabulary and starter statuses (SCB
    open question B5) remain the next planning document after this one.
3.  **Preparation-buff sizing** — targets doc locks ~25% total; distributing it
    across Cooking/Alchemy/Occult buff slots belongs with the consumables spec.
4.  **Every ⚠ constant** — pending the curve-explorer prototype (SCB doc §11 prep
    item 4), which is now clearly the next *technical* step: implement G(L), the §7
    pipeline, and §8's arithmetic as a throwaway calculator and let the owner see
    checkpoint fights before the real engine is built.

---

## Appendix A — Decision Log (formula spec session, 2026-07-10)

| # | Decision (owner-locked) |
|---|---|
| F1 | Hero level = **Combat Level**, derived from the 4 combat skills — motivates cross-style training |
| F2 | Combat Level = **average of all 4** combat skills; specialists are glass cannons by construction |
| F3 | Equipment slots = **Classic 6**: Weapon, Offhand, Helmet, Chest, Boots, Trinket |
| F4 | **No energy cost in combat** — HP/food is the only combat attrition currency (resolves SCB B3) |
| F5 | Enemies = **stat blocks + statuses**, no ability scripting (resolves SCB B4) |
| F6 | Items = **generated tier families + hand-authored uniques** (resolves SCB B7) |
| F7 | Number scale = **moderate**: ~×50–100 power from 1→99, late-game hits in the thousands |
| F8 | Gear power budget = **even six-way split** across slots (owner chose over weapon-dominant) |
| F9 | XP pacing = **~6 weeks to first 99** focused; endgame is maxing many skills |
| F10 | Roster = **3–5 specialist heroes** covering the styles collectively |
| F11 | Full defensive gear ≈ **halves** incoming damage vs. naked |
| F12 | Enemy levels authored in **~5-level bands** (≈19 budget points, one gear tier each) |

## Appendix B — Implementation Log

| Date | What landed |
|---|---|
| 2026-07-12 | **First engine pass implemented** (FormulaRegistry/CombatFormulas + live loop-combat processors): G(L), §3 hero HP/damage from skills, §6 band-derived enemy budgets, §7 pipeline (hit/damage/spread), §9 RPS (+7 hit/+10% dmg, correct orientation), weapon-determined style, no energy in combat (F4), kill XP = full to weapon skill + ⅓ to Defense. **Deferred:** Crit, Armor (gear), weapon-speed archetypes — hooks are in place at 0/neutral. **Deviations (owner-approved):** innate Block from Defense (§3); `budgetScale` interim knob (§6); existing weapon `damage` values wired in as a flat placeholder until gear is budget-priced (§4); XP *leveling* curve (§10) not yet swapped — XPCurve.js still uses the old table, pending pacing calibration. |
