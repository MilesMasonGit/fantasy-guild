// Fantasy Guild - Audio System
// Phase 25: Audio Foundation

import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';

/**
 * AudioSystem - Central manager for BGM and SFX
 * 
 * Handles:
 * - Looping BGM with cross-fading (stubbed)
 * - Punctuating SFX (Global vs Contextual)
 * - Volume control via SettingsManager
 * - Focus-tracking for hover-based sounds
 */
class AudioSystemClass {
    constructor() {
        this.bgm = null; // Current playing HTMLAudioElement
        this.currentFocusId = null;
        this.initialized = false;
        
        // Global gain adjustment to normalize loud assets
        // A slider value of 50% will result in 10% actual gain
        this.GLOBAL_MIXER_GAIN = 0.2;

        // Cache for preloaded SFX if needed
        this._sfxCache = new Map();
    }

    /**
     * Initialize the system and subscribe to events
     */
    init() {
        if (this.initialized) return;

        // Subscribe to Core Events. (The old per-area BGM switching died with
        // the single-active-area concept — CR-005; per-area music is a later
        // implementation pass, owner decision 2026-07-17.)
        EventBus.subscribe('audio:focus_changed', (data) => this.currentFocusId = data.cardId);
        EventBus.subscribe('audio:play', (data) => this.playSfx(data.clip));
        
        // Subscribe to Global SFX
        EventBus.subscribe('hero_leveled', () => this.playSfx('levelup'));
        EventBus.subscribe('skill_leveled', () => this.playSfx('levelup'));
        EventBus.subscribe('invasion_started', () => this.playSfx('invasion'));
        EventBus.subscribe('combat_victory', () => this.playSfx('victory'));
        EventBus.subscribe('combat_defeat', () => this.playSfx('defeat'));
        
        // Subscribe to Contextual SFX (Hover-only)
        EventBus.subscribe('combat_hero_attack', (data) => this.playContextualSfx(data.cardId, 'hit'));
        EventBus.subscribe('combat_enemy_attack', (data) => this.playContextualSfx(data.cardId, 'hit'));
        EventBus.subscribe('task_completed', (data) => this.playContextualSfx(data.cardId, 'task_done'));

        // Subscribe to Settings updates
        EventBus.subscribe('settings_updated', () => this.updateVolumes());

        this.initialized = true;
        logger.info('AudioSystem', 'Initialized');

        // One global BGM track for now (per-area music deferred, CR-005).
        this.handleAreaSwitch('area_guild_hall');
    }

    /**
     * Update volumes based on SettingsManager
     */
    updateVolumes() {
        const master = SettingsManager.get('audio.masterVolume') / 100;
        const music = SettingsManager.get('audio.musicVolume') / 100;
        
        if (this.bgm) {
            this.bgm.volume = master * music * this.GLOBAL_MIXER_GAIN;
        }
    }

    /**
     * Plays a global SFX regardless of hover state
     * @param {string} clipName 
     */
    playSfx(clipName) {
        const src = this._getSfxPath(clipName);
        if (!src) {
            logger.warn('AudioSystem', `No path found for clip: ${clipName}`);
            return;
        }

        const masterVol = SettingsManager.get('audio.masterVolume') ?? 100;
        const sfxVol = SettingsManager.get('audio.sfxVolume') ?? 100;
        const finalVol = (masterVol / 100) * (sfxVol / 100) * this.GLOBAL_MIXER_GAIN;

        logger.debug('AudioSystem', `Attempting to play SFX: ${clipName} | Vol: ${finalVol}`);

        let pool = this._sfxCache.get(clipName);
        if (!pool) {
            pool = [];
            this._sfxCache.set(clipName, pool);
        }

        let audio = pool.find(a => a.paused || a.ended);
        if (!audio && pool.length < 3) {
            audio = new Audio(src);
            pool.push(audio);
        } else if (!audio) {
            audio = pool[0];
            audio.pause();
        }

        audio.volume = finalVol;
        audio.currentTime = 0;
        
        audio.play().then(() => {
            logger.debug('AudioSystem', `Started playing: ${clipName}`);
        }).catch(e => {
            logger.error('AudioSystem', `SFX ${clipName} play failed: ${e.message}`);
        });
    }

    /**
     * Plays SFX only if the card is currently focused (hovered)
     * @param {string} cardId 
     * @param {string} clipName 
     */
    playContextualSfx(cardId, clipName) {
        if (this.currentFocusId !== cardId) return;
        this.playSfx(clipName);
    }

    /**
     * Handle BGM switching when area changes
     * @param {string} areaId 
     */
    handleAreaSwitch(areaId) {
        const musicPath = this._getMusicPath(areaId);
        if (!musicPath) return;

        // Stop current BGM
        if (this.bgm) {
            this.bgm.pause();
            this.bgm = null;
        }

        // Start new BGM
        this.bgm = new Audio(musicPath);
        this.bgm.loop = true;
        this.updateVolumes();
        
        this.bgm.play().catch(e => {
            logger.debug('AudioSystem', `BGM for ${areaId} play blocked: ${e.message}`);
        });
        
        logger.info('AudioSystem', `Switched BGM to: ${areaId}`);
    }

    /**
     * Resolve clip name to file path (Actual Kenney RPG Audio files)
     * @param {string} clip 
     * @returns {string|null}
     */
    _getSfxPath(clip) {
        const basePath = '/assets/audio/sfx/kenney_rpg-audio/Audio/';
        const map = {
            'levelup': 'handleSmallLeather.ogg',
            'invasion': 'bookFlip1.ogg',
            'victory': 'handleSmallLeather2.ogg',
            'defeat': 'bookFlip2.ogg',
            'hit': 'metalClick.ogg',
            'task_done': 'bookPlace1.ogg',
            'drag': 'cloth1.ogg',
            'drop': 'bookPlace1.ogg',
            'card_place': 'bookPlace1.ogg',
            'card_swap': 'cloth2.ogg',
            'hero_bench': 'cloth1.ogg',
            'hero_activate': 'handleSmallLeather.ogg',
            'hero_swap': 'cloth2.ogg',
            'hero_assign': 'handleSmallLeather.ogg',
            'item_equip': 'beltHandle1.ogg',
            'item_assign': 'bookPlace2.ogg',
            'tool_assign': 'handleSmallLeather2.ogg',
            'blueprint_assign': 'bookOpen.ogg',
            'unassign': 'clothBelt2.ogg',
            'ui_click': 'handleSmallLeather.ogg'
        };
        return map[clip] ? `${basePath}${map[clip]}` : null;
    }

    /**
     * Resolve area ID to music track
     * @param {string} areaId 
     * @returns {string|null}
     */
    _getMusicPath(areaId) {
        const basePath = '/assets/audio/bgm/';
        // Mapping AreaSet IDs to tracks
        const map = {
            'area_guild_hall': 'The_Unlit_Gallery.mp3',
            'area_whispering_woods': 'forest_theme.mp3',
            'area_misty_mountains': 'mountain_theme.mp3'
        };
        return map[areaId] ? `${basePath}${map[areaId]}` : null;
    }
}

export const AudioSystem = new AudioSystemClass();
