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
| **G-12** | **Filters: state** (charges, HP, working/idle), **what it carries** (effects, tags, capabilities), and **negation**. ⚠️ **Terrain filters are OUT, permanently.** | Owner's picks. On terrain, the owner's words: *"Terrain will not be needed in our effects system, it's purely visual."* That is a statement about what terrain **is**, not a deferral — so it is settled rather than parked. I had flagged terrain as the single largest gap in the v1 sweep; that finding is **withdrawn**, because a gap between two systems that were never meant to meet is not a gap. |
| **G-13** | **Magnitudes may be computed**, from a closed list: a flat number, a **percentage of a named stat on a named role**, or a **count of a selector's matches**. | Owner's pick over flat-only. Closed and declared, so it still renders — *"damage equal to 10% of the target's max HP"* — and still audits. Not arithmetic, not formulas. |
| **G-14** | **A statement may carry a second, `counted` selector**, used only to produce a number. | Owner's pick. *"+1% yield to every adjacent Token, per adjacent Coast Token"* counts one set and affects another; they are genuinely different sets and conflating them makes the common shape unsayable. |
| **G-15** | **`Spawns` chooses its destination from a declared vocabulary: the bearer's tile, the nearest free tile, or a random free tile.** | Owner's answer, and better than any option offered — it makes the destination something the **author picks and can see**, rather than a hidden fallback rule. Needs no tile-selector vocabulary, so filters keep meaning "entities" only. |

### Authoring — the sentence editor *(owner ruling, 2026-09-08)*

| # | Decision | Why |
|---|---|---|
| **G-18** | ⭐ **The editor is the sentence.** Structured **chips that read as prose** — typing filters what is legal at the cursor, enter inserts a chip. **There is never a parser.** | Owner's pick. The statement object *is* the editor state and `renderStatement` *is* the display, so there is one renderer and no inverse function to maintain. An invalid rule stays unwritable — the dropdowns' guarantee, at typing speed. Free-text parsing was offered and declined: it needs error recovery and can hold ambiguous states, and "what did it understand?" becomes a thing to debug. |
| **G-19** | **A live "what can go here" panel**, showing everything legal at the cursor's slot with its hint, grouped. | A dropdown is self-documenting and typing is not. This keeps the vocabulary browsable — which matters most for the parts the author has not used yet, and the vocabulary is about to grow a great deal. You can author entirely by clicking it, entirely by typing, or by mixing. |
| **G-20** | **Inline for simple values, popover for pickers, a small form for genuine tables.** Numbers and durations typed in the line; an item or Token opens a searchable popover on the chip; a `Converts` rule's two item lists stay a form beneath the sentence. | Prose where prose is good, a form where a form is better. A five-item conversion written out inline stops being a sentence. |
| **G-21** | **Built after V2, and driven by the registries.** | Owner's sequencing. V1–V2 prove the spine and get Thorns authored; the editor then arrives against a settled slot shape, and every later phase's rows appear in it for free because it reads the same registries the game does. The phases that add the most vocabulary are the ones that benefit most. |
| **G-22** | ⭐ **G-10 and G-18 reinforce each other.** Because the editor *is* the sentence, improving the sentence language improves the tool in the same edit. | The owner's rule that a badly-reading rule means "improve the syntax" now has a direct payoff: there is no separate editor UI to update when the words change. |

### Runtime

| # | Decision | Why |
|---|---|---|
| **G-6** | **Any entity may carry live effect instances** — `{ effectId, scale, expiresAt }`. Heroes, monsters and Tokens alike. | The only genuinely new runtime concept. It is what `hero.statuses` already is, generalised from five hardcoded types to the whole library. ⚠️ **Reverses ER-3.** |
| **G-16** | **Re-application refreshes the timer. One effect on an entity means one instance.** | Owner's pick. Keeps the readout legible and means an effect can never quietly compound into something nobody authored — which is what made a 99-stack Poison possible. |
| **G-5** | **The 1–5 tier is the magnitude control; charge cost is per-bearer.** A reference is `{ effectId, scale, chargeCost? }`. | Owner's pick. *Thorns III* is 3 damage, so UE-9's numeral keeps meaning something, while the same Thorns can be free on a bush and cost a charge on a monster. ⚠️ **Reverses UE-20.** |
| **G-17** | **Chaining is allowed** — an effect may apply another effect — and is bounded by the **existing structural guard**, not by author discipline. | Owner picked chained effects. `TriggerSystem` already carries an in-flight re-entry guard and a cascade depth cap built for exactly this shape, because a cooldown is a rate limit and not a recursion limit. |
| **G-23** | **`Deals` respects Armor, with an authored `ignoresArmor` flag.** | Owner's ruling, closing Q1. ⚠️ **This inverts today's default and has a consequence for V7**: DoT ticks are currently *true damage* that bypass Armor and Block by the 2026-07-12 ruling, so **Poison, Burning and Bleed must be re-authored carrying `ignoresArmor: true`** or they will quietly get weaker against armoured targets. `ContentAudit` should not have to catch this; G-7 already says these are re-authored by hand, and this is the specific thing to get right while doing it. |
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

