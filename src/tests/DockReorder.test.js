// A hero dropped on another on the hero bar moves to where that hero stands.
import { describe, it, expect, vi } from 'vitest';
import { reorderHeroInDock } from '../ui/components/dock/dockReorder.js';

describe('reorderHeroInDock — the shared logic both docks now call', () => {
    it('reorders to the target hero\'s current index', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2', 'h3'], 'h3', 'h1');
        expect(did).toBe(true);
        expect(heroManager.reorderHero).toHaveBeenCalledWith('h3', 0);
    });

    it('does nothing when the source and target are the same hero', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2'], 'h1', 'h1');
        expect(did).toBe(false);
        expect(heroManager.reorderHero).not.toHaveBeenCalled();
    });

    it('does nothing when the target is not in the list', () => {
        const heroManager = { reorderHero: vi.fn() };
        const did = reorderHeroInDock(heroManager, ['h1', 'h2'], 'h1', 'ghost');
        expect(did).toBe(false);
        expect(heroManager.reorderHero).not.toHaveBeenCalled();
    });
});
