# Session C: runtime certification, the owner's checklist

*Round-3 code review, Session C (plan `code_review_v3_master_plan.md` §4.2–4.4, §5 "C", §10).
Prepared 2026-09-29 by a subagent for the director. **The owner runs it on their own PC**
(owner ruling, §10). Nothing in this file was run in a browser; see "What I could not
check" at the end.*

---

## How this works, in plain language

- **Why:** the review measured speed on an agent's hidden, throttled browser, with other
  agents using the same computer. Those numbers only compare one change against another.
  **Your PC, in a real window, is the reference** (ruling Q2). This checklist produces the
  "before" numbers that every speed fix will be judged against.
- **Time:** about **25 minutes** for Parts 0 to E. Part F (3 minutes) and Part G (the
  60-minute soak) are optional and can be done another day.
- **Many steps are meant to fail today.** Each step has a label:

  | Label | Meaning |
  |---|---|
  | **[MEASURE]** | Press **Copy report** and paste the numbers. Nothing to judge yourself. |
  | **[BUG]** | Confirms a bug the review found by reading the code. **We expect it to go wrong today.** "Yes, it went wrong" is a useful answer. |
  | **[WORKS]** | Confirms something works. We expect it to be fine. |
  | **[LOOK]** | Note how it looks today, so you can compare after the speed fixes. |

- **A failed frame target today is not a problem with your PC.** It is the starting line.
  In the agents' test runs the busy board fitted its frame budget only 38–59 % of the time
  (the target is 99 %).
- **Your saves:** the stress boards (Parts A to C) never write to a save slot. Part D uses
  your own game but puts things back. Part E makes a new game in an **empty** slot and you
  delete it at the end. Nothing touches `data/` or the art.
- Each step has an id (A1, B3 …). Use them when you paste results back.

---

## Part 0: Before you start (about 4 minutes)

**0.1 Quiet the PC.** Close games, video, other browser windows, and anything that renders
(OBS, Discord overlay). **Make sure no Claude agent is working in the background** while you
measure: agents running benchmarks share your processor and graphics card and spoil the
numbers (that is what happened to the review's own measurements).

**0.2 Check your screen's refresh rate.** Windows 10: Start → Settings → System → Display →
**Advanced display settings**. Look at "Refresh rate". If the list offers **165 Hz**, choose
it. Write the number down; you will paste it at the end.
*Why: a screen only shows as many frames as its refresh rate. On a 60 Hz screen the game can
never show more than 60 a second, whatever the code does. The report copes with that (it
also measures how long each frame took to make), but we need to know.*

**0.3 Open a terminal in the project folder.** In File Explorer, go to
`C:\Users\16048\Projects\fantasy_guild_v2`, click the address bar at the top, type
`powershell` and press Enter. A blue or black window opens, already in the right folder.

**0.4 Note which version of the code you have.** In the terminal, type:

```
git log -1 --oneline
```

It prints one line, like `2e2b572 Bench: identical-results gate …`. **Copy that line** for
the paste-back. This command only reads; it changes nothing. *(Why: the numbers belong to
the exact code they were measured on. If the director asked you to be on `main`,
`git branch --show-current` should print `main`.)*

**0.5 Choose how to run the game.**

- **(A) Recommended: the browser, Microsoft Edge or Chrome.** Edge is built on the same
  engine as the desktop app's window (WebView2), so the numbers are representative (plan
  §2.C). You switch boards by typing in the address bar, and every step below is written
  for it.
- **(B) The desktop app.** It is the real thing the players get, but switching boards means
  typing one line into a hidden developer window (0.9). Choose this if you prefer it; the
  steps work the same.

The browser and the desktop app **keep separate saves.** Your own games are in whichever
one you normally play in (this matters in Parts D and E).

**0.6 Start the game.** Type **one** of these into the terminal and press Enter. Do not run
both: the desktop app starts its own copy of the first.

| Choice | Type | You should see |
|---|---|---|
| (A) browser | `npm run dev` | After a few seconds: `VITE … ready` and `Local: http://localhost:5173/`. Leave the terminal open. Open Edge (or Chrome) and go to **`http://localhost:5173/`**. |
| (B) desktop app | `npm run tauri:dev` | Lines about compiling. **The first time can take several minutes**, because the app is rebuilt. Then a window called **Fantasy Guild** opens, maximised. Leave the terminal open. |

If the terminal shows a different address such as `localhost:5174`, an old copy is still
running. Close the other terminal windows, then try again. (Or use that number instead of
5173 everywhere below.)

**0.7 Window size.** **Maximise** the game window (the square button at the top right; not
F11 full screen). In the browser press **Ctrl+0** so the zoom is 100 %. Use the same window
for every run, and keep it in front.

