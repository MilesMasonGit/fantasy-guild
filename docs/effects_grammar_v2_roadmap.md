# Effects Grammar v2 — roadmap

*The authoritative plan. Written 2026-09-08, expanded the same day after the
query-language session. The vision half is
[`concept_effects_grammar_v2.md`](concept_effects_grammar_v2.md).*

**Supersedes P5–P7 of [`effects_robustness_roadmap_v1.md`](effects_robustness_roadmap_v1.md).**
That document's P1, P2 and P4 are **done and stay done** — the filter fix, the
reach vocabulary and the two narrowed axes. Its §3 vocabulary sweep remains
useful inventory. Its P5/P6/P7 are replaced by what follows.

**Do not re-litigate §1.** Those are owner rulings from the 2026-09-08 sessions.

---

## 1. Locked decisions

### The shape of the system

| # | Decision | Why |
|---|---|---|
| **G-1** | **One library, no second registry.** `statusRegistry.js` and its five private effect types are deleted. Every rule in the game is a library effect. | The owner's words: *"I want one clear repository for all these effects and rules."* A status was never a different kind of thing — it was a rule with a clock, kept in its own file with its own vocabulary. |
| **G-2** | **A moment declares the roles it supplies; a target may only name a role its moment has.** | The whole defence against the targeting vocabulary becoming unbounded. It is also the principle the grammar already runs on — `KEYWORDS` declares `filter`, `when` and `upkeep` legality, and the editor cannot offer an illegal combination. |
| **G-8** | **No guards, and no condition language.** A filter narrows **who** a rule hits. A *guard* — "only fire if the hero is below half HP" — is refused. | Owner's ruling, taken with the distinction stated: a filter renders as one honest sentence, a guard wants AND/OR/NOT and a boolean tree has no sentence. This is the slope `restrictionPalette.js` already refuses in as many words. |
| **G-9** | **Filters are composable and stackable, AND-composed.** A statement picks a source set, then stacks any number of filters on it. | Owner's pick. This is the *"robust and detailed vocabulary"* the owner asked for, bounded by G-2 and G-8. Adding filter #20 is one row plus one predicate, never a redesign. |
| **G-10** | ⭐ **The sentence is absolute — AND the sentence language is itself a design surface.** When a rule reads badly, **improve the syntax**; treat it as evidence of a bad feature only if it cannot be made literal. | The owner's refinement of my proposal, and a better rule than the one I offered. Their words: *"I want the rules sentences to be unified and literal, so it communicates everything the player needs to know, based off the actual mechanics happening."* The sentence is the validation loop that replaced hand-written descriptions (UE-8); it is not a ceiling on what may be built. |

### What can be said

| # | Decision | Why |
|---|---|---|
| **G-11** | **Verbs: `Deals`, `Heals`, `Restores`, `Removes`, `Spawns`, `Transforms`.** Each ships **with its reader** or not at all. ⚠️ **`Moves`/displace is NOT in scope.** | Owner's picks. Nine keywords and not one of them does anything to a person. `Moves` was offered and declined — "where to" and "what if occupied" have no answers, and a verb with undecided targeting is how one slice becomes three. |
| **G-12** | **Filters: state** (charges, HP, working/idle), **what it carries** (effects, tags, capabilities), and **negation**. ⚠️ **Terrain filters were offered and DECLINED.** | Owner's picks. Terrain is recorded as declined rather than deferred, so it stops being re-raised — I had flagged it as the largest gap in the v1 sweep and the owner does not want it. |
| **G-13** | **Magnitudes may be computed**, from a closed list: a flat number, a **percentage of a named stat on a named role**, or a **count of a selector's matches**. | Owner's pick over flat-only. Closed and declared, so it still renders — *"damage equal to 10% of the target's max HP"* — and still audits. Not arithmetic, not formulas. |
| **G-14** | **A statement may carry a second, `counted` selector**, used only to produce a number. | Owner's pick. *"+1% yield to every adjacent Token, per adjacent Coast Token"* counts one set and affects another; they are genuinely different sets and conflating them makes the common shape unsayable. |
| **G-15** | **`Spawns` chooses its destination from a declared vocabulary: the bearer's tile, the nearest free tile, or a random free tile.** | Owner's answer, and better than any option offered — it makes the destination something the **author picks and can see**, rather than a hidden fallback rule. Needs no tile-selector vocabulary, so filters keep meaning "entities" only. |

### Runtime

