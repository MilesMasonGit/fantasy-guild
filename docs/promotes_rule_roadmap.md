# The "Promotes" rule — roadmap

*The authoritative plan for letting a Token train a hero into a job, written as a
rule. Status table in §5.*

**Status: P1–P4 done 2026-09-12 — promotion is playable end to end.**

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

#### What P1 decided that the plan did not say

* **`tokensOnly: true` is a declaration on the keyword**, not a check in the
  editor — so the CMS reads it (game defines, CMS renders) and P3's engine can
  read the same flag to ignore the rule on an item.
* ⚠️ **An item can still be handed one** through "Use an existing effect", since a
  library effect is bearer-agnostic. The Item editor then says, in the warning
  colour, that the rule does nothing there. Blocking the attachment outright
  would need the library to know its bearers, which it deliberately does not.
* **The job slot's hint names where each job comes from** ("Knight — from
  Fighter"), because the gate a hero must pass is the parent job's skills.
* **A Token with two Promotes rules uses the first job it names**
  (`promotedJobOf`). PR-4 says one rule names one job; guessing between two
  would hide an authoring mistake.
* **A new Promotes effect is named "<Job> Training"**, e.g. *Knight Training*.
* ⚠️ **The golden was already stale on `main`.** Today's 19:01 CMS syncs added
  shipped content, and the golden reads shipped data. The refresh is its own
  commit, separate from the five Promotes cases, so the diff that is P1's is
  readable on its own.
* **Not verified in a browser.** The CMS workspace in the preview browser is
  empty and the sandbox pages were deleted at the owner's request, so the menus
  and the retyped job are verified by `PromotesRule.test.js` against the real
  components. P3 and P4 are verified by playing the game.

### P2 — The two Academies become rules
One pure function turns `promotion: { jobId }` into a library effect holding a
Promotes rule, referenced by the Token. Called from **both** the CMS store's load
and a one-off data script — the precedent is `migrate-effects-library.mjs` —
because the CMS's copy lives in browser storage and a script cannot reach it. If
the two disagreed, the next sync would silently undo the work.

⚠️ Writes `data/tokens.json` and `data/effects.json` by script. That is the one
exception the never-hand-edit rule already allows (a migration), and the plan
says so rather than doing it quietly. Idempotent.

#### What P2 decided that the plan did not say

* **`migratePromotionFields` lives beside `migrateBearers`** in
  `effectMigration.js`, re-exported to the CMS through `utils/constants.js`, and
  runs on all three CMS load paths (`merge`, `migrate`, `hydrate`) after
  `seedEffectLibrary`.
* ⚠️ **Deterministic ids.** Script and CMS run independently, so a random
  statement id would give the same rule two ids and churn every sync. The
  statement is `stm_promotes_<job>`; the effect `effect_<job>_training`, made
  unique against the library it joins.
* **One effect per job, shared**, and a library effect already holding exactly
  that one Promotes rule is reused. A field naming no job is left untouched; an
  unknown job still converts, so it shows on screen rather than vanishing.
* **The script ADDS to `data/effects.json`**, unlike the effects-library
  migration, which replaced the old orphan file.
* ⚠️ **It keeps each file's trailing newline as found.** The CMS sync writes
  `data/` with none; the first run added one and would have made every later
  sync flip it back. Caught reading the diff, fixed before committing.
* ⚠️ **The owner must reload the CMS before the next Sync to Game.** A page
  opened before this change holds the old field in memory; only a reload runs
  the conversion. Logged in the changelog.
* **The stored `tokenType` still says `buff`** on both Academies. The derived
  type is `promotion`; the stored one is only rewritten by Recalculate, as for
  every other type.
* ⚠️ **The owner's CMS syncs commit onto whatever branch is checked out.** Two
  syncs at 19:25 landed on `promotes-p1` and reached `main` with its merge; one
  added `effect_bonus_drop_2`, so the golden went stale a second time and got a
  second refresh commit, again kept apart from P2's own lines.

### P3 — The engine
Port `BoardPromotion` from the branch to read the rule instead of the field:
training cycle, offer event, accept/decline, pause. Retire gold and materials from
`PromotionSystem`. Add the `on_promote` charge moment. Port the branch's
`BoardPromotion` tests, and add ones for the rule shape and for an item carrying it
(ignored).

#### What P3 decided that the plan did not say

* ⭐ **A Promotes rule's charge number counts only once its moment is authored**
  (`chargeDeltaOf` in `chargeMomentRegistry.js`). P2 built both Academies through
  `makeStatement`, which stamps `chargeDelta: 0` on any keyword that cannot fire.
  Read literally, every Academy would promote heroes for free, forever — the
  opposite of PR-6. Nothing before P3 could author a promotion price, so an
  absent `chargeWhen` means "never set" and costs the default, one charge. The
  cost strip writes `chargeWhen` beside a typed number, so a deliberate 0 still
  makes an unlimited academy. Same opt-in rule `statementCycleCost` already
  applies to per-cycle costs.
* ⭐ **One reading of a charge number, shared.** `Charges.statementChargeDelta`
  (what the board spends) and `costSlots` (what the CMS shows) both call
  `chargeDeltaOf`, so they cannot disagree.
* ⚠️ **The Change Job screen's preview-only change moved from P4 into P3.**
  Removing the gold price with its confirm button still calling
  `PromotionSystem.promote` would have opened a free, Token-less route to any job
  for the length of the gap between phases. The trade display is unchanged; the
  shared `PromotionTrade` component still ports in P4.
