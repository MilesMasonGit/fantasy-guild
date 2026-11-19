/**
 * Whether a full-screen view (the Encyclopedia, the Guild Hall, the World Map) is open: then no
 * hero can be given an order by a drag. The Encyclopedia is laid over the mat, which stays
 * mounted under it, so without this a hero let go on the book would be ordered to whatever lies
 * under that point. Heroes can still be reordered on the hero bar; items drag as always.
 * The same tiny-store shape as `useMatBankLock.js`, for the same reason: `matAccepts` is asked
 * outside React. `ReactRoot` is the only writer, kept in step with `ui.fullscreen.view`.
 * UI state only: never saved.
 */
let open = false;

export function isFullscreenViewOpen() {
    return open;
}

export function setFullscreenViewOpen(next) {
    open = !!next;
}
