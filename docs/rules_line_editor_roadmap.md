# The Rules Line — roadmap

*The authoritative plan. Vision: [`concept_rules_line_editor.md`](concept_rules_line_editor.md).*

**Status: planned 2026-09-09, no code yet.** Decisions below marked locked came
from an owner interview on 2026-09-09 and are not to be re-litigated.

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| **E-1** | ⭐ **One continuous line per rule.** You type left to right and it reads as prose, but every word you commit is a term the system offered. **Still no parser.** | Owner's pick over free-text-and-parse and over finishing the chips. Delivers the feel of writing rules text without a second representation that can drift, without ambiguous half-states, and without "why did it read it that way" becoming something to debug. |
| **E-2** | ⭐ **The line IS the rendered sentence.** `renderStatement` gains a segment form; the line is those segments with the decision segments made interactive. The string form becomes the joined segments. | One renderer, no inverse function, and the editor cannot disagree with what the game prints. Preserves G-22: improving the sentence language improves the tool in the same edit. |
| **E-3** | **Click a word, retype that word.** The rest of the sentence stays put. | Owner's pick. Tweaking beats creating in frequency by a wide margin, and most tweaks are one word — a magnitude, a target, a moment. |
| **E-4** | **An unrecognised word inserts nothing**; the panel shows the nearest legal terms with their hints. | Keeps "an invalid rule is unwritable" true, and turns a wrong guess into a way of finding the right word rather than a dead end. |
| **E-5** | **The panel stays, always visible, following the cursor.** | Owner's pick. Typing is not self-documenting and the vocabulary is large. It is how an author meets a word they did not know existed, and it keeps the editor fully usable by clicking alone. G-19 survives intact. |
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
┌─ the line ───────────────────────────────────┬─ what can go here ─┐
│ When this Token's own cycle completes,       │ ▸ the actor        │
│ deals [2] damage to [the actor].             │   whoever worked…  │
│                     ↑ cursor                 │ ▸ this entity      │
├─ cost and cadence ───────────────────────────┤   the Token itself │
│ spends 1 charge · no cooldown · always       │ ▸ the source       │
└──────────────────────────────────────────────┴────────────────────┘
```

Three regions, and each has one job: the sentence says what the rule **does**,
the strip beneath says what it **costs**, the panel says what is **possible**.

## 3. The phases

### P0 — One rule, on screen, not wired ⬅ *start here*

A static prototype of the line and panel for a single `Deals` rule. No editing,
no state, no integration. **Its only purpose is to answer "too dense to read"
before anything is built on the assumption that it isn't.**

⚠️ Judged by the owner looking at it, not by tests. Density is the complaint that
cannot be verified any other way, and the whole plan rests on the line reading as
a sentence.

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

### P2 — The line

Render the segments. Put the cursor on a decision segment; type to narrow against
`slotsOf`; enter commits. Nothing else in the sentence moves (E-3). An
unrecognised word inserts nothing (E-4).

### P3 — The panel, re-hosted

`filterOptions` and the slot hints already exist and already drive the V3 panel.
This is re-hosting them against the new cursor model, not rebuilding them.

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
| P0 Prototype one rule | **NOT STARTED** | Owner judges density before anything is built on it. |
| P1 Renderer emits segments | **NOT STARTED** | Byte-identical assertion first. |
| P2 The line | **NOT STARTED** | |
| P3 The panel | **NOT STARTED** | |
| P4 Delete the forms | **NOT STARTED** | ⭐ The phase that fixes the actual complaint. |
| P5 Cost and cadence | **NOT STARTED** | |
| P6 Token and Item editors | **NOT STARTED** | |

## 5. Open questions

**Q1 — Does the read-only sentence beneath the line survive?** If the line *is*
the sentence, a second copy of it underneath is redundant. My reading is that it
goes, but the owner said the sentence-underneath is the part of today's screen
that works, so this is worth confirming **when P0 is on screen** rather than in
the abstract.

**Q2 — What does a brand-new, empty rule look like?** A blank line with the panel
offering verbs, or a starter sentence with every decision unset? The second is
friendlier and the first is honest about there being nothing there yet.

**Q3 — Keyboard-only authoring.** Tab between decisions, enter to commit, escape
to revert? Worth settling once the line exists and the conventions can be felt
rather than guessed.

## 6. Deliberately out of scope

* **Parsing free text**, in any form, including "accept a pasted sentence".
  Offered, considered, declined — twice now. E-1 is the settled answer.
* **Writing a whole effect as a paragraph.** Offered and declined (E-7).
* **Changing the grammar itself.** This is an authoring surface for the
  vocabulary that exists. If a rule cannot be said, that is a grammar gap and
  belongs in the grammar roadmap, not here.
