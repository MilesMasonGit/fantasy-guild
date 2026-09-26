// Fantasy Guild — Moving Tokens in and out of the Vault, in one place
// (CR2-134 / CR2-146 / CR2-169)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { QuestManager } from '../quests/QuestManager.js';
import * as BoardState from './BoardState.js';
import * as Placement from './Placement.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as TokenBank from './TokenBank.js';

/**
 * VaultTransfer — **the** rule for putting a Token into the Vault and taking one
 * back out, wherever it is coming from or going to.
 *
 * ## Why this is not inside `TokenBank.js`
 * `TokenBank` is the rules over the Bank's *own* storage: slot caps,
 * consolidation, selling. It answers "may this Token live here?".
 * Moving a Token means also touching the mat or the floor sprite
 * layer — and both `Placement.js` and `SpriteLayer.js` already import
 * `TokenBank`. Putting the dispatcher in `TokenBank` would have made two new
 * static import cycles, the kind `npm run cycles` calls dangerous. So the
 * *storage* rule stays in `TokenBank` and the *transfer* rule sits one layer
 * above it, importing everything it needs and being imported only by the UI.
 *
 * ## What a call site is allowed to do
 * Call one of these two functions and show `result.reason` if there is one.
 * Nothing else. Every check ("No room in the Vault",
 * the Vault-unlock gate), the actual movement, and the repaint announcement live
 * here. The four components that used to carry their own copy had already
 * drifted apart on all three (CR2-134), which is exactly the failure this
 * removes.
 *
 * ⚠️ **The announcement of the deposit or withdrawal itself is NOT made here.**
 * `TokenBank.deposit` publishes `vault_deposited` and `TokenBank.withdraw`
 * publishes `vault_withdrawn`, each exactly once and only on success, and quests
 * count both. Publishing them again from here — or from a component — is the
 * double-count CR2-146 found. What this file publishes is only the `state_changed`
 * / `board:tile_changed` repaint pair.
 */

const VAULT_FULL = 'No room in the Vault';
const VAULT_LOCKED = 'Token Vault storage unlocks after completing "Place a Dropped Token".';

const refuse = (reason) => ({ success: false, reason });

/** A refusal the player does not need to hear about — the thing simply is not there. */
const NOTHING = { success: false };

/** Tell the board and the drawers to repaint. */
function announceMoved() {
    EventBus.publish('state_changed', {});
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, {});
}

/**
 * Store a Token in the Vault, taking it from wherever it currently is.
 *
 * `source` is a drag payload's `from` descriptor, so a drop handler can pass its
 * payload straight through:
 *
 * - `{ instanceId }` — a Token standing on the playmat (by id since slice 1.6c)
 * - `{ spriteId }`  — a loose loot Token floating over the grid
 *
 * On failure **nothing is lost** (D-138): a Token lifted off the sprite layer is
 * put back exactly where it was.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function depositFrom(source) {
    if (!source) return NOTHING;

    // The gate is here, not at the call sites, so a control that forgets to
    // check it still cannot get a Token into a locked Vault. `accepts()` in the
    // drop targets checks it too, but that only greys the target out.
    if (!QuestManager.isTokenVaultSendUnlocked()) return refuse(VAULT_LOCKED);

    if (source.instanceId != null) return depositFromMat(source.instanceId);
    if (source.spriteId != null) return depositFromSprite(source.spriteId);

    return NOTHING;
}

/**
 * The mat route already had an engine home — `Placement.returnTokenToVaultById`,
 * which knows about the Guild Hall, the hero working the Token and the forfeited
 * cycle. It is not re-implemented here; it is called. It publishes its own
 * `state_changed`, so this adds only the repaint.
 */
function depositFromMat(instanceId) {
    if (!BoardState.getTokenById(instanceId)) return NOTHING;
    const res = Placement.returnTokenToVaultById(instanceId);
    if (res?.success) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, {});
    return res;
}

function depositFromSprite(spriteId) {
    const instance = SpriteLayer.takeTokenSprite(spriteId);
    if (!instance) return NOTHING;

    const putItBack = () =>
        SpriteLayer.addSprite('token', instance.typeId, 1, null, instance.usesRemaining);

    if (!TokenBank.deposit(instance)) {
        putItBack();
        return refuse(VAULT_FULL);
    }

    announceMoved();
    return { success: true, instance };
}

/**
 * Take one copy of `typeId` out of the Vault and put it on the playmat.
 *
 * `target.at` is the **mat point** the player dropped it at. The click-driven
 * routes (the Vault tab's quick add, the inspection panel's button) pass no
 * point, and the Token lands beside the Guild Hall, where the Shop lands what it
 * sells (FP-18). Before slice 1.9 those routes filled the Tray.
 *
 * `TokenBank.withdraw` picks the **fullest copy** (D-77). If the mat refuses the
 * Token — no legal spot within nudge reach — it goes straight back into the
 * Vault (D-138, FP-46).
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function withdrawTo(typeId, target = {}) {
    const instance = TokenBank.withdraw(typeId);
    if (!instance) return refuse('Could not withdraw from Vault');

    // Stale from a previous life on the sprite layer; left set, the renderer
    // hides the Token until a particle that is never coming lands on it.
    delete instance.isLanding;

    const at = target.at ?? Placement.centreOfBoard();
    const res = Placement.placeTokenAt(instance, at);
    if (!res?.success) {
        TokenBank.deposit(instance);
        return res;
    }
    EventBus.publish('state_changed', {});
    return { success: true, instance };
}
