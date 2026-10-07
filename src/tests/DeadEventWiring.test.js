import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-ended event wiring, guarded.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');

function sourceFiles(dir = SRC) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
        return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
    });
}

const FILES = sourceFiles().map(file => ({
    path: path.relative(SRC, file).replace(/\\/g, '/'),
    text: fs.readFileSync(file, 'utf8')
}));

/** Real code only — a mention inside a comment is a note about history, not a wire. */
function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CODE = FILES.map(f => ({ ...f, text: stripComments(f.text) }));

function sitesFor(pattern) {
    return CODE.filter(f => pattern.test(f.text)).map(f => f.path);
}

describe('dead event wiring stays dead', () => {
    /**
     * the player-visible one. Three sites published `ui:notify` and nothing
     * had ever subscribed to it, so a refused Bank sale and both job-change
     * outcomes said nothing at all. They now call `NotificationSystem`
     * directly, which is how the rest of the UI speaks to the player.
     */
    it('nothing publishes or subscribes to `ui:notify` (CR2-130)', () => {
        expect(sitesFor(/['"]ui:notify['"]/)).toEqual([]);
    });

    /**
     * ⚠️ **Repointed in Promotes rule P3.** This used to check `JobChangeModal`
     * for both notifications. That screen no longer performs a promotion — it
     * plans one, and the act happens on a Token — so requiring it to announce
     * an outcome would be requiring it to lie.
     *
     * The success announcement moved to `BoardPromotion`, which is what
     * promotes. A refused acceptance returns its reason to the ceremony (P4),
     * which shows it beside the button that was pressed.
     *
     * ⚠️ **Repointed in slice 2.2.** The Bank sale half is gone: gold is
     * retired and the Bank has no sell controls, so there is no refused sale to
     * announce. What is checked instead is that the Bank no longer sells.
     */
    it('the job change reaches the player through NotificationSystem, and the Bank no longer sells (CR2-130, SP-65)', () => {
        const bank = CODE.find(f => f.path === 'ui/components/drawer/BankTab.jsx');
        const promo = CODE.find(f => f.path === 'systems/board/BoardPromotion.js');
        expect(bank, 'BankTab.jsx').toBeDefined();
        expect(promo, 'BoardPromotion.js').toBeDefined();

        // Nothing sells to the merchant any more (slice 2.2).
        expect(bank.text).not.toMatch(/CommerceSystem|sellItem/);
        // A completed promotion says so.
        expect(promo.text).toMatch(/NotificationSystem\.success\(/);
    });

    /**
     * `setCardTier` went but its subscription did not, leaving a handler that
     * would have thrown a ReferenceError the moment anything published the
     * event. It never did, so it never threw.
     */
    it('the `ui:card_tier_changed` subscription is gone, along with `setCardTier` (CR2-191)', () => {
        expect(sitesFor(/ui:card_tier_changed/)).toEqual([]);
        expect(sitesFor(/setCardTier/)).toEqual([]);
    });

    /**
     * a bare `'token_exhausted'` subscription sat directly beneath the real
     * `BOARD_EVENTS.TOKEN_DEPLETED` one and reported the same quest target. It
     * read as a double-count and was in fact dead: `token_exhausted` is a quest
     * target name and a tile-log entry type, never an EventBus event.
     */
    it('the quest counter reports token exhaustion exactly once (CR2-195)', () => {
        const quests = CODE.find(f => f.path === 'systems/quests/QuestManager.js');
        expect(quests).toBeDefined();
        const reports = quests.text.match(/reportProgress\('token_exhausted'\)/g) || [];
        expect(reports).toHaveLength(1);
        expect(quests.text).not.toMatch(/subscribe\(\s*'token_exhausted'/);
    });

    /**
     * two particle subscriptions kept alive next to the one that replaced
     * them. `items_consumed` belonged to the retired hero food/drink model
     * and was never published by anything; `loot_generated` flew items out of
     * a `data.cardId` element that no longer exists in the DOM.
     * `spawnFlyingItems` went with them as its last two callers.
     */
    it('ParticleOverlay listens only for board collection (CR2-148, CR2-149)', () => {
        const overlay = CODE.find(f => f.path === 'ui/components/base/ParticleOverlay.jsx');
        expect(overlay).toBeDefined();
        expect(overlay.text).not.toMatch(/subscribe\(\s*'items_consumed'/);
        expect(overlay.text).not.toMatch(/subscribe\(\s*'loot_generated'/);
        expect(overlay.text).not.toMatch(/spawnFlyingItems/);
        expect(overlay.text).toMatch(/SPRITE_COLLECTED/);
    });

    it('nothing anywhere subscribes to `items_consumed` (CR2-148)', () => {
        expect(sitesFor(/subscribe\(\s*['"]items_consumed['"]/)).toEqual([]);
    });

    /**
     * `ui:open_loot_table` was the only door into `LootTableModal`, and
     * nothing ever published it. The modal, its `LootModule` and the
     * `useDiscovery` hook underneath went together on the drop tables they
     * would have shown are already on screen in `TokenInspection` and
     * `MapInspection`, percentages included.
     *
     * ⚠️ Not "never wanted" — superseded. If loot tables come back on a modal,
     * they get built for the current Token/Map system rather than restored.
     */
    it('`ui:open_loot_table` is neither published nor subscribed (CR2-132)', () => {
        expect(sitesFor(/(publish|subscribe)\(\s*['"]ui:open_loot_table['"]/)).toEqual([]);
    });

    /**
     * five one-ended wires in `systems/core/`. `card_spawned` was a subscriber
     * with no publisher; the other four were publishers with nobody listening.
     * `game_saved` carried a `{slot, timestamp, autoSaveInterval}` payload
     * written for a save-status indicator that was never built — the owner
     * chose to drop the publish rather than build the indicator.
     */
    it.each([
        ['card_spawned', 'a subscriber with no publisher — cards are retired'],
        ['cards_updated', 'a publisher with no subscriber — retired with cards'],
        ['game_saved', 'the save-status indicator was never built (owner decision)'],
        ['game_loop_started', 'never had a subscriber'],
        ['game_loop_stopped', 'never had a subscriber'],
        ['game_started', 'never had a subscriber']
    ])('`%s` is neither published nor subscribed (CR2-046 — %s)', (eventName) => {
        expect(sitesFor(new RegExp(`(publish|subscribe)\\(\\s*['"]${eventName}['"]`))).toEqual([]);
    });

    /**
     * ⚠️ `EventBus.setLogging` / `getEventLog` / `hasSubscribers` are also
     * callerless and were deliberately KEPT. They are console affordances —
     * `main.jsx` exposes the engine as `window.Game`, so a person debugging can
     * run `Game.EventBus.setLogging(true)` and read back what actually fired.
     * "Is anything listening for this?" is the most common question on this
     * codebase, and `hasSubscribers` answers it. Do not delete them as dead code.
     */
    it('the EventBus debugging affordances survive (CR2-046, kept deliberately)', () => {
        const bus = CODE.find(f => f.path === 'systems/core/EventBus.js');
        expect(bus).toBeDefined();
        expect(bus.text).toMatch(/setLogging\(/);
        expect(bus.text).toMatch(/getEventLog\(/);
        expect(bus.text).toMatch(/hasSubscribers\(/);
    });

    /**
     * a notification toggle for a category nothing ever publishes with.
     * `notify` maps category → settings key for `hero` and `item` only; every
     * other category falls through to an `undefined` lookup, which is not
     * `false`, so it shows regardless. `questEvents` therefore promised the
     * player a switch that did nothing.
     */
    it('`questEvents` is gone, and no notification claims the `quest` category (CR2-047)', () => {
        expect(sitesFor(/questEvents/)).toEqual([]);
        expect(sitesFor(/category:\s*['"]quest['"]/)).toEqual([]);
    });

    /**
     * `ui_modal:opened` works, but only by the coincidence of three string
     * literals matching across two files that know nothing about each other.
     * Three tutorial quests advance solely because a React hook fires it. The
     * fix was to write the contract down at both ends; this asserts the
     * documentation is still there and that both ends still agree on the
     * strings.
     */
    it('the `ui_modal:opened` contract is documented at both ends (CR2-094)', () => {
        const hook = FILES.find(f => f.path === 'ui/hooks/useUIModals.js');
        const quests = FILES.find(f => f.path === 'systems/quests/QuestManager.js');
        expect(hook.text).toMatch(/Contract: `ui_modal:opened`/);
        expect(quests.text).toMatch(/`ui_modal:opened` comes from the React layer/);

        // The hook is still the only publisher... (Named by
        // `UI_EVENTS.UI_MODAL_OPENED`.)
        expect(sitesFor(/publish\(\s*UI_EVENTS\.UI_MODAL_OPENED\b/)).toEqual(['ui/hooks/useUIModals.js']);
        // ...and QuestManager the only subscriber.
        expect(sitesFor(/subscribe\(\s*UI_EVENTS\.UI_MODAL_OPENED\b/)).toEqual(['systems/quests/QuestManager.js']);

        // Both ends must still agree on the modal ids. `vault` went with the
        // Token Vault (Token Lifecycle 9.3); its quest mapping went in 9.5.
        for (const modalId of ['bank', 'cartographer']) {
            expect(stripComments(quests.text)).toContain(`modalId === '${modalId}'`);
        }
        expect(stripComments(quests.text)).not.toContain(`modalId === 'vault'`);
    });
});