| # | Decision | Why |
|---|---|---|
| **G-6** | **Any entity may carry live effect instances** — `{ effectId, scale, expiresAt }`. Heroes, monsters and Tokens alike. | The only genuinely new runtime concept. It is what `hero.statuses` already is, generalised from five hardcoded types to the whole library. ⚠️ **Reverses ER-3.** |
| **G-16** | **Re-application refreshes the timer. One effect on an entity means one instance.** | Owner's pick. Keeps the readout legible and means an effect can never quietly compound into something nobody authored — which is what made a 99-stack Poison possible. |
| **G-5** | **The 1–5 tier is the magnitude control; charge cost is per-bearer.** A reference is `{ effectId, scale, chargeCost? }`. | Owner's pick. *Thorns III* is 3 damage, so UE-9's numeral keeps meaning something, while the same Thorns can be free on a bush and cost a charge on a monster. ⚠️ **Reverses UE-20.** |
| **G-17** | **Chaining is allowed** — an effect may apply another effect — and is bounded by the **existing structural guard**, not by author discipline. | Owner picked chained effects. `TriggerSystem` already carries an in-flight re-entry guard and a cascade depth cap built for exactly this shape, because a cooldown is a rate limit and not a recursion limit. |
| **G-7** | **The seven shipped statuses are RE-AUTHORED, never translated.** `ContentAudit` names any that has not been. | Carried from ER-12. `attack_fail` → a negative `ACCURACY` against a 5–95 clamp is not the same arithmetic as "25% per stack capped at 80%". A quiet half-translation is the failure this whole line of work exists to remove. |

## 2. The shape

```
[ When <moment>, ]  VERB  <magnitude>  [ to <selector> ]  [ per <counted selector> ]  [ for <duration> ]
      the trigger          how much        who              what scales it              how long
```

A **selector** is a source set plus stacked filters:

```
<source>  [ where <filter> ]  [ where <filter> ] …
```

| Source | Means | Role needed |
|---|---|---|
| this entity | the bearer | `self` |
| adjacent to this entity | today's filter | `self` |
| every Token on the board | P2's reach | `self` |
| **the actor** | ⭐ the hero who caused this moment | `actor` |
| the tile the actor is working | | `actor` |
| adjacent to the actor | | `actor` |
| the entity that caused this | | `source` |

### Moments and the roles they supply

⚠️ **Two payloads are short and must be widened first** — verified 2026-09-08:

| Moment | Supplies today | Needs |
|---|---|---|
| `CYCLE_COMPLETE` / `SELF_CYCLE_COMPLETE` | `{tile, typeId, heroId, failed, produced}` | ✅ nothing — `heroId` **is** the actor |
| `COMBAT_ENGAGED` / `SELF_COMBAT_ENGAGED` | `{tile, typeId, heroId}` | ✅ nothing |
| `CYCLE_START` / `SELF_CYCLE_START` | `{tile, typeId}` | ⚠️ **`heroId`** — in scope at the publish site, simply not passed |
| `COMBAT_RESOLVED` | `{tile, outcome}` | ⚠️ **`heroId` and `typeId`** |
| `TOKEN_DEPLETED` | `{tile, typeId}` | — no actor exists; supplies `self` only, correctly |
| `ITEM_THRESHOLD` | (the Bank) | — no tile and no actor |

### The verbs

Existing, unchanged: `Provides`, `Grants`, `Acts as`, `Requires`, `Restocks`,
`Converts`, `Cannot`, `Works as`.

⭐ **`Applies` survives with a new payload and does double duty.** It attaches a
**library effect** rather than a status — and that single change deletes the
status registry. With a duration it is an over-time effect; **without one it
fires the named effect immediately, which is how chaining works** (G-17). One
verb, both shapes, no new concept for combos.

| New verb | Does | Reader that already exists |
|---|---|---|
| `Deals` | damage to a selector | `HeroManager.modifyHeroHp`, `fight.combat.enemyHp` |
| `Heals` | hp to a selector | the same two |
| `Restores` | charges to a Token | `Charges.applyDelta` — `CHARGE_EXTEND` finally gets a reader |
| `Removes` | a live effect from a selector | `StatusEffectSystem.purge`, written and **called by nothing** |
| `Spawns` | puts a Token on the board | `SpriteLayer.addSprite` / `Placement.placeToken` |
| `Transforms` | this Token becomes another | `BoardState.setToken` |

## 3. The phases

Each is one sitting, verified in the real CMS and the real game, committed at the
end. **The owner chose Thorns-first sequencing**: build the spine that makes
their own example work, prove it in play, then widen onto tested ground.

⚠️ **Expressiveness lands at V3–V4, before the risky deletion at V6.** The
owner's stated pain is *"I can't express the effects I'm imagining"* — not
turnaround speed — so the filter and magnitude vocabulary is sequenced ahead of
the status absorb, which is the biggest and most destructive slice.

### V1 — Moments declare their roles *(groundwork, no new behaviour)*

* `TRIGGER_EVENTS` rows gain `roles: [...]`.
* `CYCLE_START` publishes `heroId`; `COMBAT_RESOLVED` publishes `heroId` and
  `typeId`. One-line widenings at sites where the value is already in scope.
* A resolver turning `(moment, payload, bearerTile)` into the live role map.
* `ContentAudit` learns G-2: a target naming a role its moment does not supply.

**Verified when** every moment reports its roles, the two widened payloads carry
an actor, and nothing a player can see has changed.

### V2 — ⭐ `Deals`, `the actor`, and Thorns

