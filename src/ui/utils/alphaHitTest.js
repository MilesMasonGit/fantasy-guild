/**
 * Pixel-Perfect Alpha Hit-Testing Engine.
 *
 * Caches compact Uint8Array alpha channel masks for pixel art sprites and orbs.
 * Enables clicking, dragging, and hover effects to register ONLY on opaque pixels,
 * dynamically bypassing transparent pixels so underlying tokens and surfaces
 * can be hovered, clicked, and dragged naturally.
 */

const alphaMaskCache = new Map();
const pendingLoads = new Map();
let isGlobalInitialized = false;
const activeDisabledElements = new Set();

/** Normalize image source paths so relative, root-relative, and absolute URLs match. */
function normalizeSrc(src) {
    if (!src) return '';
    try {
        if (src.startsWith('http://') || src.startsWith('https://')) {
            const url = new URL(src);
            return url.pathname;
        }
    } catch {}
    return src;
}

/**
 * Extract alpha data from an existing loaded HTMLImageElement or Image.
 */
function extractAlphaFromImage(img, srcKey) {
    try {
        const width = img.naturalWidth || img.width || 64;
        const height = img.naturalHeight || img.height || 64;
        if (width <= 0 || height <= 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const raw = imgData.data;

        const alphaData = new Uint8Array(width * height);
        for (let i = 0, j = 3; j < raw.length; i++, j += 4) {
            alphaData[i] = raw[j];
        }

        const mask = { width, height, data: alphaData };
        if (srcKey) {
            const norm = normalizeSrc(srcKey);
            alphaMaskCache.set(norm, mask);
            alphaMaskCache.set(srcKey, mask);
        }
        return mask;
    } catch {
        return null;
    }
}

/**
 * Preload and cache the alpha mask for an image source.
 *
 * @param {string} src The image URL
 * @returns {Promise<{ width: number, height: number, data: Uint8Array }|null>}
 */
export function preloadAlphaMask(src) {
    if (!src || typeof window === 'undefined') return Promise.resolve(null);
    const norm = normalizeSrc(src);
    if (alphaMaskCache.has(norm)) return Promise.resolve(alphaMaskCache.get(norm));
    if (alphaMaskCache.has(src)) return Promise.resolve(alphaMaskCache.get(src));
    if (pendingLoads.has(norm)) return pendingLoads.get(norm);

    const promise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const mask = extractAlphaFromImage(img, src);
            pendingLoads.delete(norm);
            resolve(mask);
        };
        img.onerror = () => {
            pendingLoads.delete(norm);
            resolve(null);
        };
        img.src = src;
    });

    pendingLoads.set(norm, promise);
    return promise;
}

/**
 * Test whether a UV coordinate on an image source is opaque.
 *
 * @param {string} src Image source URL
 * @param {number} u Normalized horizontal coordinate [0..1]
 * @param {number} v Normalized vertical coordinate [0..1]
 * @param {number} [threshold=25] Minimum alpha value (0-255) to consider opaque
 * @returns {boolean} True if the pixel is opaque or mask is loading
 */
export function isPointOpaque(src, u, v, threshold = 25) {
    if (!src) return true;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;

    const norm = normalizeSrc(src);
    let mask = alphaMaskCache.get(norm) || alphaMaskCache.get(src);
    if (!mask) {
        preloadAlphaMask(src);
        return true; // Optimistic fallback while loading
    }

    const px = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));
    const py = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)));
    const idx = py * mask.width + px;

    return mask.data[idx] >= threshold;
}

/**
 * Test if a DOM element has an opaque pixel at client coordinates (clientX, clientY).
 *
 * @param {HTMLElement} element Target DOM element
 * @param {number} clientX Viewport X
 * @param {number} clientY Viewport Y
 * @param {number} [threshold=25] Alpha threshold
 * @returns {boolean} True if the point is within the solid part of the element
 */
export function isElementOpaqueAtPoint(element, clientX, clientY, threshold = 25) {
    if (!element) return false;

    // Support circular / radial hit-testing (e.g. Navigation Bar Orbs)
    if (element.hasAttribute('data-alpha-circle') || element.dataset?.alphaCircle === 'true') {
        const rect = element.getBoundingClientRect();
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            return false;
        }
        const radius = Math.min(rect.width, rect.height) / 2;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - centerX, clientY - centerY);
        return dist <= radius;
    }

    // Find the image element inside or on the element
    const imgEl = element.tagName === 'IMG' ? element : element.querySelector('img');
    const src = imgEl?.getAttribute('src') || imgEl?.src || element.dataset?.alphaSrc;

    if (!src) {
        const rect = element.getBoundingClientRect();
        return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        );
    }

    // If image is loaded in DOM but not yet cached, extract immediately in sync
    const norm = normalizeSrc(src);
    if (!alphaMaskCache.has(norm) && !alphaMaskCache.has(src) && imgEl?.complete && imgEl.naturalWidth > 0) {
        extractAlphaFromImage(imgEl, src);
    }

    const targetRect = (imgEl || element).getBoundingClientRect();
    if (
        clientX < targetRect.left ||
        clientX > targetRect.right ||
        clientY < targetRect.top ||
        clientY > targetRect.bottom
    ) {
        return false;
    }

    if (targetRect.width <= 0 || targetRect.height <= 0) return false;

    const u = (clientX - targetRect.left) / targetRect.width;
    const v = (clientY - targetRect.top) / targetRect.height;

    return isPointOpaque(src, u, v, threshold);
}

