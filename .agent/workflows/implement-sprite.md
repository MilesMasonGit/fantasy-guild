---
description: How to move a processed Art Asset into the live game
---

Follow this checklist for EVERY sprite to ensure seamless integration and zero regressions.

### 1. Verification
- [ ] Confirm the sprite has been processed to 32x32px and is located in `public/assets/sprites/approved/`.
- [ ] Identify the target Registry ID (e.g., `iron_ore`).

### 2. The Move
// turbo
- [ ] Move the file to its final home:
  `mv public/assets/sprites/approved/[filename].png public/assets/sprites/implemented/items/[id].png`
- [ ] **STRICT**: Remove all version suffixes (`_v1`, `_attempt_2`, etc.). The filename must match the registry ID exactly.

### 3. Verification
- [ ] Refresh the game browser. 
- [ ] Confirm the sprite is rendering correctly (the `AssetManager` discovers it automatically).

---
> [!IMPORTANT]
> **No Code Required**. You no longer need to edit `itemRegistry.js` or `InputSlotComponent.js` to implement a sprite. The `id` match is the link.

---
> [!IMPORTANT]
> **One Asset at a Time**. Never batch implement multiple assets in a single tool call sequence. Complete these steps for Asset A before starting Asset B.
