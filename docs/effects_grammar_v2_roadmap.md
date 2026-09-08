# Effects Grammar v2 — roadmap

*The authoritative plan. Written 2026-09-08. The vision half is
[`concept_effects_grammar_v2.md`](concept_effects_grammar_v2.md).*

**Supersedes P5–P7 of [`effects_robustness_roadmap_v1.md`](effects_robustness_roadmap_v1.md).**
That document's P1, P2 and P4 are **done and stay done** — the filter fix, the
reach vocabulary and the two narrowed axes are all in `main`'s history on
`effects-robustness`. Its §3 vocabulary sweep remains useful inventory. Its
P5/P6/P7 are replaced by what follows.

**Do not re-litigate §1.** Those are owner rulings from the 2026-09-08 session.

---

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| **G-1** | **One library, no second registry.** `statusRegistry.js` and its five private effect types are deleted. Every rule in the game is a library effect. | The owner's words: *"I want one clear repository for all these effects and rules."* A status was never a different kind of thing — it was a rule with a clock, held in its own file with its own vocabulary. |
| **G-2** | **A moment declares the roles it supplies; a target may only name a role its moment has.** | This is the whole defence against a targeting vocabulary becoming a query language. It is also the principle the grammar already runs on — `KEYWORDS` declares `filter`, `when` and `upkeep` legality, and the editor cannot offer an illegal combination. Roles extend that, they do not add a new idea. |
| **G-3** | **A fuller action set.** Verbs that *act*: `Deals`, `Heals`, `Restores`, `Removes`. Owner's pick over the minimal two. | Nine keywords and not one of them does anything to a person. Each verb ships **with its reader** or not at all — the rule `modifierPalette.js` states in its own header, and the rule the deleted 56-entry library needed. |
| **G-4** | **A full relationship vocabulary**, bounded by G-2. Owner's pick over the minimal one. | *"We need to be able to create terminology that is generalized enough to work with both"* — the bush and the monster. G-2 is what stops "full" meaning "unbounded". |
| **G-5** | **The 1–5 tier stays the magnitude control; charge cost becomes per-bearer.** A reference is `{ effectId, scale, chargeCost? }`. | Owner's pick. Keeps UE-9's numeral meaningful (*Thorns III* is 3 damage) and one name meaning one behaviour, while letting the same Thorns be free on a bush and cost a charge on a monster. ⚠️ **Reverses UE-20.** |
| **G-6** | **Any entity may carry live effect instances** — `{ effectId, scale, expiresAt }`. Heroes, monsters and Tokens alike. | The only genuinely new runtime concept. It is what `hero.statuses` already is, generalised from five hardcoded types to the whole library. ⚠️ **Reverses ER-3** — a hero carrying effects is a bearer. |
| **G-7** | **The seven shipped statuses are RE-AUTHORED, never translated.** `ContentAudit` names any that has not been. | Carried forward from ER-12, and it matters more here: `attack_fail` → a negative `ACCURACY` against a 5–95 clamp is not the same arithmetic as "25% per stack capped at 80%". A quiet half-translation is the failure this whole line of work exists to remove. |
| **G-8** | **No condition language.** No *while*, no *unless*, no booleans. Four slots: when, what, to whom, how long. | The slope `restrictionPalette.js` already refuses in as many words. A rules engine is what this becomes if the refusal ever lapses. |

## 2. The shape

```
[ When <moment>, ]  VERB  <payload>  [ to <target> ]  [ for <duration> ]  [ , costing <charges> ]
```

### Moments and the roles they supply

⚠️ **Two payloads are short and must be widened first** — verified 2026-09-08:

