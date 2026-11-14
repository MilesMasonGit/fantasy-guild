# Eye-check: Events arrive, round 1 (2026-11-13)

Build `_builds/2026-11-13-events` (`feat/events-arrival` f7d0f39c), the owner's 12 synced events, QA panel Land buttons.

| # | Check | Verdict | Owner's note |
|---|---|---|---|
| 1 | Events in the away report | Change it | Show the time left on the events if they're still here. |
| 2 | A comet falls | Looks right | |
| 3 | The banner points to it | Change it | Should just be "Special Event! Copper Comet!" |
| 4 | The comet's plate | Can't check | I don't see the countdown timer. Perhaps the cycle timer is competing with it. |
| 5 | A buff drifts in | Looks right | |
| 6 | The badge names the event | Looks right | |
| 7 | Time left on a buff | Looks right | |
| 8 | Banner from the Guild Hall | Change it | It doesn't keep its position switching between the Hall and the mat; it drags away then pops in; it should stay static and slide into its new position; the top banner could slide in and push the others down. |
| 9 | Banner from the Atlas | Change it | Same: it resets and pops in. |
| 10 | Where nodes land | Looks right | |
| 11 | An event leaves | Looks right | |

Also noted: the Fallen Maple's cycle feels very slow (content, to `owner_feedback.md`).

Fixed on the branch (a06c9146): time left in the away report for events still here (and events that stood through the whole time away are now listed); the banner reads `Special Event! <name>!` with no second line; one banner stack outside the cameras that holds still across mat, Hall and Atlas and slides the others down when one comes or goes. Check 4: no change; a node's leave clock only runs while no hero on the roster can work it (it resets to zero once one can), so with a miner able to work copper there is no countdown, by the E1 rule. Asked as a design question.
