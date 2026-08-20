# Effect Authoring Redesign — a proposal

*Written 2026-08-20, on branch `effect-redesign`. **No code was changed.** This is
a proposal for you to react to before anything is built.*

Companion reading: [`effect_system_map.md`](effect_system_map.md) is the factual
description of how the machinery works today. This document is the opinionated
half — what I think should replace the Token editor's Effect Blocks section, and
what it will cost.

---

## 0. The short version

You want Magic-the-Gathering rules text: short, literal sentences that say
exactly what a Token does, with no gap between what the card says and what the
game does.

**The proposal is to make the sentence the thing you author.** Instead of filling
in a form and hoping the description generator describes it correctly, you build
a sentence out of a small vocabulary, and the sentence *is* the effect. There is
no separate description to get out of sync, because there is nothing to sync —
the rules text is the effect block, rendered in words.

The sentence has a fixed shape, which is the one you proposed:

> **[When something happens,] KEYWORD — PAYLOAD — to FILTER [, costing UPKEEP]**

Seven keywords cover everything the engine can do today, with room for more.
Your two examples come out as:

> **Provides** 5% faster work time **to** adjacent Coast tokens.
>
> **Cannot** be adjacent to more than 2 Coast tokens.

I tested Keyword → Payload → Filter against every effect the engine supports.
**Five of the seven fit it exactly. Two need one extra clause each** — a *when*
(for things that react to an event) and a *costs* (for things you pay upkeep on).
Section 3.6 is honest about where the shape strains and why I think two optional
clauses is a fair price rather than an escape hatch.

Four things I want to disagree with you about, or correct, are in section 1. The
biggest is **Token type**: you're right that the picker should go, but *deleting*
the field would break three real things. I recommend deriving it and still
writing it into the file — you never see it, everything downstream keeps working.

---

## 1. Corrections and disagreements, up front

You've been overruling people on good evidence all day, so here is mine first
rather than buried.

### 1.1 Tier is real — but it is even more conditional than you were told

Confirmed: `tokenRegistry.getProvidedTagsWithTiers` falls back to `def.tier`
when a Token hands a capability to its neighbours, and
`RecipeResolver.checkAcceptedTokens` refuses a tool below the station's
`minTier`. A Copper Pickaxe at tier 1 genuinely cannot satisfy a requirement for
a tier 2 pickaxe. Your "Min Tier" box is the other end of that same wire.

Agreed: **rename it "Tool Tier", show it only on Tokens that hand out a
capability.** In the new editor it stops being a field on the Token at all and
becomes part of the *Acts as* statement's payload — "Acts as a **Tier 2**
Pickaxe" — which is where it actually belongs, because it only ever describes
that one sentence. See §3.2.

⚠️ One caveat: the JSON key stays `tier`. Renaming the key in `data/tokens.json`
means touching `tokenRegistry`, `descriptionDictionary` and two test files for a
purely cosmetic gain. The **label** changes; the storage doesn't.

### 1.2 Token type: derive it, but keep writing it down

You said "no type picker". I agree the picker should go. But the brief's premise
— that the engine branches on only three types — needs two corrections, and one
of them changes the design.

**What I verified:**

| Claim | Reality |
|---|---|
| Engine branches on `enemy` | ✅ True. `BoardCombat.js:71` (`tokenType === 'enemy' && enemyId`), `RecipeResolver.js:230` |
| Engine branches on `context` | ✅ True, but only in `QuestManager.js:168/179`, and always OR'd with "or it provides something" — so it is nearly redundant already |
| Engine branches on `map` | ❌ **False.** Map Tokens are detected by having a `mapId`, everywhere — `BoardState.js:297/304/330`, `Cartographer.js:61`. `tokenType: 'map'` is read by nobody in the game |
| `manager` is a type the engine understands | ❌ **False, and this is the good one.** `Managers.js:76` decides a Manager by `def.manages` — a list of Token ids it restocks. **Nothing in the CMS writes `manages`, and no Token in `data/tokens.json` has it.** |

That last row deserves its own paragraph, because it is the single best argument
for your whole complaint. Your **Copper Ore Minecart** is typed `manager`, its
description reads *"Automatically restocks adjacent stations from the Guild
Bank"*, and **it does nothing at all**. Its one effect block is empty, and the
field that would make it restock anything cannot be authored. The type picker
made a promise; the data doesn't keep it; the description repeats the promise
back to you as if it were true. That is exactly the untrustworthiness you're
describing, and no amount of tidying the form fixes it — the fix is that
behaviour comes from statements you wrote, and type is read *off* them.

**But `tokenType` is load-bearing in three places that are not the engine:**

1. **Targeting.** `targetToken: {mode: 'tokenType'}` is a live engine feature —
   "boost all adjacent resources". `TileModifiers.matchesTokenTarget` reads it.
2. **Your CMS sidebar.** `Sidebar.jsx:59` groups the Token list by `tokenType`.
   That's your navigation. Delete the field and every Token piles into
   "unclassified".
3. **`ContentRules.test.js`** validates every Token's type against the closed list.

**Recommendation: derive it, write it into the file, never show it as a picker.**
At sync time the CMS computes the type from what the Token actually has and
stores the result. You never type it; everything downstream keeps working; the
sidebar keeps grouping; the "manager" lie becomes impossible because a Token is
only a manager if it has a *Restocks* statement.

The ladder, first match wins:

