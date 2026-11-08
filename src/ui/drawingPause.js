import { setDrawingPaused } from './components/board/frameClock.js';
import { setCommitsHeld } from './hooks/commitHold.js';

/**
 * Sent to the page by the desktop app (`src-tauri/src/lib.rs`) when its window is minimised
 * (`detail: true`) or restored (`detail: false`). ⚠️ WebView2 is never told the window is
 * minimised: the page stays `visible` and keeps drawing at full rate unless told this way.
 */
export const WINDOW_MINIMISED_EVENT = 'fg-window-minimised';

/**
 * On the body while the desktop app is minimised: a CSS rule pauses the looping animations under
 * it (`tailwind.css`, "Paused while minimised").
 */
export const PAUSED_ATTRIBUTE = 'data-paused';

/**
 * The desktop app minimised (`true`) or restored: the body's {@link PAUSED_ATTRIBUTE}, and the
 * stores' commits held. ⚠️ Not for a hidden browser tab: the browser already stops CSS animations
 * there, and holding the commits there has not been measured.
 * @param {boolean} on
 */
function setQuiet(on) {
    if (on) document.body.setAttribute(PAUSED_ATTRIBUTE, '');
    else document.body.removeAttribute(PAUSED_ATTRIBUTE);
    setCommitsHeld(on);
}

/**
 * Pause the mat's drawing clocks while the window is hidden (a background browser tab) or the
 * desktop app is minimised, and resume them once it is neither. Minimised, the looping CSS
 * animations and the stores' per-tick React commits pause too, and restored, every store reads
 * once. Only drawing pauses: the game's tick is a timer of its own, so a minimised game keeps
 * playing and saving.
 * @returns {() => void} uninstall
 */
export function installDrawingPause() {
    let minimised = false;
    const update = () => {
        setQuiet(minimised);
        setDrawingPaused(document.hidden || minimised);
    };
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
        setQuiet(false);
    };
}
