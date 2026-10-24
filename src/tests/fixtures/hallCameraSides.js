// Fantasy Guild — test helper: the two sides of the Guild Hall camera in ReactRoot's layout.
//
// **For tests only.**

import fs from 'node:fs';
import { SRC, codeOf } from './sourceScan.js';

/**
 * ReactRoot's code (comments stripped) and the two sides of its `<HallCamera>`: `hall`, the Hall
 * screen in its `hall` prop (laid in the sky, gone while the camera rests on the mat), and `mat`,
 * its children (on the table, gone while the camera rests on the sky). What each side holds is
 * ReactRoot's; when each is mounted is the camera's (`HallCamera.test.js`).
 */
export function hallCameraSides() {
    const code = codeOf(fs.readFileSync(`${SRC}/ui/ReactRoot.jsx`, 'utf8'));
    const open = code.indexOf('<HallCamera');
    const close = code.indexOf('</HallCamera>');
    const hallAt = code.indexOf('hall={', open);
    const hallEnd = code.indexOf('</>', hallAt);
    if (open < 0 || close < open || hallAt < 0 || hallEnd < 0 || hallEnd > close) {
        throw new Error('ReactRoot has no <HallCamera hall={<>…</>}>…</HallCamera>');
    }
    return { code, camera: code.slice(open, close), hall: code.slice(hallAt, hallEnd), mat: code.slice(hallEnd, close) };
}
