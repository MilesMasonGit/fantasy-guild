import { logger } from '../../utils/Logger.js';

/**
 * Asset Preloader: warms the browser cache with all game art at boot.
 * Only the critical subset gates boot; the rest warms in the background.
 */

/**
 * Art that must be ready before the game shows itself: the playmat, tokens,
 * hero portraits and UI icons (the first screens the player sees).
 */
const CRITICAL_RE = /^assets\/(playmat|tokens|heroes|icon)\//;

// Never let a broken/missing image hold the game hostage.
const GATE_TIMEOUT_MS = 4000;

// Loaded Image objects are kept referenced so decoded bitmaps stay warm.
const retained = [];

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ src, ok: true });
        img.onerror = () => resolve({ src, ok: false });
        img.src = src;
        retained.push(img);
    });
}

async function fetchManifest() {
    try {
        const res = await fetch('asset-manifest.json');
        if (!res.ok) return [];
        const list = await res.json();
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

/**
 * Kick off the full art preload. Resolves once the critical subset is loaded
 * (or the safety timeout fires); background art continues loading after.
 */
export async function preloadGameArt() {
    const start = performance.now();
    const manifest = await fetchManifest();

    if (manifest.length === 0) {
        logger.warn('assets', 'Asset manifest missing or empty — skipping preload gate.');
        return;
    }

    const critical = manifest.filter((p) => CRITICAL_RE.test(p));
    const rest = manifest.filter((p) => !CRITICAL_RE.test(p));

    const criticalDone = Promise.all(critical.map(loadImage));

    // Fire-and-forget: the remaining art warms while the player is on the
    // save-slot screen.
    Promise.all(rest.map(loadImage)).then((results) => {
        const failed = results.filter((r) => !r.ok);
        logger.info('assets', `Background art warm (${rest.length - failed.length}/${rest.length}).`);
        if (failed.length) {
            logger.warn('assets', `Failed to preload: ${failed.slice(0, 5).map((r) => r.src).join(', ')}${failed.length > 5 ? '…' : ''}`);
        }
    });

    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), GATE_TIMEOUT_MS));
    const outcome = await Promise.race([criticalDone, timeout]);

    const elapsed = Math.round(performance.now() - start);
    if (outcome === 'timeout') {
        logger.warn('assets', `Preload gate timed out after ${GATE_TIMEOUT_MS}ms — continuing boot.`);
    } else {
        const failed = outcome.filter((r) => !r.ok);
        logger.info('assets', `Critical art ready in ${elapsed}ms (${critical.length} gated, ${rest.length} warming).`);
        if (failed.length) {
            logger.warn('assets', `Failed critical art: ${failed.map((r) => r.src).join(', ')}`);
        }
    }
}
