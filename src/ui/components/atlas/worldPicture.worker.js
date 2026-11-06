// paints the world map's picture off the page's thread, so a new world (a reroll) never freezes the screen

import { paintWorld } from './worldPicture.js';

self.onmessage = (event) => {
    const { id, args } = event.data || {};
    try {
        const pixels = paintWorld(args);
        self.postMessage({ id, pixels }, [pixels.data.buffer]);
    } catch {
        self.postMessage({ id, pixels: null });
    }
};
