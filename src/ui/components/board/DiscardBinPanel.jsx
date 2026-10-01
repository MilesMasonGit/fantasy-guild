import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as DiscardBin from '../../../systems/board/DiscardBin.js';
import * as NotificationSystem from '../../../systems/core/NotificationSystem.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { useEntityDrag, useEntityDrop, ACCEPT_CLS, REJECT_CLS } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { TokenSprite, TOKEN_SURFACE, tokenSizeFor } from '../base/TokenSprite.jsx';
import { EntityRibbon } from '../base/EntityRibbon.jsx';
import { announce } from './dropOnMat.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';

/**
 * ⭐ **The discard bin** (B3.2: FB-34, FB-35, TL-13) — the bin's UI, at the
 * bottom of the notification column. The engine is `DiscardBin.js` (B3.1).
 *
 * * **In:** drag a Token off the mat onto the panel (the whole panel is one
 *   drop target, {@link BIN_DROP_ID}). A refusal (the Guild Hall, a full bin)
 *   leaves the Token on the mat and the ghost flies back.
 * * **Out:** each binned Token is a draggable slot. Its payload is a `TOKEN`
 *   with `from.binnedId`, which `dropOnMat` hands to `DiscardBin.unbinToken`
 *   at the drop point.
 * * **Discard all (n)** is the confirm (B3 confirm): one press discards
 *   everything and pays the refund listed above it. No dialog; an empty bin
 *   makes it do nothing.
 */

/** The bin's droppable id. */
export const BIN_DROP_ID = 'discard-bin';

/**
 * The art in a slot, whatever the Token's footprint: half the 64 px tray
 * sprite, so nine slots fit in two rows of five and the bin stays on screen
 * in a short window (the 3x3 grid of 64 px slots pushed it off a 720 px one).
 */
const SLOT_ART_PX = tokenSizeFor(TOKEN_SURFACE.TRAY, 1) / 2;

/** What re-reads the bin. */
const BIN_EVENTS = Object.freeze([BOARD_EVENTS.BIN_CHANGED, ENGINE_EVENTS.STATE_CHANGED, ENGINE_EVENTS.GAME_LOADED]);

/** What the bin takes: a Token carried off the mat (not one already in the bin). */
export function binAccepts(payload) {
    return payload?.kind === DRAG_KIND.TOKEN && payload.from?.instanceId != null;
}

/**
 * A mat Token dropped on the bin. Bins it `fromHand` — the Token is still in
 * the player's hand until this has run (`MatToken`). A refusal is reported the
 * way the mat reports its own refused drops (`announce`, a warning
 * notification) and returns `false`, so the drag system counts a miss and the
 * ghost flies back. A source with its own miss message (the Guild Hall's
 * `onMiss`) says it instead, so the player is not told twice.
 *
 * @returns {false|undefined}
 */
export function dropIntoBin(payload) {
    if (!binAccepts(payload)) return false;
    const res = DiscardBin.binToken(payload.from.instanceId, { fromHand: true });
    if (res?.success) return undefined;
    if (!payload.onMiss) announce(res);
    return false;
}

/** A refund as `[{ itemId, name, quantity }]`. */
const named = (lines) => (lines || []).map(l => ({ ...l, name: getItem(l.itemId)?.name || l.itemId }));

/** One line of text for a refund: `7× Oak Wood, 1× Stone`, or `No refund`. */
export function refundText(lines) {
    const list = named(lines);
    return list.length ? list.map(l => `${l.quantity}× ${l.name}`).join(', ') : 'No refund';
}

/** Re-render on the bin's events. */
function useBinRefresh() {
    const [, bump] = useState(0);
    useEffect(() => {
        const refresh = () => bump(n => n + 1);
        const unsubs = BIN_EVENTS.map(e => EventBus.subscribe(e, refresh));
        return () => unsubs.forEach(u => u?.());
    }, []);
}

