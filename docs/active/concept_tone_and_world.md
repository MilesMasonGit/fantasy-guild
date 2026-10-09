# Tone and world

*D1 of the post-crunch plan ([ideas.md](ideas.md)). Owner interview,
2026-10-08. Tone, words, story, pops of activity and sound: settled, pending
the owner's final read.*

This is the guide for anyone writing player-facing text (names, speech
bubbles, events, quests, UI) and for the story around the Atlas.

## Tone

- **Mood: cozy fairytale mixed with old-school RPG**, where "old-school RPG"
  means **RuneScape**: skills to 99, ore and wood tiers, grinding as comfort,
  names that tell you the tier.
- **Humour: light and occasional.** Mostly warm and plain, a wink now and then.
  Lines repeat for hours in an idle game, so no line should rely on a joke.
- **Real-world winks**: rarely, as easter eggs (rare events, rare hero lines),
  never in anything important; they translate poorly.
- **Monsters are storybook dangerous**: real foes you fight and loot, more
  mischievous than horrific, no gore.
- **Defeat is a bump, not a tragedy**: knocked out, limping home, bandaged in
  the Hall. No death, nothing permanent.

## Words

- **Names**: plain for basics (Oak Tree, Copper Ingot) so players always know
  what something is; flavour for special, rare and event things (Grandma's
  Kitchen, the Frog Prince).
- **No flavour text**: items and Tokens have no "examine" line. Descriptions,
  where needed, say what something does.
- **Hero voice**: plain, with a little character. Problem lines stay clear
  ("I need Copper Ore to work the Furnace."); moments (level-ups, events, idle)
  may have personality.
- **UI voice**: clear and plain ("Costs 10 Oak Wood"), no character voice.
- **The player is the guildmaster**; text may address them that way.
- **Hero names**: a mix of homely fantasy (Bram, Tilly, Marigold), classic
  fantasy (Aldric, Seraphine) and name-plus-epithet ("Bram the Bold");
  ordinary real names (Tom, Sarah) are possible but rarer. Players can rename
  heroes freely.
- **Region names** (the Atlas's generated flavour names): storybook places
  built from the map's ingredients: "Mossy Hollow", "Copperbrook",
  "Old Oak Dell".
- Everything is written to be translated (T-119): short, no wordplay that only
  works in English in anything that matters.

## The story

**The hook** (owner's concept, open to change): the guildmaster stumbles upon
an old guild hall occupied by a **half-insane cartographer**. He has lost his
magical maps, scattered across **the planes**. The guildmaster must find the
maps, craft them together to **teleport the Guild Hall** to new places, and
gather the resources to fund the quest.

- **Maps write worlds** (borrowed from Myst's linking books): combining maps in
  the Cartography screen *writes* a new plane into being, and the Hall
  teleports into it. This is why Regions are generated, why ingredients shape
  them, and why old Regions freeze when the guild leaves.
- **Map tiers are planes**: each tier of maps comes from a stranger plane, so
  late content can get weirder.
- **The cartographer is unreliable and eerie**: mutters, contradicts himself;
  the player isn't sure he's on their side. He is the **tutorial guide** and a
  **quest giver**.
- **Light framing, probably no story milestones.**
- **Dialogue**: event characters can be talked to: a few lines and a choice or
  two that changes the outcome (a trade, a small quest, a gift, a fight).
  Designed in D7 (events).
- **The ending**: each skill has a **final challenge**, plus a variety of
  **combat challenges**. Their outputs feed an **endgame ritual that completes
  the cartographer's work**. Afterwards the player either keeps playing
  indefinitely or **prestiges**: plays through again with wacky modifiers.
  Designed in D2 (progression).

- **A hint of a twist: the loop.** The game exists in a sort of loop; the
  cartographer half-remembers many guildmasters who completed the ritual
  before. He is **not dangerous**. This is the story's reason for prestige:
  starting again is the loop turning.
- **The eeriness stays with him and the late planes.** The early game is fully
  cozy; the contrast grows as the player goes deeper.

## Pops of activity

A rule for the whole game: **the board is largely static, with pops of
activity**, so the player is never oversaturated but always has the next thing
to look at.

- **The action follows the hero.** Tokens sit still until a hero works them
  (a tree is still until the hero starts whacking it). Heroes are the
  constant motion.
- **Be restrictive.** Too many things will pop at first; trim over time.
  Example: the hero's "No work in range." bubble clutters and pops too often,
  so it goes. ⚠️ brief 30 H4 currently keeps that line; change it in the
  follow-up after brief 30.
- **What may pop**: rare or new things, progress, rules firing, and problems.
- **Three loudness levels**:

  | Level | Looks like | Used for |
  |---|---|---|
  | Quiet | a small fading number or icon | rules firing (double loot, neighbour bonus), every time |
  | Normal | a speech bubble | progress: level-ups, buildings finished, quests done |
  | Loud | bigger, held longer | rare drops, first-ever items, events |

- **Problems**:
  - A **station's** lasting problem (Furnace out of Copper Ore) is shown by a
    bubble **on the station**, for as long as it lasts, even with no hero there.
    The hero stays quiet.
  - **Resource nodes** don't pop for problems (depleting is routine).
  - A **hero who can't work a node** (level too low, no Pickaxe nearby) gets a
    quiet pop the first time, then just works something else.
  - **Idle heroes show nothing**; pottering about is signal enough.
- **Missed pops**: only loud ones also go to the notification column. Quiet
  and normal pops simply pass; the offline summary covers time away.

## Sound

- **Sound effects and music**, worked on after the crunch, before release.
- **Sources**: placeholder SFX and BGM already exist; SFX come from
  free-with-attribution packs (Kenney RPG audio, three ZapSplat packs, in
  `public/assets/audio/`). **Keep track of every asset used, to credit it
  properly**: a credits register now (T-120), an in-game Credits screen in
  Settings before release.
- **Music**: a friend is writing the soundtrack; maybe a few tracks, maybe
  one. Many players will turn music off.
- **SFX only on player interaction**, never 8 things passively making noise:
  - UI clicks and drawers;
  - picking up and placing (Tokens, flags, heroes, Shop buys);
  - **hovered activity**: each skill has a sound (a wood chop for Forestry)
    that plays when a cycle completes on the Token or hero being hovered;
  - **collecting loot**: a chime per item looted off the mat that **climbs a
    scale**, so sweeping quickly through loot plays a run of rising notes.
- **Quiet by default**; loud pops (rare drop, event) get a distinct chime that
  can be heard from another window.