⚠️ **The editor lands at V3 and expressiveness at V4–V5, all before the risky
deletion at V7.** The
owner's stated pain is *"I can't express the effects I'm imagining"* — not
turnaround speed — so the filter and magnitude vocabulary is sequenced ahead of
the status absorb, which is the biggest and most destructive slice. The editor
comes first of all three, because every one of them is authored through it.

### V1 — Moments declare their roles *(groundwork, no new behaviour)*

* `TRIGGER_EVENTS` rows gain `roles: [...]`.
* `CYCLE_START` publishes `heroId`; `COMBAT_RESOLVED` publishes `heroId` and
  `typeId`. One-line widenings at sites where the value is already in scope.
* A resolver turning `(moment, payload, bearerTile)` into the live role map.
* `ContentAudit` learns G-2: a target naming a role its moment does not supply.

**Verified when** every moment reports its roles, the two widened payloads carry
an actor, and nothing a player can see has changed.

⚠️ **Three things worth recording from the build.**

**`resolveRoles` and `rolesOf` answer different questions, and both are needed.**
`rolesOf` is the *authoring* question — what may an author aim at? — and is what
the editor and `ContentAudit` ask. `resolveRoles` is the *runtime* question — who
is actually here? — and may legitimately return a null actor on a moment that
declares one, because a passive generator (D-116) completes cycles unstaffed.
Conflating them would either offer a role that can never be filled, or make a
rule inert on ordinary occasions when nobody was around.

**A self-scoped moment declares no `source`.** Its source *is* the bearer, which
is `self`, and two names for one thing is how a vocabulary starts lying.

**`TOKEN_DEPLETED` and `ITEM_THRESHOLD` declare no actor** — a Token spending its
last charge was not done *to* it by anyone, and the Bank holding enough of an
item is not an act at all. This is G-2 doing its job on the very first day: those
two moments simply will not offer "the actor" in the editor.

### V2 — ⭐ `Deals`, `the actor`, and Thorns

The phase the whole project is judged by.

* The `Deals` verb, resolved against a hero or a live enemy.
* The `actor` source.
* Per-bearer `chargeCost` on the reference (G-5).
* **Author Thorns** and assign it to `token_thorn_elemental` **and** to a berry
  bush.

**Verified when** one library entry, assigned twice, hurts a hero who kills the
Elemental **and** a hero who harvests the bush.

⚠️ **Four things worth recording from the build.**

**Armour is now defined once.** `computeEnemyDamage` inlined the armour sum, and
`Deals` needed it a third time, so it became `CombatFormulas.heroFlatArmor`. A
thorn and a goblin subtracting different numbers would have been CR2-074's
parallel vocabulary arriving by copy-paste rather than by design.

**A thorn floors at zero; a combat hit floors at one.** Combat's minimum exists
so a fight always progresses. A thorn is not a fight, and a floor of 1 would make
heavy armour worth exactly as much as none against every thorn in the game — so
"respects armour" can only honestly mean armour may stop it entirely.

**The sentence lost its capital letters, and G-10 said fix the syntax.**
`whenPhrase` lowercased the *whole* trigger label, so *"This Token's own cycle
completes"* rendered as *"this token's"* and *"The Bank"* as *"the bank"*. Token
and Bank are things in this game with capitals. Only the first character is
lowered now.

⚠️ **The acceptance test nearly proved nothing.** Its first version used a second
*producer* rather than a real enemy, which would only have shown that two Tokens
can share a library entry — not that harvesting and killing are the same case.
Rewritten to fight a real `fixture_enemy` to death and assert `hero_downed` with
`cause: 'effect'`, a signal nothing else in the game publishes. It also silently
passed at first because the test hero was an unpromoted Recruit who **starts no
fight at all**: `canHeroFight` tests *possession* of a combat skill, never its
level.

