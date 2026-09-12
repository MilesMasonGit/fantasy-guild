# The Rules Line — roadmap

*The authoritative plan. Vision: [`concept_rules_line_editor.md`](concept_rules_line_editor.md).*

**Status: P0–P3 done 2026-09-12; P4 is next.** Decisions below marked
locked came from owner interviews on 2026-09-09 and 2026-09-12 and are not to be
re-litigated.

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| **E-1** | ⭐ **One continuous line per rule.** You type left to right and it reads as prose, but every word you commit is a term the system offered. **Still no parser.** | Owner's pick over free-text-and-parse and over finishing the chips. Delivers the feel of writing rules text without a second representation that can drift, without ambiguous half-states, and without "why did it read it that way" becoming something to debug. |
| **E-2** | ⭐ **The line IS the rendered sentence.** `renderStatement` gains a segment form; the line is those segments with the decision segments made interactive. The string form becomes the joined segments. | One renderer, no inverse function, and the editor cannot disagree with what the game prints. Preserves G-22: improving the sentence language improves the tool in the same edit. |
| **E-3** | **Click a word, retype that word.** The rest of the sentence stays put. | Owner's pick. Tweaking beats creating in frequency by a wide margin, and most tweaks are one word — a magnitude, a target, a moment. |
| **E-4** | **An unrecognised word inserts nothing**; the panel shows the nearest legal terms with their hints. | Keeps "an invalid rule is unwritable" true, and turns a wrong guess into a way of finding the right word rather than a dead end. |
| **E-5** | **The panel stays, always visible, following the cursor — on the LEFT** *(left side ruled by the owner 2026-09-12, seeing P0)*. | Owner's pick. Typing is not self-documenting and the vocabulary is large. It is how an author meets a word they did not know existed, and it keeps the editor fully usable by clicking alone. G-19 survives intact. |
| **E-6** | **Cost and cadence live beside the sentence, not in it** — charge cost, cooldown, upkeep, chance, `requires`. | Owner's pick. A different kind of decision, changed far less often. In the line they would put four numbers in front of every sentence you read. |
| **E-7** | **One rule at a time.** An effect is a list of lines; each is composed on its own. | Owner's pick over writing a whole effect as a block. Matches the data shape and keeps each sentence checkable on its own. |
| **E-8** | ⭐ **Every payload decision becomes a segment, and the fourteen leftover forms are deleted — not hidden.** | The duplication is the single biggest complaint and the reason the screen reads as a maze. A decision that still needs a form is a decision the sentence cannot express, and each one is a hole the maze grows back through. |
| **E-9** | **Everywhere rules are edited** — effects library, Token editor, Item editor — renders the one component. | Owner's pick. They already share a component, so it is barely more work, and leaving one on the old forms means maintaining both idioms indefinitely. |

### What this changes in the grammar roadmap

* **G-18** — its ban on a parser **survives and is reaffirmed**. Its *chip*
  presentation is superseded by E-1.
* **G-19** — survives unchanged as E-5.
* **G-20** — *"inline for simple values, popover for pickers, a small form for
  genuine tables"* is **narrowed by E-8**. A form survives only for a genuinely
  tabular payload — `Converts`' two item lists is the one clear case. It is not a
  general licence, and reading it as one is how fourteen of them accumulated.
* **G-22** — reinforced by E-2, and is the reason E-2 is worth the refactor.

## 2. The shape

```
┌─ what can go here ─┬─ the line ───────────────────────────────────┐
│ ▸ the hero         │ When this Token's own cycle completes,       │
│   whoever worked…  │ deals [2] damage to [the hero].              │
│ ▸ itself           │                     ↑ cursor                 │
│   the Token itself ├─ cost and cadence ───────────────────────────┤
│ ▸ that Token       │ spends 1 charge · no cooldown · always       │
└────────────────────┴──────────────────────────────────────────────┘
```

Three regions, and each has one job: the sentence says what the rule **does**,
the strip beneath says what it **costs**, the panel says what is **possible**.

## 3. The phases

### P0 — One rule, on screen, not wired ✅ *done, and it passed*

A static prototype of the line and panel, at `?p0=1` in the CMS. No editing, no
state, no integration. **Its only purpose was to answer "too dense to read"
before anything was built on the assumption that it isn't.**

⚠️ Judged by the owner looking at it, not by tests. Density is the complaint that
cannot be verified any other way, and the whole plan rested on the line reading
as a sentence.

⭐ **Built with four rules, not the one the plan called for.** A simple `Deals`
rule is the flattering case and would not have tested the complaint at all —
density only appears once a rule carries a computed magnitude or a counted
selector. The verdict came back on the hardest of the four.

