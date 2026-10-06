# CMS Balance Engine & Solver Architecture Plan (Revised v2)

## Overview & Core Paradigm

Based on user direction and review feedback, we **decouple per-cycle velocity (GPH) from token lifetime capacity (Charges)** into two distinct, sequential calculation stages:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: CYCLE VELOCITY & ITEM VALUE DERIVATION (Per-Cycle Economics)                    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Skill Velocity Targets (e.g., Lvl 1 = 1200 g/hr) establish baseline labor value/sec.  │
│ 2. Root anchor tokens derive root item values from cycle rate:                           │
│    Value(Item) = TargetGPH / (CyclesPerHour × ExpectedYieldPerCycle)                     │
│    (e.g., 1200 g/hr / (300 cycles/hr × 2 Oak Wood) = 2.0g per Oak Wood)                 │
│ 3. Value propagates through recipes/stations with configurable craft markup dial.        │
│ 4. Non-anchor tokens tune cycle levers (Chance, Quantity Range) to match Target GPH.     │
└────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: LIFETIME VALUE & CHARGE CAPACITY BALANCING (Macro Economics)                    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Map Price + Materials defines Map acquisition cost & burst pool allocation.           │
│ 2. Token Lifetime Target Value is established via target ROI dial (e.g., Map burst ROI). │
│ 3. Charges are set or verified to prevent over-production:                               │
│    Charges = TargetLifetimeValue / ExpectedValuePerCycle                                 │
│    (or AFK-duration target in hours × cycles/hour)                                       │
└────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: COMBAT & ENEMY LOOT BALANCING (CMS-51 Decoupled Valuation)                      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero time dimension: Evaluated strictly as Total Lifetime Loot Value vs. Cost.        │
│ 2. Tunes Loot Drop Chances (snapped to 5%/1%) and Quantities to hit target encounter EV. │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Mathematical Model

### Stage 1: Cycle Velocity & Item Value Derivation (GPH Balancing)

#### 1.1 Root Item Valuation from Target Velocity
For a designated root gathering token (the primary anchor for a raw resource, e.g., Oakwood Grove for Oak Wood):
- Given cycle time $T_{\text{cycle}}$ (seconds), the token runs $N_{\text{cycles/hr}} = \frac{3600}{T_{\text{cycle}}}$ cycles per hour.
- Given expected yield per cycle $E[Y] = q_{\text{avg}} \times p_{\text{drop}}$.
- For a skill level with target velocity $V_{\text{target}}$ (e.g. $1200\text{ g/hr}$ at Level 1):
$$\text{Value}(\text{Item}) = \frac{V_{\text{target}}}{N_{\text{cycles/hr}} \times E[Y]} = \frac{V_{\text{target}} \times T_{\text{cycle}}}{3600 \times q_{\text{avg}} \times p_{\text{drop}}}$$

*Example*: Oakwood Grove ($T = 12\text{s}$, $q = 2$, $p = 1.0$, Level 1 target = $1200\text{ g/hr}$):
$$\text{Value}(\text{Oak Wood}) = \frac{1200 \times 12}{3600 \times 2 \times 1.0} = \mathbf{2.0\text{ g}}$$

#### 1.2 Multi-Output Root Split (CMS-105)
For tokens with multiple outputs (e.g., Trout Stream producing Fish and Raw Shrimp):
- Total cycle target value $V_{\text{cycle}} = \frac{V_{\text{target}} \times T_{\text{cycle}}}{3600}$.
- Allocated across outputs based on authored weight / rarity factor $w_i$:
$$\text{Value}(\text{Output}_i) = \frac{V_{\text{cycle}} \times \left(\frac{w_i}{\sum w}\right)}{E[Y_i]}$$

#### 1.3 Value Propagation Through Recipes (Downstream Chains)
For refining and crafting stations:
- Input cost: $C_{\text{inputs}} = \sum (\text{Qty}_j \times \text{Value}(\text{Input}_j))$.
- Crafting labor / markup: $M_{\text{craft}} = 1 + \text{markupDial}(\text{level})$ (default dial: $+5\%$ baseline scaling with skill tier).
$$\text{Value}(\text{Output}) = \frac{C_{\text{inputs}} \times M_{\text{craft}}}{E[Y_{\text{output}}]}$$
- Multi-source items take the **cheapest acquisition path** as their global sell value anchor (CMS-45).

#### 1.4 Non-Anchor Cycle Solver (Tuning Levers to Match GPH)
For non-anchor tokens producing an already-valued item:
$$\text{GPH}_{\text{implied}} = \frac{\text{Value}(\text{Item}) \times E[Y]}{T_{\text{cycle}}} \times 3600$$
The solver tunes $E[Y]$ to bring $\text{GPH}_{\text{implied}}$ into the velocity band ($\pm 5\%$ tolerance):
1. **Steady Metronome (Authored Chance = 100%)**:
   - Preserve $p = 100\%$.
   - Tune Quantity Min-Max Range (shifting the midpoint $[min, max]$ while preserving authored spread $\Delta = max - min$, CMS-41).
2. **Probabilistic Drops (Authored Chance < 100% or Secondary Output)**:
   - Tune Drop Chance $p$, bounded within $[10\%, 100\%]$, snapped to $10\% \to 5\% \to 1\%$.
