# Playmat Balance Report — v0.5.0

**Written:** 2026-08-07, on `playmat-7x7-build`, at the end of Phase 10.
**Scope:** the roadmap's Phase 10 asks one question — **is the board
enjoyable?** — and asks for a written report rather than a code summary. This
is that report.

**Baseline:** 613 tests across 42 files, all passing. Build clean.

---

## How to read this

Three kinds of statement below, kept deliberately separate:

| | Meaning |
| :--- | :--- |
| **Measured** | A number produced by an instrument, reproducible from a test |
| **Observed** | Something seen while playing, described honestly |
| ⚠️ **Owner call** | A judgement the design reserves for the owner; **not made here** |

The last category matters. Several of Phase 10's questions are about *feel*,
and a report that quietly answered them on the owner's behalf would be worth
less than one that says plainly which questions are still open.

---

## 1. Risk 7 — clutter on a full board

**The risk that killed the previous spatial playmat**, and this board carries
more per-tile information than that one did. Measured on a deliberately
worst-case board: **48 Tokens, 8 heroes, both alert colours, work in progress,
loot on the floor.**

| Element | Count |
| :--- | ---: |
| Token art | 47 |
| Hero badges | 7 (2 idle-yellow, 5 working) |
| Red alert marks | 2 |
| Progress rings **actually visible** | 4 |
| Loot sprites | 4 |
| **Competing with the art** | **17** |
| **Total on screen** | **64** |

**Measured — the trend across the whole rework:**

| Phase | Total elements |
| :--- | ---: |
| 3 — sprite layer | 128 |
| 4 — rings + alert marks added | 84 |
| 5 — adjacency | 81 at rest |
| **10 — full 48-tile worst case** | **64** |

**Verdict: risk 7 is closed.** The board got *quieter* as it gained systems,
which is the opposite of how clutter normally goes. Two mechanisms did it:

* **The progress ring is mounted on all 48 tiles and drawn on 4.** It is
  invisible unless a cycle is actually turning, so an idle board shows none.
* **Alert marks appeared on exactly the 2 tiles with real problems.** D-149's
  "an unstaffed Token is not an error" is doing heavy lifting — most of a
  48-tile board is unstaffed at any moment, and none of it is flagged.

D-85's "a tile shows exactly three things" budget is being honoured: the
overwhelming majority of tiles show **art and nothing else**.

⚠️ **Owner call outstanding:** these are element counts, not an aesthetic
judgement. The numbers say the board is quiet; whether it *looks* good at 48
placeholder skill-icons is a different question, and real Token art (deferred to
a later art pass) is the obvious lever.

---

## 2. Risk 13 — does first-come allocation starve deep chains?

**The roadmap's instruction was explicit: do not guess — measure.** Phase 4
instrumented the allocator for exactly this.

**Setup.** A shallow consumer (needs 2) and a deep one (needs 5), identical in
every other respect, sharing a metered wood supply of 12/min against the ~23/min
they jointly want. Sustained 3 minutes of board time.

**Measured:**

| | Shallow (needs 2) | Deep (needs 5) |
| :--- | ---: | ---: |
| Cycles completed | 8 | 3 |
| **Input consumed** | **16** | **15** |
| Starved ticks | 249 | 1,260 |
| **Share of the scarce material** | 52% | **48%** |

**Verdict: risk 13 is real but mild — milder than the design feared.**

The fear was that deep chains would be squeezed toward zero while shallow ones
ran freely. **That is not what happens.** First-come allocation splits the
scarce input almost exactly evenly *by volume*; the deep chain then converts its
half into fewer, more valuable outputs — which is precisely what a deep chain is
supposed to do.

**The completion count (8 vs 3) is the misleading number**, and it is the one the
risk was originally framed around. A chain costing 2.5× more per cycle *should*
complete less often. The number that answers the question is input share, and at
48% the deep chain is not being penalised.

**What the starved-tick count actually means.** The deep consumer spent 5× more
ticks blocked — but blocked ticks are not lost value, they are waiting. It
converts its wait into larger batches. High starvation with fair input share is
the signature of a chain that is *patient*, not one that is *starving*.

**No change recommended to D-127.** A guard test now pins the input share above
30%; if a future allocation change pushes it below, the hazard has become real
and that is the moment to give deep chains a rule.

---

## 3. Cycle pacing and rhythm

**Measured**, on the 48-Token board over 300 seconds of board time:

* 85 completions with 7 heroes placed → **3.53 s per completion**
* Extrapolated to a full 8-hero roster → **~3.1 s per completion**

D-164 targets "roughly one completion every two or three seconds — a steady
rhythm where each drop still registers, rather than a blur."

