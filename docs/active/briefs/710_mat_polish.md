# Brief 710 — Mat polish: names, Limes, the idle hover, alerts

*Written 2026-11-20 by the planning agent from the owner's list of small changes and the follow-up
interview the same day. Runs before the Systems Audit's fix briefs. Its sister brief is
[720 The animated ring](720_animated_ring.md).*

**What the player gets.** Token and hero names that are easier to read, Limes at the same pixel size
as everything else, a quieter hover on Tokens nobody works, and a bobbing "!" above anything that
needs attention, so problems are seen at a glance.

## Read first

`CLAUDE.md`, `docs/reference/TESTING.md`, `docs/reference/ARCHITECTURE.md` (drawing, the mat's
layers). Where things are today (read 2026-11-20 at `55a3dfc6`; check the code, it wins):

- **Names**: `TokenNameBadge` (`src/ui/components/board/TokenBadges.jsx:24-47`), shown only while the
  pointer rests on a Token or hero, DOM text at `ui-text-small` (`--font-size-xxs`, 14 px by default,
  scaled by the Text size setting, `tailwind.css:160-161, 802-813`). Placed on a Token by
  `MatToken.jsx:682-687`, below a hero by `MatHero.jsx:415`.
- **Limes**: `MatLimes` (`src/ui/components/limes/MatLimes.jsx`) with `LIMES_SCALE = 2` in
  `limesSpot.js`: its pixels are twice a Token's.
- **Idle hover**: the plate under a Token nobody works once the pointer rests on it (`idlePlate.js:9-80`,
  placed by `TokenBubbles.jsx:210-223`): problem, charges, spawner count, quest progress, timer.
- **Alerts**: `ProblemMark` (`ProblemMark.jsx:13-38`, sprites `u_alert_yellow.png` / `u_alert_red.png`,
  chosen in `problemMark.js:27-92`) centred in the middle of a Token nobody works
  (`TokenBubbles.jsx:309-328`); a worked Token's problem shows only on its work plate
  (`TokenBubbles.jsx:229-230`); a hero who needs a job wears `NeedsJobMark` over their head
  (`MatHero.jsx:122-142`). No alert animates today.

## Phases

| Phase | Ticket | What | Tier |
|---|---|---|---|
| P1 | T-589, T-590 | **Larger names; Limes at Token pixel size.** The name tag one step larger: about 18 px at the default Text size (a new step, still scaled by the setting), on Tokens and heroes alike; check the 240 px tag width still fits typical names and that the tag still sits clear of the plate and the hero. Limes: `LIMES_SCALE` 1, so its pixels match a Token's (owner: "double size, same as most non-background sprites"); its corner spot, drag, bubble and saved position still work at the new size. | builder-lite |
| P2 | T-591 | **The idle hover shows a timer or a problem only** (owner, 2026-11-20: the plate under a Token is for active work). On a Token nobody works, the hover plate drops charges, the spawner count and quest progress; it shows only when there is a timer (rest, growth, crop, event, demolition, Hall production) or a stuck reason (a spawner full, no room, mat full, asleep, needs items; growth stopped for lack of items). Otherwise the hover shows the name alone. The worked Token's work plate is unchanged. What left the plate stays on the Token card. | builder |
| P3 | T-592 | **The "!" above, bobbing.** Every alert "!" moves from the Token's middle to just above the Token's art (and above a hero's head, where `NeedsJobMark` already is), with a small stepped bob (whole art pixels, about 2 px, a slow loop). A **worked** Token with a problem also gets the "!" above it; its work plate keeps the words. The hover swap to the gear for a "choose" alert keeps working. Exception: the marker left where an event expired (T-497, not built yet) stays where the event stood; P3 only makes sure the "!" code lets that marker sit in place. The bob pauses with the other looping effects when the game is minimised or reduced motion is set (as `gi-gear-alert` does, `tailwind.css:426-439, 1022`) and costs nothing between steps (a CSS `steps()` animation or `onDue`, not a per-frame loop). | builder |

**Order and parallel work.** P1 alone is small; P2 and P3 both touch `TokenBubbles.jsx`: one after the
other, P2 first. P1 may run beside either.

**Audit tickets this changes.** T-505 (the idle hover shows every timer and stuck reason) still holds
for timers and stuck reasons, and builds on P2's slimmer plate; T-504 (one writer for the timer
sentences) is unchanged. Both rows say so.

## Done when

- Gate green; bench work check: same work (nothing here touches the engine). One `bench:draw --compare`
  with the eye-check build for the cost log (the bob must not raise idle draw cost).
- Seen in the running game: a name at the new size at two Text size steps; Limes at Token pixel size on
  the Starter Camp, dragged and clicked; an unworked Token's hover with and without a timer; a "!"
  bobbing above an unworked and a worked Token and above a hero needing a job; the bob stopped when
  minimised.
- Tickets closed into `docs/archive/tickets_done.md`.

**Eye-check: yes**, one look for all three phases (may share the batch with brief 720's R1 and R2).

## Owner to-do

None.
