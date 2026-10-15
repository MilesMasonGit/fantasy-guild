import { setDrawingPaused } from './components/board/frameClock.js';

/**
 * Sent to the page by the desktop app (`src-tauri/src/lib.rs`) when its window is minimised
 * (`detail: true`) or restored (`detail: false`). ⚠️ WebView2 is never told the window is
 * minimised: the page stays `visible` and keeps drawing at full rate unless told this way.
 */
export const WINDOW_MINIMISED_EVENT = 'fg-window-minimised';

/**
 * Pause the mat's drawing clocks while the window is hidden (a background browser tab) or the
 * desktop app is minimised, and resume them once it is neither. Only drawing pauses: the game's
 * tick is a timer of its own, so a minimised game keeps playing.
 * @returns {() => void} uninstall
 */
export function installDrawingPause() {
    let minimised = false;
    const update = () => setDrawingPaused(document.hidden || minimised);
    const onMinimised = (e) => {
        minimised = e.detail === true;
        update();
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener(WINDOW_MINIMISED_EVENT, onMinimised);
    update();
    return () => {
        document.removeEventListener('visibilitychange', update);
        window.removeEventListener(WINDOW_MINIMISED_EVENT, onMinimised);
    };
}
