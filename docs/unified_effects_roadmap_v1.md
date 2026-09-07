# Unified Effects — roadmap v1

*The authoritative plan. Written 2026-09-07. The vision half is
[`concept_unified_effects.md`](concept_unified_effects.md).*

**Do not re-litigate anything in §1.** Those are owner rulings from the
2026-09-07 design session. §2 is the phase plan, §3 the status table, §4 the
questions still open.

---

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| **UE-1** | **One grammar, generalised from *a Token* to *a bearer*.** The nine keywords, four slots, palette and generated sentence are unchanged. | The grammar is sound. This is an extension of its subject, not a redesign of it. |
| **UE-2** | **Enemies are not a new bearer.** They are Tokens; `StatusApplication` already resolves a tile to its occupant, hero or live enemy. **The item is the only new bearer.** | The enemy path is written and routed already — it has simply never run. |
| **UE-3** | **Every statement lives in a named library entry. Nothing is authored inline.** | One place all rules live; a name the player can be shown; reuse across Tokens, items and enemies. |
| **UE-4** | **A library entry is a name plus a group of statements — usually one.** | Matches how an effect is described in play without forcing three names on one idea. |
| **UE-5** | **A bearer stores a live reference by id.** Editing an entry changes every bearer using it. The CMS must show *used by: N Tokens, M items* before a save. | The reuse is the feature. Blind cross-game edits are the risk it brings, and the readout is the mitigation. |
| **UE-6** | **A reference may carry a scale multiplier. No other per-bearer parameterisation.** A different chance is a different entry. | Keeps one name meaning one behaviour, at one strength per numeral. |
| **UE-7** | **The palette declares what a scale multiplies, per effect type.** `Provides` → its value, `Applies` → stacks, `Grants` → quantity, `Converts` → its amounts. `Cannot` and `Works as` offer no scale. | Keeps "adding an effect is one palette row" true. The CMS shows a scale field only where it means something. |
| **UE-8** | **The name is a title, never a description.** The generated sentence stays the body, the validation loop and the only description. A name is never shown without its sentence beneath it. | Upholds the redesign's Q3 ruling: no hand-written text on a bearer, because an override is how a description drifts from behaviour. |
| **UE-9** | **The player-facing title is name plus a tier numeral** — *Shrimp Trawler II*. | A stronger version reads as the same effect, larger. |
| **UE-10** | **A named effect cannot exist without a statement that works.** Enforced at boot by `ContentAudit`. | The one rule the deleted 56-entry library needed and did not have. |
| **UE-11** | **An item's charge pool mirrors a Token's exactly**: optional `uses`, absent means unlimited and ignores deltas in both directions, a proc spends what UE-20 says it spends, and zero destroys the item and unequips it. | One rule for both bearers. Gear is permanent by default; any item *can* be authored as a wasting asset, which is the sink the economy lacks. |
| **UE-12** | **Item effects fire from the loadout only**, not from the Bank. | An item in a chest doing things is not a thing the player can reason about. |
| **UE-13** | **A firing named effect publishes `TILE_EVENT_ALERT` with its title.** Continuous effects never pop. | The popup surface already exists and is used from eight sites. A continuous effect has no moment to announce. |
| **UE-14** | **`CYCLE_START` is the only new moment in the first pass.** The engagement moment ships with the enemy phase. | Slice discipline. |
| **UE-15** | **An engagement fires on every engagement, including post-kill respawns.** | One kill is one cycle (D-129), so one fight is one proc — a Bear tile paces like a Forest tile. |
| **UE-16** | **The legacy gear pipeline is deleted**: the `assignedEffect` switch in `EquipmentManager.js` and the nine modifier types nothing reads. **`data/effects.json` is deleted.** | Nothing authors either. Two ways to give an item an effect, one of which silently does nothing, is the exact trap this work exists to remove. |
| **UE-17** | **Enemies get all three: their own statements, being targetable by others, and scaling hero-side combat numbers.** The third unparks the SCB and is sequenced last, alone. | Owner's call, made with the SCB consequence stated. Sequencing keeps everything else off its critical path. |
| **UE-18** | **A scale is an integer, 1–5.** 1 shows no numeral, 2 is II, up to V. A strength outside that range is its own library entry. | Makes UE-9's numeral rule trivial, and mirrors the cap the deleted gear pipeline used. |
| **UE-19** | **Scales from separate bearers add, capped at 5.** A II and a III make a V. | The only answer needing no new rule, and the cap stops a build maxing one effect by carrying six of a thing. |
| **UE-20** | **Charge consumption is authored, not ruled.** Every statement carries *how many* charges it consumes **and** *when* they are consumed. **`0` is the always-on setting** — a continuous effect costs nothing and wears nothing unless its author says otherwise. | Supersedes the question of whether continuous effects wear items down: it is the author's call per effect, not a global rule. |

## 2. The phases

Each phase is one sitting, verified in the real CMS and the real game before the
next starts, and committed at the end.

### P1 — The library *(pure refactor, no behaviour change)*

The load-bearing phase. Everything else depends on it, and it should change
nothing a player can see.

* New content type: a named effect entry `{ id, name, statements: [...] }`.
  Data file, registry, CMS screen, create/rename/delete.
* Bearers store references: `effects: [{ effectId, scale }]`. Tokens read their
  statements *through* the library.
* **Migrate the 21 existing statements** across 19 Tokens into named entries.
  One Token still carries the retired `effectBlocks` shape — it is named by
  `ContentAudit` and re-authored by hand, not silently translated.
