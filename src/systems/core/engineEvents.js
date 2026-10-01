// Fantasy Guild — global event names (CR3-559)

/**
 * ⭐ **Every global EventBus event, declared once.** The board's own events
 * (`board:*`, plus the bare `token_placed`) live in `board/boardEvents.js`;
 * everything else lives here. A publish or subscribe by raw string anywhere in
 * `src/` fails `EngineEventNames.test.js`, because a typo in a raw string is a
 * subscription that silently never fires.
 *
 * Two groups, split by **who may publish**:
 *
 * * `ENGINE_EVENTS` — published by the engine (`src/systems`). The rule
 *   (R5-Q2 = A, CR3-306): **an engine command announces its own change; the
 *   UI never publishes an engine event.** The only exceptions are the dev
 *   panels listed in the guard test (they fake engine changes on purpose).
 * * `UI_EVENTS` — published by the UI. Most are UI-to-UI (`ui:*`, `dev:*`,
 *   `inspect_hero`). Two are **declared UI → engine notices**, facts the
 *   engine cannot observe for itself: `react:slot_selected` (a slot was
 *   chosen; the engine boots on it, CR3-307) and `ui_modal:opened` (the
 *   tutorial counts "open the Bank").
 *
 * `audio:play` is shared: the engine and the UI both ask for a sound.
 *
 * Payloads below are what the publishers actually send.
 *
 * ## Announced with no listener (CR3-107)
 * Some engine events have no subscriber today. Each is listed in
 * `NO_LISTENER` with the reason it is kept; the guard test fails if an event
 * gains or loses a listener without that list changing, so "sent to nobody" is
 * always a decision, never an accident.
 *
 * @see board/boardEvents.js for `BOARD_EVENTS`
 */
