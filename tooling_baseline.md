# Code-quality tooling — baseline results

Three automated checks were added to the game project on 2026-08-18, on branch
`review-tooling`, so that code review round 2 can work from evidence rather than
from whatever a reader happens to notice.

This file records **what they actually found**. It is not a ticket list — the
review turns these into tickets.

**Headline:** the tooling found the codebase to be in better structural shape
than a spaghetti hunt might expect. There are **no dangerous import cycles at
all**, and duplication sits at **0.44% of lines**. The genuinely useful findings
are a handful of specific things, listed below, not a long list.

---

## 1. ESLint — `npm run lint`

**What it is.** A linter: it reads the code without running it and reports
things that are almost always mistakes — a variable that is set but never used,
code that can never be reached, a reference to something that does not exist,
React hooks used in a way React does not allow.

The game had no linter at all until now (only the CMS did). It is configured to
report *problems*, not *style*: no rules about quotes, semicolons or indentation
were switched on, because 233 files of existing formatting would have produced
hundreds of complaints and buried everything worth reading. The reasoning is
written into `eslint.config.js` next to each decision.

**What it found.**

| | Count |
|---|---|
| First run, before any fixes | **171 problems** across 86 files |
| Unused imports removed in this branch | **134** across 82 files |
| Remaining now | **37** (29 errors, 8 warnings) |

The 134 removals were imports that nothing in the file used. Removing an unused
import cannot change behaviour, so these were fixed directly. Tests stayed at
834 passed / 21 skipped and the build stayed clean, before and after.

Everything remaining needs a human decision, so it was left alone. The ones
worth the review's attention:

**a. A real React rule violation — `src/ui/components/base/GICard.jsx` (lines 140–141).**
Two `useTransform` hooks are called inside a block that only renders when the
card has an image. React requires every hook to run in the same order on every
render; a card whose image appears or disappears can therefore crash with
"rendered fewer hooks than expected". This is the single most likely-to-bite
item the linter found. It is a real fix, not a cleanup, so it was not attempted
here.

**b. A half-finished feature — `src/ui/components/base/ToastContainer.jsx`.**
The component has a `collapsed` state that filters the notification list down to
crisis alerts, and computes a `hiddenCount` of what it suppressed. But nothing
ever sets `collapsed`, and `hiddenCount` is never displayed. The collapse
feature is unreachable: the machinery is there, the way to trigger it is not.

**c. `src/systems/quests/QuestManager.js` — `tick(deltaMs)` ignores `deltaMs`**
and reads `Date.now()` instead. Not wrong on its own, but it means quest timing
does not follow the same clock the rest of the engine is ticked with. Worth a
deliberate decision rather than an accident.

**d. Small signs of intent that got lost.** `NotificationSubscriptions.js` pulls
`className` and `traitName` out of the `hero_recruited` event and then writes a
message using neither. `BankTab.jsx` reads the player's gold and never uses it.
`BoardTile.jsx` defines an `ALERT_HINT` lookup table nothing reads. Each is
harmless today; each is a sentence someone started and did not finish.

**e. Eight warnings about React effect dependency lists** (`useGameState.js`,
`useUIModals.js`, `BoardTile.jsx`). These are set to warn, not error, because
some are deliberate. `useGameState.js` line 126 is the one to look at: its
dependency list is not a literal array, which means neither React's tooling nor
a reader can tell what it actually depends on.

---

## 2. Import cycles — `npm run cycles`

**What it is.** A home-grown script (`tools/cycles.mjs`, no new dependency) that
maps which files import which, and looks for loops: A needs B, B needs C, C needs
A. Loops are the clearest mechanical sign of tangled code, because no file in the
loop can be read, tested or moved on its own.

It follows the accuracy lessons already recorded in `tools/reachability.mjs` and
in the "three ways this tool lies" note in `code_review_v2_findings.md` — in
particular it matches genuine `from '…'` import statements, never bare mentions
of a filename, which is how an earlier pass in this project reached a confidently
wrong conclusion.

**What it found.** 231 files, 1,054 internal imports between them.

- **Zero dangerous cycles.** Not one loop is formed by ordinary imports. This is
  a genuinely good result and worth stating plainly: the module structure is
  acyclic.
- **One 16-module group** shows up as mutually reachable, but only because of
  two deliberate lazy imports in `src/state/GameState.js` (lines 44–45), where
  `_rehydrateAll` loads `HeroManager` and `EquipmentManager` at runtime. That is
  the standard way to *break* a cycle, and it works: nothing is loaded in a
  circular order.