| If the Token has… | Derived type |
|---|---|
| an `enemyId` | `enemy` |
| a `mapId` | `map` |
| a *Restocks* statement | `manager` |
| an *Acts as* statement (hands out a capability) | `context` |
| a work cycle with inputs | `station` |
| a work cycle, no inputs, and no hero required | `passive` |
| a work cycle with outputs | `resource` |
| no work cycle, but *Provides* / *Grants* statements | `buff` |
| none of the above | `buff` (and a warning: this Token does nothing) |

⚠️ **`market` is not derivable** and nothing in the game reads it — there is no
authored Market Token at all (owner decision 21 in the review). I'd let the value
lapse rather than invent a signal for it. If a Market ever needs to be
distinguishable, the honest signal is "its output is currency", and that's a
field to add then, not a guess now.

⚠️ The derived type shows in the Identity section as a **read-only badge with a
"why"** — *"Context — because it Acts as a Pickaxe."* If it says something you
didn't expect, that's the same validation loop as the rules text: your statements
say something you didn't mean.

### 1.3 "Cannot" as a general keyword: yes, but build exactly one restriction

You asked for a general **Cannot**, adjacency limits first. There is a real risk
of over-engineering here — building a restriction *framework* to hold one rule is
the classic way to spend a week and ship nothing.

My recommendation is a middle path, and I think it's genuinely the cheap one:

- **The keyword is general.** "Cannot" is one word in the UI and reads naturally
  for any restriction you invent later.
- **The registry has exactly one entry**: *adjacency limit*. It's a list in a file
  shaped exactly like `modifierPalette.js`, with one row in it. Adding restriction
  #2 later is a row plus its enforcement point — the same three-file cost a new
  number effect has today.
- **No generic condition language.** No "cannot be placed unless", no boolean
  expressions, no "while". Those are how a small feature becomes a rules engine.

That's about half a day of structure on top of the enforcement work, and it buys
you the thing you actually asked for: the word "Cannot" starting a sentence.

**The thing you haven't decided yet, and must:** what does "cannot" *do* when it's
violated? Two genuinely different games. See open question **Q1** (§7).

### 1.4 Your description complaint is worse than you think

For the record, so the fix is scoped correctly: the description generator doesn't
just describe things unhelpfully, it reads **fields that do not exist**. It looks
for `mod.axis`, `mod.isPercent`, `block.convert`, `block.bonusDrop` — none of
which are ever written. That's why everything is "Speed" (a literal fallback
string) and why your Forge Altar's saved description is:

> *"Matching tokens gain +20% Speed. Matching tokens gain NaN% Speed."*

Two modifiers, both called Speed, one of them `NaN`, and **the +20% is
backwards** — that Token makes its Forge 20% *slower*, because Work Time is
milliseconds-per-cycle and negative is faster.

So "make the description a generated rules text" isn't a polish job. It's
replacing a generator that has never worked with one that is the authoring
surface itself. That's most of why I think this redesign is worth doing now.

---

## 2. What is wrong today, in one table

Just so the proposal is measured against something specific.

| What you hit | Why |
|---|---|
| The Description field is useless | It's generated from fields that don't exist (§1.4) |
| Classification feels invented | Type is a picker the engine barely reads; tier looks decorative but isn't; rarity and size belong with identity |
| Context/Tool Provision is in every block | It was made a *section* of the one flexible container rather than a thing in its own right |
| No way to express a restriction | There is no restriction machinery at all. `acceptedTokens` (a *requirement*) is the nearest thing |
| A Token that provides a tool draws no line on the board | The board UI reads `def.provides`; **the CMS can only write `block.provides`** (bug B2) |
| The blocks form is crowded | Five unrelated mechanics — target, provides, trigger, upkeep, modifiers — share one container, all five always visible. ~490 of 1080 lines |
| Things you author sometimes do nothing | A number effect inside a Reaction block is silently dropped by both systems (bug B3). A Token typed `manager` restocks nothing (§1.2) |
| Reordering blocks | Save state (`blockUpkeep`, `blockCooldowns`) is keyed by **position in the array**, so reordering silently remaps it to the wrong block |

---

## 3. The grammar

### 3.1 A statement

Everything a Token does to the board around it is one or more **statements**. A
statement is one sentence with a fixed shape:

```
[ WHEN <event> , ]   KEYWORD   <PAYLOAD>   [ to <FILTER> ]   [ , COSTS <upkeep> ]
   optional            always    always       most keywords      optional
```

A Token's rules text is simply its statements, one per line, in order. That's the
whole model. No description field, no summary line that's computed separately —
one renderer, used by the CMS *and* the in-game tooltip.

### 3.2 The keywords

Seven. Each one names a thing the engine already knows how to do, except
**Cannot**, which is the new work.

| Keyword | Says | Payload | Takes a filter? | Takes a *when*? | Engine today |
|---|---|---|---|---|---|
| **Provides** | change a number on nearby Tokens | one effect from the palette + an amount + how it combines | ✅ | ❌ never | modifiers on an untriggered block |
| **Grants** | hand a nearby Token an extra item when it finishes work | item, quantity, chance | ✅ | ⭕ optional | `BONUS_DROP` |
| **Acts as** | hand a capability to neighbours | capability tag + tool tier | ❌ (always adjacent) | ❌ never | `provides` |
| **Requires** | this Token doesn't work without something beside it | capability tag + min tier, *or* named Tokens | ❌ | ❌ never | `acceptedTokens` |
| **Restocks** | keep named neighbours supplied from the Bank | list of Token types | ❌ (the list *is* the filter) | ❌ never | `manages` — **exists, unauthorable** |
| **Converts** | spend items from the Bank, produce others on the board | consumes list, produces list, chance | ❌ | ✅ **required** | `CONVERT` |
| **Cannot** | a restriction on where this Token may sit | restriction kind + limit | ✅ | ❌ never | 🆕 **new** |

