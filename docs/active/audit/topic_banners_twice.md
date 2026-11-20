# Topic: news told twice (banners and the away summary)
*Telling the player group (A42, A43). Read at tag audit-build (1c04f5f6),
interviewed with the owner 2026-11-20 in two rounds. From S0's note on A42,
"banners built twice (live and after time away)".*

## The rule (owner, 2026-11-20)

- **News is told once.** After "While you were away" closes, only what
  **still needs the player** stays up as a banner: the Bank or a stack still
  full, an event still standing. New recipes and knock-outs are not replayed;
  the summary is their record.
- **Problem banners clear themselves once fixed** (Bank full, stack full),
  or when clicked. Milestone banners (new recipe, new hero, guild upgrade,
  place settled) stay until clicked, as now. The same rule as the speech
  bubbles in the silent moments topic.
- **Every time away opens the summary**, however short: no 2-minute line.
- **Time away means the game was closed or the PC slept**, not a minimised
  window (owner: "it shouldn't be happening while the game is minimized. The
  time away is meant for when the game is closed or the PC sleeps"). A
  minimised game keeps playing live. How to make that so is for **A41 Time
  away and saving**; its STATUS row carries it.

## What the game does today

- Live, banners drop in at the top for milestones and problems (recipe, hero,
  upgrade, settled, knockout, bankFull, stackFull, event, save), each until
  clicked, three on screen.
- A gap of 2 minutes or more catches up with the loading bar and the summary;
  a shorter one (a background window woken about once a minute) plays quietly
  and hands its news straight to banners.
- After the summary closes, all its news is pushed again as banners: every
  recipe row, every knock-out, every Bank-full and stack-full item, and the
  events still standing. So each piece is read twice, in two wordings (the
  summary's own strings and the banner kinds').

## What it became

- **T-506**: news told once: after the summary, only open problems and standing events stay as banners; every time away opens the summary; the summary and the banners take their words from one writer.
- **T-507**: problem banners clear themselves once fixed.
- A41 Time away and saving: the ruling that a minimised game keeps playing and time away is for a closed game or a sleeping PC.

Both tickets blocked on the Telling the player group.

## Evidence

- Banners stay until clicked, three shown → `src/systems/notifications/banners.js:1-15`
- Banner kinds and their titles → `src/systems/notifications/bannerKinds.js`
- The summary's news collector → `src/systems/notifications/catchUpNews.js:8-60`
- Summary closed → news pushed again as banners → `src/systems/notifications/routing.js:186-220, 330-362`
- The 2-minute line, quiet below it → `src/config/loopConstants.js:40-43`, `src/systems/core/CatchUp.js:413`
- Summary strings → `src/i18n/en.json` `catchUp.news`
