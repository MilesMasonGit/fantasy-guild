import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { artRadiusOf } from '../../../config/matGeometry.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { MAT_Z } from './matLayers.js';
import { CALLOUT_MS, INPUT_CALLOUT_GAP_MS, TOOL_CALLOUT_GAP_MS, addCallout, anchorKeyOf, calloutText, dueAgain } from './callouts.js';
import { getAllItems, getItem } from '../../../config/registries/itemRegistry.js';
import { toolNeedPhrase } from '../../../config/registries/toolKinds.js';
import { columnPlace, heroColumnAt, heroColumnsVersion, subscribeHeroColumns } from './speechColumns.js';
import { SPAWN_MS } from './spawnMotion.js';
import { useMatFit } from './MatFitContext.jsx';
import { SpeechFrame } from './SpeechFrame.jsx';
import { SPEECH_TONE } from './speechTone.js';
import { plateUnit, platePlace } from './workPlate.js';
import { useMatSize } from '../../hooks/useMatSize.js';

/** Clear air between the top of a Token's art and the bottom of its callout's tail, in mat units. */
const GAP_PX = 6;

let nextId = 1;

const NO_SUBSCRIPTION = () => () => {};

/**
 * Quick popups over the mat, in the speech family's frame (`SpeechFrame`), red for a refusal: "! Spawned Oak Tree" over the spawner, an effect's name
 * over the Token it fired on, "Needs Pickaxe" over a Token a hero passed over for want of the tool, "Needs Coal" over a station its hero stands at
 * out of an input, "Needs Oak Seedling" over a Stump as it stops for want of one,
 * "Demolished Oak Tree" where a demolished Token stood, and the reason
 * for a refused action (a drop, a quest claim, a shrink that left a Token crowded) over the spot or
 * Token involved. Refusals are never notifications.
 * They appear, hold for a moment and fade (`callout-pop` in `components.css`); nothing to click,
 * and the pointer passes straight through. One layer and one subscription per event for the
 * whole mat, however many Tokens are drawn.
 * Depletion and level-ups are not here: a hero says those (`HeroBubbleLayer`).
 * Over a Token whose hero is speaking, the callouts go on top of the hero's stack, one column
 * (`speechColumns.js`). Only while a callout is up does a change to that stack redraw this.
 */