⚠️ The comparison column was the **real** editor (`StatementList` with the same
statements), not a recreation, so the new line had to beat the actual thing
rather than a strawman.

Each line also printed whether its hand-written segments joined back to exactly
what `renderStatement` produces. All four said yes — the first real evidence that
P1's byte-identical guarantee is reachable rather than hoped for.

### P1 — The renderer learns to say where each word came from

`renderStatement` returns segments: `[{ text, slotId?, statementPath? }]`. The
existing string function becomes `segments.map(s => s.text).join('')`.

⚠️ **The riskiest phase in the plan, and the least visible.** This function
prints every rule in the game — the Token inspector, the Guild Hall panel, the
CMS, `description` fields. A refactor that shifts a space or drops a comma
changes rules text everywhere at once and nothing would fail.

**Mitigation, and it is not optional:** a test that renders **every authored
statement and every fixture statement** through both paths and asserts the
strings are byte-identical. Written before the refactor, run after.

Twenty functions, 614 lines, 9 consumers. No behaviour change, no UI change.

#### What P1 left deliberately coarse

These words render correctly but are tagged as one wide span, or as plain
text, because the editor has no finer slot for them **yet**. Each is P4's to
split, and each is a place a click will feel imprecise until then:

* `Grants` — "2 Oak Wood" and "40%" are both tagged `payload`, the form slot.
* `Converts` and `Restocks` — whole item and Token lists are one `payload` span.
* `Cannot` — "be adjacent to more than 2" is one `kind` span; the 2 has a `max`
  slot but lives inside the restriction's own template.
* `Works as` — the skill is plain text; its picker is still a form.
* `BONUS_DROP` — the item and quantity are plain text; `Provides` has no item slot.
* `Heals` — a computed heal keeps only its number clickable.

⚠️ **To change a sentence on purpose:** regenerate the golden with
`UPDATE_RENDER_GOLDEN=1 npx vitest run src/tests/RenderGolden.test.js` and
**read the diff of `renderGolden.json`** before committing. That diff is the
review of what every player will see change.

### P2 — The line

Render the segments. Put the cursor on a decision segment; type to narrow against
`slotsOf`; enter commits. Nothing else in the sentence moves (E-3). An
unrecognised word inserts nothing (E-4).

#### What P2 decided that the plan did not say

* ⚠️ **A retyped number keeps its direction.** "work 5% faster" stores −5, so
  retyping the 5 as 20 would silently have made it slower. A typed number takes
  the current sign unless the author types `+` or `-`; a trailing `%` is
  accepted because that is what the sentence shows. "faster" is a different
  word, and E-3 retypes one word.
* ⚠️ **Every decision without a word gets a control.** A flat hit never says
  "measured as", "ignores armour" is silent until true, an empty filter stack
  says nothing. `slotsWithoutWords` lists them and a quiet row beneath the line
  offers each. A test walks every keyword and fails if any slot is unreachable —
  the failure the last code review found hiding behind a form.
* **Typing ranks best-first**, because Enter takes the top hit: exact label,
  label prefix, word prefix, label contains, then hint.
* **Each clickable word is named by the word itself** (`aria-label`), not by its
  slot — a real browser named the "2" button "damage", and a re-rendered one had
  no name at all.

#### Left for P3, deliberately — ✅ all done in P3

* ~~The panel still sits beneath the line; E-5 puts it on the left.~~
* ~~Clicking a blank ("…") should open a search to pick the item or Token.~~
* ~~Arrow keys through the panel's list, and Tab between words (Q3).~~

### P3 — The panel, re-hosted

`filterOptions` and the slot hints already exist and already drive the V3 panel.
This is re-hosting them against the new cursor model, not rebuilding them.

#### What P3 decided that the plan did not say

* ⭐ **The cursor lives in `StatementList`, not in each line.** One panel serving
  every rule has to follow the author between rules, so the list owns which word
  is open. It remembers a word by **slot and occurrence**, never by position,
  because committing a word re-renders the sentence and positions shift.
* ⚠️ **`StatementList` accepts a `content` override** (tokens, items, effects).
  The CMS store **persists itself to localStorage**, so seeding it — even to try
  the editor — would add to the author's real workspace and could reach `data/`
  on the next sync. The sandbox and the tests supply their own vocabulary.