/**
 * Traverse stacked elements at (clientX, clientY) and return the topmost element
 * that is solid/opaque according to alpha hit-testing.
 *
 * @param {number} clientX Viewport X
 * @param {number} clientY Viewport Y
 * @param {string} [selector='[data-alpha-test]'] CSS selector for candidate elements
 * @param {number} [threshold=25] Alpha threshold
 * @returns {HTMLElement|null} The topmost opaque element or null
 */
export function resolveTopOpaqueElement(clientX, clientY, selector = '[data-alpha-test]', threshold = 25) {
    if (typeof document === 'undefined') return null;

    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
        const candidate = el.closest(selector);
        if (candidate && isElementOpaqueAtPoint(candidate, clientX, clientY, threshold)) {
            return candidate;
        }
    }
    return null;
}

function getZIndex(el) {
    const z = el.style?.zIndex || (typeof window !== 'undefined' ? window.getComputedStyle(el).zIndex : 'auto');
    return z === 'auto' ? 0 : parseInt(z, 10) || 0;
}

function compareStackOrder(a, b) {
    const zA = getZIndex(a);
    const zB = getZIndex(b);
    if (zA !== zB) return zB - zA; // Higher z-index comes first (on top)

    if (typeof Node !== 'undefined') {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return 1; // b is after a in DOM -> b is on top
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return -1; // a is after b in DOM -> a is on top
    }
    return 0;
}

/**
 * Global dynamic pointer-events manager.
 * Bypasses transparent regions of [data-alpha-test] elements under the cursor
 * by dynamically setting `pointer-events: none` on transparent areas so that
 * underlying tokens can be hovered, clicked, and dragged seamlessly.
 */
export function updateAlphaPointerEvents(clientX, clientY) {
    if (typeof document === 'undefined') return;

    // During active dragging, do not interfere with pointer events
    if (document.body.classList.contains('gi-dnd-active')) {
        for (const el of activeDisabledElements) {
            el.style.pointerEvents = '';
        }
        activeDisabledElements.clear();
        return;
    }

    // Query all alpha-tested elements (avoids elementsFromPoint omitting pointer-events: none elements)
    const allAlpha = document.querySelectorAll('[data-alpha-test]');
    const intersecting = [];

    for (let i = 0; i < allAlpha.length; i++) {
        const el = allAlpha[i];
        const rect = el.getBoundingClientRect();
        if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        ) {
            intersecting.push(el);
        } else if (activeDisabledElements.has(el)) {
            el.style.pointerEvents = '';
            activeDisabledElements.delete(el);
        }
    }

    if (intersecting.length === 0) {
        for (const el of activeDisabledElements) {
            el.style.pointerEvents = '';
        }
        activeDisabledElements.clear();
        return;
    }

    // Sort intersecting elements top to bottom
    intersecting.sort(compareStackOrder);

    let foundTopOpaque = false;
    for (const el of intersecting) {
        if (!foundTopOpaque) {
            const opaque = isElementOpaqueAtPoint(el, clientX, clientY);
            if (opaque) {
                if (activeDisabledElements.has(el)) {
                    el.style.pointerEvents = '';
                    activeDisabledElements.delete(el);
                }
                foundTopOpaque = true;
            } else {
                if (!activeDisabledElements.has(el)) {
                    el.style.pointerEvents = 'none';
                    activeDisabledElements.add(el);
                }
            }
        } else {
            if (activeDisabledElements.has(el)) {
                el.style.pointerEvents = '';
                activeDisabledElements.delete(el);
            }
        }
    }
}

/**
 * Initialize global pointer listeners for transparent pixel pass-through.
 */
export function initAlphaHitTesting() {
    if (typeof window === 'undefined' || isGlobalInitialized) return;
    isGlobalInitialized = true;

    window.addEventListener('pointermove', (e) => {
        updateAlphaPointerEvents(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
        updateAlphaPointerEvents(e.clientX, e.clientY);
    }, { capture: true });
}

// Auto-initialize when running in browser
if (typeof window !== 'undefined') {
    initAlphaHitTesting();
}
