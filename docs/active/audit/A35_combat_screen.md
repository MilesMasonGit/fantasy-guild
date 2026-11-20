# A35: The combat screen
*Read at tag audit-build (1c04f5f6), 2026-11-20.*

## In one paragraph

A fight shows in two places. **On the mat**: a small health bar over each
fighter with a crossed-swords fight button between them, floating numbers
(white on the enemy, red on the hero, Miss, Crit!, green heals, red Venom and
Burn ticks) and short bubbles for special moves and statuses. **The fight
window**, opened by the button, one per hero: the two fighters at twice their
size, a stat block comparing them, the enemy's attacks, what's on each
fighter, elixirs, and a log of this fight and the last. A window can be
minimised to a tab along the bottom of the mat. It matches the GDD closely;
the differences are small.

## What the player sees and does

- **Health bars** over fighters, one light red fill with the numbers
  ("17/30"). The GDD says green, amber and red.
- **The fight button** opens or closes that hero's window. With two windows
  open, only the top one's button looks "open".
- **Floats** on the mat last half a second; **bubbles** about two.
- **The window**: drag it by its title, Escape closes the top one, minimise
  makes a tab with both faces and health bars; Won or Lost in the title
  between fights. A Limes tip sits in the battle's corner.
- **The log** (closed until asked): "This fight" and "Last fight", newest
  first, headed "Beat Goblin in 0:42", "Knocked out after 1:05" or "Left the
  fight after 0:12".
- **While you were away**: events first, then knock-outs (with gear lost),
  then the fights as "Goblin beaten ×12". The GDD says knock-outs lead.

## What really happens underneath

- **The window and the mat tell "what just landed" differently**: the window
  shows it 0.7 s (a move 1.4 s), the mat 0.5 s (a bubble 2.2 s); the window
  doesn't wait for the swing's strike frame; and a Venom or Burn tick on the
  enemy is white with no icon in the window, red with a drop or flame on the
  mat.
- **The fight clock** rounds down (right for a time counting up) but writes
  "0:42", not the compact "42s" the owner chose (T-488). Swing times are
  written "3 s" with a space.
- **An elixir drunk mid-fight never reaches the log** (it's queued and only
  written when the next fight starts).
- **The same enemy facts are shown three ways**: the window's stat block, the
  mat hover's enemy card (being removed, T-544), and the Token card.
- **Words still say "swing"** in many places (Swing, Swings every, slow swings,
  "Small hits every 2 s"); a move with no name is called "Attack", which will
  clash with Attack Speed (T-536). An item tooltip calls the hit "DMG" and
  attack speed "Speed".
- **Won and lost are worded four ways**: Won/Lost, "Ana beats Goblin" / "is
  knocked out", "Beat … in" / "Knocked out after", and the summary's
  "Knocked out", "beaten".
- **Dead code**: a computed title, clock and health text never shown, two
  unused text keys, leftover float styles, a copied helper.
- **Placeholders drawn in code**: 25 combat icons, the minimise button, a
  borrowed battle background; every enemy but the Cow stands still in the
  window (no animation art yet).
- Redraws only on change (T-198) hold, except an open window also redraws on
  each swing; minor.

## What the owner controls in the CMS

Nothing on this screen directly; it shows the enemies, moves, effects and
items authored elsewhere. The battle background and icons are art.

## What it touches, and where it overlaps another system

- **Telling the player** (ready to brief): times (T-488), sentence case
  (T-501), effect hovers (T-495), the away summary (T-506).
- **The hit** (A31): Attack Speed (T-536), damage types without groups (T-532:
  the window's resistance rows), Weak!/Resisted (T-533).
- **Statuses and boss moves** (A33): move names (T-541).
- **Enemies** (A32): no enemy hover, the Token card shows everything (T-544).
- **Winning and loot** (A34): bonus drops in the Drops line (T-554).

## Where it differs from the GDD

- Health bars: one light red, not green, amber and red.
- The away summary: events lead, then knock-outs.
- The window's "just landed" timings and tick colours differ from the mat's.

## Try this (in the tagged build, with the QA panel)

1. **Set-up**: a new game; QA panel: a hero with a Copper Sword, food and an
   Elixir of Valor; place a Toxic Frog and a Goblin.
2. **Send the hero at the Toxic Frog**, watch the mat: bars, floats (Venom
   ticks in red with a drop), bubbles.
3. **Open the fight window** with the swords button: the stat block, attacks
   ("just used"), what's on each fighter, the elixir and its fights left.
4. **Watch a Venom tick in the window** vs on the mat: colour and icon.
5. **Open the log**; finish the fight; read "Beat Toxic Frog in 0:42".
6. **Minimise the window** to a tab; open a second hero's window; check which
   fight button looks open.
7. Ask yourself: is the mat enough most of the time, and what must the window
   show that the mat can't?

## Owner feedback (date)

## What it became

## Evidence

- Health bar one colour → `src/ui/components/board/healthBar.js:4`, `src/ui/components/base/VitalBar.jsx:5-11`
- Fight button, top window only looks open → `src/ui/components/board/FightLayer.jsx:39-95, 129`, `src/ui/components/combat/fightPanelStore.js:50-53, 107`
- Bubbles 2.2 s, placement → `src/ui/components/board/callouts.js:11`, `CalloutLayer.jsx:41-46, 120-133`
- Floats 0.48 s, colours, ticks with icons → `src/ui/components/board/fx/fightFloats.js:25-34, 56-82, 115-119`
- Window parts → `src/ui/components/combat/FightPanel.jsx:152-214, 297-457, 493-541`; behaviour → `FightPanelPopup.jsx:79-155`; log 400 → `fightWatch.js:26`
- Window "just landed" 0.7 s, move 1.4 s, colour by side → `FightPanel.jsx:50-53, 99-120`
- Fight clock floors, m:ss → `src/ui/components/combat/fightView.js:110-114`; log headings → `src/i18n/en.json:439-441`
- Elixir mid-fight not logged → `fightWatch.js:209-214, 289-295`
- Swing words → `en.json:367, 400-410, 460, 471, 487, 513, 519, 527, 531`; DMG, Speed → `en.json:138, 141`
- Away summary order → `src/ui/components/hud/CatchUpOverlay.jsx:338-369, 469-481`
- Dead code → `fightView.js:384-388`, `healthBar.js:36, 48`, `en.json:431-432`, `src/styles/tailwind.css:656-662`; copied helper → `fightWatch.js:336`, `callouts.js:35`
- Placeholders → `src/ui/components/combat/combatGlyphs.js:6-262`, `FightPanel.jsx:43, 547-561`, `fightView.js:346-350`
