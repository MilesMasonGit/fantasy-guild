// Fantasy Guild - Native HTML5 drag registry (Deck Loop rework, Phase 7)
//
// The deck-loop UI uses the browser's native drag events (the pattern the
// Phase 6 Deck Focus view established) rather than the legacy dnd-kit
// pipeline, which stays wired to the old grid behind !USE_DECK_LOOP.
//
// dataTransfer payloads are unreadable during dragover (browser security),
// so drop targets validate/highlight against this module-level record while
// a drag is in flight, and read the real payload on drop.
//
// Payload shapes:
//   { kind: 'hero', heroId }
//   { kind: 'card', templateId, cardType }
//   { kind: 'item', itemId }

export const DRAG_MIME = 'application/x-fantasy-guild';

let current = null;

export function beginNativeDrag(event, payload) {
    current = payload;
    try {
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
    } catch {
        // setData can throw in exotic embedders; the module record still works.
    }
}

export function endNativeDrag() {
    current = null;
}

/** The in-flight payload, or null. Safe to call from dragover handlers. */
export function getNativeDrag() {
    return current;
}

/** Resolve the payload on drop: prefer dataTransfer, fall back to the record. */
export function readDropPayload(event) {
    try {
        const raw = event.dataTransfer.getData(DRAG_MIME);
        if (raw) return JSON.parse(raw);
    } catch {
        // fall through to the module record
    }
    return current;
}
