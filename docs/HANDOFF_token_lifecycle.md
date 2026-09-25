# Token Lifecycle — handoff to the next agent

**Written 2026-09-25.** This is a **design-only** brainstorming project. No code is
to be written. The aim of the next session is an **open-minded brainstorm about
how best to rework the Token lifecycle**: how Tokens are *spawned*, how they
*exist on the mat*, and what happens when they are *exhausted*.

Read this once, then read `CLAUDE.md` for how the owner works. This file explains
the design space, the goals, the challenges and the current system.

---

## 1. What is meant to be challenged

**Please read this section twice.**

The following are **existing systems and early ideas, not fixed foundations**. The
owner wants them examined and is happy for them to be changed or thrown out:

* **The Map purchase-and-burst system** (Maps bought with gold, opened for a few
  random Tokens from a pool).
* **The Exploration and Construction "initial skills" idea** (the notion that
  Maps and Blueprints are *worked* by a hero to produce Tokens).
* **The Vault, the Tray, and the whole Maps → Tray → mat → Vault pipeline.**
* **The "source Token spawns nodes" idea** (a Mineshaft or Forest that spawns ore
  veins or trees) that surfaced in the first session. It is one candidate, not a
  decision. (See §6.)

Nothing in this document should be treated as a settled design for *how Tokens
arrive*. That question is wide open.

## 2. The owner and how to work with them

The owner **does not code**. See `CLAUDE.md`; in short:

* **Plain language.** Explain, don't assume knowledge.
* **Interview by multiple choice.** The owner asked for the `AskUserQuestion`
  multiple-choice tool to be used for questions, with **labelled options, the
  trade-offs spelled out, and your recommendation first**. Never an open-ended
  question. Multi-select is welcome for "which of these appeal to you?".
* **Ask, don't assume.** Do not silently pick design answers.
* **Do not commit to things the owner has not chosen.** In the last session the
  owner said "not sure yet, don't want to commit to anything" more than once.
  Record such answers as *leaning* or *open*, never *locked*.
* **Don't frame questions around scaffolding that is being removed** (lesson from
  the free-playmat work, where a question assumed the old grid).
* **No code this session.** Documentation is fine.
* Push back when a choice has a consequence the owner may not have seen, but do
  not re-litigate a choice they have made.

## 3. Goals (what the owner wants)

Stated by the owner in the first session:

1. **Tokens spend their entire life on the mat**: transforming, renewing and
   expiring. **The Token Vault system goes away** (a stated secondary goal).
2. **Lifecycles differ by skill.** Renewing and transforming loops are the
   primary lifecycles, with plain consuming ("mined out and gone") as the third.
   Example given: a tree used for Logging might become a stump and regrow; an ore
   vein might be mined out and vanish, forcing the player to find new nodes.
3. **"Sporadic to near-indefinite."** A player should be able to set up a board that
   does one task for a while and then stops. Later improvements let the same
   setup run near-indefinitely.
4. **The player can go out and get the specific Token they need.** The owner's
   example: the player wants to cook, needs a Kitchen station, works a blueprint to
   produce the Kitchen, keeps the blueprint, and can get another Kitchen whenever
   needed if the first is discarded.
5. **The first steps must not feel like paperwork.** "Working a map to spawn a
   forest to spawn a tree to log some wood feels like a lot of steps when a player
   just wants a bit of wood."
6. **The mat should feel like a living place** (a stated aim from the free-playmat
   concept).

### Decisions the owner did make (and that are safe to build on)

* **Energy is no longer a mechanic** (owner, 2026-09-24). ⚠️ Project notes had
  recorded the energy vital as *not retired, moved to the effects rework*; the
  owner's newer statement supersedes it, but **verify against the code** before
  relying on it.
* **Tools may act indefinitely.** The owner is *considering* this; it is not
  decided. It means tool wear should not be assumed to be the "leak".
* **The costs of a loop are a Token's own charges plus input items.** New
  resources may be introduced later as **gates** that make the player use a variety
  of skills to progress.
* **When the mat is full, an arrival pushes neighbours where that is legal and is
  otherwise refused. Nothing is ever destroyed.**
* **Anything that leaves the loop vanishes cleanly**, with no leftover husk to clear.
* **A "live cap"** is needed on anything that spawns other Tokens, so an unattended
  spawner cannot flood the mat. (The owner: "I think it definitely needs a cap.")