### V3 — ⭐ The sentence editor

The tool the rest of the project is authored through, so it comes before the
phases that add the most vocabulary (G-21).

* A **chip-based sentence editor** in the CMS. The statement object is the
  editor state; `renderStatement` is the display; **no parser exists** (G-18).
* Typing at a slot filters what is legal there; enter inserts a chip. Legality
  comes from the same declarations the game reads — `KEYWORDS`, `TRIGGER_EVENTS`,
  `REACHES`, `MODIFIER_PALETTE` and the roles from V1 — so a new row appears in
  the editor with no editor change.
* A live **"what can go here"** panel beside the line (G-19).
* Values inline; item and Token pickers as popovers on the chip; `Converts`
  lists stay a small form beneath (G-20).

⚠️ **The old form editor is retired in the same commit, not left beside it.** Two
editors for one thing is the duplication this project keeps deleting, and a form
that drifts from the sentence is exactly the drift UE-8 exists to prevent.

**Verified when** Thorns — already authored through the form in V2 — can be
rebuilt from scratch by typing, reads identically, and produces a byte-identical
statement. ✅ Typing `deal` and pressing enter produced *"When this Token's own
cycle completes, deals 1 damage to the actor."*

⚠️ **Five things worth recording from the build.**

**The chips are the DECISIONS, not every word.** Rewriting `statementText` to
emit segments — so every word of the sentence could be a chip — would have meant
touching nine keyword branches that many tests assert byte-for-byte. Instead the
chips show *slot values in sentence order* and the canonical sentence is printed
beneath by the one renderer. G-18's real guarantee is intact: the statement is
the state, there is no parser, and there is no second renderer that can disagree.

⚠️ **Changing the verb has to REBUILD the statement.** The first version patched
only the keyword, producing a `Deals` carrying a `Provides` payload with no
moment and nothing to act on — a rule no author could have written. It goes
through `makeStatement` now, **keeping the statement id**, because per-statement
save state is keyed by it.

⚠️ **Deleting the pickers lost three things, and the smoke test caught them.**
The bucket picker (flat/percentage/multiplier), the buff-or-penalty reading, and
the unknown-tag warning all lived in the deleted components. They are slot
properties now — `note`, `warning`, `suggestions` — which makes them testable in
the game's own suite rather than only visible on screen.

⚠️ **An optional slot left empty is not a hole.** "Only for <skill>" unset means
*any skill*, and painting it as a warning made every ordinary rule look
half-written. Optional slots are declared and rendered dimmed.

⚠️ **The panel is stacked, not a sidebar.** It began as a 240px side column and
overlapped the chips: the CMS's centre editor column is narrow. Beneath the
sentence it also lands directly under the chip just clicked.

### V4 — Composable filters

* A selector becomes source + stacked filters, AND-composed (G-9).
* **State** filters: charges remaining, HP, working/idle.
* **Negation** on every filter (G-12).
* Sentence syntax extended to render stacked filters legibly (G-10).

⚠️ The **"carries effect X"** filter waits for V6, when live instances exist for
it to look at.

⚠️ **Three things worth recording from the build.**

**A filter the caller cannot evaluate FAILS.** `Restrictions` checks placement
against definitions and has no live instance, so "with fewer than 3 charges" has
no answer there. Failing is the safe direction: a rule reaching nothing is
visible and reportable, where a rule reaching EVERYTHING because a filter could
not be checked is a narrow effect turned board-wide. `ContentAudit` names a
`Cannot` carrying a state filter so the author is told rather than left guessing.

⚠️ **A hero arriving now rebuilds the tile caches.** `being worked` is the first
filter whose answer changes without the board changing, and a tile aggregator is
only rebuilt on board changes — so the rule would have been evaluated once, at
placement, and been silently wrong for the rest of the session. `TileModifiers`
subscribes to `HERO_MOVED`. Same reasoning `heroContributions` uses to read a
loadout live: **a hero is not the board.**

**Filters are modifiers, not a relative clause.** The first version wrote "that
is …", which forced a number agreement the renderer cannot win — the frame in
front may be singular or plural, so it produced *"Tokens that is being worked"*.
Phrases attaching directly read correctly after either. Each filter also owns its
**negative** wording, because negating mechanically produces *"not with fewer
than 3 charges"*, which nobody would write; the opposite of "fewer than 3" is
"3 or more", and only the filter knows that.

