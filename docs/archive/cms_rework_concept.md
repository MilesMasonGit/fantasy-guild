# CMS Rework — Design Concept

> **Status:** Draft for owner review, 2026-07-22.
> **Companion doc:** [`cms_rework_roadmap_v1.md`](cms_rework_roadmap_v1.md) — the
> implementation plan. This document is the *why*; that one is the *how*.

---

## 1. What this is

The Fantasy Guild CMS (`cms/`) is a separate design tool where game content is
authored — items, cards, recipes, enemies, areas — and a balancing engine that
checks whether that content makes economic sense. It writes its results into the
game's `data/` folder, which is what the game actually loads when it starts.

It has fallen behind. The game has changed enormously since the CMS was built —
the Area Deck Loop rework, Card Mutators & Tokens, the 15-skill rework, the
7-stat combat engine, the Hero Dock — and the CMS has not kept up. This document
describes what we're going to do about that.

## 2. The problem, in plain terms

### 2.1 The CMS is describing a game that no longer exists

This is not a matter of a few stale fields. The two projects now disagree about
fundamentals:

| | The game | The CMS |
|---|---|---|
| Skills | 15 hero skills | 9 — and only **6 are real** |
| Card types | 16 types, 11 presets | 3 |
| Equipment slots | 6 (Hand, Hand, Hat, Chest, Trinket, Trinket) | 8 different ones |
| Mutators & tokens | A shipped feature | Does not exist |

The skill row is the one to dwell on. The CMS offers `industry`, `culinary` and
`nautical` — **none of which are skills in the game.** Anything authored against
them is authored against nothing at all. Meanwhile 13 real skills, including
`aquatic`, can't be selected. One of your own mutator cards, *Chum the Waters*,
uses `aquatic`. The CMS cannot represent it.

### 2.2 Saving your work can destroy content

The "Sync to Game" button doesn't edit the game's files. It **replaces** them —
it builds each file fresh from what the CMS knows, and writes over whatever was
there. Anything the CMS has no concept of is simply not written, and so ceases
to exist.

This has already happened once. Area deck slots vanished, and rather than fixing
the cause, a special patch was added for that one field. Everything else is still
exposed: your three mutator cards, card tags, tokens, card presets. They survive
only because nobody has pressed Sync since they were added.

The store also lives in your browser's local storage. Clear it, or open the CMS
in a different browser, and a single click on Sync flattens `data/`.

### 2.3 Authoring costs too many steps

You told us the pain isn't lag, it's effort — too many steps per thing. And you
think in **production chains**: "I want Apple Pie to exist," then working
backwards through dough and apples until everything bottoms out at something you
can gather.

The CMS's own design document has called this "Backward Chaining" from day one.
The tool doesn't actually support it. Typing an unknown ingredient creates a
bare stub and abandons it; you then hunt it down later and start again. The
workflow you want is the one it was designed for and never got.

## 3. What we're building

### 3.1 One principle above the rest

> **Engine logic lives in the game. The CMS provides the content.**

This is your line, and it decides most of the hard questions. The game owns what
things *are* — what a skill is, what card types exist, how the maths works. The
CMS owns what things *say and are worth* — names, values, how much HP a berry
restores, how long a card takes.

Two consequences follow.

**The CMS reads the game's vocabulary.** Rather than keeping its own list of
skills that rotted into fiction, the CMS asks the game: *what skills exist?*
Same for card types, presets, tags and equipment slots. The wrong-skills problem
stops being something we fix and becomes something that can't happen.

This is not a circular dependency, though it can look like one at a glance. Two
different kinds of thing move in two different directions: **definitions** flow
game → CMS, **content** flows CMS → game. The CMS never writes a definition; the
game never writes content. Each side stays the sole author of its own kind of
thing.

The real cost is coupling: renaming something in the game's registries can break
the CMS until it's updated. That's a genuine tradeoff, accepted deliberately —
a loud break beats a silent lie.

### 3.2 Sync becomes a merge, never a replacement

Your words: *"If I change the value of an item or an output of a card, I want it
to use the new value, but still keep that card in the data."*

That's the fix, stated exactly. Sync will open the existing file, change the
fields you changed, and leave everything else untouched. Fields the CMS doesn't
model pass straight through.

The deck-slots patch stops being a special case and becomes the universal rule,
and sync becomes safe by construction — not safe because we remembered to guard
each field, but safe because overwriting isn't a thing it does any more.

Deletion then has to become deliberate: when you delete something in the CMS it
is recorded as a real deletion and carried out on the next sync. Content is
removed because you removed it, never because the CMS forgot it existed.

### 3.3 Content flows both ways; authority does not

The CMS will read `data/` as well as write it. On conflict the CMS wins — it's
your workspace and it holds design-time information the game has no use for
(true production cost, root-item anchors, EV targets). But **silence is not
disagreement.** Where the CMS has no opinion, the game's data stands.

### 3.4 The card's content decides what it is