* *Used by* readout on every library entry.
* `ContentAudit` learns UE-10: an entry with no working statement, and a
  reference to an entry that does not exist.
* Delete `data/effects.json`.

**Verified when** the game behaves identically before and after, `npm test` is
green against the known baseline, and a Token's rules panel reads the same.

### P2 — Scale and cost

* `scaleField` on each palette row (UE-7); no field where a scale is meaningless.
* A reference's integer scale (UE-18) applied at resolve time, and rendered into
  the sentence so the words carry the scaled magnitude. Scales from separate
  bearers add, capped at 5 (UE-19).
* Tier numeral in the title (UE-9).
* **Charge consumption as an authored field (UE-20)** — amount *and* moment, on
  every statement, with `0` as the always-on setting.

  What exists today: `chargeDelta` is real, defaults to −1, and an explicit `0`
  already means free — but `makeStatement` only stamps it on keywords that can
  carry a trigger, so **a continuous statement has no cost field at all**, and
  the moment is implicit rather than chosen (a firing spends on fire; a station
  spends `DEFAULT_STATION_CHARGE_COST` per cycle). This phase widens the field
  to every statement and makes the moment authorable.

### P3 — Announcing

* A firing statement publishes **`EFFECT_FIRED`** carrying its title and numeral,
  and `EffectProcText` draws it: text, rising, fading, gone.
* Continuous statements do not (UE-13).

⚠️ **Two things changed from the plan, both deliberate.**

**It is not `TILE_EVENT_ALERT`.** UE-13 named that event, but it is the *alert*
channel: a persistent icon, hovered to read, held for five seconds, dismissible,
used from eight sites for problems a player must act on. An effect firing is the
opposite kind of news — frequent, positive, over when it happens. Reusing the
alert would have cluttered the board with icons nobody needs to act on and
blunted what the icon means. A separate event and a fifteen-line component were
simpler than bending the alert to two jobs.

**"Continuous effects never pop" needed sharpening.** The real line is not
continuous-versus-triggered but *attributable-versus-merged*. A scalar axis is
merged before it is used — `resolveAxis` sums every Yield reaching a tile and
returns one number — so when a proc lands off it, no single effect can honestly
claim it. So the announcement happens where one statement demonstrably did one
thing: a triggered firing, an item grant that actually rolled, a status that
actually landed. A continuous `Provides` still says nothing, which is what UE-13
was reaching for.

### P4 — Items as bearers

* `effects` references on items; `ItemEditor` gains the library picker.
* `uses` on items, mirroring Tokens (UE-11), destroyed and unequipped at zero.
* Bearer-relative filters: *my hero*, *the Token they are working*, *the enemy
  they are fighting* — rendered honestly in the sentence.
* **A hero scope on `resolveAxis`**, alongside tile and guild. Required by the
  owner's own example, a Token that gives *+10% damage to adjacent heroes*.
* Delete the legacy gear pipeline (UE-16).

### P5 — Cycle start

* Publish `CYCLE_START`; add it to `TRIGGER_EVENTS`.

### P6 — Enemies

* Verify the never-run `applyToEnemy` path end to end.
* Author a real enemy Token with its own statements.
* The engagement moment (UE-15), published where `BoardCombat` creates or
  refreshes a fight.

### P7 — Combat numbers *(unparks the SCB — its own project)*

* Enemies scaling hero-side damage / armor / accuracy. `BLOCK`, `ARMOR` and
  `STATUS_IMMUNITY` are read by combat and written by nobody; that is where this
  starts.

## 3. Implementation status

| Phase | State | Notes |
|---|---|---|
| P1 The library | **DONE** 2026-09-07 | 21 statements → 16 entries (5 were duplicates, now shared). Game + CMS + migration + audit. Suite back to its 6 baseline failures with 36 new tests. |
| P2 Scale and cost | **DONE** 2026-09-07 | Scale applied at expansion, so no consumer changed. Charge moment authored, opt-in. 31 new tests; suite back to its 6 baseline failures. |
| P3 Announcing | **DONE** 2026-09-07 | Own event and own component — text, rising, fading, nothing to click. Announced only where ONE named effect discretely acted. |
| P4 Items as bearers | Not started | |
| P5 Cycle start | Not started | |
| P6 Enemies | Not started | |
| P7 Combat numbers | Not started | Blocked on nothing, sequenced last by choice |

## 4. Open questions

*Q1 (integer scale), Q2 (stacking) and Q3 (continuous wear) were closed by the
owner on 2026-09-07 and are now UE-18, UE-19 and UE-20.*

*Q5 (the charge-moment list) was closed by the owner on 2026-09-07: only moments
that already have a reader. `chargeMomentRegistry.js` holds two — `on_fire` and
`per_cycle` — and P5 and P6 each add their own when they add the moment.*

**Q7 — Where does UE-19's stacking cap live?** Scales from separate bearers add,
capped at 5. P2 built the scale and the cap on a single reference, but the
*adding* has no home yet: two adjacent Tokens carrying one effect are two
separate modifier sources, and the three-bucket formula already combines them —
adding their scales on top would double-count. The rule was framed around a hero
carrying two items with the same effect, so its aggregation point arrives with
**P4**, and it is built there rather than guessed at now.

**Q6 — Does a named effect need a category or tag for library navigation?** Not
in P1. Revisit when the library passes ~30 entries.