### V5 — Computed magnitudes

* A magnitude becomes flat, **percentage of a named stat on a role**, or **a
  count** (G-13).
* The second `counted` selector (G-14).

**Verified when** *"+1% yield to every adjacent Token, per adjacent Coast Token"*
is authorable, reads as one sentence, and moves the right number.

⚠️ **Three things worth recording from the build.**

**An unreadable stat is ZERO, never the base number.** *"10% of the target's max
HP"* against nobody must do nothing, not fall back to doing 10 damage. Silently
swapping a percentage for a flat amount is how a rule comes to mean something
nobody authored. Unlimited charges (`null`, R-4) read as nothing for the same
reason — treating them as huge would make an unlimited Token the strongest
possible version of the effect.

**A count is not "equal to".** The first rendering wrote *"damage equal to per
adjacent Coast Token"* and dropped the number entirely. A count is a per-match
amount, so the number keeps its place: *"deals 1 damage per adjacent Coast
Token"*. Three magnitude shapes, three sentence shapes.

**G-2 reaches the magnitude vocabulary too.** A stat about the actor is not
offered on a moment that has no actor — `statsForRoles` filters by the same roles
the target picker uses. The rule that bounds targeting bounds this as well,
without it being a second mechanism.

⚠️ **The counted selector is measured from the BEARER, not the target.** *"1
damage per adjacent Coast Token"* on a monster means the Tokens beside the
monster. Counting around whoever it hit would be a different rule, and a much
stranger one.

### V6 — Live effect instances, duration, and chaining

* An entity carries `effects: [{ effectId, scale, expiresAt, sourceId }]` (G-6).
* One clock ticks them; expired instances are dropped. Re-application refreshes
  (G-16).
* `Applies` retargeted from a status id to a library effect reference — **with a
  duration it is over-time, without one it chains** (G-17), bounded by the
  existing cascade guard.
* The **"carries effect X"** filter deferred from V4.
⚠️ **No save migration was needed after all, and that is deliberate.** The plan
expected one because `hero.statuses` is save-resident. V6 does not touch it: live
instances land on a **new** `hero.effects` field and the status engine keeps
running beside them untouched. `Applies` accepts both payload shapes — a
`statusId` takes the old path, an `effectId` the new one — so there is no flag
day, and the migration question (Q2) moves to V7 where the statuses actually die.

⚠️ **`self` can now mean a HERO, not only a tile.** A live effect sits on a
person, so "deal 2 damage to this entity" on a Poison means the person carrying
it — there is no square involved. `resolveRoles` grew a `selfHeroId`, filled only
by `LiveEffects`, because only it knows the bearer is a person.

⚠️ **A live statement does NOT go through `fireStatement`.** That path is about a
Token *instance* — where the cooldown lives and the charge delta is spent — and a
carried effect has neither. It ticks once every five seconds by construction, so
a cooldown would be redundant. The cascade guard still applies, because chaining
is exactly the shape that can spin.

⚠️ **The clock runs at exactly `STATUS_TICK_INTERVAL_MS`.** Poison has always
ticked at that rate, and V7 has to reproduce what the seven statuses did — a
different interval would silently re-balance every damage-over-time effect.

⚠️ **A stronger application replaces a weaker one.** G-16 says refresh rather
than stack, but a scale-3 Poison landing on a scale-1 one would otherwise be
silently discarded and the player would watch better gear do nothing.

⚠️ **Tokens cannot carry live instances yet** (roadmap Q3). Nothing wants a
temporarily-cursed Forest, and building the general case first is the trap this
project keeps naming. The `carrying` filter therefore reads *the hero standing
there*, and its sentence says so.

### V7 — The seven, re-authored; the old engine deleted

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

### V8 — The rest of the verbs

`Heals`, `Restores`, `Removes` — each with its reader, each its own commit.
`Removes` finally gives `purge()` a caller.