**0.8 Check it is the developer build.** You should see the **SYSTEM BOOT** slot picker, and
at the bottom right two round yellow buttons, **QA** and **TUNER**. That is all "developer
mode" needs: **no setting to switch on.** If QA and TUNER are missing, you opened the
installed game instead of the one from step 0.6.

**0.9 How to switch boards.** Four places are used below:

| Board | Browser: type in the address bar | Desktop app: see below |
|---|---|---|
| Busy board (S2) | `http://localhost:5173/?stress=realistic` | `location.search='?stress=realistic'` |
| Torture board (S3) | `http://localhost:5173/?stress=torture` | `location.search='?stress=torture'` |
| Quiet board (S1) | `http://localhost:5173/?stress=quiet` | `location.search='?stress=quiet'` |
| Your own game | `http://localhost:5173/` | `location.search=''` |

**In the desktop app:** press **Ctrl+Shift+I**. A developer window opens. Click its
**Console** tab, type the line from the right-hand column exactly, press **Enter**, then
close the developer window with **Ctrl+Shift+I** again (or its X). **Leave it closed while
measuring;** it slows the game.
*Backup, if Ctrl+Shift+I does nothing:* load any save, then **QA → Performance → S2
Realistic** (or S1 Quiet, S3 Torture). Answer **OK** to "Replace this game with a stress
board?" (your game is saved first and not touched). If the HUD's `react/s` line then says
"off", press **F5**, load the save again and press the same button again.

---

## The Perf HUD, in brief

A black box at the **bottom left**. The lines that matter:

```
PERF HUD  S2 realistic  ·  62 s              ← which board · seconds since Reset
frame Δ   p50 6.06 … ~165 Hz                 ← the refresh rate it sees
  over 6.06: 120 … 16.7: 3 of 10,000  (98.8% ≤ 6.06)   ← THE main number
frame work p50 2.10 …                        ← time to make a frame (works on any screen)
LoAF 3  max 72 ms                            ← freezes over 50 ms (you'd see a stutter)
tick …                                       ← the game rules, 10 times a second
react/s  mat 0.5  dock 1.0 …                 ← screen redraws a second
events/s … DOM 2,140  heap 84 MB             ← leak signs (for the soak)
```

Buttons: **Copy report**, **Reset**, **Hide**. After Copy report it says
**"Copied ✓ — paste it into the chat"**. If the title shows **⚠ hidden**, the window was
minimised or covered, and those numbers don't count: press Reset and start that wait again.

You may also see a small FPS counter elsewhere. Ignore it; the HUD is what counts.

---

## Part A: the frame-rate certification (about 10 minutes, hands off)

**A1 [MEASURE] Open the busy board.** Go to the S2 address (0.9).
*You should see:* the slot picker closes by itself; a busy board with **8 heroes**, about
100 Tokens and a few enemies walking; the HUD at the bottom left, its title starting
**PERF HUD S2**. If the `react/s` line says "off", press **F5** once.

**A2 Let it settle.** Wait **30 seconds**. Press **Reset** on the HUD. Then move the mouse
**off the game** (onto the Windows taskbar) and leave it there. Hovering over the board makes
extra work.

**A3 [LOOK] Watch for 5 minutes, hands off.** Wait until the HUD's seconds reach **300**.
Don't touch anything, but use the time to look (these are the review's eye-checks, R6 §1;
today's look is the reference for later):

- **L1** Walking heroes and walking enemies: does the pixel art stay **sharp while moving**,
  not soft or blurry? If a speech bubble appears, does it sit **above the head and move with
  it**?
- **L2** The progress rings around Tokens being worked: do they **sweep smoothly**?
- **L3** A hero working a Token: does the hero's swing land **in time with the Token's
  little shake**?
- **L4** Only if you happen to see one: a hero who lost a fight **limps home noticeably
  slower** than heroes walk.

**A4 [MEASURE] Copy report.** Press **Copy report**, then paste it into the chat, starting
your message with **"A4 S2"**. (Switching to the chat is fine now; the numbers are copied.)

**A5 [MEASURE] Open the torture board.** Go to the S3 address (0.9). It takes a couple of
seconds to build about 320 Tokens. Wait **30 seconds**, press **Reset**, mouse to the
taskbar, and wait until the HUD reads **180** seconds (3 minutes).

**A6 [BUG] CR3-250, a kill with a whole-board buff.** While A5 runs, find a hero fighting a
walking enemy (they fight when one comes close). **At the moment the enemy disappears, does
the whole board freeze for a split second?** *The review measured a 0.1–0.2 s stall per kill
on this board.* Answer yes / no / didn't see a fight.

**A7 [MEASURE] Copy report** and paste it, starting with **"A7 S3"**.

### What "pass" looks like (plan §4.4, in plain words)

