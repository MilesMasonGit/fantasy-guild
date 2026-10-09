# Animation menu: code effects and art to draw

Read-only research for Stage A (`docs/active/ideas.md`, "In-engine animation
brainstorm" and "True animations"). Nothing here is built or decided. It is a
menu for the owner to pick from, plus an art list so frames can be drawn early.

The rules it follows (`concept_tone_and_world.md`, "Pops of activity"):

- The board is largely still. **The action follows the hero**: a Token moves
  only while a hero works it.
- Three loudness levels: **quiet** (a small fading number or icon, rules
  firing), **normal** (a speech bubble, progress), **loud** (bigger, held
  longer, rare and first-ever things).
- Be restrictive: start with few, trim over time.
- Crunch rule (`PERFORMANCE.md`): no expensive mat effects (blur, layout
  shifts, heavy transparency over animation) without a line in the cost log.
- Pixel art stays crisp: whole pixels, no smoothing (`tailwind.css:347-352`
  says "Never scale" a Token for this reason).

No numbers here were measured for this note: the game, dev server and benches
were not run. Costs marked **measured** come from `PERFORMANCE.md`; the rest
are reasoned from the code.

## Owner picks (2026-10-09)

- **Code-only, first batch**: 1 crisp hit reactions, 2 strike chips, 3
  completion blink, 4 loot hop, 5 crisp Hall flight, 6 rule number, 7
  neighbour spark, 10 rare drop twinkle, 12 level-up hop and burst, 13 white
  hit frame, 14 damage number (**every hit**), 15 knockout blink, 17 crisp
  transform flash (replaces the gold glow ruled in FB-11; the owner chose it
  here). **After the Atlas**: 18 Region settle. Ticket T-137.
- **Not picked**: 8 bubble drop-in, 9 station problem nudge, 11 first-ever
  showcase, 16 build drop.
- **Art, first batch** (owner draws): falling leaves, rock chips and sparks,
  dust puff, water splash, anvil sparks, wood chips, steam or smoke, hit
  spark, knockout poof, grain puff, level-up sparkle, rare shine. **Later**:
  loot glint, used-up crumble. On the owner's art list
  (`docs/active/owner_art_list.md`); the sprite-strip player is T-138.

## 1. What exists today

| Effect | What the player sees | How it's drawn | Evidence | Cost |
|---|---|---|---|---|
| **Token hit reactions** | While a hero works a Token, its art reacts once per swing, one style per skill: forestry shake, mining jitter, fishing bob, farming sway, smithing squash, crafting hop, cooking pulse, construction thump. | DOM, Web Animations on a wrapper round the art, looping on the hero's strike frame (frame 5 of 8, 125 ms frames). Transform only. | `hitAnimations.js:40-167`, `TokenHitArt.jsx:45-55`, used at `MatToken.jsx:466-474` | Unmeasured; transform-only, so the compositor runs it. ⚠️ Not pixel-snapped: moves in % of the art box with smooth easing and scales by 0.82-1.1 (`hitAnimations.js:90-99`, `217-224`), which is what `tailwind.css:347-352` and `384-389` warn blurs pixel art. |
| **Combat knockback + red flash** | A landed hit pushes the enemy away from the hero and tints it red; a miss does nothing. | Same wrapper, one-shot per `combat_hero_attack`, delayed to the strike frame. The red is a CSS **filter** (`sepia saturate hue-rotate`). | `hitAnimations.js:143-153`, `211-215`; `TokenHitArt.jsx:61-73` | Unmeasured. The filter repaints the art each frame for 380 ms per hit. |
| **Transform flash + glow** | A Token that just became another one flashes white-gold and a soft gold glow swells and fades, 1 s. | DOM/CSS. Flash = `filter: brightness saturate drop-shadow`; glow = a radial gradient with `mix-blend-mode: screen`, scaled. Raised by effect actions (`TokenGlows.raiseGlow`). | `tailwind.css:404-438`; `MatToken.jsx:344-352`, `473`, `500-506`; `EffectActions.js:300`, `366` | Unmeasured (no draw scene transforms). The heaviest kind of mat effect in the game today: filter + blend over live art. Rare, so tolerable. |
| **Quest-ready halo** | A finished quest Token breathes a gold halo until claimed. | CSS radial gradient, `screen` blend, infinite 1.8 s loop. | `tailwind.css:445-462`; `MatToken.jsx:452-459` | Unmeasured. A constant loop, but only on quest Tokens. |
| **Token landing bounce** | A placed Token drops the last stretch, hits, rebounds twice. | CSS, whole-pixel `translateY`, `steps(1, end)`, 380 ms. The model for pixel-crisp motion. | `tailwind.css:359-396`; `MatToken.jsx:483`, `492` | Cheap (transform, one-shot). |
| **Spawn pop-out** | A spawned Token pops out of its spawner at half size and slides to its spot, 300 ms. | Web Animations, `translate + scale(0.5→1)`. | `spawnMotion.js:51-60`; `MatToken.jsx:317-327` | Unmeasured (S2 has almost no spawns; `spawnMotion` draw switch exists, `PERFORMANCE.md` U8). Smooth scale, so briefly soft. |
| **Hover hop** | A hovered Token or hero hops once (0 → -4 → +1 → 0 px). | CSS keyframes. | `tailwind.css:481-511`; `MatToken.jsx:463`, `MatHero.jsx:243` | Cheap. Smooth easing, so off the pixel grid mid-hop. |
| **Floor loot hover bob** | Loot on the floor bobs up and down. | CSS, whole pixels, `steps(1, end)`, 1.96 s loop. | `tailwind.css:309-327`; `TokenSprite.jsx:184` (applied on hover only) | Cheap. |
| **Loot thrown to the floor** | A finished cycle's item slides from the Token to its floor spot and fades in, 480 ms. | Web Animations, translate + opacity. ⚠️ The file's header says "ballistic arc, densely sampled"; the code is two keyframes, a straight eased slide (`lootArc.js:1-6` vs `35-46`). | `SpriteLayerView.jsx:88-95`; `lootArc.js:16-50` | Cheap per item. `itemFlight` switch covers it. |
| **Loot stacking** | A new item slides into a matching pile, shrinks and fades. | Web Animations, translate + `scale(0.6→0.2)` + opacity. | `SpriteLayerView.jsx:97-113`; `lootArc.js:61-84` | Cheap. |
| **Loot flight to the Hall** | Collected loot flies in an arc to the Guild Hall with a glowing trail, a soft halo and sparkles; 8 sparkles burst on landing; the Hall brightens for 350 ms. | **Canvas** (`ParticleOverlay`), full-screen, additive blending (`lighter`), a 20 px soft trail, a 25 px radial-gradient halo per item, 2×2 sparkles. Loop sleeps when empty. Max 12 per burst. The Hall's brightening is a CSS filter. | `ParticleOverlay.jsx:23`, `191`, `440-512`; `MatToken.jsx:354-366`, `464` | **Measured**: particles 2.3 ms, itemFlight 2.1 ms of frame work at 4× in S2 (`PERFORMANCE.md`, "What each system costs"); a loot burst drops S2 from ~84 to **~40 FPS** at 4×. The most expensive effect we have. |
| **Charge floater** | `-1` / `+50` rises a few px and fades over 3 s beside the charges ring. | CSS, opacity + transform; soft `text-shadow` and a `drop-shadow` filter on the text. | `TokenBadges.jsx:22-75`; `tailwind.css:544-553` | Cheap. Soft shadows are T-013's question. |
| **Count ring glide** | A charges ring slides to its new value. | CSS transition on `stroke-dashoffset`. | `tailwind.css:531-537`; `RingBadge.jsx:112` | Cheap. (The *cycle* rings are the opposite: **measured** 8.0 ms, 58 % of frame work, `PERFORMANCE.md`.) |
| **Callouts** | "! Spawned X" or a rule's title pops over a Token, rises, fades, 2.2 s. Max 3 per Token, 24 on the mat. | DOM/CSS, opacity + transform (one 1.12 scale at the start). | `components.css:75-98`; `callouts.js:7-14`; `CalloutLayer.jsx:43-46` | **Measured**: `alerts` switch 1.9 ms at 4×. |
| **Hero speech bubbles** | Level-ups ("LVL UP! …"), blocked lines, arriving or going idle. No entrance animation; they follow the walking hero. | DOM. | `heroSpeech.js:14-17`, `64-98`; `HeroBubbleLayer.jsx:74-95`, `221` | **Measured**: `speech` 0.5-1.7 ms, below noise. |
| **Hero and enemy sprite frames** | Walk, idle, swing rows, 8 frames at 125 ms. | DOM image, frame stepped by a timer per hero. | `AnimatedHeroSprite.jsx:57-76`; `hitAnimations.js:345-363` | **Measured**: heroAnim 3.7 ms; enemyAnim below noise. |
| **Sprite outlines and shadows (spriteFx)** | Sharp green (worked), white (hovered), red (alert) outline; a hard black shadow on dragged Tokens and floating loot. | Pictures generated from the art at build time (`scripts/spriteFx.mjs` into `public/_gen/sprite-fx/`), not filters. | `src/config/spriteFx.js:1-20`, `31-35`; `src/ui/utils/spriteFx.js:107-135` | **Measured**: none (spriteFx switch below noise). The cheap pattern to reuse. |
| **Gear pulse, equip bob** | The empty recipe gear breathes; a just-equipped dock slot bobs and glows. | CSS, scale + `drop-shadow` filter. | `tailwind.css:515-526`, `555-576` | Unmeasured; small, off-mat (equip) or rare (gear). |
| **Health bar** | Shrinks over 300 ms on damage. | CSS `width` transition (a layout property). | `HealthBar.jsx:32` | Unmeasured; bars exist only in a fight (`PERFORMANCE.md` U2). |

**The particles setting.** Settings has one toggle, "Item Fly Particles"
(`SettingsModal.jsx:193`, key `ui.itemParticles`, default on,
`SettingsManager.js:50`). It turns off **only the flight to the Hall**
(`ParticleOverlay.jsx:191`); the floor throw and stacking ignore it
(`SpriteLayerView.jsx:89`, `106` check only the perf switch). Its description
("between cards and inventory") is out of date.

**Left-over CSS.** `shimmer`, `chroma-swirl-gradient`, `bubble-float` /
`.bubble`, `bit-drift` / `.bit` and `bloom` (`tailwind.css:588-685`) have no
user in `src/` that a search found. Dead weight, not a cost.

**Events with no visual today** (good hooks for new effects): a Foundation
finished (`BOARD_EVENTS.TOKEN_BUILT`), a fight won or lost
(`COMBAT_RESOLVED`, `HERO_DEFEATED`), all with no listener under `src/ui`. A
finished cycle (`CYCLE_COMPLETE`) only resets the ring (`TokenBubbles.jsx:232-236`).

## 2. Cost classes used below

- **Cheap**: a one-shot `transform` or `opacity` animation on one small element,
  or swapping a ready-made picture (the spriteFx pattern). The compositor does
  the work; no React re-render per frame.
- **Moderate**: a CSS `filter`, a blend mode, a gradient, or anything that keeps
  a frame loop awake (the particle canvas), or one effect on many elements at
  once.
- **Expensive**: blur, full-mat movement, layout-changing animation (`width`,
  `top`), large translucent layers over moving art. Needs a cost-log line first;
  mostly on the "avoid" list.

"See first" means the owner should see it moving before choosing (a prototype
later, not now).

## 3. Code-only effect menu

### A hero working a Token

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 1 | **Crisp hit reactions** | The same per-skill reactions, but moving in whole art pixels with stepped timing, so a struck tree "clicks" like the landing bounce instead of blurring. Smithing's squash becomes a 1-px dip instead of a scale. | constant (hero motion) | Reuse `HIT_ANIMATIONS` (`hitAnimations.js:40`); change units to pixels and add `steps`. | Cheap: same transform loop as today. | Yes: side by side with today's. |
| 2 | **Strike chips** | On the strike frame, 2-3 single pixels in a colour taken from the Token (bark brown, ore grey, water blue) pop off and fall, gone in ~4 frames. | constant (hero motion) | New: a tiny pool of 2×2 divs per worked Token, timed by `strikeStartTime` (`hitAnimations.js:285`). The code-only stand-in for art items in section 4. | Cheap per strike; moderate across 8-10 busy heroes (one more looping animation per worked Token). Must not use the particle canvas, which would keep its loop awake. | Yes. |

### A cycle completing

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 3 | **Completion blink** | The Token's green outline blinks white for two frames (~60 ms) as the item comes out. | quiet | Reuse the generated white outline (`spriteFx.js:31-35`); swap the picture on `CYCLE_COMPLETE`. | Cheap: a picture swap, no filter. Must not re-render the Token through React each cycle (the rings already cost 8 ms). | Yes. |
| 4 | **Loot hop** | The item hops out in a real arc and lands with a 1-px bounce, like the Token landing, instead of today's straight slide. | quiet | Reuse `lootArc.js:16`; whole-pixel keyframes with `steps`, as `gi-token-land`. | Cheap. | Yes. |
| 5 | **Crisp Hall flight** | Loot flies to the Hall with a short trail of hard 2×2 pixels instead of the soft glowing smear and halo; a 4-pixel "plink" on arrival; the Hall dips 1 px instead of brightening. | quiet | Reuse `ParticleOverlay`; drop the 20 px trail, the radial gradient and additive blending (`ParticleOverlay.jsx:449-490`); swap the Hall's filter (`MatToken.jsx:464`) for a transform. | **Cheaper than today**, which is measured at 4.4 ms and the 40-FPS loot burst. Worth measuring before and after. | Yes. |

### Quiet pops (rules firing, every time)

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 6 | **Rule number** | A small "x2" or "+1" in the pixel font rises 6 px in three whole-pixel steps and vanishes, with a hard 1-px black edge instead of a soft shadow. | quiet | Reuse the charge floater (`TokenBadges.jsx:22`, `gi-charge-float`) on `EFFECT_FIRED`; it would replace the callout text for quiet rules. | Cheap. Hard edge also answers T-013 for this text. | Yes. |
| 7 | **Neighbour spark** | When a neighbour bonus fires, one pixel spark hops from the giving Token to the receiving one in 4-5 steps. | quiet | New, small: one 2×2 div, transform only. Needs the effect payload to name the source Token. | Cheap. | Yes. |

### Normal pops (progress)

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 8 | **Bubble drop-in** | A speech bubble arrives by dropping 3 px and settling (two steps), instead of just appearing. | normal | Reuse `gi-token-land`'s pattern on the bubble. | Cheap. | No. |
| 9 | **Station problem nudge** | A station's problem bubble does one 2-frame shake when the problem starts, then sits still for as long as it lasts. | normal | Reuse the `shake` frames (`hitAnimations.js:41`) once. | Cheap. | No. |

### Loud pops (rare and first-ever)

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 10 | **Rare drop twinkle** | A rare item lands on the floor and a plus-shaped pixel star (5×5 art pixels) flickers on it twice; it stays on the floor a little longer before it is collected. | loud | New: the star drawn as a tiny CSS pixel shape or a 3-frame strip made in code. | Cheap. | Yes. |
| 11 | **First-ever showcase** | A first-ever item rises above the hero at double size, holds for ~1 s, then makes its flight to the Hall; a loud bubble names it. | loud | Reuse the flight (`ParticleOverlay`) with a hold at the start; the integer 2× keeps it crisp. Notification column per the concept doc. | Moderate: wakes the particle canvas for ~1.5 s, rare. | Yes. |

### Level-up

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 12 | **Level-up hop and burst** | The hero hops once (landing-bounce curve) and 8 pixels burst outward in a ring for 3 frames, with the existing "LVL UP!" bubble. | normal | Reuse `gi-token-land` on the hero; new 8-div burst; hook `HERO_LEVELED` (`HeroBubbleLayer.jsx:74`). | Cheap. | Yes. |

### A fight

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 13 | **White hit frame** | On a landed hit the enemy turns solid white for one or two frames (the classic pixel-game hit), then the knockback. Replaces today's red filter tint. | constant (fight) | A white silhouette made by the spriteFx generator (it already makes black ones, `spriteFx.js:1-12`); swap the picture. No owner art. | Cheaper than today's filter. | Yes. |
| 14 | **Damage number** | A small red number pops off the enemy per hit. Could be crits only, to stay restrictive. | quiet | Reuse the charge floater. | Cheap. | No. |
| 15 | **Knockout blink** | A beaten enemy blinks three times, drops 4 px and is gone, with a 4-pixel grey puff. | normal | New, on `COMBAT_RESOLVED` (no listener today). Visibility toggles and transform. | Cheap. | Yes. |

### A building finished

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 16 | **Build drop** | The finished building drops in from higher than a normal placement, lands with the bounce, and two dust pixels puff out at each base corner. | normal | Reuse `gi-token-land` (a taller variant); hook `TOKEN_BUILT` (no listener today). | Cheap. | Yes. |
| 17 | **Crisp transform flash** | A transformed Token flashes with its white outline for 3 frames instead of the soft gold filter and blended glow. | normal | Reuse the white outline picture; would replace `gi-transform-flash` / `gi-transform-glow` (`tailwind.css:404-438`). Owner's call: the gold glow is a ruled look (FB-11). | Cheaper than today. | Yes: next to today's glow. |

### A Region arriving (after the Atlas lands)

| # | Effect | Player sees | Level | Machinery | Cost | See first |
|---|---|---|---|---|---|---|
| 18 | **Region settle** | On arrival, the Hall lands first, then the Region's Tokens drop in one after another, rippling out from the Hall. | loud | Reuse `gi-token-land` with a stagger by distance; one-off. | Moderate: up to 80 Tokens animating within ~1.5 s, once per travel. Cap the stagger. Needs a cost-log line. | Yes. |

### Avoid

- **Mat shake** on a loud event: moves every Token and hero at once; moderate
  to expensive and reads as an error in an idle game.
- **Blur, bloom, soft glows** (the old `gi-glow-active` was the busy mat's
  biggest graphics cost, per `tailwind.css:464-470`; that is a comment, not a
  measurement here).
- **Smooth scaling of pixel art** (squash and stretch by fractions): it blurs
  the art (`tailwind.css:347-352`). Fake it with 1-px moves instead.
- **Anything per cycle that re-renders the Token through React**: the cycle
  rings are already over half the frame (`PERFORMANCE.md`).

## 4. Art-based animations (the owner draws frames)

Scale: Token art is **64×64**, drawn at exactly **2×** (`matGeometry.js:73-75`);
items are **32×32**; hero sheets are 8 frames of 64×64 in 3 rows
(`ani_fighter_0.png` 512×192, `spriteFx.js:56`); enemy sheets are 4×4 of 64×64.
Hero frames are 125 ms (`hitAnimations.js:22-23`). So effect art should be drawn
at the same art-pixel size (a 16×16 effect shows 32 screen-units wide, a
quarter of a Token) as a **horizontal strip**, one frame per cell, about 4-6
frames at 80-125 ms.

| Effect | When | Frames | Cell size | Plugs in at |
|---|---|---|---|---|
| **Falling leaves** | Each forestry strike on a tree | 6 | 16×16 (2-3 leaves per cell), or 3 leaf variants of 8×8 that code drops along a path | The strike frame of the work loop (`TokenHitArt.jsx:45-55`, `strikeStartTime`); maybe every other strike, to stay restrictive |
| **Wood chips** | Woodcutting / sawing stations | 4 | 16×16 | Strike frame |
| **Rock chips and sparks** | Mining strikes on ore | 4 | 16×16 | Strike frame |
| **Water splash or ripple** | Fishing, on the bob's low point | 5 | 32×16 | Strike frame of the `bob` loop |
| **Grain puff** | Farming, on the sway | 4 | 16×16 | Strike frame |
| **Anvil sparks** | Smithing strikes | 4 | 16×16 | Strike frame |
| **Steam or smoke puff** | Cooking stations while worked | 6, looping | 16×24 | While worked (the work loop) |
| **Dust puff** | Construction strike; a building finished; a Token landing | 5 | 32×16 | Strike frame; `TOKEN_BUILT`; the landing |
| **Hit spark** | A landed combat hit | 3 | 16×16 | `combat_hero_attack` after `STRIKE_DELAY_MS` (`TokenHitArt.jsx:61-73`) |
| **Knockout poof** | An enemy beaten | 5 | 32×32 | `COMBAT_RESOLVED` |
| **Level-up sparkle** | A hero levels | 4 | 16×16 | `HERO_LEVELED` |
| **Rare shine** | A rare item on the floor | 4 | 16×16 (over a 32×32 item) | Floor loot (`SpriteLayerView.jsx`) |
| **Loot glint** | Ordinary floor loot, now and then | 3 | 8×8 | Floor loot; optional, may be too busy |
| **Used-up crumble** | A node worked to its last charge | 4 | 64×64 | `TOKEN_DEPLETED`. Most art; lowest priority |

**What the code side needs (later, not now):** one small "play a sprite strip
once at this mat point" player, like the hero and enemy frame stepper
(`AnimatedHeroSprite.jsx:57-76`), and a sheet-grid entry for the new folder.
⚠️ The spriteFx generator outlines every sprite outside `assets/ui/`
(`spriteFx.js:77-80`), so a new effects folder (for example `assets/fx/`) must be
added to its skip list or it will generate pointless outline images.

## 5. Suggested first pick

If the owner wants a small, cheap first batch that already follows the pops
rules: **1** (crisp hits), **3** (completion blink), **5** (crisp Hall flight,
which should also make loot bursts cheaper), **13** (white hit frame), **12**
(level-up hop), **16** (build drop). Then the first art: **falling leaves**,
**rock chips** and **dust puff**, which cover the three most-seen strikes.