### V9 — `Spawns` and `Transforms`

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
| V1 Moments declare roles | **DONE** 2026-09-08 | `roleRegistry.js` + `roles` on all ten triggers. `CYCLE_START` and both `COMBAT_RESOLVED` sites widened. 16 new tests, 8 of which fail when neutered. |
| V2 `Deals`, the actor, Thorns | **DONE** 2026-09-08 | ⭐ One entry hurts a hero who harvests a bush AND one who kills a monster, proven in a real fight. 16 new tests, 6 of which fail when the verb is neutered. |
| V3 ⭐ The sentence editor | **DONE** 2026-09-08 | Chips in sentence order, typing narrows, panel beneath. Four pickers deleted. Thorns rebuilt by typing, byte-identical. 23 new tests. |
| V4 Composable filters | **DONE** 2026-09-08 | `filterRegistry.js`: tagged / is_station / charges_below / worked, all negatable and AND-composed. 18 new tests. |
| V5 Computed magnitudes | **DONE** 2026-09-08 | `magnitudeRegistry.js`: flat / % of a named stat / per-match count, with the second `counted` selector. 16 new tests. |
| V6 Live instances, duration, chaining | **DONE** 2026-09-08 | `LiveEffects.js` + the `EFFECT_TICK` moment. `Applies` takes a library effect; duration 0 chains. 16 new tests. ⚠️ No save migration needed — `hero.statuses` is untouched and dies at V7. |
| V7a The seven become **expressible** | **DONE** 2026-09-09 | A carried effect now contributes modifiers, which is what four of the seven needed. `DAMAGE` gained a percentage reader. 12 tests prove all seven are sayable. |
| V7b.1 Enemies become effect bearers | **DONE** 2026-09-09 | A fight holds the list and the aggregator, so it has the fight's lifetime. `Deals` at an enemy now respects armour; `self` on a monster means the monster; both halves of `Applies` resolve targets the same way. 17 tests, 6 of which fail when neutered. |
| V7b.2 `SELF_TOKEN_DEPLETED` | **DONE** 2026-09-09 | ⭐ "Leave a Stump behind when this depletes" is authorable — §4b's open item is closed. The moment is `settled`: no charge paid, no charge gate. 13 tests, 5 of which fail when neutered. |
| V7b.3 Author the seven, then delete the old engine | ⏸ **Owner deferred** | Ruled 2026-09-09: *"I don't really want to author these effects now. I want the system to be more complete first. These effects are just theoretical test effects, there may not be those effects in the final game."* Nothing waits on it — both engines run side by side. |
| V8 The rest of the verbs | **DONE** 2026-09-08 | `Heals`, `Restores`, `Removes` in `EffectActions.js`. ⭐ `Restores` is the reader `CHARGE_EXTEND` was named for; `Removes` is the first caller a cleanse has ever had. 14 new tests. |
| V9 `Spawns` and `Transforms` | **DONE** 2026-09-08 | `placementRegistry.js` — the destination is an authored choice, never a hidden fallback. 15 new tests. |

*Carried over and already done:* v1 P1 (the filter tells the truth), P2 (reach),
P4 (`STATUS_IMMUNITY` and the skill scope). v1 P3 — authoring real effects on
items and the one enemy — is **still outstanding and still the owner's**; V2 does
part of it by authoring Thorns.

## 4b. ⚠️ Findings from the code review, and one that is still open

A review of the whole implementation found thirteen defects, twelve of which are
fixed and pinned by `src/tests/ReviewRegressions.test.js`. **Every one of them
was invisible to a green suite**, and always for the same reason: a fixture
dodged the exact condition that broke. `uses: null` skipped the charge path, a
hero stood on every bearer tile, and a fixture carried no `to` key when the
editor always writes one. That pattern is the lesson worth keeping.

The four worst were:

* **A transforming Token destroyed the Token it became.** The charge delta ran
  against the discarded instance, and `applyDelta` destroys at zero by emptying
  the **tile** — taking the new Token with it.
* **A Token-borne `Applies <library effect>` was completely inert**, and it is
  the editor's default shape. The guard tested `statusId` alone.
* **`Works as` became unauthorable.** The payload form was rendered only when a
  list-shaped slot existed, so every keyword the chips do not fully cover lost
  its controls — and `stationSkillOf` is the sole input to `deriveTokenType`.
* **A conversion produced onto a neighbour while its sentence named none.**
  `makeStatement` stamps `to: { mode: 'all' }`, which the runtime read as "pick a
  neighbour" and the renderer read as "no destination".

✅ **Closed 2026-09-09 by `SELF_TOKEN_DEPLETED`.** The answer turned out to be
neither of the two options offered above: the tile emptying *before* the event is
**correct**, because that is what frees the square for a `Spawns here`. Two
things were actually missing — a self scope on the depletion moment, and any way
for the departing instance to be found once the board no longer holds it. It now
rides on the event.