The one thing here worth the review's eye is architectural rather than
mechanical. `GameState` lives in the data layer, and those two lazy imports are
it reaching back up into the engine layer to re-derive hero and equipment data
after a save is loaded. The lazy import is the tell that the dependency runs the
"wrong" way. The files caught in the group are the hero / inventory / equipment
cluster:

```
src/state/GameState.js
src/systems/hero/HeroManager.js, SkillSystem.js, logic/*.js  (5 files)
src/systems/equipment/EquipmentManager.js, EquipmentValidator.js
src/systems/inventory/InventoryManager.js, InventoryStore.js, InventoryFormatter.js
src/systems/economy/CurrencyManager.js
src/systems/progression/RegistryManager.js
src/utils/RecruitCostCalculator.js
```

Whether rehydration belongs in `GameState` at all is a fair question for the
review. Nothing is broken today.

---

## 3. Duplication — `npm run duplication`

**What it is.** `jscpd`, a well-established copy-paste detector, added as a dev
dependency. It finds passages of code that appear in more than one place.

Tuned in `.jscpd.json` to a minimum of 60 tokens over 5 lines — above the tool's
default of 50. At the default the report filled up with repeated data blocks
inside `config/registries/*.js` (the same six-line stat shape written out once
per enemy and item), which is content, not copied logic. Tests are excluded:
they repeat their setup on purpose. `dist/`, `node_modules/`, `cms/` and
`archive/` are excluded too.

**What it found.** 169 files, **12 clones, 0.44% of lines duplicated.** That is a
low number and mostly uninteresting — three of the twelve are still repeated data
inside the registries, and three more are a file repeating a passage of itself
(`Placement.js`, `RecipeResolver.js`, `QuestManager.js` ×2).

**One finding here is worth real attention.**

**The "deposit a token into the Vault" rule is written out three times**, in
three unrelated UI components:

- `src/ui/components/board/Tray.jsx` (lines ~172–192)
- `src/ui/components/drawer/TokenVaultTab.jsx` (lines ~62–85)
- `src/ui/components/nav/BubbleMenu.jsx` (lines ~106–130)

All three carry the same business rules — maps cannot be stored, the Vault can
be full, take the token out of the tray — copied line for line. **And the copies
have already drifted.** Only the `TokenVaultTab` version publishes the
`state_changed` and `vault_deposited` events after a successful deposit; the
other two do not. So depositing a token behaves differently depending on which
part of the screen you drop it on. This is exactly the failure mode duplication
causes, caught in the act, and it is a rule that belongs in the engine layer
rather than in three React components.

Two smaller ones:

- **`DetailLine` is defined twice, identically** — `BankTab.jsx` (line 549) and
  `TokenInspection.jsx` (line 243). A four-line presentational component; an easy
  extraction.
- **A framer-motion animation preset is copied** between `Toast.jsx` (line 47)
  and `QuestColumn.jsx` (line 34) — the same fade/slide/scale numbers in both.
  Worth a shared constant so the two float in step.

---

## Noticed and left alone

These were spotted while running the tools. They are out of scope for a tooling
change and were **not** touched.

- **`src/ui/components/base/GISurface.jsx` is now orphaned.** Its only importer
  was `GIModal.jsx`, and that import was unused, so removing it left the file
  with nothing reaching it. Confirmed by grepping `src/`, `cms/src/` and the
  tests, and by `tools/reachability.mjs`. It is a 29-line component with no test.
  Deleting it is probably right, but that is a deletion decision, not a lint fix.
- **One stale suppression comment** — `src/tests/Risk13Allocation.test.js` line
  121 disables a rule that no longer reports anything there.
- **The build warns that the JS bundle is 865 kB**, over Vite's 500 kB advisory.
  Pre-existing and unrelated to this work.
- **`npm audit` reports vulnerabilities** in the dependency tree, pre-existing
  and in dev-only tooling.

---

## How to re-run everything

```
npm run lint          # ESLint — problems, not style
npm run cycles        # import-cycle detector (tools/cycles.mjs)
npm run duplication   # jscpd copy-paste detector (config in .jscpd.json)
```

All three exit cleanly and print a summary at the end. Baseline at the time of
writing: lint 37 problems, cycles 0 dangerous, duplication 12 clones / 0.44%.
