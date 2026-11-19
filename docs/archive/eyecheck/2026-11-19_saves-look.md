# Eye-check: time away and banners come back, one window (brief 680 S3, S4, S5)

Build: `_builds/2026-11-18-saves-look/Fantasy Guild.exe`. Looked at by the owner, 19 Nov 2026: **all six right** ("All the save slot tests worked as intended").

| # | Check | Do | See | Verdict |
|---|---|---|---|---|
| 1 | The summary comes back | QA panel Away 3 hours; close with the X before choosing; reopen and Load | The same summary, "You closed the game before choosing, so here it is again.", both buttons | ok |
| 2 | Load as I left it still works | Load as I left it, Confirm | The game as before the 3 hours | ok |
| 3 | Return ends it | Away 3 hours, Return to the Guild, Confirm; close, reopen, Load | No summary | ok |
| 4 | Banners come back | Land an event, knock out a hero; close, reopen, Load | Both banners back | ok |
| 5 | A clicked banner stays gone | Click the knock-out banner away; close, reopen, Load | Only the event's banner | ok |
| 6 | One window | Minimise, double-click the exe again | No second game; the open window comes forward | ok |

After the look: the temporary Away 3 hours QA button and its test are deleted.
