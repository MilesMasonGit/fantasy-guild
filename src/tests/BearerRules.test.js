import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import Statements from '../../cms/src/components/editors/Statements.jsx';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';

/**
 * ⭐ **A Token's and an item's rules, on the Rules Line** (Rules Line P6, E-9).
 *
 * Owner ruling 2026-09-12: an effect only this bearer uses is edited in place;
 * a shared one stays read-only with its count and Edit, because an in-place edit
 * would change every other bearer while looking local. And the separate "Rules
 * Text" section goes — it printed the same sentences twice.
 *
 * ⚠️ These mount the real bearer panel, which reads the CMS store. The store is
 * reset before and after every test, exactly as `CMSSmoke` does — nothing here
 * reaches the author's workspace.
 */

const originalFetch = globalThis.fetch;
const resetStore = () => useEntityStore.setState({
    items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
});

beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
    resetStore();
});
afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    resetStore();
});

const store = () => useEntityStore.getState();
const tokenNamed = (name, extra = {}) => {
    const id = store().addToken({ name, tags: ['Coast'] });
    if (Object.keys(extra).length) store().updateToken(id, extra);
    return id;
};
const effectWith = (name, statements) => store().addEffect({ name, statements });
/**
 * The Token is read from the store on every render, as `TokenEditor` does — a
 * Token passed once would never show its own `acceptedTokens` changing.
 */
function LiveToken({ tokenId }) {
    const token = useEntityStore((s) => s.tokens[tokenId]);
    return React.createElement(Statements, { token });
}
const mountToken = (tokenId) => render(React.createElement(LiveToken, { tokenId }));

/** Click a word, retype it, press Enter — as the author does. */
function retype(container, scope, slot, text) {
    fireEvent.click(scope.querySelector(`[data-rules-line] [data-slot="${slot}"]`));
    const box = container.querySelector('[data-retyping]');
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: 'Enter' });
}

describe('⭐ an effect only this Token uses is edited in place', () => {
    it('shows the line, and a retyped word writes to the effect', () => {
        const tokenId = tokenNamed('Shrimp Coast');
        const effectId = effectWith('Net', [{ id: 'stm_net', keyword: 'acts_as', payload: { tag: 'net', tier: 1 } }]);
        store().addEffectRef('tokens', tokenId, effectId);

        const { container } = mountToken(tokenId);
        const block = container.querySelector(`[data-editable-effect="${effectId}"]`);
        expect(block).not.toBeNull();
        expect(block.querySelector('[data-rules-line]').textContent).toBe('Acts as a Tier 1 net for adjacent stations.');
        expect(block.querySelector('[data-cost-strip]')).not.toBeNull();

        retype(container, block, 'tier', '3');
        expect(store().effects[effectId].statements[0].payload.tier).toBe(3);
        expect(container.querySelector('[data-rules-line]').textContent).toBe('Acts as a Tier 3 net for adjacent stations.');
    });

    it('offers no "Add rule" inside the effect — "New rule" beside it makes a new one', () => {
        const tokenId = tokenNamed('Shrimp Coast');
        const effectId = effectWith('Net', [{ id: 'stm_net', keyword: 'acts_as', payload: { tag: 'net', tier: 1 } }]);
        store().addEffectRef('tokens', tokenId, effectId);
        const { container } = mountToken(tokenId);
        const labels = [...container.querySelectorAll('button')].map((b) => b.textContent);
        expect(labels.filter((l) => l.includes('Add rule'))).toHaveLength(0);
        expect(labels.some((l) => l.includes('New rule'))).toBe(true);
    });

    it('says when the numbers shown are scaled for this Token', () => {
        const tokenId = tokenNamed('Shrimp Coast');
        const effectId = effectWith('Hit', [{ id: 'stm_hit', keyword: 'deals', payload: { amount: 2 },
            when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 } }]);
        store().addEffectRef('tokens', tokenId, effectId);
        store().setEffectRefScale('tokens', tokenId, effectId, 3);
        const { container } = mountToken(tokenId);
        expect(container.textContent).toContain('carries it at x3');
    });
});

describe('⚠️ a shared effect stays read-only', () => {
    it('shows its sentences, its count and Edit — and no line to click', () => {
        const a = tokenNamed('Shrimp Coast');
        const b = tokenNamed('Crab Coast');
        const effectId = effectWith('Net', [{ id: 'stm_net', keyword: 'acts_as', payload: { tag: 'net', tier: 1 } }]);
        store().addEffectRef('tokens', a, effectId);
        store().addEffectRef('tokens', b, effectId);

        const { container } = mountToken(a);
        const block = container.querySelector(`[data-shared-effect="${effectId}"]`);
        expect(block.textContent).toContain('Acts as a Tier 1 net for adjacent stations.');
        expect(container.querySelector('[data-rules-line]')).toBeNull();
        expect(container.textContent).toContain('shared x2');
        expect([...container.querySelectorAll('button')].some((btn) => btn.textContent.includes('Edit'))).toBe(true);
    });

    it('⚠️ names an applied effect by its name, not its id', () => {
        const a = tokenNamed('Shrimp Coast');
        const b = tokenNamed('Crab Coast');
        const poison = effectWith('Venom', [{ id: 'stm_v', keyword: 'deals', payload: { amount: 1 } }]);
        const effectId = effectWith('Spit', [{ id: 'stm_s', keyword: 'applies', payload: { effectId: poison, durationMs: 0 } }]);
        store().addEffectRef('tokens', a, effectId);
        store().addEffectRef('tokens', b, effectId);

        const { container } = mountToken(a);
        const block = container.querySelector(`[data-shared-effect="${effectId}"]`);
        expect(block.textContent).toContain('Venom');
        expect(block.textContent).not.toContain(poison);
    });
});

