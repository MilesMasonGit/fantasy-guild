// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TEXT_SIZES } from '../ui/components/base/textSizes.js';
import { DEFAULT_FONT_SIZES } from '../ui/modals/TypographyScaleModal.jsx';
import { SettingsManager } from '../systems/core/SettingsManager.js';

const css = readFileSync(path.resolve('src/tailwind.css'), 'utf8');
const mainCss = readFileSync(path.resolve('src/styles/main.css'), 'utf8');

/** The `font-size` a kit class's rule in tailwind.css sets, as written. */
function ruleFontSize(className) {
    const m = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`));
    return m ? m[1].match(/font-size:\s*([^;]+);/)?.[1].trim() : null;
}

/**
 * ⭐ The kit's text sizes: title, body and small for panels, display for the mat, each a class the
 * Text size setting scales.
 */
describe('Kit text sizes', () => {
    it('are exactly title, body, small and display', () => {
        expect(TEXT_SIZES.map(s => s.id)).toEqual(['title', 'body', 'small', 'display']);
        expect(new Set(TEXT_SIZES.map(s => s.cssVar)).size).toBe(4);
    });

    it('each class reads one step of the Text size setting, and its default is that step’s', () => {
        const settingSteps = Object.fromEntries(DEFAULT_FONT_SIZES.map(f => [f.key, f.defaultVal]));
        for (const size of TEXT_SIZES) {
            expect(ruleFontSize(size.className)).toBe(`var(${size.cssVar}) !important`);
            expect(settingSteps[size.cssVar]).toBe(size.px);
            expect(mainCss).toMatch(new RegExp(`${size.cssVar}:\\s*${size.px}px`));
        }
    });

    describe('in the page', () => {
        let style;
        let saved;
        beforeEach(() => {
            saved = SettingsManager.get('ui.fontSizes');
            style = document.createElement('style');
            style.textContent = TEXT_SIZES.map(s => `.${s.className} { font-size: ${ruleFontSize(s.className)}; }`).join('\n');
            document.head.appendChild(style);
        });
        afterEach(() => {
            style.remove();
            SettingsManager.applyFontSizes(saved);
            document.body.innerHTML = '';
        });

        /** jsdom leaves `var()` unresolved; resolve it against the root as a browser would. */
        const rendered = (el) => {
            const fs = getComputedStyle(el).fontSize;
            const m = fs.match(/^var\((--[\w-]+)\)$/);
            return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : fs;
        };

        it('scale when the setting changes', () => {
            const els = TEXT_SIZES.map(s => {
                const el = document.createElement('span');
                el.className = s.className;
                document.body.appendChild(el);
                return el;
            });
            const defaults = Object.fromEntries(DEFAULT_FONT_SIZES.map(f => [f.key, f.defaultVal]));
            SettingsManager.applyFontSizes(defaults);
            TEXT_SIZES.forEach((s, i) => expect(rendered(els[i])).toBe(`${s.px}px`));

            const bigger = Object.fromEntries(DEFAULT_FONT_SIZES.map(f => [f.key, f.defaultVal + 4]));
            SettingsManager.applyFontSizes(bigger);
            TEXT_SIZES.forEach((s, i) => expect(rendered(els[i])).toBe(`${s.px + 4}px`));
        });
    });
});