⚠️ One consequence worth knowing when authoring: at this moment the natural verb
is **`Spawns … here`, not `Transforms`**. `Transforms` requires a Token standing
on the tile, and by then there is none. The sentence also still renders the
destination as *"on this Token's own tile"*, which is true of the square but
reads oddly for a Token that has just left it — a G-10 wording call, not a bug.

## 4c. V7a — what the seven actually needed

⭐ **The blocker was never the seven; it was one missing capability.** Three of
them (Poison, Burning, Bleed) already worked from V6 — they are `Deals` on a
clock. The other four are **modifiers with a clock**, and `LiveEffects` fired
`EFFECT_TICK` statements and contributed no modifiers at all. A carried effect
could hurt you but could not make you tougher, so Armor Shield, Well Fed,
Cookout and Stun were literally unsayable.

V7a builds that: a carried effect's `Provides` statements now reach the same two
roads their axis already travels — the **hero's aggregator** for combat axes, and
**live at `resolveAxis`** for board axes. Neither reader had to learn about live
effects.

`DAMAGE` also gained a **percentage bucket**, because it is the one combat axis
whose reader genuinely multiplies by one (`computeHeroDamage`). That is what
makes a Well Fed style buff expressible rather than hardcoded.

⚠️ **Stun stays a re-authoring, not a translation** (G-7). The old `attack_fail`
was "25% per stack, capped at 80%"; a negative `ACCURACY` against a 5–95 clamp is
different arithmetic. The shape is expressible and the numbers are the owner's.

### What V7b still needs

1. ~~**The owner authors the seven in the CMS.**~~ ⏸ **Deferred by the owner
   2026-09-09** — the seven are theoretical test effects and may not exist in the
   finished game, so completeness comes first. Steps 3 and 5 wait on it; nothing
   else does.
2. ~~**Enemies get a `ModifierAggregator`**~~ ✅ **DONE 2026-09-09.** V6's header
   claimed live enemies were supported; only heroes were. `LiveEffects` no longer
   knows what a hero is — it works on a bearer descriptor, and `BoardCombat`
   registers its live fights as a source.
3. **The save migration.** `hero.statuses` is save-resident; the standing rule —
   never silently half-translate — points at dropping live statuses on load and
   letting the player re-earn a few seconds of a transient buff. Still §5 Q2.
4. **The minimal status readout** (ER-17), so any of it can be watched in play.
5. **Delete `statusRegistry.js`**, its five effect types and five decay triggers,
   and move the eight readers onto the aggregator.

## 5. What V7b is waiting on

The **destructive** half — deleting a shipped engine and reshaping save-resident
data. One of its three blockers is now answered.

~~**1. Where do the seven re-authored statuses live?**~~ ✅ **Answered
2026-09-09: in the library, authored in the CMS like every other effect.** ER-13
is retired; G-7 stands.

**2. What happens to a live save's statuses?** A save holds
`[{ id: 'poison', stacks: 7 }]` and the new shape has no stacks. The project's own
standing rule — never silently half-translate — points at dropping them on load
and letting the player re-earn them, which costs a few seconds of a transient
buff. Mapping stacks onto a tier would invent a number. My reading is that
dropping is the consistent answer, but it is the owner's call to make.

**3. Who authors it?** V7's content work cannot be done from here. The CMS
workspace in this environment is **empty** (0 tokens, 0 items, 0 effects), so
"Sync to Game" would write that emptiness over `data/` and destroy the shipped
content. Every phase so far has been proven against fixtures for exactly this
reason.

⚠️ **Nothing else waits on V7.** V6 deliberately left `hero.statuses` untouched
and put live instances on a new field, so the old engine and the new one run side
by side. The game is in a working state with both.

## 6. Open questions

*Q1 (does `Deals` respect Armor?) was closed by the owner on 2026-09-08 and is
now **G-23**: yes, with an authored `ignoresArmor` flag. ⚠️ See the warning on
G-23 — Poison, Burning and Bleed must carry that flag when they are re-authored
in V7, or they quietly weaken against armoured targets.*

**Q2 — What happens to a live save's statuses at V5?** A save holds
`[{ id: 'poison', stacks: 7 }]`, and the new shape has no stacks. Drop them on
load and let the player re-earn them, or map stacks onto a scale? Dropping is
honest and cheap; mapping invents a number.

**Q3 — Can a Token carry a live effect instance, or only heroes and monsters?**
G-6 says any entity. Nothing yet wants a temporarily-cursed Forest, and building
the general case before something needs it is the trap this project keeps naming.
V5 may ship heroes and monsters only.