export const CalloutLayer = memo(function CalloutLayer() {
    const [callouts, setCallouts] = useState([]);
    const timers = useRef(new Map());

    useEffect(() => {
        const pending = timers.current;
        const toolSaidAt = new Map();   // instanceId → when "Needs Pickaxe" was last said over it
        const inputSaidAt = new Map();  // instanceId → when "Needs Coal" was last said over it
        const growthSaidAt = new Map(); // instanceId → when "Needs Oak Seedling" was last said over it
        /** Whether a reminder over `instanceId` is due; if so, noted as said now. */
        const remind = (saidAt, instanceId, gapMs) => {
            const now = Date.now();
            if (!dueAgain(saidAt.get(instanceId) ?? null, now, gapMs)) return false;
            if (saidAt.size > 256) {
                for (const [id, at] of saidAt) if (dueAgain(at, now, gapMs)) saidAt.delete(id);
            }
            saidAt.set(instanceId, now);
            return true;
        };
        const say = ({ anchorId = null, x = null, y = null, typeId = null, text, tone = SPEECH_TONE.PLAIN }) => {
            if (!text) return;
            const anchor = anchorId ? BoardState.getTokenById(anchorId) : null;
            const at = anchor ? { x: anchor.x, y: anchor.y, typeId: anchor.typeId } : { x, y, typeId };
            if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
            const id = nextId++;
            const entry = { id, key: anchorKeyOf({ anchorId: anchor ? anchorId : null, ...at }), anchorId: anchor ? anchorId : null, ...at, text, tone };
            setCallouts(list => addCallout(list, entry));
            pending.set(id, setTimeout(() => {
                pending.delete(id);
                setCallouts(list => list.filter(c => c.id !== id));
            }, CALLOUT_MS));
        };
        const unsubs = [
            // Said as the new Token lands: over the spawner, the callout would hide its hop out of it.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => {
                if (!p?.spawnerId || !p.name) return;
                const id = nextId++;
                pending.set(id, setTimeout(() => {
                    pending.delete(id);
                    say({ anchorId: p.spawnerId, text: calloutText.spawned(p.name) });
                }, SPAWN_MS));
            }, UI_LISTENER),
            EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => {
                if (p?.instanceId && p.title) say({ anchorId: p.instanceId, text: calloutText.effect(p.title) });
            }, UI_LISTENER),
            // A flag passed this Token over for want of a tool: the Token says which, now and then.
            EventBus.subscribe(BOARD_EVENTS.TOOL_NEEDED, (p) => {
                if (!p?.instanceId || !p.kind) return;
                if (!remind(toolSaidAt, p.instanceId, TOOL_CALLOUT_GAP_MS)) return;
                say({ anchorId: p.instanceId, text: calloutText.needsTool(toolNeedPhrase(p, getAllItems())), tone: SPEECH_TONE.CANT });
            }, UI_LISTENER),
            // A station its hero stands at is out of an input: it says which, in the same look.
            EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => {
                if (!p?.instanceId || !p.itemId) return;
                if (!remind(inputSaidAt, p.instanceId, INPUT_CALLOUT_GAP_MS)) return;
                say({ anchorId: p.instanceId, text: calloutText.needsInput(getItem(p.itemId)?.name || p.itemId), tone: SPEECH_TONE.CANT });
            }, UI_LISTENER),
            // A Stump stops for want of its seedling: it says which as it stops, in the same look.
            EventBus.subscribe(BOARD_EVENTS.GROWTH_ALERT_CHANGED, (p) => {
                if (!p?.instanceId || p.alert !== ALERT.GROW_NEEDS_ITEM || !p.needs?.length) return;
                if (!remind(growthSaidAt, p.instanceId, INPUT_CALLOUT_GAP_MS)) return;
                say({ anchorId: p.instanceId, text: calloutText.needsInput(p.needs.map(id => getItem(id)?.name || id).join(', ')), tone: SPEECH_TONE.CANT });
            }, UI_LISTENER),
            // The Token is gone by now: said where it stood, over where its art was.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, (p) => {
                if (p?.typeId) say({ x: p.x, y: p.y, typeId: p.typeId, text: calloutText.demolished(tokenName(p.typeId)) });
            }, UI_LISTENER),
            // A drop the mat refused names a point, not a Token: say why where it was aimed. A
            // Token a shrunk mat left crowded says so over itself.
            EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => {
                if (p?.type === 'drop_rejected') say({ x: p.x, y: p.y, text: p.rulesText || p.title || p.message, tone: SPEECH_TONE.CANT });
                else if (p?.type === 'resize_crowded' && p.instanceId) say({ anchorId: p.instanceId, text: p.title || p.message, tone: SPEECH_TONE.CANT });
            }, UI_LISTENER),
            // The screen's own refusals (the Guild Hall dragged off, a drop or claim refused): over
            // the Token involved, or at the mat point it names.
            EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => {
                if (p) say({ anchorId: p.instanceId || null, x: p.x, y: p.y, text: p.title || p.message, tone: SPEECH_TONE.CANT });
            }, UI_LISTENER)
        ];
        return () => {
            unsubs.forEach(u => u());
            for (const t of pending.values()) clearTimeout(t);
            pending.clear();
        };
    }, []);

    useSyncExternalStore(callouts.length ? subscribeHeroColumns : NO_SUBSCRIPTION, heroColumnsVersion);
    const fit = useMatFit() || 1;
    const u = plateUnit(fit);
    const mat = useMatSize();

    if (!callouts.length) return null;

    const groups = new Map();
    for (const c of callouts) {
        if (!groups.has(c.key)) groups.set(c.key, []);
        groups.get(c.key).push(c);
    }

    return (
        <div
            data-callouts
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.CALLOUT }}
        >
            {[...groups.entries()].map(([key, list]) => {
                const { x: ownX, y, typeId, anchorId } = list[0];
                let ownTop = y - (typeId ? artRadiusOf(typeId) : 0) - GAP_PX;
                // A worked Token near the mat's foot wears its work plate over its head: say it above.
                if (anchorId && BoardState.workerOf(anchorId)) {
                    const plateTop = platePlace({ x: ownX, y, typeId, fit, matH: mat.h }).top;
                    if (plateTop < y) ownTop = Math.min(ownTop, plateTop - GAP_PX);
                }
                const { x, top } = columnPlace(
                    { x: ownX, top: ownTop },
                    anchorId ? heroColumnAt(anchorId) : null
                );
                return (
                    <div
                        key={key}
                        className="absolute flex flex-col-reverse items-center gap-1"
                        style={{ left: 0, top: 0, transform: `translate(${x}px, ${top}px) translate(-50%, -100%)` }}
                    >
                        {list.map(c => (
                            <SpeechFrame key={c.id} data-callout={c.text} tone={c.tone} u={u} tail className="callout-bubble whitespace-nowrap ui-text-title font-bold">
                                {c.text}
                            </SpeechFrame>
                        ))}
                    </div>
                );
            })}
        </div>
    );
});

export default CalloutLayer;
