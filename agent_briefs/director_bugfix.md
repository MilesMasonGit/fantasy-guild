# Director brief — Bug fixing

**Read `_shared_rules.md` first.** It carries the rules all three directors
follow: you direct rather than code, you verify subagent claims before merging,
the owner does not code and is always available to interview, and this codebase
invents concepts.

## Your lane

You own **`code_review_v2_findings.md`** — roughly 184 tickets from a
nine-session review, plus 26 recorded owner decisions. Your job is to turn that
backlog into fixed software, in an order that serves the owner.

## Before you fix anything, read the decisions

The findings file has four **"Owner decisions"** sections. They are settled, and
several **re-grade whole families of tickets**:

- **Combat is parked.** No Token is typed `enemy`, so the combat engine, loot
  system and Bestiary are unreachable by playing. Combat-path tickets are
  *"ready for content"*, **not urgent** — but they are much cheaper to fix now
  than as live bugs once enemies are authored.
- **Audio is deferred.** That whole family is P3 and out of the fix waves.
- **Retirement and recruit-purchasing are retired mechanics.** Increasing roster
  size auto-adds a hero.
- **The Time Bank stays off.** ⚠️ Two tickets reason as though fast-forward is
  reachable; their premise is currently false.
- **Influence and item durability are cut.** Consumable slots are **kept** — so
  that ticket is a fix, not a deletion.

**Scheduling work the owner has parked is the main way to waste their time here.**

## The backlog is already sequenced

The end of the findings file has **"⭐⭐ THE FINAL BACKLOG"** — seven waves by
theme, ~13 sittings total, though 158 of 175 open tickets are under an hour each.
It also says **what not to fix**, which is as useful as what to fix. Start there
rather than re-deriving an order.

Sequence for **leverage**: some fixes make others cheaper or unnecessary. Say
what should come first *because it changes the cost of the rest*.

## What this backlog is actually made of

The review looked hard for spaghetti and did not find it — zero dangerous import
cycles, 0.45% duplication, the engine tick at 0.159ms against a 5ms budget,
memory flat over 40,000 ticks. **The architecture is sound.**

What it found instead was **features wired up at one end only**: an event
published and never subscribed, a value computed and never read, a rule enforced
on one route into a behaviour but not the others, a control with no way to reach
it. Nothing errors, nothing fails a test, and the code reads as intentional.

That shapes how you fix: **follow the wire from both ends** before declaring
something fixed, and check whether the same rule exists in more than one place.
The Vault deposit rule was fixed once and had already drifted again in three
surviving copies.

## How to run a fix

One problem per subagent, with the ticket as its brief and the file paths already
found — that is the owner's stated preference. Narrow scope is what stops agents
wandering into unrelated code.

Give every subagent: the ticket text, the verification bar (`npm test` must not
regress, build clean, and **exercise it in the running game** if a player could
see it), and permission to **stop and report** rather than guess.

When it comes back, **check its claims yourself** before merging. Three separate
sessions produced confidently wrong findings that only checking caught.

## When to interview the owner

Many tickets carry an explicit owner question with labelled options — those are
ready to ask. Beyond them, ask whenever a fix would change how the game plays
rather than whether it works. Batch the questions; do not drip-feed.
