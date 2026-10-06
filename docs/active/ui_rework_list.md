# UI rework list — owner, 2026-10-06

**Status:** the owner's outstanding UI list, the input for the crunch's UI
rework (the old `ui_overhaul_spec.md` / `ui_bugfix_tracker.md` stay archived).
Crunch prep P4 turns it into ready-to-run briefs; items still marked for
discussion get an owner interview first.

**Gameplay rulings inside this list** (they override earlier tickets and the GDD):
- **Token cap 80** for testing, and **spawners and spawned Tokens are under
  the same cap** (today only placed Tokens count). Upgradeable in the Guild
  Hall later. → T-102
- **Binned Tokens count toward spawner caps and Token counts** (today a full
  bin lets a spawner exceed its cap: a bug). → T-101
- **"Trickle" becomes "Passive Production"**: all of it on one 5-minute timer;
  the **Wishing Well** joins it (about 10 Water every 5 min). → T-099
- The **"Hero went elsewhere"** notification should not be a notification.

Checked 2026-10-06: the inspection panel's "Origin (dev)" line shows only in a
dev build or with Debug Mode on; T-097 hides Debug Mode in shipped builds.

The list below is the owner's own wording.

---

**Drag consistency:**
Sometimes a drag fails to start when grabbing a hero or their flag.
Clicking and dragging a token must feel as good as possible. It needs to be 100% successful and smooth every time, as this is the main interaction method for the player. We should consider doing a deep dive review into drag and drop consistency once we've updated our UI. Right now, I think other UI elements are blocking and causing the issue.

**Hero flag:**
I see a "…" badge in the top left that does nothing. The gear to change hero work behavior should not be on the flag token, it will likely live on the horizontal hero bar.

**Quests:**
Should show the target sprite overtop of the Quest sprite. The sprite for quests is a billboard with a large blank poster on the front. It is intended to show the item that the quest needs (eg Oak Wood) on top of it, centered.

**Bubble UI:**
The new Bubble UI looks good, but I think it needs to be within the bounds of the sprite box. Currently it lives underneath the token, and when there are a lot of tokens it's hard to tell which it belongs to.
We need hover tooltips to show when hovering over the bubbles, to explain what they mean and do. Currently cannot hover some bubbles as they live outside of the token's bounds and disappear when the cursor moves towards them.
Bubbles should not be always visible. They should pop in either when the token is hovered over, or when they change.
Sometimes the bubbles look like they're getting cut off at the edges.
Bubbles that jump in number (such as spawners going from 2/5 to 3/5) should still show movement in their ring.
We should have a discussion about bubble locations and visibility for each kind of bubble. My preliminary thoughts below:

**Bubble positioning:**
Spawn cap bubbles should be dead center on the Token.
Charge count bubbles should be bottom right.
Lifespan timers should be top left (such as for coast/fishing tokens)
Work cycle should be bottom left.
Quest progress should be bottom center.
The Gear icon should also be dead center.
I'm open to feedback on this, or if I've missed a kind of bubble or behaviour that should be considered.

**Spawner behaviour:**
Tokens in the bin should still count towards caps and token counts. Currently I can keep items in the bin to exceed a spawner's cap.

**Token movement:**
I want tokens to have movement when they spawn in, popping out of the spawner and sliding a little bit.

**New Shadow:**
The old shadows are still used when dragging an item in the bank.

**Item particle fly:**
Items seem to have the same flight duration no matter how long they have to travel. This makes it look lethargic and slow when the destination is close to them.

**Notification/Bin bar:**
I want to expand the playmat size, and have the notifications and bin be sidebars that pop out on hover. They should expand out overtop of the playmat.
I see a "Hero went elsewhere" notification – not sure what triggers this, but it shouldn't be a notification.

**Level Up Notifications:**
I want the hero speech bubble to pop for level ups both on the playmat and on the horizontal Hero Bar. The notification should work the same way it currently works in the notification bar.
The hero will say "Leveled up Mining to 25! (+4)"
That hero bar bubble should persist until cleared, this way after returning from a long afk session the player can see all the levels gained just by scanning the bottom bar.

**Shop UI:**
We need to use the arrow bars at the top and bottom instead of a scroll bar.
The sprite icon of what's being purchased should be 128px size and on the right side. I want to give the feeling of taking an item out of the shop and placing it on the map.
The sprite should be the central focus, and I want the rest of the information to not exceed the vertical height of that sprite. Each container needs to be consistently sized. We can display the item costs in a 2x2 grid.
Some types of purchasable tokens will be groups. For example, Wood foundation should have a dropdown menu allowing the player to choose Oak, Willow, Ebony foundations. Those higher-level foundations will have greater costs and be required for higher level constructions. Anvils should have a dropdown to select different anvil types.

**Hero bar:**
Horizontal hero bar can be spaced out more, as we are going to have a max of 8 heroes.
The inspection panel for heroes can be placed the same as it is in the item bank, even when the bank is closed.

**Alerts:**
Let's not have the alert icons on the token itself, the floating exclamation points where it shows tokens that have been exhausted or new tokens that have spawned.
Instead, I want to try communicating this information through more natural visuals. Let's include an "Oak Tree Depleted" speech bubble for the hero that exhausts it.
For spawners, they should have a "! Spawned Oak Tree" speech bubble-style popup that appears and fades quickly.

**General UI Reworks:**
The Guild Hall Trickle Income, Token Summary, and Upkeep tooltips all need to be greatly simplified and reworked.

**Trickle Income:**
All guild hall Trickle Income should be on the same 5 min timer.
We should call this "Passive Production", not "Trickle".
Our guild hall upgrades should be integrated with this. The wishing well upgrade is meant to produce X amount of Water passively, probably 10 every 5 minutes.

**Token Summary:**
Should always be displayed as a list, probably can put in additional information, such as a bubble row showing specific progress.
It should be click to open, and the player can hover to highlight that token.
I think spawners and spawned tokens should be subject to the same cap. Let's increase the base cap to 80 for testing purposes. The player will be able to upgrade this in the guild hall later on.

**Upkeep:**
Should not display trickle income/passive production. This is meant to be a summary of what wants to consume resources, how much and how often.

**Disallow:**
Disallowed tokens should have the disallow icon in the center of the token.
The "Heroes may work this" switch in the inspection should be a disallow function instead.

**Token Inspection UI:**
Skill icon sprites are fuzzy and not sharp in this view.
The speech bubble arrow doesn't look good, the overall shape should look more like the speech bubbles do.
I assume the "Origin (dev) Spawned" will not be visible in the production builds.
Charges, time, and XP should be displayed as bubbles. They should update if the inspected token is being worked.