* **Different skills should have different lifecycle shapes** ("I want different
  skills to focus on different kinds of lifecycles").

## 4. The current system (what exists today)

### 4.1 Free playmat status

The game moved from a 6×6 grid to a **free playmat** (see
`docs/concept_free_playmat.md` and `docs/free_playmat_roadmap_v1.md`, which is
authoritative). Slices 1.0–1.7 are merged: no grid, Tokens land where dropped and
can crowd, heroes are commanded by **flags** (a radius plus a skill, with
allow/disallow and priority rules). **Not done:** slice 1.8 (arrivals on the mat),
1.9 (Tray retired), 1.10 (wording), 1.11 (tune and tag). ⚠️ **Do not start 1.8 or
1.9 as written** until the owner decides how far a lifecycle rework replaces them.

Relevant locked free-playmat decisions: tokens are round with crowding overlap
(FP-6); only bursts and spawns push (FP-17); a full mat refuses rather than destroys
(FP-46); Managers restock in the exact spot (FP-19); the 50-Map cap; the Vault was
to be decided at stage 3 (FP-37); "Nearby" ranges (Close / Near / Far).

### 4.2 The Map purchase-and-burst pipeline (to be challenged)

* **Maps** live in `data/maps.json` (8 today: Test Map, Guild Hall Map, Oak Forest,
  Bronze Hills, Cozy Hamlet, Sandbar Shores, Golden Farmland, Volcanic Island) and
  are handled by `src/systems/board/Cartographer.js`.
* A Map is **bought with gold** (a flat price that never rises: Oak Forest 3000,
  Bronze Hills 2000, Volcanic Island 10000). Optional material costs come from the
  Bank.
* Opening (bursting) a Map gives **a few Tokens chosen at random from its
  weighted pool.** Example: Oak Forest's pool is an Oak Forest Token, Oak Tree, Fir
  Tree, a Rusty Woodaxe and a Thorn Elemental (an enemy), so the player cannot
  aim for the Token they actually want.
* Bought Maps sit in the Tray; there is a **50-Map cap**.
* Tokens from bursts currently arrive as floating sprites that are collected into
  the **Vault** (long-term Token storage), then placed via the **Tray** onto the
  board. Under the free-playmat plan the Tray is being retired and bursts land on
  the mat.

### 4.3 The problems the owner sees with it

* **Getting many of one Token means opening many Maps and getting a lot of junk.**
  ("I want lots of Oak Trees, but I keep getting Redberry Bushes.") This floods
  the mat and is not fun.
* **It depends on the Vault**, which is needed to hold the excess Tokens.
* **The player cannot go and get a specific Token.**

### 4.4 Tokens, charges and work

* All Tokens are in `data/tokens.json` (78 today). Each carries **`uses`**
  (its charges) and a **`config`** with a `skill`, `skillRequired`, `cycleTimeMs`,
  `xp`, `inputs` and `outputs`. Resource Tokens are worked by a hero; `acceptedTokens`
  names tools that must sit nearby (e.g. a Pickaxe with minimum tier).
* **Charges today are effectively unlimited for some Tokens and tiny for others:**
  Copper Ore Vein 1000 uses, Quartz and Clay Deposits 500, Copper Rubble 10. At
  16–25 second cycles, a 1000-use vein lasts hours.
* **Output goes straight to the item Bank** as items; nothing spawns onto the mat
  from a normal work cycle.
* Other relevant machinery: **Spawns and Transforms actions** exist in
  `src/systems/board/EffectActions.js` (used by rules); **Managers**
  (`Managers.js`) restock spent Tokens in place; `Charges.js` handles
  charges; `Restrictions.js` handles "Cannot" rules (spawns, transforms and Manager
  restocks do **not** check them today).
* **Enemies are Tokens** with `enemy: { level, style }`; they do not move. Combat
  flags fight non-disallowed enemies in their radius automatically.
* **Skills** (`src/config/registries/skillRegistry.js`): six Foundation skills
  (Mining, Logging, Fishing, Smithing, Crafting, Cooking), three Combat skills
  (Melee, Ranged, Magic), a Specialist layer and a Signature layer.
  ⚠️ **Farming is not in the registry.** It appears in a draft concept doc only
  (`docs/concept_skill_and_class_rework_v2.md`, another session's untracked work).
  The owner wants Farming in scope for the lifecycle discussion.
* **Terrain** is switched off (dormant code) after the free-playmat move.
* **Promotion** is a Token rule, and **Heroes** live on the mat holding flags.

## 5. Design space and open questions

These are prompts, not conclusions. Everything is open for the brainstorm.

* **Spawning.** How does a Token come into existence on the mat? What is the
  player's *verb* for getting a specific Token? Should the mat produce its own
  Tokens over time? What is the role of gold, inputs, heroes, skills, time, or
  choice in this?
* **Existing.** How much should position, clusters and space matter? What limits
  crowding? How does the player see the state of a setup at a glance (the owner:
  "our art will mostly handle this, with expired or missing Tokens")?
* **Exhausting.** Vanish, transform, refill, go dormant, or something new? Should
  this be per skill?
* **Without a Vault.** Where does anything the player is not using live? The
  owner's concern is that the *Vault* goes away; whether other kinds of storage
  are acceptable is itself a question.
* **Supply and the leak.** The owner's frame: a loop loses value somewhere each time
  round (the "leak"), and progression **reduces the leak rather than adding output**
  until a setup can run near-indefinitely. What should leak, and where?
* **Economy.** Loops that close produce output forever; how do item values stay
  meaningful and how would the economic simulator model it? (The Bank now carries
  more: seeds, fuel, inputs.)
* **Heroes.** What does a flagged hero do when the Token they are working vanishes,
  transforms or refills mid-cycle? (Topic touches Stage 2, autonomous heroes.)
* **Space and rules.** What does a Token vanishing or a stump growing back do to
  neighbouring buffs, Managers and "Cannot" rules?
* **How staffed setups scale.** If something spawns Tokens of several skills, who
  works them?

### Per-skill lifecycle leanings (from the first session)

These are the owner's answers to "how should this skill's loop feel?". They were
given quickly and are **starting points that the owner wants to revisit**:

| Skill | Leaning |
|---|---|
| **Mining** | Nodes last a few minutes early on and vanish cleanly; where new nodes come from is unresolved |
| **Combat** | Enemy Tokens vanish when defeated; an enemy source has a cap and finite budget |
| **Logging** | A tree gives about 3–5 cycles, becomes a stump, which *maybe* regrows on its own. No leak: the "steady, low-attention" skill (wood would need to be priced cheaply) |
| **Fishing** | A permanent spot with a stock that drains when worked and refills slowly |
| **Farming** | Plant → grow → harvest → empty; seeds are the leak; feeds Cooking and Alchemy through items |
| **Smithing, Crafting, Cooking** | Permanent stations; fuel (a consumable input) is the leak, so Logging feeds Smithing and Cooking |

## 6. Ideas raised in the first session (starting material only)

**None of these is decided.** They are here so you do not have to rediscover them,
and so you can challenge them.

* **Source → node.** A persistent Token (a Mineshaft, a Forest) spawns worker-able
  Tokens (veins, trees) up to a live cap, with a finite, upgradeable budget, and
  goes dormant when spent. The owner said this is "the most crucial part of the
  loop" and worried about flooding, how many it can produce, where it comes from,
  and whether it exhausts.
* **Biome/source Tokens bought or given at the start** so basic resources need no
  Exploration step ("drop the Birch Forest on the mat and it spawns Birch trees").
* **Maps as a richer, mixed-pool tier**, and **Blueprints** as permanent recipes worked
  to make building Tokens (Kitchens). Both are reusable producers, and the owner
  confirmed you can make several Kitchens or explore the same Map for lots of Oak.
* **A small fixed bar** of the player's permanent Maps and Blueprints that can be
  dragged onto the mat ("like the old Tray, but just for these"). The owner floated
  this as a small list and did not commit to it.
* **Targeted expeditions:** the player names a specific target and a hero returns
  with that specific thing.
* **Seeds and spreading:** nodes seed new sources, and sources grow in stages.
* ⚠️ **A concern the owner raised about their own idea:** a mixed-pool Map would
  spawn Tokens the Exploration hero cannot work, so other crews would need to be
  staffed to use them.

## 7. Files worth reading

| File | Why |
|---|---|
| `CLAUDE.md` | How the owner works. Not optional. |
| `docs/concept_free_playmat.md` and `docs/free_playmat_roadmap_v1.md` | The playmat this sits on. The roadmap is authoritative. |
| `docs/concept_token_lifecycle.md` | ⚠️ The first session's working notes. It records proposals the owner **did not settle on**; treat every "locked" mark in it as provisional and prefer this handoff. |
| `src/systems/board/Cartographer.js`, `data/maps.json` | The Map burst as it exists. |
| `data/tokens.json`, `data/stations.json`, `data/tokenRecipes.json` | What Tokens, stations and recipes look like. |
| `src/systems/board/EffectActions.js`, `Managers.js`, `Charges.js` | Spawns, Transforms, restocking, charges. |
| `docs/concept_effects_grammar_v2.md`, `docs/effects_grammar_v2_roadmap.md` | The planned verbs-and-roles effects system, which overlaps with spawning and transforming. |

## 8. Traps

* ⚠️ **Never hand-edit `data/*.json`.** The CMS is the exclusive authoring surface,
  and its one-way "Sync to Game" destroys anything authored outside it.
* ⚠️ **Never trust a comment in the code.** Project notes record several cases of
  fabricated rationale; read what the code does.
* ⚠️ **Other sessions share this checkout.** Check the branch before committing.
  Never stage another session's work.
* ⚠️ **Nothing has been pushed to GitHub** by the owner's instruction. Do not push.
* Docs in this repo often go stale; verify against code.

## 9. Suggested shape of the session

1. Read `CLAUDE.md`, this handoff, and skim the current Map/burst code.
2. Start open: ask the owner what they picture the *feel* of getting a new Token to
   be, before proposing mechanisms.
3. Offer **several genuinely different** models, not variations on one, and let the
   owner say which appeal. Use multi-select.
4. Test candidates against concrete cases ("I need a Kitchen", "I want lots of
   Oak", "the mat has been left alone for a night", "a new save's first hour").
5. Write up what emerges as a concept doc, with each decision marked **locked**,
   **leaning** or **open**. No code.
