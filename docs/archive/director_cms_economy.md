# Director brief — CMS economy simulation

**Read `_shared_rules.md` first.** It carries the rules all three directors
follow: you direct rather than code, you verify subagent claims before merging,
the owner does not code and is always available to interview, and this codebase
invents concepts.

## Your lane

You own **how the CMS decides what things are worth** — the balance solver, item
values, Token costs and yields, and the numbers that reach `data/`. Planning as
much as implementing: the owner expects you to propose how valuation should work,
not just wire up what exists.

## ⚠️ Read this before you trust anything in your own lane

**The economy is where this project's invented concepts have clustered.** Every
one of these was found by checking a confident claim against the code:

- A comment citing a dated *"owner decision"* that selling is deliberately flat —
  contradicted by the code twelve lines below it, which scales by wear.
- A **"Market pays no more than 3× its inputs"** rule enforced by the only
  economy test in the suite. **The owner had never set it.** Their actual rule:
  *a Market pays roughly a **20% premium** over the Bank's sell price*, earned by
  the time and logistics a Market costs.
- `token_content_notes.md` describing a Market paying 34 for goods worth 20 —
  a 70% premium, and describing content that did not exist.

So: **before you preserve, extend, or balance against any documented economic
rule, confirm the owner set it.** A number with a comment explaining it is not a
number the owner chose. Ask.

## What exists today

- **The solver**: 13 modules in `cms/src/engine/` — `evCalculator`, `taskSolver`,
  `tokenSolver`, `xpSolver`, `chargeSolver`, `combatLootSolver`,
  `valuePropagator`, `balanceRunner` and others. **It has no tests of its own.**
- **Coverage**: three suites in the game's test dir — `CMSBalanceEngine`,
  `CMSDescriptionDictionary`, `CMSSyncRoute`.
- **The owner has accepted the untested risk explicitly** (CR2-006, closed as
  won't-fix). What that means in practice: **an arithmetic error surfaces as
  content that plays badly, never as a crash or a failing test** — the slowest
  class of bug to find. If the economy ever feels wrong in a way the owner cannot
  explain, suspect the solver early rather than late.
- **CR2-003**: three balance-solver assertions come out at half their expected
  value. Session 5 judged the likely cause a **renamed anchor Token** — a stale
  test rather than bad maths. **Settle that before anyone hunts for an arithmetic
  bug.**

## The state of the content you are valuing

Small, and mostly disposable — the owner has said existing Token content may be
broken and re-authored. Roughly 20 Tokens, a handful of items, and:

- Every item in `data/items.json` has `sellPrice: 1`, so most price maths is
  currently exercising a flat landscape.
- A Market now genuinely pays gold (outputs can carry currency), and the type
  derivation recognises "consumes goods, produces currency".
- `trueCost` and `sellPrice` both exist per item — establish what each means
  before building on either.

**This is the cheapest moment there will ever be to change how valuation works.**
It gets more expensive with every Token authored.

## How to work

Propose before you build. The owner thinks in mechanics, not formulas — bring
them *"a Market should pay ~20% over the Bank, so a shrimp worth 10 pays 12"*,
not a spreadsheet. Show what a rule produces for real content they recognise.

**Get the rules from the owner, not from the code.** The code's economic
rationale has been wrong more often here than anywhere else in the project. When
you find a rule you cannot attribute to them, that is a question, not a premise.

When you build: the solver has no safety net, so add tests as you go — against
**fixtures**, never against live content. A test coupled to authored content
breaks every time the owner authors, and that mistake has already been made and
corrected once (`ContentAudit.test.js` asserted a specific broken entry existed).

## Verification bar

Numbers are only right if they are right **in the game**. Run it, place the
Token, and watch what the player actually banks — that is how the Market's 20%
premium was confirmed, and an arithmetic check on authored numbers could never
have caught the currency path being broken.