| Moment | Supplies today | Needs |
|---|---|---|
| `CYCLE_COMPLETE` / `SELF_CYCLE_COMPLETE` | `{tile, typeId, heroId, failed, produced}` | ✅ nothing — `heroId` **is** the actor |
| `COMBAT_ENGAGED` / `SELF_COMBAT_ENGAGED` | `{tile, typeId, heroId}` | ✅ nothing |
| `CYCLE_START` / `SELF_CYCLE_START` | `{tile, typeId}` | ⚠️ **`heroId`** — it is in scope at the publish site and simply not passed |
| `COMBAT_RESOLVED` | `{tile, outcome}` | ⚠️ **`heroId` and `typeId`** |
| `TOKEN_DEPLETED` | `{tile, typeId}` | — no actor exists; supplies `self` only, correctly |
| `ITEM_THRESHOLD` | (the Bank) | — no tile and no actor; supplies nothing |

### The roles

| Role | Means |
|---|---|
| `self` | the entity carrying the rule — always available |
| `actor` | the hero who caused this moment |
| `source` | the neighbouring entity that caused it |

### The targets

A role, optionally with a relation. The editor offers only those whose role the
chosen moment supplies (G-2).

| Target | Role | Notes |
|---|---|---|
| this entity | `self` | the bearer itself |
| adjacent to this entity | `self` | today's filter, unchanged |
| every Token on the board | `self` | P2's reach, unchanged |
| **the actor** | `actor` | ⭐ *the opponent, the harvester* — what Thorns needs |
| the tile the actor is working | `actor` | |
| adjacent to the actor | `actor` | |
| the entity that caused this | `source` | |

### The verbs

Existing, unchanged: `Provides`, `Grants`, `Acts as`, `Requires`, `Restocks`,
`Converts`, `Cannot`, `Works as`.

`Applies` **survives with a new payload**: it attaches a **library effect** for a
duration, rather than a status. That single change is what deletes the status
registry.

New, each with its reader named:

| Verb | Does | Reader that already exists |
|---|---|---|
| `Deals` | damage to a target | `HeroManager.modifyHeroHp`, `fight.combat.enemyHp` |
| `Heals` | hp to a target | the same two |
| `Restores` | charges to a Token | `Charges.applyDelta` — and `CHARGE_EXTEND` finally gets a reader |
| `Removes` | a live effect from a target | `StatusEffectSystem.purge`, which is written and **called by nothing** |

⚠️ **`Moves`/displace was offered in the same option and is NOT in this plan.**
`Placement.moveToken` exists, but "move it where, and what if that tile is
occupied" are real design questions with no answer yet, and a verb whose
targeting is undecided is how a slice turns into three. Recorded in §5 as a
question, not built on a guess.

## 3. The phases

Each is one sitting, verified in the real CMS and the real game, committed at the
end. **The order is chosen so the owner's own example works at V2**, not at the
end.

### V1 — Moments declare their roles *(groundwork, no new behaviour)*

* `TRIGGER_EVENTS` rows gain `roles: [...]`.
* `CYCLE_START` publishes `heroId`; `COMBAT_RESOLVED` publishes `heroId` and
  `typeId`. Both are one-line widenings at sites where the value is in scope.
* A resolver turning `(moment, payload, bearerTile)` into the live role map.
* `ContentAudit` learns G-2: a target naming a role its moment does not supply.

**Verified when** every moment reports its roles, the two widened payloads carry
an actor, and nothing a player can see has changed.

### V2 — ⭐ `Deals`, `the actor`, and Thorns

The phase the whole project is judged by.

* The `Deals` verb, with damage resolved against a hero or a live enemy.
* The `actor` target.
* **Author Thorns**: *"When a cycle completes on this entity, deal 1 damage to
  the actor."* Assign it to `token_thorn_elemental` **and** to a berry bush.
* Per-bearer `chargeCost` on the reference (G-5).

**Verified when** the same named effect, from one library entry, hurts a hero who
kills the Elemental **and** a hero who harvests the bush — watched in the running
game, not only in tests.

### V3 — Live effect instances, and duration

* An entity carries `effects: [{ effectId, scale, expiresAt, sourceId }]`.
* One clock ticks them: recurring statements fire, expired ones are dropped.
* `Applies` retargeted from a status id to a library effect reference.
* ⚠️ **`hero.statuses` is save-resident and deliberately not stripped**
  ([`GameState.js:21`](../src/state/GameState.js)). This needs a save migration,
  not just a code change.