**Verdict: on target, at the slow end.** ~3.1s sits just outside the stated 2–3s
band and firmly inside the *intent* of it. Every completion is individually
legible; nothing blurs. If anything there is headroom to speed content up
slightly, which is a content-tuning lever rather than a systems one.

⚠️ **Not measured: the inhale-and-exhale rhythm** (an early board of charged
Tokens depleting, settling as unlimited-use Tokens accumulate). That plays out
across hours, not minutes, and cannot be honestly assessed from a synthetic
board. It needs a real session.

---

## 4. The open balance questions

| Question | Status |
| :--- | :--- |
| Is 1 HP / 5s regen enough to make retreat-and-recover a tactic? (`G-2`) | ⚠️ **Owner call.** Untuned for a board where combat is permanent |
| Does a 3–6 item burst carry the headline reward beat? (D-167) | ⚠️ **Owner call, and the most important one.** Mechanics verified; feel not judged |
| Are adjacency effects too small to notice? (risk 2) | ⚠️ **Owner call.** See below |
| Does the board solve into one optimal geometry? (risk 1) | Not yet answerable — needs extended real play |
| Is a purely constructive board unchallenging? (risk 5) | ⚠️ **Owner call.** This is the experiment the whole design rests on |
| Can a returning player tell "I ran out of stock" from other failures? (risk 15) | ✅ **Closed in Phase 7.** The emptied tile carries a red mark reading *"This tile ran dry and the Vault has no replacement — restock it"*, and the hero on it carries the yellow one |

**On risk 2 (adjacency too subtle), one piece of evidence worth having:** the
numerical buffs genuinely *are* tiny — a Sawmill is +5%, and eight of them give
+40%, not +400%. But **adjacency's real job is definition, not amplification**,
and that half is emphatically not subtle: a Smelter with no Mould beside it
produces **nothing at all**, and swapping the Mould changes what it makes with
no menu involved. The binary half carries the weight; the numeric half is
polish. If placement ever stops feeling meaningful, the design's own answer is
*more recipe-defining context Tokens, not bigger buff numbers* — and the Phase 9
kits give that lever real content to work with.

---

## 5. Polish delivered

* **Token detail is now available wherever a Token sits** (D-145) — Vault, Tray,
  Cartographer pool and board alike. This was listed as done in Phase 4 and
  never was; the inspection panel handled items only, and the Vault's inspect
  click did nothing. A Smelter's sheet now reads:

  > SMELTER · UNCOMMON · WOODLAND
  > CHARGES 600 uses · ~4h unattended · CYCLE 22s · NEEDS forge lv 8
  > **Needs beside it: Ingot Mould** → 3× Copper Ore, 1× Charcoal → 1× Copper Ingot
  > **Needs beside it: Blade Mould** → 2× Copper Ingot, 1× Yew Log → 1× Copper Sword
  > FOUND IN Woodland Map

  Three design requirements land in that one sheet: **planning before placement**
  (D-145), **visible pairings** (D-18 — a player cannot discover "a Smelter needs
  a Mould" by trial without spending a tile and a hero), and **where to restock
  it** (D-159), which turns a depleted board into a shopping list.

---

## 6. Known gaps, honestly

Not fixed here, and each one deliberate:

* ⚠️ **Only 4 of 18 enemies are usable.** The 14 in `enemyRegistry.js` drop
  legacy item ids absent from `data/items.json`, so a kill silently yields
  nothing. Combat variety is capped at four until the duplicate registries are
  reconciled. **This is the largest content constraint in the game right now.**
* ⚠️ **`RegenSystem` regenerates Energy, which nothing consumes**, and throws if
  a hero lacks the field. Harmless for real heroes; it is the deferred Energy
  removal sweep (`G-8`) showing through.
* **`isHeroIdle` reports a hero in combat as idle** — enemy Tokens carry
  `enemyId` rather than `config`. Only tests read it today.
* **Audio for placement, displacement, burst and depletion** was listed in
  Phase 10 §E and is not done. It is additive and needs no systems work.
* **Hero Speed and Efficiency** (`G-1`) remain deferred to the hero rework — a
  level 99 hero works a Grove at exactly the speed a level 1 hero does, and a
  test pins that so nobody "fixes" it by accident.

---

## 7. The honest summary

**The bones are sound and the systems are quiet.** Every risk that could be
measured came in better than feared: clutter is down 50% from its peak *while
gaining systems*, deep chains get a fair share of scarce supply, and pacing
lands within touching distance of its target.

**What cannot be measured is what remains.** Whether a Map burst feels like a
reward, whether a board with no antagonist stays interesting for an evening, and
whether adjacency reads as meaningful — those are three questions no instrument
answers, and all three are load-bearing for the design. They need a real session
at the keyboard, and they are the right next thing to spend attention on.