Notes on the two you might not expect:

- **Requires** is your existing "Accepted Tokens / Tools" section, moved into the
  same list so the whole Token reads as one set of sentences. It keeps writing
  the existing `acceptedTokens` field — see §5.
- **Restocks** costs zero engine work. The field is read by `Managers.js` today;
  there has simply never been a box to type it in. Including it turns the
  Minecart from a lie into a working Token, so I'd take it.

### 3.3 The payloads

**For *Provides*** the payload is: which effect, how much, and how it combines.
The palette is unchanged (Yield, Work Time, Input Cost, XP Bonus, Double Loot
Chance, Failure Chance) — this design adds no new number effects.

⚠️ **The direction trap gets fixed here.** Today you type `-0.05` into a box
labelled "Value (−0.05 = 5% less)" on an axis where lower is better. In the new
editor you pick a **direction word**, and the sign is derived:

> Provides work time  **[ 5 ]% [ faster ▾ ]**

The palette already knows which axis runs backwards (`inverted: true` on Work
Time and Input Cost), so "faster" writes `-0.05` and "slower" writes `+0.05`.
You never think about the sign again, and the sentence reads back to you in the
same words you chose.

The three ways a number combines (`flat`, `multiplier`, `percentage`) stay —
they're locked by the three-bucket formula shared with heroes, gear and statuses,
and I'm not touching them — but they're presented as **`+5`**, **`×1.5`**,
**`5%`** rather than as jargon.

**For *Grants* / *Converts*** the payload is items and quantities, exactly as
today, from one shared item-picker control (there are currently four separate
implementations of that picker in the file).

**For *Acts as*** the payload is a capability tag and its tier: *"Acts as a Tier 1
Pickaxe."* The tag list is **derived from what your content actually uses** —
every tag any Token provides plus every tag any Token requires — rather than the
hardcoded `['pickaxe','axe','hammer','anvil','saw','furnace','pie_tin','cookbook']`
that's typed into the component today (bug B5). `RecipeEditor.jsx` already does
it the right way; this copies that.

**For *Cannot*** the payload is a restriction kind and its limit. Exactly one kind
exists at launch: *adjacency limit* — "no more than N adjacent Tokens matching
the filter".

### 3.4 The filters

The filter answers *"which Tokens?"*, and it's the engine's existing targeting,
unchanged:

| Filter | Reads as | Engine |
|---|---|---|
| (none) | "to adjacent Tokens" | untargeted block |
| by **tag** | "to adjacent **Coast** tokens" | `targetToken: {mode:'tag'}` |
| by **exact Token** | "to adjacent **Forges**" | `{mode:'id'}` |
| by **category** | "to adjacent **resources**" | `{mode:'tokenType'}` |

You said tags are how effects know what they're applying to, and I agree — that's
the filter that should be front and centre. The category filter is the awkward
one now that type is derived (§1.2): you'd be aiming at a value the CMS computed.
See **Q2**.

⚠️ Adjacency is **the 8 surrounding tiles, always**, with no direction and no
range. Every filter is implicitly "adjacent". There is no way to say "the Token
below it" and adding one is not a small change (§6.3).

### 3.5 The two extra clauses

**`When …`** — the trigger. Four events exist (`a neighbour completes a cycle`, `a
neighbour runs out of charges`, `a neighbouring fight is won`, `the Bank holds
enough of an item`). It reads first, like MTG's trigger clause:

> **When** a neighbour completes a cycle, **Grants** 1 Copper Ore, 25% of the time.

**`, costing …`** — the upkeep. Items on their own clock; if the Bank can't pay,
the statement switches off until stock returns.

> **Provides** 10% more yield **to** adjacent Forges, **costing** 1 Coal every 30s.

### 3.6 ⭐ Does Keyword → Payload → Filter survive contact with everything?

You asked me to test the shape rather than assume it. Here is every effect the
system supports today, and whether it fits.

| Effect the engine supports | Fits K→P→F? |
|---|---|
| Yield / Work Time / Input Cost / XP Bonus | ✅ Exactly. *Provides 10% more yield to adjacent Coast tokens.* |
| Double Loot Chance / Failure Chance | ✅ Exactly, once the sentence is rendered per-effect rather than mechanically. *Provides adjacent Forges a 5% chance of double loot.* Failure Chance renders as a penalty — *"Adjacent Forges have a 5% chance to produce nothing"* — which is a wording rule, not a grammar problem. |
| Bonus Drop (ambient) | ✅ *Grants 2 Copper Ore to adjacent Forges when they finish work, 100% of the time.* The "when they finish work" is fixed and implicit — this effect has no other moment it could apply. |
| Context / tool provision | ✅ As its own keyword. The filter slot is empty because it is always "adjacent stations" — there is no way to provide a capability selectively. |
| Accepted Tokens (requirement) | ✅ Same — a keyword with a payload and no filter. |
| Manager restocking | ✅ Payload is a list of Token types; that list is doing the filter's job. |
| Upkeep | ❌ **Does not fit.** It isn't a keyword, a payload or a filter — it's a *cost attached to a statement*. Hence the `, costing …` clause. |
| Triggers (4 events, 2 scopes) | ❌ **Does not fit.** A trigger is *when*, not *who*. Forcing it into the filter slot would mean "to adjacent Tokens that just completed a cycle", which is wrong: the trigger decides whether the statement runs *at all*, not who it reaches. Hence the `When …` clause. |
| Convert | ⭕ **Fits only with the When clause.** It has no filter at all — it moves items between the Bank and the board, touching no neighbour. |
| Adjacency restriction (new) | ✅ *Cannot be adjacent to more than 2 Coast tokens.* Payload = "more than 2", filter = "Coast tokens". Your second example is textbook K→P→F. |