* **A Token that cannot pay does not train** (`ALERT.CHARGES`). The branch's
  Tokens always had one charge to give; a rule price of 2 on a Token with 1 left
  would otherwise train a hero toward an offer that can never be accepted.
* **Spending goes through `Charges.applyDelta`**, not the branch's hand-rolled
  copy, so a spent Academy depletes exactly as every other Token does — vacancy,
  `TOKEN_DEPLETED` with the instance and hero, hero left standing.
* **A positive price is no price**, never a refund: promotion cannot restore
  charges.
* **The retired `promotion` field is ignored by the engine**, deliberately: only
  the rule counts, so an unmigrated workspace cannot half-work.
* **Two guard tests read the source**: the Promotes rule is read in exactly one
  engine file, which reads Tokens (PR-3), and `PromotionSystem.promote` has
  exactly one caller, `BoardPromotion` (PR-9).
* ⚠️ **Between P3 and P4, an offer cannot be answered in play.** The engine
  offers; the ceremony that accepts or declines is P4. A hero who finishes
  training waits on the tile.

### P4 — The ceremony
Port `PromotionCeremonyModal` and `PromotionTrade`, wire the offer into the UI,
and make `JobChangeModal` preview-only. **Verified by playing**: stand a hero on
an Academy, train, accept, decline — the branch found two ceremony bugs that only
showed up in play.

#### What P4 decided that the plan did not say

* ⭐ **It is a port, and the owner was right that it already existed.**
  `PromotionCeremonyModal` and `PromotionTrade` were written and approved on the
  unmerged `promotion-tokens` branch; P4 copies them onto `main` against the
  rule-reading engine. They call the same three functions P3 ported
  (`accept`, `decline`, `getOffer`), so the changes are small.
* ⚠️ **A decline is now recorded on the Token** (`promotionDeclined`). The branch
  saved an offer on the instance but only ever opened the window at the moment
  training finished, so after a reload a waiting hero was never asked. P4 opens
  the window for a standing offer on `game_loaded` and on mount — which needed
  the decline recorded, or a player who said "not yet" would be asked again the
  moment they loaded (PR-7). A declined offer can no longer be accepted either.
* **A refused acceptance is explained in words** (`refusalText`), because P3's
  engine returns reason codes, not the branch's prose.
* **The Change Job screen draws `PromotionTrade`**, retiring its own trade list,
  so the two screens cannot disagree.
* **"Not yet" is named explicitly** (`aria-label`). With only a `title` the
  browser exposed it by its tooltip; found while clicking through it.
* **Seven deliberately wrong versions; six caught.** The miss — deleting
  `hideClose` — changes nothing observable: `GIModal` offers a close control or
  backdrop dismissal only when handed an `onClose`, and the ceremony passes
  none. `hideClose` is a second lock on a door that is already shut.
* **The console's duplicate-key warning predates P4.** A brand-new game with no
  heroes, no Tokens and no promotion logs it too. Not investigated here.
* **Verified by playing, in the real game:** training → window opens by itself →
  Become Wizard → "Promotion complete", still showing Recruit → Wizard and what
  was set aside (the branch's first play-found bug, not reintroduced) → Done
  closes it; a second offer arrives unanswered (the branch's second bug, not
  reintroduced); Not yet → nothing spent, not re-asked over 40 s; save, reload,
  load → the unanswered offer's window reopens and the declined one stays quiet.

### After
Delete the `promotion-tokens` branch once P4 is merged (owner's call). Tell the
economic simulator the re-training sink moved from gold to a Token's drop rate.

## 5. Implementation status

| Phase | State | Notes |
|---|---|---|
| P1 Vocabulary | ✅ **DONE** 2026-09-12 | Keyword `promotes` (`tokensOnly`), `jobId` slot over every job with a parent, "Promotes the hero to Knight.", Token type `promotion`, hidden from the Item editor with a warning if attached anyway. `PromotesRule` (18) tests. Golden: 5 new cases; no existing sentence changed. |
| P2 Academies become rules | ✅ **DONE** 2026-09-12 | Wizard Academy → *Wizard Training*, Fighter's Academy → *Fighter Training*, by `scripts/migrate-promotion-rules.mjs` (data) and the CMS store's load paths (workspace), one shared function. Deterministic, idempotent, second run writes nothing. `PromotionFieldMigration` (21) tests, including the game's own Token registry loading both Academies as `promotion` Tokens; six deliberately wrong versions each caught. The game boots on the migrated data with no console errors. Golden: 6 new shipped lines. ⚠️ Owner must reload the CMS before syncing. |
| P3 Engine | ✅ **DONE** 2026-09-12 | `BoardPromotion` ported to read the rule; price = the rule's charge cost at new moment `on_promote` (default 1; migrated 0 does not make the Academies free); gold/materials retired; Change Job screen preview-only (pulled forward from P4 to avoid a free route). `BoardPromotion` tests ported and extended, two re-training tests un-skipped. ⚠️ Offers can't be answered in play until P4. |
| P4 Ceremony | ✅ **DONE** 2026-09-12 | Ported the branch's ceremony window and trade display; opens on training complete and re-opens for an unanswered offer on load; decline recorded so it never re-asks. Played end to end in the real game: accept, done, second offer, decline, save/reload. |
