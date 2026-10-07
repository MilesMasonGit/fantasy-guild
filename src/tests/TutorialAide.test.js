// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    setTutorialAideTarget,
    resolveTutorialTargetElement,
    TUTORIAL_AIDE_EVENTS
} from '../ui/components/base/TutorialAideOverlay.jsx';
import { EventBus } from '../systems/core/EventBus.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';

/**
 * The beacon for each tutorial step (rewritten with the chain, Token
 * Lifecycle 9.5). Tokens on the mat are found by `data-token-type`; a step
 * whose Token is not on the mat yet points at the orb or Shop card that gets it.
 */
describe('Tutorial Aide Target Resolution & Events', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="guild-bubble-target">Guild Hall</div>
            <div id="bank-bubble-target">Bank</div>
            <div id="shop-bubble-target">Shop</div>
            <div id="rightmost-hero-dock">
                <div data-hero-dock-tab="true">Hero Arthur</div>
            </div>
            <div id="board-container">
                <div data-token-art="true" data-token-type="token_guild_hall" data-guild-hall="true">Guild Hall Token</div>
                <div data-token-art="true" data-token-type="token_oak_forest">Oak Forest Token</div>
                <div data-token-art="true" data-token-type="token_oak_tree">Oak Tree Token</div>
            </div>
            <div id="sprite-layer">
                <div data-item-sprite="true">Wood Drop</div>
            </div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('publishes hover and unhover events via setTutorialAideTarget', () => {
        const events = [];
        const unsub1 = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.HOVER, (e) => events.push({ type: 'hover', ...e }));
        const unsub2 = EventBus.subscribe(TUTORIAL_AIDE_EVENTS.UNHOVER, (e) => events.push({ type: 'unhover', ...e }));

        setTutorialAideTarget('tut_recruit');
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: 'hover', questId: 'tut_recruit' });

        setTutorialAideTarget(null);
        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({ type: 'unhover' });

        unsub1();
        unsub2();
    });

    it('every tutorial step has a beacon on a new game’s screen', () => {
        for (const { id } of TUTORIAL_QUESTS) {
            expect(resolveTutorialTargetElement(id), id).not.toBeNull();
        }
    });

    it('points at the right thing for each step', () => {
        const text = (id) => resolveTutorialTargetElement(id)?.textContent;
        const elId = (id) => resolveTutorialTargetElement(id)?.id;

        expect(elId('tut_recruit')).toBe('guild-bubble-target');
        expect(resolveTutorialTargetElement('tut_flag').getAttribute('data-hero-dock-tab')).toBe('true');
        expect(text('tut_log')).toBe('Oak Tree Token');
        expect(text('tut_collect')).toBe('Wood Drop');
        expect(elId('tut_bank')).toBe('bank-bubble-target');
        // Nothing bought yet: the Shop orb.
        expect(elId('tut_shop')).toBe('shop-bubble-target');
        expect(elId('tut_foundation')).toBe('shop-bubble-target');
        expect(elId('tut_explore')).toBe('shop-bubble-target');
    });

    it('prefers the Shop card, then the Token on the mat, once they exist', () => {
        document.body.innerHTML += `
            <div data-shop-item="token_wood_foundation">Wood Foundation card</div>
            <div data-shop-item="token_farmland">Farmland card</div>
        `;
        expect(resolveTutorialTargetElement('tut_foundation').textContent).toBe('Wood Foundation card');
        expect(resolveTutorialTargetElement('tut_shop').textContent).toBe('Wood Foundation card');
        expect(resolveTutorialTargetElement('tut_workbench').textContent).toBe('Wood Foundation card');

        document.body.innerHTML += `
            <div data-token-art="true" data-token-type="token_wood_foundation">Wood Foundation Token</div>
            <div data-token-art="true" data-token-type="token_workbench">Workbench Token</div>
            <div data-token-art="true" data-token-type="token_ripe_wheat">Ripe Wheat Token</div>
        `;
        expect(resolveTutorialTargetElement('tut_workbench').textContent).toBe('Wood Foundation Token');
        expect(resolveTutorialTargetElement('tut_charcoal').textContent).toBe('Workbench Token');
        expect(resolveTutorialTargetElement('tut_farmland').textContent).toBe('Farmland card');
        expect(resolveTutorialTargetElement('tut_wheat').textContent).toBe('Ripe Wheat Token');
    });

    it('an old chain id resolves to nothing', () => {
        expect(resolveTutorialTargetElement('tutorial_4')).toBeNull();
        expect(resolveTutorialTargetElement('tutorial_12')).toBeNull();
    });

    it('identifies the Guild Hall Upgrade screen target for Recruit a Hero', () => {
        document.body.innerHTML += `
            <div data-guild-hall-board="true">
                <div id="guild-roster-upgrade-node" data-guild-roster-upgrade="true">Guild Roster Upgrade</div>
            </div>
            <div id="inspection-panel">
                <button id="guild-upgrade-button" data-guild-upgrade-button="true" data-guild-roster-upgrade-button="true">Claim Starter Hero (Free)</button>
            </div>
        `;

        const matNode = document.querySelector('[data-guild-roster-upgrade="true"]');
        expect(matNode.id).toBe('guild-roster-upgrade-node');
        expect(document.querySelector('[data-guild-roster-upgrade-button="true"]').id).toBe('guild-upgrade-button');

        // Target resolver prefers the node directly on the guild mat when present
        expect(resolveTutorialTargetElement('tut_recruit')).toBe(matNode);
    });
});
