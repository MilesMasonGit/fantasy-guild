import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    setTutorialAideTarget,
    resolveTutorialTargetElement,
    TUTORIAL_AIDE_EVENTS
} from '../ui/components/base/TutorialAideOverlay.jsx';
import { EventBus } from '../systems/core/EventBus.js';

describe('Tutorial Aide Target Resolution & Events', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="guild-bubble-target">Guild Hall</div>
            <div id="bank-bubble-target">Bank</div>
            <div id="vault-bubble-target">Vault</div>
            <div id="cartographer-bubble-target">Cartographer</div>
            <div id="tray-bubble-target" data-tray-container>
                <div data-alpha-test="true">Guild Hall Token</div>
            </div>
            <div id="rightmost-hero-dock">
                <div data-hero-dock-tab="true">Hero Arthur</div>
            </div>
            <div id="board-container">
                <div id="tile-24" data-tile-staffed="true" data-tile-has-token="true">Guild Hall with Hero</div>
                <div data-board-map-id="map-instance-1">Map</div>
            </div>
            <div id="sprite-layer">
                <div data-item-sprite="true">Wood Drop</div>
                <div data-token-sprite="true">Oak Forest Drop</div>
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

        setTutorialAideTarget('tutorial_1');
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: 'hover', questId: 'tutorial_1' });

        setTutorialAideTarget(null);
        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({ type: 'unhover' });

        unsub1();
        unsub2();
    });

    it('resolves the correct DOM targets for all 16 tutorial quests', () => {
        // tutorial_1: Place Guild Hall Token from Tray
        const t1 = resolveTutorialTargetElement('tutorial_1');
        expect(t1).not.toBeNull();
        expect(t1.textContent).toBe('Guild Hall Token');

        // tutorial_2: Recruit a Hero
        const t2 = resolveTutorialTargetElement('tutorial_2');
        expect(t2).not.toBeNull();
        expect(t2.id).toBe('guild-bubble-target');

        // tutorial_3: Upgrade Guild Hall Production
        const t3 = resolveTutorialTargetElement('tutorial_3');
        expect(t3).not.toBeNull();
        expect(t3.id).toBe('guild-bubble-target');

        // tutorial_4: Explore Map (board map)
        const t4 = resolveTutorialTargetElement('tutorial_4');
        expect(t4).not.toBeNull();
        expect(t4.getAttribute('data-board-map-id')).toBe('map-instance-1');

        // tutorial_5: Place another Token (floating token on playmat)
        const t5 = resolveTutorialTargetElement('tutorial_5');
        expect(t5).not.toBeNull();
        expect(t5.getAttribute('data-token-sprite')).toBe('true');

        // tutorial_6: Deploy a Hero
        const t6 = resolveTutorialTargetElement('tutorial_6');
        expect(t6).not.toBeNull();
        expect(t6.getAttribute('data-hero-dock-tab')).toBe('true');

        // tutorial_7: Token Cycles (Staffed Token with Hero)
        const t7 = resolveTutorialTargetElement('tutorial_7');
        expect(t7).not.toBeNull();
        expect(t7.id).toBe('tile-24');
        expect(t7.getAttribute('data-tile-staffed')).toBe('true');

        // tutorial_8: Collect Items
        const t8 = resolveTutorialTargetElement('tutorial_8');
        expect(t8).not.toBeNull();
        expect(t8.getAttribute('data-item-sprite')).toBe('true');

        // tutorial_9: Exhaust one Token
        const t9 = resolveTutorialTargetElement('tutorial_9');
        expect(t9).not.toBeNull();
        expect(t9.id).toBe('tile-24');

        // tutorial_10: Open Bank
        const t10 = resolveTutorialTargetElement('tutorial_10');
        expect(t10).not.toBeNull();
        expect(t10.id).toBe('bank-bubble-target');

        // tutorial_11: Equip Hero
        const t11 = resolveTutorialTargetElement('tutorial_11');
        expect(t11).not.toBeNull();

        // tutorial_12: Open Vault
        const t12 = resolveTutorialTargetElement('tutorial_12');
        expect(t12).not.toBeNull();
        expect(t12.id).toBe('vault-bubble-target');

        // tutorial_13: Stage Token
        const t13 = resolveTutorialTargetElement('tutorial_13');
        expect(t13).not.toBeNull();

        // tutorial_14: Context Token
        const t14 = resolveTutorialTargetElement('tutorial_14');
        expect(t14).not.toBeNull();

        // tutorial_15: Cartographer's Shop
        const t15 = resolveTutorialTargetElement('tutorial_15');
        expect(t15).not.toBeNull();
        expect(t15.id).toBe('cartographer-bubble-target');

        // tutorial_16: Buy a Map
        const t16 = resolveTutorialTargetElement('tutorial_16');
        expect(t16).not.toBeNull();
    });

    it('returns null for tutorial_4 when no map is on the board', () => {
        document.querySelector('[data-board-map-id]')?.remove();
        expect(resolveTutorialTargetElement('tutorial_4')).toBeNull();
    });

    it('returns null for tutorial_7 when no token is staffed by a hero', () => {
        document.querySelector('[data-tile-staffed="true"]')?.removeAttribute('data-tile-staffed');
        expect(resolveTutorialTargetElement('tutorial_7')).toBeNull();
    });

    it('identifies Guild Hall Upgrade screen targets for Recruit a Hero and Wishing Well quests', () => {
        document.body.innerHTML += `
            <div data-guild-hall-board="true">
                <div id="guild-roster-upgrade-node" data-guild-roster-upgrade="true">Guild Roster Upgrade</div>
                <div id="guild-wishing-well-upgrade-node" data-guild-wishing-well-upgrade="true">Wishing Well Upgrade</div>
            </div>
            <div id="inspection-panel">
                <button id="guild-upgrade-button" data-guild-upgrade-button="true" data-guild-roster-upgrade-button="true" data-guild-well-upgrade-button="true">Claim Starter Hero (Free)</button>
            </div>
        `;

        const matNode = document.querySelector('[data-guild-roster-upgrade="true"]');
        expect(matNode).not.toBeNull();
        expect(matNode.id).toBe('guild-roster-upgrade-node');

        const wellNode = document.querySelector('[data-guild-wishing-well-upgrade="true"]');
        expect(wellNode).not.toBeNull();
        expect(wellNode.id).toBe('guild-wishing-well-upgrade-node');

        const upgradeBtn = document.querySelector('[data-guild-upgrade-button="true"]');
        expect(upgradeBtn).not.toBeNull();
        expect(upgradeBtn.id).toBe('guild-upgrade-button');
        expect(document.querySelector('[data-guild-roster-upgrade-button="true"]')).toBe(upgradeBtn);
        expect(document.querySelector('[data-guild-well-upgrade-button="true"]')).toBe(upgradeBtn);

        // Target resolver prefers the node directly on the guild mat when present
        expect(resolveTutorialTargetElement('tutorial_2')).toBe(matNode);
        expect(resolveTutorialTargetElement('tutorial_3')).toBe(wellNode);
    });

    it('highlights finite non-infinite tokens on the playmat for Exhaust one Token quest', () => {
        document.body.innerHTML = `
            <div id="tile-10" data-tile-has-token="true">Infinite Guild Hall</div>
            <div id="tile-12" data-tile-has-token="true" data-tile-finite-token="true">Oak Tree (Finite)</div>
        `;

        const target = resolveTutorialTargetElement('tutorial_9');
        expect(target).not.toBeNull();
        expect(target.id).toBe('tile-12');
    });
});
