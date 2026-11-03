import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ⭐ **A first find's shine leaves nothing behind** (T-202). The shine is an animation on the stub's
 * `::before`; held at its end by a `both` fill it stayed "in effect" for as long as the stub was
 * new, which Chrome keeps as a composited layer per stub (measured: 10 of them on a board of 9
 * stubs), and every stub drawn after one a layer too, for overlap. With no forwards fill the
 * animation ends and the pseudo-element is plain and invisible: the same pixels, no layer.
 */

const css = fs.readFileSync(path.join(process.cwd(), 'src/tailwind.css'), 'utf8');

/** The first rule body for `selector`. */
function ruleOf(selector) {
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is in tailwind.css`).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
}

describe('⭐ the stub shine', () => {
    it('plays once with no forwards fill, so a finished shine holds no layer', () => {
        const rule = ruleOf('.gi-stub-new::before');
        expect(rule).toMatch(/animation:\s*ui-shine-sweep\s+420ms\s+steps\(7, end\)\s+1\b/);
        expect(rule).not.toMatch(/\b(both|forwards)\b/);
    });

    it('is invisible at rest, or the band would stand on the stub once the animation has ended', () => {
        expect(ruleOf('.gi-stub-new::before')).toMatch(/opacity:\s*0\b/);
    });
});