First, what a card "type" *is*, in your words: the types are mostly a
**theoretical separation** — a way to help a player understand that this card
serves a different purpose than that one. They're not deep mechanical branches
so much as labels of intent. That's exactly why deriving the type from content
fits: the type is a *description* of what the card does, so the card's content
is the honest place to read it from.

So rather than picking a type from a dropdown and then filling in fields to
match, you fill in the card and its type follows. Put an enemy on it and it's a
combat card. Give it a station and inputs and it's a recipe.

Mutators work differently, and it's worth being precise because I had it
backwards in an earlier draft. **You don't attach a token to a card to make it a
mutator.** A mutator is a card whose *effect is to apply a token to other cards*.
You create the mutator card, drop it into an Area Deck's sequence, and during
play it stamps its token onto the cards that follow it. So the thing that marks a
card as a mutator is that it *carries a token to hand out* — not that a token has
been stuck onto it.

Deriving type from content collapses many screens into one and removes a decision
you shouldn't have to make twice. It works because of a second decision you made:
**cards are single-purpose.** Variety comes from mixing cards in a deck — and
from mutators reshaping the cards around them — not from any one card doing
several jobs at once. With that in place the rules are unambiguous and no manual
override is needed.

One live exception: `task_berry_bush_patch` is a berry-gathering card that also
springs a Thorn Elemental. It keeps working as it is; we simply won't author
more like it.

### 3.5 Chain-first authoring

Creating an unknown ingredient will no longer leave a dangling stub. It'll ask
the obvious next question — *where does this come from?* — and let you answer it
without leaving the screen, again and again, until you reach something gatherable.
One unbroken session, following the shape of the thought.

### 3.6 A narrower, honest balance engine

The balance engine stays — the CMS exists for it — but its scope contracts to
what it can actually get right:

- **In:** value propagation through production chains, XP curves against the 15
  real skills, gold-and-XP-per-hour velocity targets.
- **Out:** combat balancing. Modelling the 7-stat engine is its own project.

The existing combat code is left alone and clearly marked as modelling an old
system, so its numbers are never mistaken for current ones. Better an obvious
gap than a confident wrong answer.

### 3.6a Building on moving ground

Two of the things the CMS leans on are themselves still in development, and the
plan treats them as such:

- The **7-stat combat engine** is a starting framework, not a settled system —
  all of it is subject to change. This is a second reason combat balancing is its
  own later project (§3.6): there's no point hard-modelling maths that's still
  moving.
- The **15-skill list** is likewise in flux and may change. This is why the CMS
  *reads* the skill list from the game rather than keeping its own (§3.1) — when
  the list changes, the CMS follows automatically instead of drifting into
  fiction the way it already did once.

The general stance: where the game is still deciding something, the CMS should
*reflect* it rather than *encode a copy of* it.

### 3.7 Deck slots as an authored template

The deck slot editor shows what an **unaltered** deck looks like: the blank
slots and your locked hazard cards. That's the authored artifact. What the
player later drops into those slots is theirs, not yours, and doesn't belong in
this view.

## 4. Explicitly out of scope

- **The sprite and recolor suite.** It works well. It is essentially independent
  of the CMS proper. It will not be touched, and saved palette data is preserved.
- **Combat balance simulation.** Its own project, later.
- **The AI content generator.** Parked — left as-is, revisited once the core is
  sound.
- **Save migration.** As with the other reworks, old saves are already broken by
  design. No migration logic.

## 5. What success looks like

1. Every skill, card type and equipment slot in the CMS is one the game actually
   has — and stays that way without anyone maintaining a list.
2. Pressing Sync after editing one number changes one number. The diff is small
   enough to read.
3. You can build a production chain from finished product down to raw resource
   without leaving the screen or losing your place.
4. Mutators, tokens, deck slots and card tags survive a sync — because sync
   merges rather than replaces.
5. The balance engine's numbers are trustworthy within its stated scope, and
   silent outside it.

## 6. Resolved questions (owner, 2026-07-22)

The five open questions were answered by the owner:

1. **The fictional skills.** Remap `industry`, `culinary` and `nautical` to
   whichever of the 15 real skills makes sense — the implementing session has
   latitude to choose. Note the 15-skill list may itself change later in
   development, so this is a best-fit remap, not a permanent binding.
2. **The live workspace.** Resolved by launching the CMS so the owner can
   perform a hard save (a fresh named backup into `cms/backups/`) before Phase 0.
3. **Explore cards.** **Retired — no longer a feature.** The three explore cards
   in `data/` are removed as game-side cleanup, in the same spirit as the ambush
   trigger. The CMS never authors them.
4. **Effects vs status effects.** The 56 `effects.json` entries were *early
   concepts* for what became the status-effect system. Many need reworking, but
   that's later. **For now they exist in name only** — the CMS preserves them as
   named placeholders and does not attempt to model their mechanics.
5. **Quests.** Quests will be a mix of game-generated, tutorial-scripted, and
   mid-game skill gates — but **manual quest authoring is still required.** So
   quests are an authored type in the CMS, not preserve-only.