| What | Where on the HUD | Busy board (S2) passes when… | Torture board (S3) passes when… |
|---|---|---|---|
| Frames fit the 165 Hz budget | line 3, "(NN.N% ≤ 6.06)" | **99.0 or more** | **95.0 or more** |
| No big stutters | line 3, "16.7: N of T" | N is at most **1 in 1,000** of T | (no target) |
| No freezes | line 5, "LoAF N" | **0** | (no target) |
| The mat doesn't redraw for nothing | line 7, "mat" | **1 or less** a second | (no target) |

- **On a 60 Hz screen** line 3 always reads near 0 %. That is the screen, not the game.
  Ignore it; the agent reads the "frame work" numbers from the report instead.
- **This is a developer build**, which is slower than what players get. A near miss means
  "re-check on a faster build", not "fail" (P3's question P3-Q2).
- **What we expect today:** both boards fail. The review measured S2 at 38–59 % and S3 at
  0–2 %, and the "mat" counter at about 40 a second. It over-counts (CR3-356), and heroes
  animating push it up (CR3-301).
- The game-rules targets (a tick under 1.5 ms) are measured separately, without a screen
  (Part F).

### If the HUD doesn't appear

1. Check the address ends **exactly** `?stress=realistic`, and the port matches the terminal
   (5173).
2. Wait 10 seconds; the torture board takes a moment to build.
3. Open **QA** (bottom right) → **Performance (dev only)** → **Toggle Perf HUD**.
4. No QA button at all? You're not on the developer build (step 0.8).
5. Still nothing: press **F12** (browser) or **Ctrl+Shift+I** (desktop app) → **Console**,
   type `__perf.showHud()` and press Enter. If it answers in red ("… is not defined"), copy
   the red text into the chat and stop there.
6. **Copy report says "Copy failed"**: in that same Console, type
   `copy(JSON.stringify(__perf.report(), null, 2))`, press Enter, then paste into the chat as
   usual.

---

## Part B: hands-on, on the busy board (about 5 minutes)

Go to the S2 address again, for a fresh board. You may use the mouse from now on.

**B1 [MEASURE] CR3-400, the cost of picking up.** Wait 30 s and press **Reset**. Pick up a
Token and drop it somewhere else on open ground, **10 times**, at a normal pace. (A drop on a
crowded spot may fly back. That is by design: a drop never pushes.) **Copy report** → paste
as **"B1"**, and say whether a pickup or a drop ever looked like a hitch.

**B2 [MEASURE] CR3-400, crossing the dock.** Press **Reset**. Carry one Token slowly back and
forth over the hero figures in the dock at the bottom for about 10 seconds without letting
go, then drop it back on the mat. **Copy report** → **"B2"**.

**B3 [BUG] CR3-402, a drop over the Bank's header.** Open the **Item Bank** (the yellow orb,
left edge). Drag a Token from the part of the mat you can still see and let go over the
Bank's **header or search row** (not the grid of items). *Expected today: the Token vanishes
from its old place. Close the Bank: it is on the mat, under where the drawer was. Correct
would be: it flies back.* Did it land under the drawer? Yes / no.

**B4 [WORKS] The Bank's item grid (the control).** Same again, but let go over the **grid of
items**. *It should fly back, with the soft "no" sound if your sound is on.*

**B5 [BUG] CR3-450, the hero sheet beside the Bank.** With the Bank still open, the column
beside it shows your heroes as tabs. Click one: their sheet slides out. Now:
- click somewhere **inside the sheet** that is not a button (a skill row, say).
  *Expected today: the sheet closes at once;*
- open it again and click the **pencil (Edit)** icon. *Expected today: the sheet closes and
  the edit window never opens;*
- open it again and click the **same hero tab** again. *Expected today: it stays open.*

Answer yes / no for each. Then close the Bank.

**B6 [BUG] CR3-402, a drop over the Shop.** Open the **Shop** (the green orb). Drag a **mat
Token** (not a Shop row) and let go over the Shop drawer. *Expected today: it moves to the
mat under the drawer. Correct would be: it flies back.* Close the Shop.

**B7 [BUG] CR3-402, a drop over the hero sheet.** Click a hero in the dock to open their
sheet. Drag a **flag** on the mat and let go over the sheet. *Expected today: the flag is
planted on the mat under the sheet.* Close the sheet.

**B8 [BUG] CR3-300, stale HP bars in the dock.** Open **QA** and press **🩸 Drain 9 HP
(All)** three times. Watch the small HP bars on the heroes in the dock. *Expected today: they
don't shrink straight away; they catch up late (when a hero changes what it's doing) or not
at all.* Answer: at once / a few seconds later / not at all. Close QA.

---

## Part C: hands-on, on the quiet board (about 5 minutes)

