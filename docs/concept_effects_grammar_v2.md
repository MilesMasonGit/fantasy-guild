# Effects Grammar v2 — concept

*Written 2026-09-08 from a design session with the owner. This is the vision
half. The authoritative plan is [`effects_grammar_v2_roadmap.md`](effects_grammar_v2_roadmap.md).*

**This supersedes the second half of
[`effects_robustness_roadmap_v1.md`](effects_robustness_roadmap_v1.md).** Its P1,
P2 and P4 are done and stay done; its P5–P7 are replaced by this, and the
decisions ER-3, ER-4 and ER-7…ER-13 are explicitly reopened — see §6.

---

## 1. The one-sentence version

> **One library holds every rule in the game.** A rule says *when* it happens,
> *what* it does, *to whom*, and *for how long* — and those four slots are
> general enough that the same named effect works on a raspberry bush, on a
> monster, on a sword and on a hero.

## 2. The example that defines the target

The owner's, and the whole design should be judged against it:

> *"With Thorns: I should be able to author a **'Does 1 damage to opponent when a
> cycle completes targeting this entity'** effect. I name that effect Thorns,
> allow for increased tiers to modify the damage. Later, when I want to assign it
> to a different token, I can select the effect from the library, set the
> magnitude and the charge consumption, and then it works. I would also want to
> apply the same thorns effect to a raspberry bush."*

Three things are being asked for at once:

1. **A rule that acts**, rather than one that only scales a number.
2. **A target that means "whoever just did this to me"**, and means it the same
   way for a monster and for a bush.
3. **One entry, assigned anywhere, tuned at the point of assignment.**

## 3. ⭐ The discovery that makes this cheap

**Work and combat already publish the same event.** `BoardRunner` (a hero
finishes harvesting) and `BoardCombat` (a hero wins a fight) both publish
`CYCLE_COMPLETE` with the same payload — `{ tile, typeId, heroId, failed }` —
because **one kill is one cycle** (D-129).

So *"a cycle completes targeting this entity"* is not a new concept to build. It
is `SELF_CYCLE_COMPLETE`, which shipped in the effect grammar's Phase 2. And
`heroId` in that payload **is** the opponent, the harvester, the actor — already
there, already correct, and read by nothing.

The raspberry bush and the Thorn Elemental are genuinely the same case, and they
are the same case *already*. The generalisation the owner asked for is not
something to invent; it is something to expose.

## 4. What a rule is

```
[ When <moment>, ]  VERB  <payload>  [ to <target> ]  [ for <duration> ]
      the trigger   what it does      to whom          how long it lasts
```

Two of those four slots are new.

### The verb — what it does

The grammar has nine keywords and **not one of them does anything to a person**.
`Provides` scales a number. `Grants` drops an item. `Applies` attaches a status,
which is a different system's concept. So the first addition is a set of verbs
that act: **deal damage, heal, restore charges, remove an effect.**

### The target — to whom

A **moment declares the roles it supplies**, and a target may only name a role
its moment actually has. This is the rule that keeps a targeting vocabulary from
becoming a query language, and it is the same principle the grammar already uses
for `filter`, `when` and `upkeep`: **legality is declared, never hoped for.**

| Role | Means | Supplied by |
|---|---|---|
| `self` | the entity carrying the rule | every moment |
| `actor` | the hero who caused this moment | a cycle completing, a fight beginning |
| `source` | the neighbour that caused it | the adjacent moments |

A target is a role, optionally with a relation applied to it — *the actor*, *the
tile the actor is working*, *everything adjacent to the actor*. An effect with
no moment (a continuous aura) has only `self` and its neighbours, which is
exactly what it has today.

### The duration — how long

A rule that fires at an instant may leave something behind. That is what a
status is, and it is the only genuinely new runtime concept here:

> **Any entity may carry live effect instances.** A hero, a monster, a Token.
> Each is `{ effectId, scale, expiresAt }` — a reference into the same library,
> with a clock on it.

## 5. Statuses stop existing

There is no status. `statusRegistry.js` and its five private effect types are
deleted, and the seven shipped statuses are re-authored as library effects. They
turn out to be two ordinary shapes:

| Today | Really is |
|---|---|
| Armor Shield, Well Fed, Cookout, Stun | a **`Provides`** with a duration — a modifier that expires |
| Poison, Burning, Bleed | **`Deal N damage` on a clock**, with a duration |

Neither needs a private vocabulary, and neither is a special kind of thing. This
is what "one clear repository" means when it is followed all the way down.

⚠️ **This is the opposite direction from the one the previous plan was heading.**
That plan pushed statuses toward the **modifier aggregator** — mapping
`flat_armor` onto `ARMOR` and so on. Half of them do belong there, but Poison
does not: recurring damage is a *thing that happens*, and things that happen
belong to the **statement grammar**. Pushing all seven at the aggregator would
have forced three of them into a shape that cannot hold them.

## 6. What this reopens

Decisions from the previous roadmap that this direction overturns, named so the
reversal is deliberate rather than quiet:

* **ER-3 — "no third bearer".** A hero carrying live effects *is* a bearer.
  Reopened by the design, not by preference.
* **ER-4 — "no new keywords".** The verbs are the point of this work.
* **ER-7…ER-13 — the status absorb as specified.** Same destination, different
  road: the grammar rather than the aggregator, which changes almost every step.
* **UE-20 — charge cost authored on the statement.** The owner wants the cost set
  when an effect is assigned, so one Thorns can be free on a bush and cost a
  charge on a monster.

Decisions that **stand**: UE-3 (nothing authored inline), UE-5 (a bearer stores a
reference; edits reach everywhere), UE-8 (the name is a title, never a
description), UE-9/UE-18 (a 1–5 tier numeral is the magnitude control), and
ER-1/ER-2/ER-5/ER-6 (the reach vocabulary, shipped and working).

## 7. What this deliberately does not solve

* **A condition language.** No "while", no "unless", no booleans. The design
  says when, what, to whom, how long — and stops. That refusal is what the
  restriction palette already documents, and it holds here.
* **Directional adjacency.** Still no meaning for "the Token below it".
* **Balance.** Nothing authored uses any of this, so no number moves until
  someone authors one on purpose.