describe('⭐ one panel at a time, across every rule on the Token (E-5)', () => {
    it('opens beside the rule being edited and follows the author to the next', () => {
        const tokenId = tokenNamed('Shrimp Coast', { acceptedTokens: [{ tag: 'net', minTier: 1 }] });
        const one = effectWith('Net', [{ id: 'stm_net', keyword: 'acts_as', payload: { tag: 'net', tier: 1 } }]);
        const two = effectWith('Hit', [{ id: 'stm_hit', keyword: 'deals', payload: { amount: 2 },
            when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 } }]);
        store().addEffectRef('tokens', tokenId, one);
        store().addEffectRef('tokens', tokenId, two);

        const { container } = mountToken(tokenId);
        const panels = () => container.querySelectorAll('[data-rules-panel]');
        expect(panels()).toHaveLength(0);

        fireEvent.click(container.querySelector(`[data-editable-effect="${one}"] [data-slot="tier"]`));
        expect(panels()).toHaveLength(1);
        expect(panels()[0].closest(`[data-editable-effect="${one}"]`)).not.toBeNull();

        fireEvent.click(container.querySelector(`[data-editable-effect="${two}"] [data-slot="amount"]`));
        expect(panels()).toHaveLength(1);
        expect(panels()[0].closest(`[data-editable-effect="${two}"]`)).not.toBeNull();

        fireEvent.click(container.querySelector('[data-rules-line] [data-slot="minTier"]'));
        expect(panels()).toHaveLength(1);
        expect(panels()[0].closest('[data-editable-effect]')).toBeNull();
    });
});

describe('⭐ Requires on the Rules Line', () => {
    const seeded = () => {
        const provider = tokenNamed('Net Shed');
        const net = effectWith('Net', [{ id: 'stm_net', keyword: 'acts_as', payload: { tag: 'net', tier: 2 } }]);
        store().addEffectRef('tokens', provider, net);
        return tokenNamed('Shrimp Coast', { acceptedTokens: [{ tag: 'net', minTier: 1 }] });
    };
    const requiresLine = (container) => [...container.querySelectorAll('[data-rules-line]')]
        .find((l) => l.textContent.startsWith('Requires'));

    it('reads as its sentence, with who satisfies it', () => {
        const tokenId = seeded();
        const { container } = mountToken(tokenId);
        expect(requiresLine(container).textContent).toBe('Requires an adjacent Tier 1 net.');
        expect(container.querySelector('[data-satisfied-by]').textContent).toContain('Net Shed');
    });

    it('writes the tier and the capability back to acceptedTokens, in their plain shape', () => {
        const tokenId = seeded();
        const { container } = mountToken(tokenId);
        retype(container, requiresLine(container).parentElement, 'minTier', '3');
        expect(store().tokens[tokenId].acceptedTokens).toEqual([{ tag: 'net', minTier: 3 }]);
        // Tier 3 is more than the Net Shed's Tier 2, so nothing satisfies it now.
        expect(container.querySelector('[data-satisfied-by]').textContent).toContain('nothing yet');

        retype(container, requiresLine(container).parentElement, 'tag', 'pickaxe');
        expect(store().tokens[tokenId].acceptedTokens).toEqual([{ tag: 'pickaxe', minTier: 3 }]);
    });

    it('⚠️ cannot be retyped into a rule, and has no cost strip', () => {
        const tokenId = seeded();
        const { container } = mountToken(tokenId);
        const line = requiresLine(container);
        expect(line.querySelector('[data-slot="keyword"]')).toBeNull();
        const row = line.closest('[data-rules-editor]');
        expect(row.querySelector('[data-cost-strip]')).toBeNull();
        expect(container.textContent).not.toContain('Min Tool Tier');
    });

    it('removes a requirement from the Token', () => {
        const tokenId = seeded();
        const { container } = mountToken(tokenId);
        fireEvent.click(requiresLine(container).closest('[data-rules-editor]').querySelector('button[title="Remove rule"]'));
        expect(store().tokens[tokenId].acceptedTokens).toEqual([]);
    });
});

describe('the duplicate Rules Text section is gone (owner, P6)', () => {
    it('on the Item editor', () => {
        const itemId = store().addItem({ name: 'Raw Shrimp' });
        store().setActiveEntity(itemId, 'item');
        const { container } = render(React.createElement(ItemEditor));
        expect(container.textContent).toContain('Rules');
        expect(container.textContent).not.toContain('Rules Text');
    });
});