export const ENGINE_EVENTS = Object.freeze({
    /**
     * "Something changed, everyone re-check." Payload: none. Being retired in
     * stages (CR3-305): every engine publisher now sends a specific event
     * first, so a new subscriber should listen to that instead.
     */
    STATE_CHANGED: 'state_changed',

    /** A save slot was loaded. Payload: `{ slot, savedAt }`. */
    GAME_LOADED: 'game_loaded',

    /** Any hero field changed (HP, state, roster, equipment, xp). Payload: usually none; sometimes `{ heroId }`. */
    HEROES_UPDATED: 'heroes_updated',
    /** Payload: `{ heroId, name }`. */
    HERO_RECRUITED: 'hero_recruited',
    /** A skill gained a level. Payload: `{ heroId, heroName, skillId, newLevel, oldLevel, … }`. */
    HERO_LEVELED: 'hero_leveled',
    /** Payload: `{ heroId, heroName, fromJobId, fromJobName, toJobId, toJobName, gained, banked, restored }`. */
    HERO_PROMOTED: 'hero_promoted',
    /** A hero arrived at a Token to work it. Payload: `{ heroId, instanceId, typeId }` (`instanceId` null when none). */
    HERO_DEPLOYED: 'hero_deployed',
    /** A hero's HP reached zero. Payload: `{ heroId, cause }` ('effect' | 'status' | …). */
    HERO_DOWNED: 'hero_downed',
    /** Payload: `{ heroId, heroName, recoveryTime }`. */
    HERO_WOUNDED: 'hero_wounded',
    /** Payload: `{ heroId, heroName, recoveredHp }`. */
    HERO_RECOVERED: 'hero_recovered',
    /** A hero ate or drank from the Bank. Payload: `{ heroId, itemId, category, amount }`. */
    HERO_CONSUMED: 'hero_consumed',
    /** Payload: `{ heroId, slot, itemId, action: 'equip' }` or `{ heroId, slot, itemId: null, previousItemId, action: 'unequip' }`. */
    HERO_EQUIPMENT_CHANGED: 'hero_equipment_changed',

    /** The Bank changed. Payload: `{ itemId, amount, added|removed }`, or none for a bulk change. */
    INVENTORY_UPDATED: 'inventory_updated',
    /** Items did not fit in the Bank. Payload: `{ itemId, amount }`. */
    INVENTORY_OVERFLOW: 'inventory_overflow',

    /** Payload: `{ upgradeId, rank }`. */
    GUILD_UPGRADES_UPDATED: 'guild_upgrades_updated',
    /** Payload: `{ type: 'item' | 'enemy', id }`. */
    REGISTRY_UPDATED: 'registry_updated',
    /** First time an item was seen. Payload: `{ itemId, itemName }`. */
    ITEM_DISCOVERED: 'item_discovered',
    /** First time an enemy was seen. Payload: `{ enemyId, enemyName }`. */
    ENEMY_DISCOVERED: 'enemy_discovered',

    /** A quest's progress changed. Payload: `{ instanceId }` (or none for a sweep). */
    QUESTS_UPDATED: 'quests_updated',
    /** Payload: `{ instanceId, questId, tutorial }`. */
    QUEST_SPAWNED: 'quest_spawned',
    /** Payload: `{ questId, instanceId, tutorial, rewardItems }`. */
    QUEST_CLAIMED: 'quest_claimed',

    /** Payload: `{ typeId, instanceId, price }`. */
    TOKEN_PURCHASED: 'token_purchased',
    /** Payload: `{ instanceId, typeId, addedCharges, currentCharges }`. */
    TOKEN_RESTOCKED: 'token_restocked',

    /** The loop could not keep up and dropped time. Payload: `{ overflowMs }`. */
    TIME_OVERFLOW: 'time_overflow',
    /** Payload: `{ bankedMs, isSpending, multiplier }`. */
    TIME_BANK_UPDATED: 'time_bank_updated',

    /** Payload: the notification object. */
    NOTIFICATION_ADDED: 'notification_added',
    /** Payload: `{ id }`. */
    NOTIFICATION_DISMISSED: 'notification_dismissed',
    /** Payload: `{ id, … }` (the changed fields). */
    NOTIFICATION_UPDATED: 'notification_updated',

    /** Payload: `{ cardId, instanceId, heroId, enemyId, damage, hit, … }`. */
    COMBAT_HERO_ATTACK: 'combat_hero_attack',
    /** Payload: `{ cardId, heroId, enemyId, damage, hit, … }`. */
    COMBAT_ENEMY_ATTACK: 'combat_enemy_attack',
    /** Payload: `{ cardId, heroId, traitId, damage }`. */
    COMBAT_ENEMY_TRAIT_TRIGGER: 'combat_enemy_trait_trigger',
    /** Payload: `{ cardId, heroId, itemId, healed }`. */
    COMBAT_HERO_ATE: 'combat_hero_ate',
    /** Payload: `{ cardId, heroId, instanceId, areaId, enemyId, enemyName, drops }`. */
    COMBAT_VICTORY: 'combat_victory',
    /** Payload: `{ cardId, heroId, enemyId, enemyName, instanceId?, areaId?, drops }`. */
    LOOT_GENERATED: 'loot_generated',

    /** Payload: `{ targetType: 'hero' | 'enemy', targetId, statusId, stacks }`. */
    STATUS_APPLIED: 'status_applied',
    /** Payload: `{ targetId, statusId }`. */
    STATUS_BLOCKED: 'status_blocked',
    /** Payload: `{ targetType, targetId, damage }`. */
    STATUS_DOT_TICK: 'status_dot_tick',
    /** Payload: `{ heroId, statusId, removed }`. */
    STATUS_PURGED: 'status_purged',

    /** The player changed a setting. Payload: the whole settings object. */
    SETTINGS_UPDATED: 'settings_updated',
    /** Payload: `{ track }`. */
    BGM_TRACK_CHANGED: 'bgm:track_changed',
    /** Shared engine/UI channel: play a sound. Payload: `{ clip, options? }`. */
    AUDIO_PLAY: 'audio:play',
});

export const UI_EVENTS = Object.freeze({
    /** ⭐ UI → engine notice: a save slot was chosen. Payload: `{ index, isNewGame }`. The engine boots on it (CR3-307). */
    REACT_SLOT_SELECTED: 'react:slot_selected',
    /** ⭐ UI → engine notice: a window opened. Payload: `{ modalId }`. The tutorial counts it. */
    UI_MODAL_OPENED: 'ui_modal:opened',

    /** Payload: `{ heroId }`. */
    INSPECT_HERO: 'inspect_hero',
    /** A collect particle reached its Token. Payload: `{ instanceId, … }`. */
    PARTICLE_LANDED: 'particle_landed',
    /** Payload: `{ tab }`. */
    UI_OPEN_DRAWER: 'ui:open_drawer',
    /** Payload: `{ heroId }`. */
    UI_OPEN_FLAG_RULES: 'ui:open_flag_rules',
    /** Payload: `{ questId }`. */
    TUTORIAL_AIDE_HOVER: 'tutorial_aide:hover',
    /** Payload: none. */
    TUTORIAL_AIDE_UNHOVER: 'tutorial_aide:unhover',
    /** The playmat tuner swapped the terrain art. Payload: none. */
    TERRAIN_ART_SET_CHANGED: 'terrain_art_set_changed',

    /** Dev panel only. Payload: none. */
    DEV_TOGGLE_SANDBOX: 'dev:toggle-sandbox',
    /** Dev stress harness. Payload: `{ name, id }`. */
    DEV_STRESS_STARTED: 'dev:stress_started',
});

