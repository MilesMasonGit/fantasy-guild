# Topic: silent moments, and the two kinds of message
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-19/20 in three rounds. From S0 part 5,
"Silent moments", and S0 part 4, running out reported five ways.*

## The rule (owner, 2026-11-20)

**Two kinds of message, by whether the player has to act:**

- **Popup**: floats up and is gone after a few seconds. For a moment that
  sorts itself out: something that will come back or carry on alone.
- **Speech bubble**: stays until the player hovers or clicks it. For
  anything **stopped, gone, or needing the player**. It **clears itself once
  the need is met** (Coal is back in the Bank, arrows are bought). The owner:
  "If the player isn't paying attention or comes back then they'll need to
  see what issues they need to address."

| Moment | Kind | Says |
|---|---|---|
| A Token runs dry and rests (a vein, a bush) | Popup | "Copper Vein exhausted" |
| A Token is used up (most Tokens finishing come back after a while) | Popup | "Oak Forest used up" (today a 3 s bubble) |
| A Token changes (a building finishes, a Sapling grows, a Token turns) | Popup, with the glow | its new name: "Oak Tree", "Sawmill built". The 1 s glow stays. |
| A status lands on a hero | Popup | "Venom!" (as today) |
| A hero recovers from wounds | Speech bubble | "Recovered, ready to work!" (today nothing) |
| An event leaves | Speech bubble **with an alert icon, left where the event stood** | "Fish Shoal expired" (words settled in the wording drift topic) (today its banner just vanishes). A marker, not a Token: it never blocks placing. Fades once looked at. |
| A hero's gear breaks | Speech bubble | "My axe broke!" (today a 5 s bubble) |
| A hero runs out of something the work needs (Coal, Food, bait, arrows) | Speech bubble | "Out of Coal!"; clears when the Bank has it again. |

**The word for a resting Token is "Exhausted" everywhere**: the popup, the
card, the hover and the drawer ("Exhausted · respawns in 4m", the verb from
the wording drift topic; today "Resting").

**An item's tooltip lists its effects**, in the rule-line form from the
effect wording topic ("Lucky ×1.2 on Veins"), with the effect-name hovers;
the same in the Bank, the Shop, drop lists and the loadout. Today an
item's effect shows only once a hero wears it.

## A rule change for other sessions

**No fishing without bait, no bow without arrows** (owner, 2026-11-20).
Today the hero fishes the basic pool with no bait, and a bow shoots without
arrows (its own damage only; the code leaves this to the owner). With this
ruling, running out stops the work and gets the speech bubble above. It
changes how two skills play, so the details (a Rod's basic pool, older bows,
new players' first catch) are settled in **A8 Fishing** and **A16 Ranged**;
their STATUS rows carry it.

## What the game does today

- Hero messages are all timed: 5 s by default, 3 s for "used up", a callout's
  length for a status landing. None waits for the player.
- A Token used up speaks (`TOKEN_DEPLETED`); a Token that rests does not
  (`TOKEN_RESTING` has no listener in the UI).
- A hero's recovery is announced in the engine (`HERO_RECOVERED`) and heard by
  nothing the player sees.
- An event's end withdraws its banner and says nothing.
- Every transform raises the same 1 s glow, which names nothing.
- An item's tooltip has no effect lines.
- Out of Coal: a badge and a notice. Out of bait or arrows: nothing.

## What it became

- **T-496**: two kinds of message, popup and speech bubble, by the rule above; the existing moments re-sorted.
- **T-497**: the silent moments speak: recovery, exhausted, an event's leaving marker, a transform's new name, running out.
- **T-498**: "Exhausted" is the word for a resting Token everywhere.
- **T-499**: an item's tooltip lists its effects.
- A8 Fishing and A16 Ranged: the bait and arrows ruling, in their STATUS rows.

All tickets blocked on the Telling the player group.

## Evidence

- Hero messages timed, 5 s and 3 s → `src/ui/components/board/heroSpeech.js:17-30`
- Used up speaks, status lands, gear broke → `src/ui/components/board/HeroBubbleLayer.jsx:101-121`
- Resting has no UI listener → `src/systems/board/boardEvents.js:118-126` (grep of `src/ui` finds `TOKEN_DEPLETED` only)
- Recovery published, unheard → `src/systems/combat/WoundedSystem.js:93`; engine note → `src/systems/core/engineEvents.js:270`
- Event end withdraws its banner → `src/systems/notifications/routing.js:171-175`
- One glow for every transform, 1 s → `src/systems/board/TokenGlows.js:1-15, 33`
- Banner kinds → `src/systems/notifications/bannerKinds.js` (recipe, hero, upgrade, settled, knockout, bankFull, stackFull, event, save)
- Item tooltip has no effect lines → `src/ui/components/drawer/ItemTip.jsx` (no effect, rule or statement reader)
- Arrows left to the owner → `src/systems/combat/Arrows.js:10-19`; bait from the Bank only → `src/systems/board/Fishing.js:41-52`