Go to the S1 address (one hero, a few Tokens). A small board keeps the mat-size change in C6
from freezing the game.

**C1 [WORKS] Escape on the mat.** Wait until the hero is working a Token. Drag **that**
Token and press **Esc** mid-air. *It flies back to exactly where it was, and the hero keeps
working it.*

**C2 [WORKS] Dragging a hero moves the flag.** Drag the hero standing on the mat. *Only the
flag follows the cursor; the hero stays, then walks to the new flag.* Now drag the flag onto
the dock. *The hero is called back.*

**C3 [BUG, suspected] CR3-412, a quick flick.** Press on a Token, flick about 1 cm and
release at once. Do it 5 times. *Does it land where you let go, or slightly short, towards
where you pressed?* (The review only suspects this one.)

**C4 Disallow mode.** Click **⊘ Disallow mode** in the top bar (a red edge appears round the
mat).
- **[WORKS]** Try to drag a mat Token, the flag and the hero on the mat. *None should lift.*
- **[BUG] CR3-409:** drag the hero **from the dock** (it lifts) and press **Esc** mid-drag.
  *Expected today: Disallow mode also switches off.* Yes / no.
- Afterwards: if Disallow mode is still on, click it off. If **Allow all** shows a number,
  press it (your attempts may have flipped a Token).

**C5 [LOOK] CR3-010, the first loot sparkle.** Open **QA**, press **✨ Scatter Loot (burst)**,
close QA. Wait **10 seconds** with nothing flying. Then move the mouse across one of the
scattered items. *It is collected and flies off with its sparkle **straight away**, with no
pause.*