3. **Restraints & Invariants**:
   - Cycle time $T_{\text{cycle}}$ remains within $[10\text{s}, 30\text{s}]$ (D-164) and is only adjusted as a last resort.
   - Refuse and raise Critical Audit Error if solution requires yield $< 1$, chance $< 10\%$, or cycle time outside bounds.

---

### Stage 2: Token Charges & Lifetime Value Balancing (Macro Capacity)

Once per-cycle item value and per-cycle EV are set:
- **Map Burst Target Value**: $V_{\text{burst}} = (\text{MapGoldPrice} + \text{MaterialValue}) \times \text{SellRatio}$.
- **Token Slice**: Allocated to tokens according to inverse pool weight (CMS-103).
- **Target Lifetime Value**: $V_{\text{lifetime}} = \text{TokenSlice} \times \text{UsageMultiplier}$ (dial in globals, e.g. 10×–50× ROI representing AFK gameplay value).
- **Charge Solver / Validator**:
$$\text{Charges} = \text{round}\left(\frac{V_{\text{lifetime}}}{\text{EV}_{\text{cycle}}}\right)$$
- Alternatively, for tokens with fixed authored AFK targets (e.g. 16 hours of cycles):
$$\text{Charges} = \frac{16 \times 3600}{T_{\text{cycle}}}$$
  The solver computes the implied Lifetime ROI and validates that it falls within acceptable economy bounds (raising an audit warning if a token produces disproportionate lifetime value).

---

### Stage 3: Combat / Enemy Loot Balancing (CMS-51)

Enemies have **zero time dimension** (combat speed deferred):
- Objective function: $\text{TargetLootEV} = \text{EncounterCost} \times \text{CombatEVMultiplier}(\text{level})$.
- Solver tunes **Drop Chances** (snapped to 5% / 1%) and **Loot Quantities** so:
$$\sum (p_k \times q_k \times \text{Value}(\text{Item}_k)) = \text{TargetLootEV}$$

---

## 2. Convergence & Iteration Safeguards

Because Maps consume materials whose values are derived through this pipeline (CMS-108 circularity):
- Outer relaxation loop feeds updated material costs back into Map bursting calculations.
- **Iteration Cap**: Maximum 10 iterations.
- **Oscillation Detection**: State hashing to detect 2-state snapping limit cycles and terminate cleanly.
- **Convergence Condition**: $\max |\Delta \text{Value}_{\text{items}}| < 0.01\text{g}$.

---

## 3. CMS Decision Updates (CMS-109 through CMS-114)

1. **CMS-107**: Marked *RESOLVED*, pointing to CMS-109 through CMS-114.
2. **CMS-109 — Decoupled Cycle Velocity vs. Lifetime Capacity**: Per-cycle GPH and item values are derived independently of token charge counts.
3. **CMS-110 — Cycle Lever Policy**: Resource steady metronomes tune Quantity Ranges (preserving spread); probabilistic/secondary drops tune Chance (snapped 10/5/1%); crafting main outputs lock at 100% chance.
4. **CMS-111 — Min-Max Spread Preservation (CMS-41 Protection)**: Quantity range adjustments shift the range center while maintaining authored variance $(\text{max} - \text{min})$.
5. **CMS-112 — Restraint Invariants & Hard Audit Refusals**: Explicit refusal rules (D-164 cycle 10–30s, chance $\ge 10\%$, yield $\ge 1$, no negative craft margins).
6. **CMS-113 — Combat Loot Valuation (CMS-51 Pure Lifetime EV)**: Combat drops solved on encounter value vs. cost with no cycle time dimension.
7. **CMS-114 — Convergence Safeguards**: Iteration capped at 10 passes with oscillation detection on discrete snapping steps.

---

## 4. Technical Implementation Structure

```
cms/src/engine/
├── velocityCalculator.js    # [NEW] GPH/XPH target curves & per-cycle labor valuation (Stage 1)
├── anchorCalculator.js      # [NEW] Root item pricing from velocity + multi-output split (CMS-105)
├── valuePropagator.js       # [MODIFY] Topological DAG propagation with craft markup dial & cheapest-path anchor (CMS-45)
├── tokenSolver.js           # [NEW] Non-anchor cycle lever tuning (Quantity/Range/Chance/Spread preservation)
├── chargeSolver.js          # [NEW] Stage 2: Token charge capacity & lifetime value validation
├── combatLootSolver.js      # [NEW] Stage 3: CMS-51 pure lifetime EV loot solver
├── balanceRunner.js         # [NEW] Master orchestrator with convergence & oscillation guards (CMS-16)
└── connectivityAuditor.js   # [MODIFY] Integrates solver refusal defects into AuditPanel.jsx
```

---

## Verification Plan

### Automated Calculators Verification
- Unit test suite testing pure calculation engines in isolation:
  - Verify Oakwood Grove at Level 1 derives Oak Wood at ~2.0g and GPH = 1200 g/hr.
  - Verify non-anchor resource tokens tune quantity/chance into the $\pm 5\%$ band.
  - Verify range spread preservation (e.g. $[2, 4] \to [3, 5]$, not $[4, 4]$).
  - Verify charge solver computes sensible charges for 16h AFK targets.
  - Verify 10-iteration cap and oscillation break on cyclic snapping.

### Game Content Rule Compliance
- Run the game engine content tests to guarantee 100% green status:
  ```powershell
  npm test -- src/tests/ContentRules.test.js
  ```
