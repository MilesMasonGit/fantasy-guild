// Fantasy Guild — Moving Tokens in and out of the Vault, in one place
// (CR2-134 / CR2-146 / CR2-169)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
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
 * `TokenBank` is the rules over the Bank's *own* storage: slot caps, D-156's Map
 * refusal, consolidation, selling. It answers "may this Token live here?".
 * Moving a Token means also touching the Tray, a tile, or the floor sprite
 * layer — and both `Placement.js` and `SpriteLayer.js` already import
 * `TokenBank`. Putting the dispatcher in `TokenBank` would have made two new
 * static import cycles, the kind `npm run cycles` calls dangerous. So the
 * *storage* rule stays in `TokenBank` and the *transfer* rule sits one layer
 * above it, importing everything it needs and being imported only by the UI.
 *
 * ## What a call site is allowed to do
 * Call one of these two functions and show `result.reason` if there is one.
 * Nothing else. Every check ("Maps cannot be stored", "No room in the Vault",
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

const MAP_REFUSAL = 'Maps cannot be stored — open it.';
const VAULT_FULL = 'No room in the Vault';
const TRAY_FULL = 'No room in the Tray';
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
 * - `{ traySlot }`  — a Token loose on the Tray surface
 * - `{ tile }`      — a Token standing on the playmat
 * - `{ spriteId }`  — a loose loot Token floating over the grid
 * - `{ boardMapId }`— a Map lying on the playmat (always refused, D-156)
 *
 * On failure **nothing is lost** (D-138): a Token lifted off the sprite layer is
 * put back exactly where it was, and a Tray Token is only removed from the Tray
 * after the Vault has accepted it.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function depositFrom(source) {
    if (!source) return NOTHING;

    // The gate is here, not at the call sites, so a control that forgets to
    // check it still cannot get a Token into a locked Vault. `accepts()` in the
    // drop targets checks it too, but that only greys the target out.
    if (!QuestManager.isTokenVaultSendUnlocked()) return refuse(VAULT_LOCKED);

    if (source.traySlot != null) return depositFromTray(source.traySlot);
    if (source.tile != null) return depositFromTile(source.tile);
    if (source.spriteId != null) return depositFromSprite(source.spriteId);

    // A Map on the playmat. Refused for the same reason as everywhere else, and
    // named rather than silently ignored so the player learns the rule.
    if (source.boardMapId != null) return refuse(MAP_REFUSAL);

    return NOTHING;
}

function depositFromTray(slot) {
    const instance = BoardState.getTray()[slot];
    if (!instance) return NOTHING;

    if (getTokenType(instance.typeId)?.mapId) return refuse(MAP_REFUSAL);
    if (!TokenBank.deposit(instance)) return refuse(VAULT_FULL);

    BoardState.takeFromTray(slot);
    announceMoved();
    return { success: true, instance };
}

/**
 * The tile route already had an engine home — `Placement.returnTokenToVault`,
 * which knows about the Guild Hall, multi-tile footprints, the hero standing on
 * top and the forfeited cycle. It is not re-implemented here; it is called.
 * It publishes its own `state_changed`, so this adds only the tile repaint.
 */
function depositFromTile(tile) {
    const res = Placement.returnTokenToVault(tile);
    if (res?.success) EventBus.publish(BOARD_EVENTS.TILE_CHANGED, {});
    return res;
}

function depositFromSprite(spriteId) {
    const instance = SpriteLayer.takeTokenSprite(spriteId);
    if (!instance) return NOTHING;

    const putItBack = () =>
        SpriteLayer.addSprite('token', instance.typeId, 1, null, instance.usesRemaining);

    // ⚠️ Checked explicitly rather than left to `TokenBank.deposit`'s own D-156
    // refusal. Both refuse it, but only this one can say *why*: the old code
    // here fell through to the generic "No room in the Vault", which is not the
    // reason and sends the player looking for a Vault upgrade they do not need.
    if (getTokenType(instance.typeId)?.mapId) {
        putItBack();
        return refuse(MAP_REFUSAL);
    }
    if (!TokenBank.deposit(instance)) {
        putItBack();
        return refuse(VAULT_FULL);
    }

    announceMoved();
    return { success: true, instance };
}

/**
 * Take one copy of `typeId` out of the Vault and put it somewhere.
 *
 * `target` is `{ tile }` to place it straight onto the playmat, or `{ at }` (or
 * nothing at all) to land it on the Tray — `at` being the `{x, y}` fraction the
 * player dropped it at (D-227), omitted for the click-driven routes that just
 * scatter it.
 *
 * `TokenBank.withdraw` picks the **fullest copy** (D-77). If the destination
 * refuses the Token it goes straight back into the Vault (D-138).
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function withdrawTo(typeId, target = {}) {
    const instance = TokenBank.withdraw(typeId);
    if (!instance) return refuse('Could not withdraw from Vault');

    // Stale from a previous life on the sprite layer; left set, the Tray hides
    // the Token until a particle that is never coming lands on it.
    delete instance.isLanding;

    if (target.tile != null) {
        const res = Placement.placeToken(target.tile, instance);
        if (!res?.success) {
            TokenBank.deposit(instance);
            return res;
        }
        EventBus.publish('state_changed', {});
        return { success: true, instance };
    }

    if (!BoardState.addToTray(instance, undefined, target.at)) {
        TokenBank.deposit(instance);
        return refuse(TRAY_FULL);
    }

    announceMoved();
    return { success: true, instance };
}