The phase the whole project is judged by.

* The `Deals` verb, resolved against a hero or a live enemy.
* The `actor` source.
* Per-bearer `chargeCost` on the reference (G-5).
* **Author Thorns** and assign it to `token_thorn_elemental` **and** to a berry
  bush.

**Verified when** one library entry, assigned twice, hurts a hero who kills the
Elemental **and** a hero who harvests the bush — watched in the running game.

### V3 — Composable filters

* A selector becomes source + stacked filters, AND-composed (G-9).
* **State** filters: charges remaining, HP, working/idle.
* **Negation** on every filter (G-12).
* Sentence syntax extended to render stacked filters legibly (G-10).

⚠️ The **"carries effect X"** filter waits for V5, when live instances exist for
it to look at.

### V4 — Computed magnitudes

* A magnitude becomes flat, **percentage of a named stat on a role**, or **a
  count** (G-13).
* The second `counted` selector (G-14).

**Verified when** *"+1% yield to every adjacent Token, per adjacent Coast Token"*
is authorable, reads as one sentence, and moves the right number.

### V5 — Live effect instances, duration, and chaining

* An entity carries `effects: [{ effectId, scale, expiresAt, sourceId }]` (G-6).
* One clock ticks them; expired instances are dropped. Re-application refreshes
  (G-16).
* `Applies` retargeted from a status id to a library effect reference — **with a
  duration it is over-time, without one it chains** (G-17), bounded by the
  existing cascade guard.
* The **"carries effect X"** filter from V3.
* ⚠️ **`hero.statuses` is save-resident and deliberately not stripped**
  ([`GameState.js:21`](../src/state/GameState.js)). Needs a save migration.

### V6 — The seven, re-authored; the old engine deleted

* Poison, Burning, Bleed as `Deals` on the clock. Armor Shield, Well Fed,
  Cookout, Stun as `Provides` with a duration.
* `statusRegistry.js`, its five effect types and its five decay triggers deleted.
* The eight `sumStatusEffect` call sites become ordinary reads.
* ⚠️ `DAMAGE` needs a **percentage bucket and a reader** first.
* ⚠️ **Enemies need a `ModifierAggregator`** — the old ER-10, and it belongs
  here. (Verified: on its own it would have had no writer — `enemy.armor` is
  never set by anything, and P7 routes an enemy's own `Provides` onto the
  *hero's* aggregator by design.)
* A minimal status readout, so any of this can be watched (ER-17 stands).

### V7 — The rest of the verbs

`Heals`, `Restores`, `Removes` — each with its reader, each its own commit.
`Removes` finally gives `purge()` a caller.

### V8 — `Spawns` and `Transforms`

With the declared placement vocabulary: the bearer's tile, the nearest free tile,
or a random free tile (G-15).

### Deliberately out of scope

* **Guards and any condition language** (G-8).
* **`Moves`/displace** (G-11) — offered and declined.
* **Terrain filters** (G-12) — offered and **declined by the owner**, not
  deferred. Stop raising them.
* **The bearer's own state as a magnitude source** — offered and not picked.
* **Statuses as CMS-authored content** — they *become* library effects, which are
  already CMS-authored, so this dissolves rather than being deferred.

## 4. Implementation status

| Phase | State | Notes |
|---|---|---|
| V1 Moments declare roles | **NOT STARTED** | |
| V2 `Deals`, the actor, Thorns | **NOT STARTED** | ⭐ The example the plan is judged by |
| V3 Composable filters | **NOT STARTED** | |
| V4 Computed magnitudes | **NOT STARTED** | |
| V5 Live instances, duration, chaining | **NOT STARTED** | Needs a save migration |
| V6 The seven re-authored | **NOT STARTED** | Absorbs the old ER-10 |
| V7 The rest of the verbs | **NOT STARTED** | |
| V8 `Spawns` and `Transforms` | **NOT STARTED** | |

*Carried over and already done:* v1 P1 (the filter tells the truth), P2 (reach),
P4 (`STATUS_IMMUNITY` and the skill scope). v1 P3 — authoring real effects on
items and the one enemy — is **still outstanding and still the owner's**; V2 does
part of it by authoring Thorns.

## 5. Open questions

**Q1 — Does `Deals` respect Armor?** A thorn that ignores armour and one that
does not are different game feels. Today's DoT ticks are **true damage** and
bypass Armor and Block by an owner ruling (2026-07-12) — but that was a ruling
about poison, not about every future action. **Blocks V2.**

**Q2 — What happens to a live save's statuses at V5?** A save holds
`[{ id: 'poison', stacks: 7 }]`, and the new shape has no stacks. Drop them on
load and let the player re-earn them, or map stacks onto a scale? Dropping is
honest and cheap; mapping invents a number.

**Q3 — Can a Token carry a live effect instance, or only heroes and monsters?**
G-6 says any entity. Nothing yet wants a temporarily-cursed Forest, and building
the general case before something needs it is the trap this project keeps naming.
V5 may ship heroes and monsters only.