**Verified when** an authored Poison lands, ticks, hurts, and expires — and a
hero it kills is wounded exactly as combat wounds them (`hero_downed`, CR2-070:
that branch was a no-op for months and a poisoned hero worked on at 0 HP).

### V4 — The seven, re-authored; the old engine deleted

* Poison, Burning, Bleed as `Deals` on the clock. Armor Shield, Well Fed,
  Cookout, Stun as `Provides` with a duration.
* `statusRegistry.js`, its five effect types and its five decay triggers deleted.
* The eight `sumStatusEffect` call sites become ordinary reads.
* ⚠️ `DAMAGE` needs a **percentage bucket and a reader** before `damage_pct` can
  land on it.
* ⚠️ Enemies need a `ModifierAggregator` before the four enemy-side readers can
  move — this is the old ER-10, and it belongs **here**, not in a phase of its
  own. (Verified 2026-09-08: on its own it would have had no writer at all —
  `enemy.armor` is never set by anything, and P7 routes an enemy's own `Provides`
  onto the *hero's* aggregator by design.)
* A minimal status readout, so any of this can be watched (ER-17 stands).

**Verified when** every one of the seven behaves as it did, checked in play.

### V5 — The rest of the verbs

`Heals`, `Restores`, `Removes` — each with its reader, each its own commit.
`Removes` finally gives `purge()` a caller.

### V6 — The rest of the relationship targets

`the tile the actor is working`, `adjacent to the actor`, `the entity that
caused this`. Each ships only once something authored wants it.

### Deliberately out of scope

* **A condition language** (G-8).
* **`Moves`/displace** — §5.
* **Terrain-aware filters and restrictions** — still the largest untouched gap
  (v1 §3), still its own job.
* **Statuses as CMS-authored content** — they *become* library effects, which are
  already CMS-authored, so this dissolves rather than being deferred.

## 4. Implementation status

| Phase | State | Notes |
|---|---|---|
| V1 Moments declare roles | **NOT STARTED** | |
| V2 `Deals`, the actor, Thorns | **NOT STARTED** | The example the plan is judged by |
| V3 Live effect instances | **NOT STARTED** | Needs a save migration |
| V4 The seven, re-authored | **NOT STARTED** | Absorbs the old ER-10 |
| V5 The rest of the verbs | **NOT STARTED** | |
| V6 The rest of the targets | **NOT STARTED** | |

*Carried over and already done:* v1 P1 (the filter tells the truth), P2 (reach),
P4 (`STATUS_IMMUNITY` and the skill scope). v1 P3 — authoring real effects on
items and the one enemy — is **still outstanding and still the owner's**, and V2
does part of it by authoring Thorns.

## 5. Open questions

**Q1 — What does a `Moves` verb move, and where?** Offered and deliberately not
built. `Placement.moveToken` exists; "to which tile", "what if it is occupied"
and "does a hero move with it" do not have answers. Its own slice, after V6.

**Q2 — What happens to a live save's statuses at V3?** A save holds
`[{ id: 'poison', stacks: 7 }]` and the new shape has no stacks (G-5 makes the
tier the magnitude). Drop them on load and let the player re-earn them, or map
stacks onto a scale? Dropping is honest and cheap; mapping invents a number.

**Q3 — Can a Token carry a live effect instance, or only heroes and monsters?**
G-6 says any entity. Nothing yet wants a temporarily-cursed Forest, and building
the general case before something needs it is the trap this project keeps
naming. V3 may ship heroes and monsters only.

**Q4 — Does `Deals` respect Armor?** A thorn that ignores armour and a thorn that
does not are different game feels. Today's DoT ticks are **true damage** and
bypass Armor and Block by an owner ruling (2026-07-12), so the precedent exists —
but it was made about poison, not about every future action.
