# The "Promotes" rule — roadmap

*The authoritative plan for letting a Token train a hero into a job, written as a
rule. Status table in §5.*

**Status: planned 2026-09-12. No code yet.**

## 1. Where this starts

The owner asked for *"a way to make tokens train Heroes into new jobs. We have the
functionality, but I think we don't have the rules vocabulary."* Both halves of
that turned out to be true, with a twist:

* **The functionality exists, but not on `main`.** Branch `promotion-tokens`
  (`fb7e299`, 2026-09-06) built the whole thing — a training cycle on the tile, an
  offer when it completes, pause-on-decline, a ceremony screen — and was never
  merged. It expressed the job as a Token **field**, `promotion: { jobId }`, not a
  rule.
* **`main` still charges for promotion the old way.** `PromotionSystem.promote`
  takes gold and materials (`PROMOTION_COSTS`), and `JobChangeModal` calls it
  directly — a menu route to a new job that the 2026-09-06 decisions retired.
* ⚠️ **Two authored Tokens are inert on `main` today.** `data/tokens.json` carries
  *Wizard Academy* and *Fighter's Academy* with a `promotion` field that nothing
  on `main` reads. They look authored and do nothing.

Merging the branch as-is is not the plan: it conflicts in 4 files after 96 commits
on `main`, and two of its three commits are CMS syncs of `data/` that would
overwrite content authored since.

## 2. Locked decisions

| # | Decision | Source |
|---|---|---|
| **PR-1** | ⭐ **Promotion is a rule, not a Token field.** A new keyword authored on the Rules Line like every other. | Owner, 2026-09-12 (over merging the field) |
| **PR-2** | **The sentence reads "Promotes the hero to Knight."** Verb *Promotes*; the job is the clickable word. | Owner, 2026-09-12 |
| **PR-3** | **Tokens only.** An item cannot carry it: training is a hero standing on a tile for a cycle, and an item has no cycle. | Owner, 2026-09-12 |
| **PR-4** | **One rule names one job.** A Knight's Barracks promotes to Knight and nothing else — no generic trainer. | Owner, 2026-09-06 (carried) |
| **PR-5** | **Train first, ask after.** The cycle runs; when it completes the game offers the job. | Owner, 2026-09-06 (carried) |
| **PR-6** | **The Token is the whole price.** Gold and materials are retired from promotion; only the skill gate (D-262) survives. | Owner, 2026-09-06 (carried) |
| **PR-7** | **Declining costs nothing and moves nobody.** The hero stays on the tile, the tile holds, and it asks again only when a hero is picked up and put back. | Owner, 2026-09-06 (carried) |
| **PR-8** | **Refuse before the work.** No training starts if the hero already holds the job or fails the skill gate. | Owner, 2026-09-06 (carried) |
| **PR-9** | **The Change Job screen previews; it does not promote.** Otherwise it is a second, free-of-Token route to the same result. | Owner, 2026-09-06 (carried) |

PR-4 to PR-9 are not to be re-litigated; they were decided with the branch and
only the *expression* (PR-1 to PR-3) changed.

## 3. How it fits the grammar

```
Promotes the hero to [Knight].
spends 1 charge per hero promoted
```

* **Keyword `promotes`**, label *Promotes*. No `When` clause (the training cycle
  is implied, as `Works as` implies a station's), no filter, no reach, no upkeep.
* **One slot, `jobId`** — a vocabulary of every job with a parent (Recruit has
  none, so nothing can promote *to* it), read from `jobRegistry`, so a new job
  appears in the editor with no editor change.
* **"the hero" is fixed wording, not a role slot.** It is always whoever stands on
  the tile; offering other roles would offer rules that cannot happen.
* **The charge is spent when the player accepts**, as the branch did. That is a
  new charge moment, `on_promote`, added *with its reader* (`BoardPromotion.accept`)
  per the charge-moment registry's own rule, defaulting to 1 and editable in the
  cost strip — so an unlimited academy is a written 0.
* **Token type `promotion`** is derived from the rule, above the work-cycle rungs
  (a promotion Token has a cycle and would otherwise file itself as a station).
* **Training time** is the Token's cycle time, defaulting to 30 seconds.

## 4. Phases

### P1 — The vocabulary
Keyword, `jobId` slot, renderer wording, golden regenerated and its diff read,
type derivation, and the Item editor not offering it. A Promotes rule can be
written and reads correctly, and does nothing yet.

### P2 — The two Academies become rules
One pure function turns `promotion: { jobId }` into a library effect holding a
Promotes rule, referenced by the Token. Called from **both** the CMS store's load
and a one-off data script — the precedent is `migrate-effects-library.mjs` —
because the CMS's copy lives in browser storage and a script cannot reach it. If
the two disagreed, the next sync would silently undo the work.

⚠️ Writes `data/tokens.json` and `data/effects.json` by script. That is the one
exception the never-hand-edit rule already allows (a migration), and the plan
says so rather than doing it quietly. Idempotent.

### P3 — The engine
Port `BoardPromotion` from the branch to read the rule instead of the field:
training cycle, offer event, accept/decline, pause. Retire gold and materials from
`PromotionSystem`. Add the `on_promote` charge moment. Port the branch's
`BoardPromotion` tests, and add ones for the rule shape and for an item carrying it
(ignored).

### P4 — The ceremony
Port `PromotionCeremonyModal` and `PromotionTrade`, wire the offer into the UI,
and make `JobChangeModal` preview-only. **Verified by playing**: stand a hero on
an Academy, train, accept, decline — the branch found two ceremony bugs that only
showed up in play.

### After
Delete the `promotion-tokens` branch once P4 is merged (owner's call). Tell the
economic simulator the re-training sink moved from gold to a Token's drop rate.

## 5. Implementation status

| Phase | State | Notes |
|---|---|---|
| P1 Vocabulary | **NOT STARTED** | |
| P2 Academies become rules | **NOT STARTED** | |
| P3 Engine | **NOT STARTED** | |
| P4 Ceremony | **NOT STARTED** | |