/** A filled slot: the binned Token's own icon, draggable back onto the mat. */
const BinSlot = ({ instance, onHover }) => {
    const drag = useEntityDrag({
        id: `bin-token-${instance.id}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: instance.typeId, from: { binnedId: instance.id } },
        sourceSurface: DND_SURFACE.DRAWER
    });
    const name = tokenName(instance.typeId);
    return (
        <div
            ref={drag.setNodeRef}
            {...drag.handleProps}
            data-bin-slot={instance.id}
            data-bin-slot-type={instance.typeId}
            aria-label={`${name}: ${refundText(DiscardBin.refundFor(instance))}`}
            onMouseEnter={() => onHover(instance.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
                'aspect-square rounded-full flex items-center justify-center bg-black/30 border border-white/15 hover:border-gi-gold/60 cursor-grab touch-none transition-opacity',
                drag.isDragging && 'opacity-30'
            )}
        >
            <TokenSprite typeId={instance.typeId} size={SLOT_ART_PX} />
        </div>
    );
};

/** An empty slot: a faint dashed circle. */
const EmptySlot = () => (
    <div data-bin-slot="" className="aspect-square rounded-full border-2 border-dashed border-white/15" />
);

export const DiscardBinPanel = ({ className }) => {
    useBinRefresh();
    const [hoverId, setHoverId] = useState(null);

    const drop = useEntityDrop({
        id: BIN_DROP_ID,
        surface: DND_SURFACE.DRAWER,
        accepts: binAccepts,
        onDrop: (payload) => dropIntoBin(payload)
    });
    // The cue says what the engine will say: red for a Token the bin refuses.
    const carried = drop.isOver && binAccepts(drop.activePayload) ? drop.activePayload : null;
    const refusal = carried ? DiscardBin.canBin(carried.from.instanceId, { fromHand: true }) : null;

    const contents = DiscardBin.binContents();
    const refund = named(DiscardBin.binRefundTotal());
    const hovered = hoverId ? contents.find(t => t.id === hoverId) : null;

    const discardAll = () => {
        const res = DiscardBin.discardAll();
        if (!res?.discarded) return;
        EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
        NotificationSystem.info(`Discarded ${res.discarded} Token${res.discarded === 1 ? '' : 's'}`);
    };

    const slots = [];
    for (let i = 0; i < DiscardBin.BIN_SIZE; i++) {
        const t = contents[i];
        slots.push(t
            ? <BinSlot key={t.id} instance={t} onHover={setHoverId} />
            : <EmptySlot key={`empty-${i}`} />);
    }

    return (
        <section
            ref={drop.setNodeRef}
            {...drop.droppableProps}
            data-discard-bin
            data-bin-count={contents.length}
            className={cn(
                'w-full flex flex-col gap-2 p-2 rounded-lg border border-gi-border/30 bg-black/20 transition-colors',
                refusal && (refusal.success ? ACCEPT_CLS : REJECT_CLS),
                className
            )}
        >
            <div className="flex items-baseline justify-between text-sm md:text-base font-bold text-gi-text">
                <span>Bin</span>
                <span data-bin-header className="tabular-nums text-gi-muted">{contents.length}/{DiscardBin.BIN_SIZE}</span>
            </div>

            <div className="grid grid-cols-5 gap-1">{slots}</div>

            {/* Hover a slot: its name and its own refund. Fixed height, so the
                panel does not jump. */}
            <div data-bin-hover className="h-8 text-[11px] leading-tight text-gi-muted overflow-hidden">
                {hovered ? (
                    <>
                        <div className="font-bold text-gi-text truncate">{tokenName(hovered.typeId)}</div>
                        <div className="truncate">{refundText(DiscardBin.refundFor(hovered))}</div>
                    </>
                ) : refusal && !refusal.success ? (
                    <div className="text-gi-danger">{refusal.reason}</div>
                ) : contents.length ? (
                    'Drag a Token back onto the mat to keep it.'
                ) : (
                    'Drag Tokens here to discard them.'
                )}
            </div>

            <div data-bin-refund className="flex flex-col gap-1 max-h-32 overflow-y-auto gi-scrollbar">
                <span className="text-[10px] font-bold gi-caps tracking-wider text-gi-muted">Refund</span>
                {refund.length ? refund.map(l => (
                    <EntityRibbon
                        key={l.itemId}
                        kind="item"
                        id={l.itemId}
                        name={l.name}
                        quantity={l.quantity}
                        size="sm"
                    />
                )) : (
                    <span className="text-[11px] text-gi-muted">Nothing</span>
                )}
            </div>

            <button
                type="button"
                data-discard-all
                onClick={discardAll}
                className="w-full px-3 py-2 rounded border font-bold text-xs uppercase tracking-wide transition-colors border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 cursor-pointer active:scale-[0.99]"
            >
                Discard all ({contents.length})
            </button>
        </section>
    );
};

export default DiscardBinPanel;