**C6 [WORKS] Pointer accuracy at other mat sizes.** Open **TUNER** (bottom right). Under "The
mat", set **Mat size** to **6**.
- Drag a Token to an exact spot (for example touching the flag's pole). *It lands centred
  under the cursor.*
- Set Mat size to **20** and repeat.
- *Browser only:* un-maximise the window and drag its corner to make it small (the mat
  tiny). Repeat once. Maximise again. (The desktop app won't go that small.)
- **Put Mat size back to 11** (or to your own value, if you had changed it before).

---

## Part D: in your own game (about 3 minutes)

Go to your own game (0.9) and load the save you use for testing (slot 3, if that is still
your test save). **Skip any step you can't set up**; say "skipped".

**D1 [BUG] CR3-451, the upgrade panel's Close.** Click the **Guild Hall** (the purple orb).
Click any upgrade. A panel shows it, with a small **X** at its top right. Click the X.
*Expected today: the same upgrade stays on show; nothing closes.* Then **Return to Playmat**.

**D2 [BUG] CR3-405, a refused equip sounds like a success.** Open the Item Bank and drag an
item onto a dock hero who **already wears that same item** (or whose slots are all full).
*Expected today: the equip sound plays, the hero's sheet opens, nothing changes, and no
message says why. Correct would be: a message, and the item flies back.*

**D3 [BUG] CR3-409, Escape while dragging out of the hero sheet.** Click a dock hero with
equipment to open their sheet. Start dragging an item **out of one of their slots**, and
press **Esc** before letting go. *The drag cancels.* Did the **sheet close too** (expected
today: yes)? Did the item's fly-back look right?

**D4 [MEASURE] CR3-401, a crowded drag near a Coast.** Only if your mat has a **Coast** or
**Shrimp Coast**. Press **Reset** on the HUD (it will be showing in your game now). Carry
that Token slowly over the thickest cluster of Tokens you can find for about 10 seconds,
then drop it back where it was. **Copy report** → **"D4"**, and say whether the ring or the
ghost stuttered.

---

## Part E: a new game's first save (about 3 minutes)

*CR3-100: the save that claims a new slot is written **before** the Guild Hall and the
starting Tokens exist. The next save is 10 minutes later. So a crash in the first 10 minutes
could leave a slot with an empty table and no Guild Hall.*

**You need an empty slot** ("Slot N — Empty"). If all three slots hold games you care about,
**skip Part E**. Don't delete a real save for this.

**E1 [BUG] A crash in the first minutes.** Go to your own game (0.9). At the slot picker,
press **New Game** on an empty slot. Wait until you see the **Guild Hall**, a **Forest** and a
**Mine** on the mat. Within the next 2 minutes, crash it on purpose:
- *Browser:* press **Shift+Esc** (the browser's own Task Manager). Select the line for the
  game's tab and press **End process**. The tab shows a crash page; press **Reload**.
- *Desktop app:* click the terminal and press **Ctrl+C** (answer **Y** if asked "Terminate
  batch job?"). The window disappears. Run `npm run tauri:dev` again.

At the slot picker, press **Load Sync** on that slot. What do you see?
- (a) an empty mat, no Guild Hall: **the bug, confirmed**;
- (b) the Guild Hall, the Forest and the Mine: fine;
- (c) the slot says "Empty": the save never reached the disk (tell us).

**E2 (desktop app only, optional) A normal close.** Delete the slot from E1 first (bin icon
→ **Confirm**). **New Game** in it again, wait for the Guild Hall, then close the window
normally with its **X** within 2 minutes. Run `npm run tauri:dev` again and load the slot.
Is the Guild Hall there? *(Nobody knows yet whether the desktop app saves when its window
closes. If it doesn't, a normal close also loses a new game's start.)*

**Clean up:** delete **only the slot you made** (bin icon → **Confirm**).

Then press **Hide** on the HUD if you don't want it showing in your games. (It stays on after
a reload until you hide it.)

---

## Part F (optional, 3 minutes): the engine benchmark on a quiet PC

The game-rules numbers in plan §4.4 are measured without a screen. The review's run was taken
while agents were using the computer, so a quiet run on your PC is worth more.

**F1 [MEASURE]** With the game closed (in the terminal, **Ctrl+C** to stop it) and nothing
else running, type:

```
npm run bench
```

It takes about 3 minutes and prints a table. Copy everything from the table's header row
down to the end, and paste it as **"F1"**. *(Don't add `--save-baseline`; the director
decides which run becomes the reference.)*

---

## Part G (optional, 60 minutes): the soak test

*It checks whether anything slowly piles up (memory, page elements, listeners) over an hour.
It also settles CR3-039, whether toasts leave page elements behind.*

**G1 Prepare.** Close other programs (0.1). Stop Windows sleeping or locking for an hour:
Settings → System → **Power & sleep** → set both "Screen" and "Sleep" to **Never** (note what
they were; put them back afterwards). Open **Notepad** and make it small, in a corner, so
it **does not cover the whole game window**. A fully covered window counts as hidden.

**G2 Start.** Go to the S2 address. Wait 30 seconds, press **Reset**, and move the mouse to
the taskbar. **Don't press Reset again** until the end.

**G3 At 5 minutes** (HUD ≈ 300 s): **Copy report**, click Notepad, paste under a line "5 min",
then click the game window's **title bar** (not the board) to bring it back.
*Optional, the stronger memory check:* press **F12** (desktop app: Ctrl+Shift+I) → **Memory**
tab → click the **bin icon** ("Collect garbage") → wait 5 s → write down the size shown next
to the page in the list at the bottom (like "58.3 MB") → close the tools with the same key.

**G4 At 30 minutes** (≈ 1,800 s): Copy report → paste under "30 min".

**G5 At 60 minutes** (≈ 3,600 s): Copy report → paste under "60 min". Repeat the optional
bin-icon reading.

**G6** Paste all three reports (and the two memory numbers, if taken) into the chat as
**"G soak"**. If the HUD ever showed **⚠ hidden**, say so. The leak numbers are still useful.

*Passes when (plan §4.4):* page elements (DOM) and listeners at 60 minutes are within ±2 % of
the 5-minute numbers, and the after-clean-up memory is no more than 5 % higher.

---

## What to paste back

Paste the reports as you go (each starting with its id). At the end, copy this block, fill it
in and paste it:

```
SESSION C RESULTS
Date:
Code (step 0.4):
Ran in: Edge / Chrome / desktop app
Screen refresh rate (0.2): ___ Hz
Other programs closed, no agents running: yes / no

A4 S2 report ........ pasted / not
A7 S3 report ........ pasted / not
L1 sharp while walking: yes / no      bubbles follow the head: yes / no / none seen
L2 rings sweep smoothly: yes / no
L3 swing in time with the Token's shake: yes / no
L4 defeated hero limps slower: yes / no / didn't see
A6 freeze when an enemy dies: yes / no / didn't see a fight

B1 report pasted; any hitch on pickup/drop: yes / no
B2 report pasted
B3 Token landed under the Bank: yes / no
B4 flew back from the Bank grid: yes / no
B5 sheet closed on a click inside: yes / no   pencil failed: yes / no   tab won't close it: yes / no
B6 Token landed under the Shop: yes / no
B7 flag planted under the hero sheet: yes / no
B8 dock HP bars moved: at once / seconds later / not at all

C1 Esc: flew back and hero kept working: yes / no
C2 only the flag moved; flag on dock recalled the hero: yes / no
C3 flick landed short: never / sometimes (__ of 5)
C4 nothing lifted in Disallow mode: yes / no   Esc also ended Disallow mode: yes / no
C5 first sparkle appeared at once: yes / no
C6 landed under the cursor at 6: yes / no   at 20: yes / no   tiny window: yes / no / skipped

D1 upgrade panel X did nothing: yes / no / skipped
D2 refused equip made the equip sound with no message: yes / no / skipped
D3 Esc also closed the sheet: yes / no / skipped   fly-back looked right: yes / no
D4 report pasted / skipped (no Coast); ring or ghost stuttered: yes / no

E1 after the crash: (a) empty mat / (b) Hall there / (c) slot empty / skipped
E2 (desktop) after a normal close, Hall there: yes / no / skipped

F1 bench table pasted / skipped
G soak pasted / skipped

Anything else odd:
```

---

## Not checkable by hand today

- **CR3-028** (an input-cost discount is checked only when paying): no shipped Token uses an
  input-cost effect (R10's census), so nothing on screen can show it. It stays "confirmed by
  reading", with R3's test to write.
- **§4.4 "Idle drawing"** (an empty mat does no drawing work): R6 already measured that it
  fails (the particle canvas never sleeps, CR3-010; the dev FPS counter, CR3-358). An agent
  can re-measure it headless (below). It isn't worth the owner's time.

---

## For the director

### Where each §4.4 row gets its number

| §4.4 row | Source | Report field |
|---|---|---|
| Engine tick S2: p99 ≤ 1.5 ms, max ≤ 4 | F1 (or the director on a quiet machine) | bench table, S2 |
| Engine tick S3: p99 ≤ 4 ms | F1 | S3 |
| Push solver S4: every drop or shrink ≤ 8 ms | F1 | S4 worst arrival / landing drop / refused drop / shrink |
| Frames S2: ≥ 99 % ≤ 6.06 ms, p99.9 ≤ 16.7, 0 LoAF > 50 ms | A4 | `frames.pctAtOrUnder['6.06ms']` (165 Hz screen) or `frameWork.pctAtOrUnder['6.06ms']` (slower screen, see `env.refreshHzEstimate`); `frames.p999`; `longAnimationFrames.count` |
| Frames S3: ≥ 95 % | A7 | same fields |
| React S2 "working, not walking" ≤ 1/s and "walking causes none" | A4, as-is | `react.surfaces.MatBoard.perSecond`. ⚠ Not separable on a stress board (heroes walk constantly), and the counter counts the whole mat subtree (CR3-356). Record the number, mark it "not measurable as specified" until CR3-356 adds a MatBoard-only probe. |
| Idle drawing | not in the owner's list | known fail (R6: CR3-010, CR3-358); re-measure headless |
| Memory S6, 8 h headless | P2 already: +0.3 % ✓ | `npm run bench -- --long` to repeat |
| Memory soak, 60 min | G | `dom`, `listeners` at 5 vs 60 min; the bin-icon memory readings |
| Every row | | Check `window.representative` is `true` and `window.hiddenSeconds` < 1; otherwise that run doesn't count. |

### Which tickets this confirms by running

| Ticket | Step | Filed confidence | Today's expected result |
|---|---|---|---|
| CR3-300 dock HP bars stale | B8 | measured (preview pane) | bars lag or don't move |
| CR3-450 Bank-side hero sheet closes | B5 | reasoned | closes on first click |
| CR3-451 upgrade panel Close | D1 | reasoned | nothing closes |
| CR3-402 drop over a drawer lands underneath | B3, B6, B7 (B4 = control) | reasoned | lands underneath |
| CR3-405 refused equip sounds like success | D2 | reasoned | equip sound, no message |
| CR3-409 Escape also closes sheet / disallow | C4, D3 | reasoned | both close |
| CR3-412 flick lands short | C3 | suspected | maybe |
| CR3-400 pickup re-renders every draggable | B1, B2 | reasoned | `react.surfaces.MatBoard.maxMs` > 6 on pickup |
| CR3-401 crowded drag near a Cannot rule | D4 | reasoned | LoAF during the drag |
| CR3-100 new game's first save is empty | E1 (E2 answers R1's open Tauri question) | reproduced headless | empty mat |
| CR3-250 kill stall with an aura | A6 | measured headless | a visible freeze |
| CR3-039 toast DOM leak | G | undecidable by reading | DOM count creeps up, or doesn't |
| CR3-350 / CR3-007 / CR3-351 / CR3-301 / CR3-010 look | L1–L4, C5 | look reference | fine today; compare after fixes |
| R7 handoff: pointer maths at 6 / 20 / tiny | C6 | by construction | works |
| CR3-028 | none | by reading | not visible (no content) |

### Setup facts checked in the code (2026-09-29, `tool/bench-gate` at `2e2b572`)

- `npm run dev` is `vite` (port 5173, or `PORT` from the environment; not strict, so a
  busy port moves it to the next). `npm run tauri:dev` is `tauri dev`. Its
  `beforeDevCommand` is `npm run dev`, and it opens `http://localhost:5173` in a
  1600×1000 window, **maximised** (`src-tauri/tauri.conf.json`). So the two must not run
  together.
- A Rust toolchain is installed (`~/.cargo/bin`), and a debug build from 2026-08-22 exists
  in `src-tauri/target/debug`. The next `tauri:dev` will recompile, which takes several
  minutes.
- Stress names (`stressScenarios.js`): `quiet`, `realistic`, `torture`, `push`, `rebuild`,
  or `S1`…`S5` (case-insensitive), plus the aliases `quiet-hall`, `push-storm`,
  `rebuild-storm` and `late`.
- HUD buttons (`perfHud.js`): **Copy report**, **Reset**, **Hide**. Status texts: "Copied ✓ —
  paste it into the chat" and "Copy failed — use window.__perf.report()". The HUD is fixed at
  the bottom left.
- QA panel (`PerfDevSection.jsx`): section **Performance (dev only)**, **Toggle Perf HUD**,
  **S1 Quiet … S5 Rebuild**, and the confirm dialog "Replace this game with a stress board?
  …" (shown only when a slot is loaded). The QA and TUNER buttons show whenever
  `import.meta.env.DEV`, so no Debug Mode is needed.
- The React Profilers arm only at page load (`?stress=`, `?perf=1`, or a remembered HUD).
  So a scenario started from the QA panel in a fresh page shows `react/s off` until a
  reload. That is why the backup route in 0.9 reloads.
- The slot picker is a Headless UI v2 dialog (`GIModal`, z 300). Headless UI makes the rest
  of the page inert, so **QA probably can't be clicked while the slot picker is open**.
  This is inferred, not observed, and it is why the backup route loads a save first.
- The game blocks the right-click menu (`main.jsx:41`), so in the desktop app DevTools can
  only be opened by keyboard.
- **Saves live in `localStorage`** (`SaveManager.js`). The browser at `localhost:5173` and
  the desktop app's WebView2 keep separate saves.
- `🩸 Drain 9 HP (All)` mutates `hp.current` in place and publishes `heroes_updated`, which
  is exactly R5's CR3-300 repro.
- Loot is collected by **hovering** it (`SpriteLayerView.jsx:28`).

---

## For unattended agent runs: real frame numbers without the owner

*The preview pane cannot measure frames, and screenshots time out there. R6 got real frame
numbers from **headless Chrome driven over the DevTools protocol**. This is that method as a
procedure. Every number it gives is "headless Chrome, dev build, not representative". Only
before/after comparisons from it count; the owner's real window certifies.*

**Why the pane fails:** it is hidden, so `document.hidden` is true and `requestAnimationFrame`
never fires (R6: 0 frames in 2 s, even with the tab fronted). `__perf.report()` then has no
frames. The pane is still fine for checking the plumbing, for `__perf.drive(n)` (it pushes
ticks through the real `GameLoop.runHandlers`), and for **counts** that don't depend on
timing (commits per driven tick, event counts).

1. **Quiet the machine.** No other agent benchmarking or running spikes at the same time.
   If that can't be avoided, say so next to every number. R6's two batches, an hour apart,
   had different baselines.
2. **Serve the tree you want to measure.**
   - *The main checkout:* use the existing server (the preview tool's `dev` entry in
     `.claude/launch.json`, port 5173, `autoPort`). The server is fine; only the pane's
     drawing is throttled. Point headless Chrome at the same URL.
   - *A throwaway worktree, or any second server:* **give it its own Vite dependency
     cache.** Two servers that share `node_modules/.vite` (as a junctioned worktree does)
     rewrite each other's pre-bundled dependencies. The page, and the main server too, then
     gets **504 "Outdated Optimize Dep"**. R6's fix: a spike-only config file in the
     worktree that imports the real `vite.config.js` and overrides only `cacheDir` (for
     example `node_modules/.vite-spike-<name>`), started with `vite --config <that file>`
     on its own port (`PORT` works too). Never commit that file. Delete it and its cache
     folder afterwards. When removing the worktree, **remove the `node_modules` junction
     first with `cmd /c rmdir`**, or the real packages go with it (plan §10).
   - Wait until `http://localhost:<port>/` answers. Use `localhost`, not `127.0.0.1`: Vite
     may listen on IPv6 only.
3. **Start headless Chrome** (`C:\Program Files\Google\Chrome\Application\chrome.exe`; Edge
   is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) with:
   - `--headless=new --remote-debugging-port=<free port>`;
   - `--user-data-dir=<a folder in your scratchpad>`. Recent Chrome refuses remote
     debugging on the default profile, and a scratch profile keeps the owner's saves and
     their `fg_perf_hud` setting out of it;
   - `--window-size=1600,900 --force-device-scale-factor=1` (R6's size). Keep it identical
     across every run you compare;
   - `--disable-background-timer-throttling --disable-renderer-backgrounding
     --disable-backgrounding-occluded-windows`, as belt and braces;
   - **not** `--disable-gpu`. R6's runs used the real GPU (RTX 3060 via ANGLE/D3D11), and
     the graphics process turned out to be the S2 bottleneck (CR3-350).
4. **Connect.** `GET http://localhost:<debug port>/json/version` gives `webSocketDebuggerUrl`.
   Node 24 has a built-in `WebSocket` (the repo also has `ws`), so a short script in the
   scratchpad needs no install. `Target.createTarget` (`about:blank`), then
   `Target.attachToTarget` with `flatten: true`, then `Page.navigate` to
   `http://localhost:<port>/?stress=realistic` (or `torture`, …).
5. **Wait for the board.** Poll `Runtime.evaluate` of `window.__perf?.running === true`
   (`returnByValue: true`), with a 60 s timeout. S3 builds in about 2 s.
6. **Settle, then measure.** Wait 20 s, call `__perf.reset()`, and wait 30 s (R6's window;
   use 300 s to match the owner's certification). Then `Runtime.evaluate` of
   `JSON.stringify(__perf.report())` with `returnByValue: true`, and save it in the
   scratchpad.
7. **Reject bad runs.** Keep a run only if `window.representative === true`,
   `window.hiddenSeconds < 1`, `frames.count > 0` and `react.armed === true`. Note
   `env.userAgent` (it says `HeadlessChrome`) and `env.build`.
8. **Optional: where the frame time goes (R6 §3).** Record a 5 s trace with `Tracing.start`
   (`transferMode: 'ReturnAsStream'`, categories `devtools.timeline`,
   `disabled-by-default-devtools.timeline`, `disabled-by-default-devtools.timeline.frame`,
   `toplevel`, `blink`, `cc`, `gpu`, `viz`, `v8.execute`), then `Tracing.end`, and read the
   stream with `IO.read` until `eof`. Offline:
   - group complete events by process and thread (the `thread_name` metadata:
     `CrRendererMain` is the page's main thread, `Compositor` its compositor thread,
     `CrGpuMain` / `VizCompositorThread` the graphics process);
   - sum each event name's self time and bucket it: script (`FunctionCall`,
     `EvaluateScript`, `TimerFire`, `FireAnimationFrame`, `RunMicrotasks`), style
     (`UpdateLayoutTree`), layout (`Layout`), paint (`PrePaint`, `Paint`, `PaintImage`),
     compositing (`Layerize`, `PaintArtifactCompositor::Update`, `UpdateLayer`, `Commit`);
   - "graphics process busy" is the top-level task time on its main thread ÷ 5 s.

   ⚠ Event names drift between Chrome versions. List the top 30 names by total time first,
   map them, and write down the mapping you used.
9. **Before/after comparisons.** Put the variants behind a URL switch (`?spike=…`) on
   **one** server in the throwaway worktree. Run them interleaved (A B B A: two rounds, the
   second in reverse order), with the same window size, and compare only within one batch.
10. **Clean up.** Send `Browser.close`, then check that no `chrome.exe` using your
    `--user-data-dir` is left running. An orphaned headless Chrome keeps the GPU busy and
    spoils the next run. Stop any server you started, and delete the scratch profile.
11. **Label every number** "headless Chrome, dev build, <date>, machine load: …, not
    representative", and give the stress board, window size and batch.

---

## What I could not check (the owner or the director must confirm)

- **The desktop app's keys.** Nobody has checked that **Ctrl+Shift+I** opens the developer
  tools and **F5** reloads in the `tauri:dev` window. Both are WebView2 defaults in debug
  builds. The 0.9 backup route and "close and run it again" cover the case where they don't.
- **Copy report in the desktop app** (`navigator.clipboard` with an `execCommand` fallback)
  has not been tried in WebView2. The Console `copy(…)` fallback covers it.
- **How long the first `tauri:dev` build takes** on the owner's PC. The last debug build is
  from 2026-08-22.
- **Whether the owner's screen can do 165 Hz.** Step 0.2 asks.
- **Whether the slot picker really blocks the QA button** (inferred from Headless UI's
  behaviour, not observed).
- **What Ctrl+C does to the desktop app** (E1): whether it kills it without a save, and
  whether the claim save itself survives. Option (c) exists for that case.
- **Whether the owner's own game can set up D2, D3 and D4** (a duplicate equippable item, a
  hero with equipment, a Coast). Each can be skipped.
- **The exact wording of the DevTools Memory panel** (G3) varies by browser version.
- **What the stress-board enemies look like.** The bench's enemy uses a plain icon sprite,
  so the owner may not recognise it as a "goblin". The checklist says "walking enemies".