**Verdict: the spine holds.** Nine of eleven rows fit Keyword → Payload → Filter
without argument. The two that don't — trigger and upkeep — fail for the *same
reason*, and it's a principled one: they are not part of *what* the statement
does, they are **when it happens** and **what it costs**. Those are the other two
questions a rules sentence answers, and Magic writes them the same way ("Whenever
…, do X" / "Pay 2 life: do X").

So I'd rather state the grammar honestly as four slots than pretend three:

> **[When] KEYWORD PAYLOAD [to FILTER] [, costing COST]**

Both extra clauses are optional, closed (four events; one cost shape), and
**only offered where they're legal** (§3.7). That's a grammar, not an escape
hatch. An escape hatch would be a free-text "condition" box, and there isn't one.

### 3.7 Which combinations are legal

This is your decision 7, generalised. Today the palette has a `triggeredOnly`
flag with no mirror image, which is why a Yield modifier can be dropped onto a
Reaction block where **neither** system reads it (bug B3). Each keyword declares
what it accepts, and the editor simply never offers the rest:

| Keyword | `When` | `, costing` |
|---|---|---|
| Provides | ❌ never — the engine drops number effects inside triggered blocks | ✅ allowed |
| Grants | ⭕ optional — works both ambiently and triggered | ✅ allowed |
| Converts | ✅ required — meaningless without a firing moment | ✅ allowed |
| Acts as | ❌ never | ✅ allowed (a tool that needs fuel) |
| Restocks | ❌ never | ✅ allowed |
| Requires | ❌ never | ❌ never |
| Cannot | ❌ never | ❌ never — a restriction that lapses when you run out of coal is a trap, not a rule |

Two rows in one small table, declared beside the palette, replace the current
situation where the editor offers six effects that will silently do nothing.

### 3.8 Five more worked examples

Your two, plus real effects from the existing palette, so you can see it
generalise beyond the Coast case.

**Your two:**

> 1. **Provides** work time **5% faster to** adjacent **Coast** tokens.
> 2. **Cannot** be adjacent to more than **2 Coast** tokens.

**Three more, from the palette as it exists:**

> 3. *(the Forge Altar, authored correctly this time)*
>    **Provides** work time **20% faster to** adjacent **Forges**.
>    **Grants** 2 **Copper Ore to** adjacent **Forges** when they finish work.
>
> 4. *(the Copper Pickaxe)*
>    **Acts as** a **Tier 1 Pickaxe** for adjacent stations.
>
> 5. *(the Stoneshaper Sigil, the case the trigger system was built for)*
>    **When** the Bank holds at least **20 Stone**, **Converts** 20 Stone into
>    2 Cut Stone, at most once every 5 seconds.

**And two showing the awkward corners honestly:**

> 6. **Provides** adjacent **Forges** a **5% chance to produce nothing**.
>    *(Failure Chance — a penalty rendered as a penalty. Same grammar, different
>    sentence template.)*
>
> 7. **Provides** yield **10% more to** adjacent **resources**, **costing**
>    1 Coal every 30 seconds.
>    *(Category filter + upkeep. Reads fine; see Q2 on whether the category filter
>    should survive at all.)*

### 3.9 The rules text is the validation

Because the sentence is generated from the statement, a wrong effect produces a
wrong sentence, and you catch it by reading. Concretely, these all become visible
instead of silent:

| Mistake | What the sentence says |
|---|---|
| Sign flipped on Work Time | *"…take 20% **longer** to work."* — the current live bug, now unmissable |
| Tag typo | *"…to adjacent **Coste** tokens"*, plus a warning that no Token carries that tag |
| Empty statement | *"Provides — to adjacent Tokens."* with the blank highlighted |
| A Convert with no trigger | can't be authored at all; the keyword requires a When |
| A number effect on a reaction | can't be authored at all |
| A Token with no statements and no production | derived type warns: *"this Token does nothing"* |

---

## 4. What the editor looks like

### 4.1 The screen

**Identity** — Name, ID, Sprite, Rarity, Grid Size. *(Rarity and Grid Size have
already been moved here — that part of your feedback landed in the code before
this document.)* Plus the derived type badge (read-only, with its "why"), and the
**Rules Text** panel: generated, read-only, styled like a card's text box.

**Tags** — its own small section, promoted out of Classification. Your point that
tags are how effects find their targets makes them identity-level, not
classification trivia. The picker shows which other Tokens carry each tag.

**Rules** — the statement list. This is where Effect Blocks, Accepted Tokens and
Context Provision all merge. One "**+ Add rule**" button opens a keyword menu of
seven words, each with one line of explanation. Picking one adds a row; the row
shows only the fields that keyword needs.

**Work Cycle**, **Recipes**, **Lifecycle** — unchanged.

The Classification section disappears. Token Type is derived, Tier moves into the
*Acts as* payload, `mapId` moves to Identity (it's what a Map Token *is*), Tags
get promoted.

### 4.2 One statement row, drawn

```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ Provides ▾   work time  [ 5 ]% [ faster ▾ ]                │
│    to  [ adjacent Tokens tagged ▾ ] [ Coast ▾ ]         🗑    │
│    ▸ Add a trigger    ▸ Add an upkeep cost                    │
│ ──────────────────────────────────────────────────────────── │
│ “Adjacent Coast tokens work 5% faster.”                       │
└──────────────────────────────────────────────────────────────┘
```

The line at the bottom is that statement's sentence, live. The Rules Text panel
at the top of the screen is every statement's sentence stacked.

"Add a trigger" and "Add an upkeep cost" are collapsed links, not always-open
sections, and they're absent entirely on keywords that can't take them (§3.7).
That is the fix for "five sections show on every block whether they apply or
not".

### 4.3 Authoring the Shrimp Coast — today vs proposed

**The Token:** provides an adjacency buff to other Coasts, can be worked to
harvest Raw Shrimp, and no more than two Coasts may sit beside it.

**Today** (as far as it can be done at all):

1. Identity: name, sprite. Add tag `Coast`.
2. Classification: pick a Token Type from nine values — *is a workable coast a
   `resource`? a `context`? a `buff`?* — none is right, and whichever you pick,
   nothing reads it.
3. Set Tier, which looks decorative and isn't.
4. Sidebar: add output Raw Shrimp.
5. Work Cycle: skill, cycle time, XP.
6. Effect Blocks → **Add block → Aura**. The block opens with five sections:
   Target, Context/Tool Provision, Reacts to, Upkeep, Modifiers. Three of the
   five are irrelevant and stay on screen.
7. Target → "By tag" → type `Coast` (case-sensitive; a near miss silently
   reaches nothing).
8. Modifiers → **+ Work Time** → Bucket `percentage` → Value… **and here is
   where it goes wrong.** The buff you want is *less* work time, so the correct
   value is `-0.05`. The label tells you so; nothing stops you typing `0.05` and
   shipping a curse.
9. The adjacency limit: **there is no way to express it.** Not hard — impossible.
10. The description now reads *"Matching tokens gain +5% Speed."* — wrong axis
    name, and wrong direction if you typed the positive.

**Proposed:**

1. Identity: name, sprite, rarity, size. Type badge shows *Resource — because it
   produces Raw Shrimp*.
2. Tags: `Coast`.
3. Sidebar: output Raw Shrimp. Work Cycle: skill, time, XP. *(unchanged)*
4. Rules → **+ Add rule → Provides**.
   - effect: **Work Time**
   - amount: **5%**, direction: **faster**
   - to: **Tokens tagged** → **Coast** (picked from tags in use)
   - Sentence appears: *"Adjacent Coast tokens work 5% faster."*
5. Rules → **+ Add rule → Cannot**.
   - restriction: **be adjacent to more than** — **2**
   - which: **Tokens tagged** → **Coast**
   - Sentence appears: *"Cannot be adjacent to more than 2 Coast tokens."*
6. Done. The Rules Text panel reads:

   > Adjacent Coast tokens work 5% faster.
   > Cannot be adjacent to more than 2 Coast tokens.

Two rules, six decisions, no sign to get wrong, no type to guess at, no sections
you have to ignore, and the description is the rules.

---

## 5. The data shape, and the migration

### 5.1 Do I agree this is the cheapest moment to change the shape?

**Yes** — with one qualification. `data/tokens.json` holds 10 Tokens, 3 with
effect blocks, one of those empty. Migrating content is genuinely a ten-minute
job and will never be cheaper.

But the *content* isn't the expensive part of a shape change — the **readers**
are. Four engine modules read `effectBlocks` directly with no adapter layer
(`TileModifiers`, `TriggerSystem`, `BlockUpkeep`, `tokenRegistry`), and the
three-bucket `{type, bucket, value}` payload is pinned by ~50 test assertions and
shared with heroes, gear and statuses. So my recommendation is: **change the shape
where it buys something, and leave it alone where the gain is cosmetic.**

Concretely, I recommend **not** renaming `effectBlocks`. It would touch six files
to make a name read slightly better. Spend that budget on the four changes below,
which each fix something real.

### 5.2 What changes

**① Every block gets a stable `id`.** *(the important one)*

```jsonc
{ "id": "blk_3f9c", "kind": "provides", ... }
```

Today `BlockUpkeep` stores `instance.blockUpkeep = {0: {...}}` and
`TriggerSystem` stores `instance.blockCooldowns = {0: …}` — keyed by **position
in the array**. Reordering a Token's rules in the CMS silently remaps a live
save's upkeep and cooldown state onto the wrong rule. Since the new editor
positively encourages reordering (they're sentences; you'll want them in reading
order), this must be fixed *in* this work, not after.

The fix: key that state by block id, and backfill on read — if a loaded instance
has numeric keys, map them by position once. That's the same route Tray positions
took (D-226), so no save-schema break.

`kind` records which keyword you chose, so the editor can render the row back
without re-deriving it from the payload.

**② One statement = one block.** A block may carry one modifier, not a list.

Nothing in the engine cares — `TileModifiers` iterates `block.modifiers` and will
happily iterate an array of one. It matters for *authoring*: a block with three
modifiers is three sentences pretending to be one, which is exactly what makes
the current summary line unreadable. Splitting them makes each row's rules text
exact.

**③ Capability provision moves to the top-level `provides`, in one place.**

Today there are two channels — `def.provides` (read by the game and the board UI,
**unwritable by the CMS**) and `block.provides` (writable, read by the engine but
**not** by the board UI). That split is bug B2: your Copper Pickaxe works
mechanically but draws no connection line and shows no "Tool" panel, because five
UI readers gate on the channel the CMS can't write.

Fix: the CMS writes **only** `def.provides`, in the object form that carries
tier:

```jsonc
"provides": [ { "tag": "pickaxe", "tier": 1 } ]
```

`getProvidedTagsWithTiers` already merges both channels and already accepts both
string and object entries, so old content keeps working untouched. The five UI
readers get pointed at the merged helper rather than the raw array — that's B2
fixed as a side effect.

**④ A new top-level `restrictions` array.**

```jsonc
"restrictions": [
  { "id": "res_a1", "kind": "adjacency_limit", "max": 2,
    "match": { "mode": "tag", "value": "Coast" } }
]
```

Read by `Placement.js` (new), not by `TileModifiers`. Keeping it out of
`effectBlocks` matters: a restriction is not a modifier, has no aggregator, and
belongs to placement rather than to the per-tile effect scope.

**⑤ `acceptedTokens` stays exactly where it is.**

The *Requires* keyword is a presentation of the existing top-level field. It's
read early by `RecipeResolver.checkAcceptedTokens`, it's per-Token rather than
per-rule, and it already works. You get the unified sentence list; the engine
sees no change at all. (See **Q5** if you'd rather it moved.)

### 5.3 The migration, Token by Token

All of it is mechanical, and it's one script run once at sync time.

| Token | What moves |
|---|---|
| `token_copper_pickaxe` | `block.provides: ["pickaxe"]` → `provides: [{tag:"pickaxe", tier:1}]`; the now-empty block is deleted; `kind: "acts_as"`. Type re-derives to `context` ✅ |
| `token_forge_altar` | One block with 2 modifiers → two blocks with one each, each with a new `id` and `kind`. ⚠️ **Its Work Time value is `+0.2` and should almost certainly be `-0.2`** — the migration should *not* silently flip it; it should flag it for you |
| `token_copper_ore_minecart` | Its one block is empty and does nothing. Delete it. To make the Token work, add a *Restocks* statement naming Copper Ore Vein — a choice for you, not for the script |
| `token_copper_ore_vein` | Nothing. `acceptedTokens` is untouched |
| The other 6 | Nothing but the derived `tokenType`, and a blank `theme: ""` cleanup (CR2-001) if you want it done here |

⚠️ **The sync route overwrites `data/tokens.json` wholesale with no backup**
(the known CMS-3 hazard, still live). Whatever day this migration runs, copy the
file first. That's a one-line precaution, and it's the difference between a
ten-minute migration and a bad afternoon.

---

## 6. Engine work vs CMS work

Sizes are rough: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ 3–5 days. All
sizes assume tests, since the engine side is test-covered (the CMS deliberately
isn't — owner decision 24).

### 6.1 Engine

| # | Work | Size | Why it's engine |
|---|---|---|---|
| E1 | **Stable block ids**, upkeep/cooldown state keyed by id, backfill numeric keys on load | **S–M** | Touches save-resident state; must not break existing saves |
| E2 | **Restrictions**: a one-row registry, enforcement in `Placement.js`, a refusal message, re-check on load | **M** | New machinery. Detail below |
| E3 | **Single `provides` channel** + point the five UI readers at `getProvidedTagsWithTiers` (fixes B2) | **S** | Board UI and registry |
| E4 | **Legality metadata on the palette** — `when: never / optional / required` per effect, replacing the one-sided `triggeredOnly` (closes B3 by construction) | **S** | Vocabulary lives in the game (CMS-5) |
| E5 | **Content audit for capability tags** — a `Requires pikaxe` typo currently produces a Token that never runs, with no warning anywhere (bug B4) | **S** | `ContentAudit.js` |
| **Total** | | **≈ 3–5 days** | |

**On E2, the part that needs thought.** A restriction is symmetric, and that's the
trap: if a Coast says *"no more than 2 adjacent Coasts"*, then dropping a **third**
Coast next to it violates **the existing Coast's** rule, not the new Token's. So
enforcement must check, on every placement:

1. the incoming Token's own restrictions against its would-be neighbours, **and**
2. every neighbour's restrictions against the board as it would then be.

There's good news: the precedent exists and is small. `Placement.js` already
refuses placements — `mythicAlreadyPlaced` blocks a second Mythic of a type with
`refuse("Only one … can be on the board at a time")`, and the board already shows
that reason. Restrictions plug into the same seam.

⚠️ Three paths put Tokens on the board **without** going through a normal
placement: 2×2 cascade pushing (which *shoves neighbours sideways*, and could
shove a fourth Coast into contact), Map bursts, and loading a save authored before
the restriction existed. Each needs a decision — I'd let all three place, and mark
the offending Token as violating rather than refusing, which is the fallback in
**Q1**.

### 6.2 CMS

| # | Work | Size | Notes |
|---|---|---|---|
| C1 | **The statement list** — replaces `EffectBlocks.jsx`'s block editor. One row component per keyword, one shared item picker (there are four today), one shared tag picker | **L** | The bulk of the job. Should come out *shorter* than 1080 lines |
| C2 | **The rules-text renderer** — one function, statement → sentence, used by the editor row, the top panel and the in-game tooltip. Deletes the modifier half of `descriptionDictionary.js` | **M** | This is the "description" fix (§1.4) |
| C3 | **Screen restructure** — Classification retired, type badge derived, Tool Tier moved into *Acts as*, Tags promoted | **S** | |
| C4 | **Derived vocabularies** — capability tags from content instead of the hardcoded list (B5); `Requires` written through to `acceptedTokens` | **S** | |
| C5 | **Type derivation + migration script**, run at sync | **S** | §1.2, §5.3 |
| **Total** | | **≈ 5–8 days** | |

### 6.3 Explicitly not in this work

Directional adjacency ("the Token *below* it") is the one that will tempt you. It
is **not** a new effect type — adjacency in this game has no direction anywhere,
so it means changing the adjacency layer, then the data shape, then every
consumer (`TileModifiers`, `RecipeResolver`, `TriggerSystem`), then the CMS. It's
its own project and it should stay one.

---

## 7. What this does not solve

Stated plainly, so nothing is assumed fixed.

- **Balance.** The CMS's balance solvers never look at effect blocks at all — I
  checked all fifteen files in `cms/src/engine/`. A Token that doubles a
  neighbour's yield is invisible to the economy maths, before and after this
  work. Worth its own conversation; not this one.
- **The sync overwrite hazard.** `data/tokens.json` is still written wholesale
  with no validation, merge or backup. This redesign doesn't touch that, and it
  makes the file slightly more valuable, which argues for fixing it soon.
- **Gear and hero effects.** A completely separate vocabulary
  (`EquipmentManager.js`), with nine effects written by gear and read by nobody
  and three read by combat and written by nobody (CR2-074). None of it is
  authorable in the CMS, so it can't bite you while authoring Tokens — but this
  work does not fix it, and the grammar here is Token-shaped, not hero-shaped.
- **Skill-restricted effects.** The engine supports "+10% Yield, mining only"
  (`target.category` on a modifier), but no CMS field has ever written it. I've
  left it out — it's a fourth slot on the sentence, and you haven't asked for it.
  Easy to add later as a payload option on *Provides*.
- **Self-targeting and hero-targeting.** A Token cannot buff itself, and
  `target: 'hero'` is a dead field skipped by everything. Neither is added here.
- **Restriction kinds beyond adjacency limits.** Deliberate — §1.3.
- **Number effects inside reactions.** Closed off rather than implemented
  (§3.7). Giving triggered scalars a meaning would mean building temporary
  buffs, which is a real feature and a separate one.
- **Conditional effects.** No "while", no "unless", no expressions. If you want
  *"provides +10% yield while the Bank holds 50 Fish"*, that's the trigger system
  growing a condition language, and I'd want to see three real Tokens that need
  it first.

---

## 8. Open questions

Options, trade-offs, recommendation first.

### Q1 — When a "Cannot" is violated, what happens? ⭐ *the one that matters*

- **A · The placement is refused.** *(recommended)* You physically cannot drop
  the third Coast; the board says why, using the same refusal channel the
  one-Mythic rule already uses. Clearest, most MTG-like, and it makes the rule a
  *placement puzzle*, which is what your board game is. Cost: the three
  non-placement paths in §6.1 need a fallback anyway.
- **B · The Token goes inert.** It can be placed, but stops working while
  violated, with a warning badge. No placement friction, handles every path
  uniformly. But it's a much softer rule, and "why is this dead?" is a question
  the player has to go looking for an answer to.
- **C · Both.** Refuse on manual placement; mark inert when the board gets into a
  violating state some other way.

**Recommendation: A, with C's fallback.** Refuse where you can, mark where you
can't. That gives you the crisp rule when the player is doing the placing, and no
crashes or impossible boards when a Map bursts or a 2×2 shoves things around.

### Q2 — Does the "by category" filter survive?

Once type is derived, *"boost all adjacent resources"* aims at a value the CMS
computed rather than one you chose.

- **A · Retire it from the editor, keep tags.** *(recommended)* You said tags are
  how effects find their targets. Tags are explicit, you control them, and the
  category filter is used by exactly zero authored Tokens today. The engine mode
  stays so old content never breaks.
- **B · Keep it.** It's free, and "all adjacent resources" is a genuinely useful
  reach that would otherwise need tagging every resource Token.

**Recommendation: A.** If you find yourself tagging every resource `Resource`,
that's your evidence for bringing B back — and it'll be one line.

### Q3 — Is there any authored text left on a Token?

- **A · Rules text only, fully generated.** Purest, and matches "the description
  should be a rules-text of the token's effects".
- **B · Generated rules text, plus a separate optional *flavour* line.**
  *(recommended)* MTG has both, in different typefaces, and never confuses them.
  The rules box is generated and read-only; the flavour line is yours and is
  never mechanical. Costs one field.
- **C · Generated, with a manual override.** What exists today. I'd drop it — an
  override is how the description drifts from the effect, which is the problem
  you're solving.

**Recommendation: B.** You lose nothing and the temptation to "fix" a wrong
sentence by editing the words instead of the rule disappears.

### Q4 — What happens to the `market` and `passive` Token types?

- **A · `passive` derives (work cycle + no hero); `market` lapses.**
  *(recommended)* Nothing reads `market`, no Market Token exists, and inventing a
  derivation signal for a thing you haven't built is guessing.
- **B · Keep an "override the derived type" escape hatch** for cases derivation
  gets wrong.

**Recommendation: A.** B reintroduces the picker through a side door, and the
moment an override exists, the derived type stops being trustworthy.

### Q5 — Where does *Requires* live?

- **A · Stays as the top-level `acceptedTokens` field, shown as a statement.**
  *(recommended)* Zero engine change, zero risk, and you get the unified list.
- **B · Move it into the statement array properly.** Cleaner data, but it means
  changing `RecipeResolver.checkAcceptedTokens`, which gates whether a station
  runs at all — the highest-consequence reader in the system.

**Recommendation: A.** The gain from B is tidiness; the risk is a station that
silently stops producing.

### Q6 — Is *Restocks* in scope?

- **A · Yes.** *(recommended)* Zero engine work — `Managers.js` already reads
  `manages`; there has just never been a field. It turns the Minecart from a
  Token that lies into one that works.
- **B · No, keep the scope tight.** Then the Minecart stays broken and the
  derived-type ladder loses its `manager` rung.

**Recommendation: A.** This is the highest value-per-hour item in the document.

### Q7 — Build order

- **A · All of it in one pass.** *(recommended)* The grammar, the editor, the
  rules text and *Cannot* together. They interlock: the rules text is what makes
  the editor trustworthy, and *Cannot* is the reason you asked for the grammar.
- **B · Grammar and editor first; *Cannot* in a second pass.** Lower risk per
  slice, and *Cannot* is the only genuinely new engine machinery. But you'd
  finish pass one still unable to author the Coast Token you started from.

**Recommendation: A**, sequenced so that E1 (stable block ids) lands first and
alone — it's the one change that can corrupt an existing save if got wrong, and
it deserves its own commit and its own verification.

---

*Nothing in this document has been built. Every claim about how the code behaves
today was checked against the code, not against its comments — this project has a
documented history of comments describing machinery that isn't there, and I found
two more instances while writing this (`tokenType: 'map'`, and the Minecart).*

---

## 9. Owner decisions on the open questions — 2026-08-20

Recorded after the proposal was written. **Three of them supersede what §8 recommended**, and two facts in the document went stale while it was being written, because the owner was authoring live.

**Q1 — Violated "Cannot": REFUSE, and the Token flies back to its last location**, with a warning that flashes to say why. Owner: *"There should always be a last location, but we can make it fly to the vault as a fallback in case."*
So: return-to-origin is the rule; **the Vault is the fallback** for any path that genuinely has no origin (a Map burst, a 2×2 cascade push, an old save loading into an illegal board). Nothing is destroyed and the board never sits in a violating state.

**Q2 — The category filter is retired from the editor, replaced by a special `all` tag.**
⚠️ **These are not equivalent, and the difference should be understood before building.** The old category filter meant *"all adjacent **resources**"*. An `all` tag means *"all adjacent **Tokens**"* — broader in one direction, narrower in another. Targeting a *kind* of Token now means tagging those Tokens explicitly. That is consistent with the owner's *"tags are how effects know what they're applying to"*, but it does mean tagging discipline carries more weight than it used to.

**Q3 — Rules text only. No hand-written text on a Token at all.** No flavour line. Supersedes §8's recommendation of B.

**Q4 — `market` does NOT lapse. Markets are a real plan.** The owner has authored **`token_shrimp_market`**, meant to sell raw shrimp for testing. §8's reasoning ("nothing reads `market`, no Market Token exists") was **already out of date when written**. The type derivation needs a rule for Markets — likely "consumes goods, produces currency", but **the owner should confirm the signal** rather than have one inferred.

**Q5 — `Requires` stays where it is**, presented as a statement. Confirms §8's recommendation: no change to `RecipeResolver.checkAcceptedTokens`, the reader that gates whether a station produces at all.

**Q6 — `Restocks` is IN SCOPE.** Confirms §8. This is the fix for `token_copper_ore_minecart`, which is typed `manager`, promises to restock neighbours, and does nothing — because `Managers.js` reads `def.manages` and no CMS field writes it.

**Q7 — PHASED, not one pass.** Grammar and editor first; **`Cannot` in a second pass.** Supersedes §8's recommendation of A. The stable-block-id change still lands **first and alone**, since it is the one that can corrupt a save.
Consequence to accept: the Coast tokens get authored *without* their adjacency limit for a while.

---

## 10. ⚠️ The migration estimate in §5 is stale

The document says *"10 Tokens, 3 with effect blocks, one empty — a ten-minute job."* Measured 2026-08-20, while the owner was authoring:

| | When written | Now |
|---|---|---|
| Tokens | 10 | **20** |
| Tokens with effect blocks | 3 | **9** |
| Effect blocks to migrate | ~3 | **10** |

Still not large — but it has **tripled in a day**, and it will keep growing while the redesign is designed and built. The "cheapest moment to change the shape" argument is now more urgent, not less. Anyone planning the migration should re-count rather than trust §5.

Newly authored and relevant: `token_coast` and `token_shrimp_coast` both carry the `Coast` tag (the case the grammar was designed against), and `token_shrimp_market` is the first Market.