/**
 * Names subscribed somewhere with **no publisher** — dead listeners owned by
 * other tickets. They are declared (so the subscriptions name a constant) and
 * pinned here so the list can only shrink. Kept in a separate object so no
 * live code is tempted to publish them.
 */
export const ORPHAN_EVENTS = Object.freeze({
    /** ⚠ No publisher (CR3-461): `ReactRoot` listens. */
    UI_OPEN_GUILD_HALL: 'ui:open_guild_hall',
    /** ⚠ No publisher (CR3-461): `ReactRoot` listens. */
    UI_CLOSE_GUILD_HALL: 'ui:close_guild_hall',
    /** ⚠ No publisher (CR3-461): `ReactRoot` listens. */
    UI_TOGGLE_GUILD_HALL: 'ui:toggle_guild_hall',
    /** ⚠ No publisher (CR3-461): `TestDashboard` listens. */
    DEV_OPEN_ANIMATION_STUDIO: 'dev:open-animation-studio',
    /** ⚠ No publisher (CR3-461): `ReactRoot`, `DockEquipmentGrid`. The live event is `hero_equipment_changed`. */
    HERO_EQUIPPED: 'hero_equipped',
    /** ⚠ No publisher (CR3-461): the dock and inspection sheet list it. Statuses announce through `heroes_updated`. */
    HERO_STATUS_CHANGED: 'hero:status_changed',
    /** ⚠ No publisher (R9, `AudioSystem`). */
    COMBAT_DEFEAT: 'combat_defeat',
    /** ⚠ No publisher (R9, `AudioSystem`). */
    INVASION_STARTED: 'invasion_started',
    /** ⚠ No publisher (R9, `AudioSystem`). */
    HERO_ASSIGNED: 'hero_assigned',
    /** ⚠ No publisher (R9, `AudioSystem`). */
    SKILL_LEVELED: 'skill_leveled',
    /** ⚠ No publisher (CR3-107): the On Tick trigger's bus name. `LiveEffects` fires its statements directly, so `TriggerSystem`'s subscription to it is inert. */
    EFFECT_TICK: 'effect_tick',
});

/**
 * CR3-107: engine events published with **no subscriber**, and why each is
 * kept rather than deleted. They cost ~12 ns a publish with nobody listening
 * (R1 §4.2), and each marks a moment a rule, the Perf HUD or the console
 * (`Game.EventBus.setLogging(true)`) can hook without touching the engine.
 */
export const NO_LISTENER = Object.freeze({
    [ENGINE_EVENTS.REGISTRY_UPDATED]: 'console affordance; the discovery events below are the specific ones',
    [ENGINE_EVENTS.ITEM_DISCOVERED]: 'first-seen moment, for a future "new item" notice',
    [ENGINE_EVENTS.ENEMY_DISCOVERED]: 'first-seen moment, for a future bestiary notice',
    [ENGINE_EVENTS.QUEST_SPAWNED]: 'quest moment; quest Tokens announce on the board',
    [ENGINE_EVENTS.TOKEN_RESTOCKED]: 'player action moment; the board events carry the redraw',
    [ENGINE_EVENTS.LOOT_GENERATED]: 'combat moment; loot lands as sprites',
    [ENGINE_EVENTS.HERO_WOUNDED]: 'combat moment; HEROES_UPDATED carries the redraw',
    [ENGINE_EVENTS.HERO_RECOVERED]: 'combat moment; HEROES_UPDATED carries the redraw',
    [ENGINE_EVENTS.HERO_CONSUMED]: 'combat moment; INVENTORY_UPDATED carries the redraw',
    [ENGINE_EVENTS.COMBAT_HERO_ATE]: 'combat moment, for a future floating-text cue',
    [ENGINE_EVENTS.COMBAT_ENEMY_TRAIT_TRIGGER]: 'combat moment, for a future floating-text cue',
    [ENGINE_EVENTS.STATUS_APPLIED]: 'status moment (Effects Grammar v2 will listen)',
    [ENGINE_EVENTS.STATUS_BLOCKED]: 'status moment (Effects Grammar v2 will listen)',
    [ENGINE_EVENTS.STATUS_DOT_TICK]: 'status moment (Effects Grammar v2 will listen)',
    [ENGINE_EVENTS.STATUS_PURGED]: 'status moment (Effects Grammar v2 will listen)',
    [ENGINE_EVENTS.BGM_TRACK_CHANGED]: 'console affordance for the music system',
});
