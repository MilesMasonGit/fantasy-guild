# Brief 50 — Drag deep-dive

Runs after the UI rework (briefs 10 and 30), as the owner asked: "dragging
must be 100 % successful and smooth every time; it's the main way to play."

**Evidence:** `PERFORMANCE.md` (drag baseline and the owner's certification):
pickup stalls ~90 ms and drop ~60 ms on S2 in the dev build (226 ms on S3);
the mat redraws ~115×/s while carrying; flags 74–94 % success. Tickets:
**T-033** (P1, redraws), **T-105** (a hero sprite blocks its flag), **T-106**
(a flag grabs a Token), **T-107** (alert marks block presses; likely gone after
brief 10 U3). T-104 was fixed in brief 00.

**Branch:** `crunch/drag`. **Tier:** engineer. **Eye-check:** the feel of
dragging, at the end.

## D1 — Make the bench see stalls (engineer)

`bench:drag` times the drag *start*, not the frames after it. Add frame
timing around each pickup, carry and drop (the longest frame, frames over
16.7 ms) and report them per kind. Re-take the drag baseline after briefs
10/30 changed the UI.

## D2 — Hit-testing (engineer)

T-105, T-106, any T-107 leftovers, and anything new D1's failure causes name.
Goal: **100 % on every kind, plain and with overlays**.

## D3 — Redraws (engineer)

T-033: pickup, drop and target changes must not redraw every draggable (a
memoised Token grab; read `docs/archive/review_v3/R7.md` for the analysis).
Goal: no frame over 16.7 ms at pickup or drop on S2 in the perf build; carry
stays smooth on S3.

**Done when:** `bench:drag` exits 0 (100 % everywhere) with no stall over
16.7 ms on S2 (perf build); the owner drags heroes, flags and Tokens in their
save and calls it smooth.