* **Long vocabularies show 30 at a time with a count** ("Showing 30 of 312 —
  keep typing"). A search, not a wall.
* ⚠️ **Tab never guesses.** It commits what was typed if it is valid and simply
  drops it if not. Arrowing onto a suggestion IS an explicit choice, so Enter
  takes it — E-4 still holds for plain Enter on a non-word.
* **On a narrow editor column the panel wraps above the rules** rather than
  squeezing them — the failure that originally pushed the V3 panel beneath.
* ⚠️ **The line names effects by their name.** Found in the browser: picking
  "Poison" from a blank printed "Applies effect_1". Fixed for the editable line.
  ⚠️ **The same gap remains in four read-only rules panels** (EffectEditor's Rules
  Text, the Item editor, the Token editor, and the Token's rules panel) — out of
  this phase's scope and flagged as its own task.

### P4 — ⭐ Delete the fourteen forms

Every remaining decision gets a slot, and the forms go. `Converts`' item lists
stay as a table beneath (E-8's one exception).

⚠️ This is the phase that actually fixes the complaint. P0–P3 make a better line;
**this is what stops the screen being a maze.** It is also where a decision that
was only ever authorable through a form will be found — the code review already
caught one (`Works as` became unauthorable when its form was gated wrongly), so
expect more, and expect them to be silent.

### P5 — Cost and cadence

The strip beneath the line: charge cost, cooldown, upkeep, chance, `requires`.
Mostly relocating controls that already exist.

### P6 — Everywhere else

Token editor and Item editor onto the same component (E-9).

## 4. Implementation status

| Phase | State | Notes |
|---|---|---|
| P0 Prototype one rule | ✅ **DONE, and it passed** 2026-09-12 | ⭐ Four rules, not one — a simple rule is the flattering case. Owner's verdict: *"the fourth rule reads fine"*, so density is settled and the plan may proceed. Also ruled: **E-6 confirmed** (fine print stays beside the sentence) and **the panel moves to the left** (E-5). All four lines' hand-written segments joined byte-identically to the real renderer, which is early evidence P1 is reachable. |
| P1 Renderer emits segments | ✅ **DONE** 2026-09-12 | `renderSegments` is the source; `renderStatement` is its join, so all nine callers were untouched. ⭐ Golden written and committed FIRST: 1382 cases walked from the registries, one changed character turns 344 red. `RenderSegments` holds every tag to the slots `slotsOf` really emits — its first run caught `category` tagged on axes with no category picker. Three text-preserving wrong renderers each turned it red while the golden stayed green. |
| P2 The line | ✅ **DONE** 2026-09-12 | `RulesLine.jsx` replaces `SentenceEditor.jsx` (deleted). The line is `renderSegments`' output; click a word, retype it, Enter commits, Escape reverts. An unknown word commits nothing and offers the nearest real words. Both quoted copies of the sentence are gone (Q1). 30 new tests; four deliberately wrong versions each caught. Verified by clicking and typing in a real browser on a sandbox (`?p2=1`) that never writes to the workspace. |
| P3 The panel | ✅ **DONE** 2026-09-12 | ONE panel for the whole list, on the left, pinned while the rules scroll, and wrapping above them on a narrow column. Tab and Shift+Tab walk the words (Q3); arrows move through the panel; a blank reads "Pick …" and searches, 30 at a time with a count. 32 interaction tests; six deliberately wrong versions each caught. Verified in a real browser on the sandbox: layout at 1280px and 640px, pinning over a 1,500px scroll, Tab/Shift+Tab, arrow + Enter, and picking an effect and an item from blanks. |
| P4 Delete the forms | **NOT STARTED** | ⭐ The phase that fixes the actual complaint. |
| P5 Cost and cadence | **NOT STARTED** | |
| P6 Token and Item editors | **NOT STARTED** | |

## 5. Open questions

~~**Q1 — Does the read-only sentence beneath the line survive?**~~ ✅ **Answered
by P0, 2026-09-12: it goes.** The owner looked at the line with no separate
sentence under it and judged that it reads fine. A second copy would now be the
same words twice, which is the duplication this whole rework exists to remove.

**Q2 — What does a brand-new, empty rule look like?** A blank line with the panel
offering verbs, or a starter sentence with every decision unset? The second is
friendlier and the first is honest about there being nothing there yet.

~~**Q3 — Keyboard-only authoring.**~~ ✅ **Answered 2026-09-12: Tab walks the
words.** Tab moves to the next underlined word and opens it; Shift+Tab goes back;
Up/Down move through the panel; Enter takes the highlighted option; Escape leaves
the word as it was. Past the last word, Tab leaves the sentence normally. Built in
P3.

## 6. Deliberately out of scope

* **Parsing free text**, in any form, including "accept a pasted sentence".
  Offered, considered, declined — twice now. E-1 is the settled answer.
* **Writing a whole effect as a paragraph.** Offered and declined (E-7).
* **Changing the grammar itself.** This is an authoring surface for the
  vocabulary that exists. If a rule cannot be said, that is a grammar gap and
  belongs in the grammar roadmap, not here.
