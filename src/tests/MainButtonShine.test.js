import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

describe('Main-action button shine', () => {
    it('is on the Upgrade and Settle buttons', () => {
        const upgrade = read('ui/components/drawer/GuildUpgradeInspection.jsx');
        // The Upgrade button is the kit's main button, which wears the shine.
        expect(upgrade).toMatch(/<KitButton\s+id="guild-upgrade-button"/);
        const settle = read('ui/components/atlas/WorldDrawer.jsx');
        // Settle is the world map's main button: the kit's main tone, which wears the shine.
        expect(settle).toMatch(/tone=\{KIT_BUTTON_TONE\.MAIN\}\s+data-world-settle/);
        expect(read('ui/components/base/KitButton.jsx')).toMatch(/main: 'ui-shine /);
    });

    it('is a stepped, once-only solid band over the whole button that stops for reduced motion', () => {
        const css = read('tailwind.css');
        expect(css).toMatch(/\.ui-shine::before\s*\{[^}]*z-index: 1;/);
        expect(css).toMatch(/\.ui-shine::before\s*\{[^}]*rgba\(255, 255, 255, 0\.75\)/);
        expect(css).toMatch(/animation: ui-shine-sweep 280ms steps\(7, end\) 1 both/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.ui-shine:hover:not\(:disabled\)::before \{ animation: none; \}/);
    });
});
