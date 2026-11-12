import { EventBus } from './EventBus.js';
import { SettingsManager } from './SettingsManager.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS, XP_FOR_EVERYONE_SOURCE } from './engineEvents.js';

export const BGM_PLAYLIST = [
    { id: 'gentle_pause', title: 'Gentle Pause', file: 'Gentle Pause.m4a' },
    { id: 'guitar_hearth', title: 'Guitar Hearth', file: 'Guitar Hearth.m4a' },
    { id: 'hearthside', title: 'Hearthside', file: 'Hearthside.m4a' },
    { id: 'piano_hearth', title: 'Piano Hearth', file: 'Piano Hearth.m4a' },
    { id: 'quiet_trail', title: 'Quiet Trail', file: 'Quiet Trail.m4a' },
    { id: 'tide_and_timber', title: 'Tide and Timber', file: 'Tide and Timber.m4a' },
    { id: 'warm_cedar', title: 'Warm Cedar', file: 'Warm Cedar.m4a' },
    { id: 'woolen_keys', title: 'Woolen Keys', file: 'Woolen Keys.m4a' }
];

const CALCULATOR_BUTTON_SFX = [
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_001_81851.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_002_81852.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_003_81853.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_004_81854.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_005_81855.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_006_81856.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_007_81857.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_008_81858.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_009_81859.mp3',
    '/assets/audio/sfx/zapsplat_pack_calculator_buttons_mp3/zapsplat_office_calculator_button_single_press_010_81860.mp3'
];

const COINS_HAND_SFX = [
    '/assets/audio/sfx/zapsplat_pack_handling_coins_mp3/zapsplat_foley_money_several_coins_loose_change_place_into_another_persons_hand_001_85378.mp3',
    '/assets/audio/sfx/zapsplat_pack_handling_coins_mp3/zapsplat_foley_money_several_coins_loose_change_place_into_another_persons_hand_002_85379.mp3',
    '/assets/audio/sfx/zapsplat_pack_handling_coins_mp3/zapsplat_foley_money_several_coins_loose_change_place_into_another_persons_hand_003_85380.mp3',
    '/assets/audio/sfx/zapsplat_pack_handling_coins_mp3/zapsplat_foley_money_several_coins_loose_change_place_into_another_persons_hand_004_85381.mp3'
];

const TOKEN_DRAG_SFX = [
    '/assets/audio/sfx/kenney_rpg-audio/Audio/cloth1.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/cloth2.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/cloth3.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/cloth4.ogg'
];

const TOKEN_DROP_SFX = [
    '/assets/audio/sfx/kenney_rpg-audio/Audio/bookPlace1.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/bookPlace2.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/bookPlace3.ogg',
    '/assets/audio/sfx/kenney_rpg-audio/Audio/dropLeather.ogg'
];

/** Central manager for BGM and SFX: shuffled playlist, autoplay unlock, SFX variation, volumes from SettingsManager. */
class AudioSystemClass {
    constructor() {
        this.bgm = null;
        this.currentTrack = null;
        this.playlistQueue = [];
        this.initialized = false;
        this.hasUserInteracted = false;
        
        // Normalizes loud source assets: the 0-100 sliders scale this base gain.
        this.GLOBAL_MIXER_GAIN = 0.2;

        this._sfxCache = new Map();
        /** Wanted files that failed to load, so their clip plays its fallback from then on. */
        this._missingSfx = new Set();
        /** A wanted file's fallback, by the wanted file's path. */
        this._sfxFallbacks = new Map();
        /** While true (a catch-up), no sound effect plays. */
        this.silenced = false;
    }

    /** Silence sound effects, or bring them back. The music plays on. */
    setSilenced(on) {
        this.silenced = !!on;
    }

    /**
     * Initialize the system and subscribe to events
     */
    init() {
        if (this.initialized) return;

        EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (data) => this.playSfx(data.clip, data.options));
        
        // A Guild Hall gift's level-ups, every hero's in every skill, sound once for the purchase
        // (`GuildUpgradeManager`), not once a level.
        EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ source } = {}) => {
            if (source !== XP_FOR_EVERYONE_SOURCE) this.playSfx('levelup');
        });
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => this.playSfx('victory'));
        EventBus.subscribe(ENGINE_EVENTS.QUEST_CLAIMED, () => this.playSfx('quest_claim'));
        EventBus.subscribe(ENGINE_EVENTS.HERO_DEPLOYED, () => this.playSfx('hero_assign'));
        
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => this.playContextualSfx('hit'));
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, () => this.playContextualSfx('hit'));

        EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, () => this.updateVolumes());

        this._setupAutoplayUnlock();

        this.initialized = true;
        logger.info('AudioSystem', 'Initialized');

        this.playNextTrack();
    }

    /**
     * Unlock audio playback on first user gesture
     */
    _setupAutoplayUnlock() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            this.hasUserInteracted = true;
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('click', unlock);

            if (this.bgm && this.bgm.paused) {
                const master = (SettingsManager.get('audio.masterVolume') ?? 0) / 100;
                const music = (SettingsManager.get('audio.musicVolume') ?? 50) / 100;
                if (master > 0 && music > 0) {
                    this.bgm.play().catch(() => {});
                }
            }
        };

        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('click', unlock, { once: true });
    }

    /**
     * Refill and shuffle the BGM playlist queue
     */
    _replenishQueue() {
        const pool = [...BGM_PLAYLIST];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        // If the first track of the new pool is the one that just played, swap it to avoid back-to-back repeats
        if (this.currentTrack && pool.length > 1 && pool[0].id === this.currentTrack.id) {
            [pool[0], pool[pool.length - 1]] = [pool[pool.length - 1], pool[0]];
        }
        this.playlistQueue = pool;
    }

    /**
     * Advance to the next random track in the soundtrack playlist
     */
    playNextTrack() {
        if (typeof Audio === 'undefined') return;

        if (this.playlistQueue.length === 0) {
            this._replenishQueue();
        }

        const nextTrack = this.playlistQueue.shift();
        if (!nextTrack) return;

        this.currentTrack = nextTrack;

        if (this.bgm) {
            this.bgm.onended = null;
            this.bgm.onerror = null;
            this.bgm.pause();
            this.bgm.src = '';
            this.bgm = null;
        }

        const src = `/assets/audio/bgm/${encodeURIComponent(nextTrack.file)}`;
        const audio = new Audio(src);
        audio.loop = false;
        
        audio.onended = () => {
            logger.info('AudioSystem', `Finished track: ${nextTrack.title}. Playing next...`);
            this.playNextTrack();
        };

        audio.onerror = () => {
            logger.warn('AudioSystem', `Failed to load track ${nextTrack.title}, advancing...`);
            setTimeout(() => this.playNextTrack(), 1000);
        };

        this.bgm = audio;
        this.updateVolumes();

        const master = (SettingsManager.get('audio.masterVolume') ?? 0) / 100;
        const music = (SettingsManager.get('audio.musicVolume') ?? 50) / 100;

        if (master > 0 && music > 0) {
            audio.play().then(() => {
                logger.info('AudioSystem', `Now playing BGM: ${nextTrack.title}`);
            }).catch(e => {
                logger.debug('AudioSystem', `BGM autoplay waiting for user interaction: ${e.message}`);
            });
        }

        EventBus.publish(ENGINE_EVENTS.BGM_TRACK_CHANGED, { track: nextTrack });
    }

    /**
     * Get the currently playing track
     */
    getCurrentTrack() {
        return this.currentTrack;
    }

    /**
     * Get the entire playlist
     */
    getPlaylist() {
        return [...BGM_PLAYLIST];
    }

    /**
     * Update volumes based on SettingsManager
     */
    updateVolumes() {
        const master = (SettingsManager.get('audio.masterVolume') ?? 0) / 100;
        const music = (SettingsManager.get('audio.musicVolume') ?? 50) / 100;
        
        if (this.bgm) {
            this.bgm.volume = master * music * this.GLOBAL_MIXER_GAIN;
            if (master > 0 && music > 0 && this.bgm.paused && this.hasUserInteracted) {
                this.bgm.play().catch(() => {});
            }
        }
    }

    /**
     * Plays a global SFX regardless of hover state
     * @param {string} clipName 
     * @param {object} [options]
     */
    playSfx(clipName, options = {}) {
        if (typeof Audio === 'undefined') return;

        const src = this._getSfxPath(clipName, options?.variant);
        if (!src) {
            logger.warn('AudioSystem', `No path found for clip: ${clipName}`);
            return;
        }
        // ⚠️ After the variant pick, not before: it draws from the game's shared random stream,
        // so a silenced catch-up draws exactly as many numbers as play at volume 0 does.
        if (this.silenced) return;

        const masterVol = SettingsManager.get('audio.masterVolume') ?? 0;
        const sfxVol = SettingsManager.get('audio.sfxVolume') ?? 50;
        const finalVol = (masterVol / 100) * (sfxVol / 100) * this.GLOBAL_MIXER_GAIN;

        if (finalVol <= 0) return;

        let pool = this._sfxCache.get(src);
        if (!pool) {
            pool = [];
            this._sfxCache.set(src, pool);
        }

        let audio = pool.find(a => a.paused || a.ended);
        if (!audio && pool.length < 4) {
            audio = new Audio(src);
            pool.push(audio);
            if (this._sfxFallbacks.has(src)) {
                // The wanted file is not there yet (new art or sound not dropped in): play the fallback.
                audio.addEventListener('error', () => {
                    if (this._missingSfx.has(src)) return;
                    this._missingSfx.add(src);
                    this._sfxCache.delete(src);
                    this.playSfx(clipName, options);
                }, { once: true });
            }
        } else if (!audio) {
            audio = pool[0];
            audio.pause();
        }

        audio.volume = finalVol;
        audio.currentTime = 0;

        const pitchVariance = options?.pitchVariance ?? 0.06;
        if (pitchVariance > 0) {
            try {
                if ('preservesPitch' in audio) {
                    audio.preservesPitch = false;
                } else if ('mozPreservesPitch' in audio) {
                    audio.mozPreservesPitch = false;
                } else if ('webkitPreservesPitch' in audio) {
                    audio.webkitPreservesPitch = false;
                }
                const rate = 1.0 + (Math.random() * 2 - 1) * pitchVariance;
                audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
            } catch (e) {
                // Ignore if environment does not support pitch manipulation
            }
        } else {
            audio.playbackRate = 1.0;
        }
        
        audio.play().then(() => {
            logger.debug('AudioSystem', `Started playing: ${clipName} (${src})`);
        }).catch(e => {
            if (this._sfxFallbacks.has(src)) return;
            logger.error('AudioSystem', `SFX ${clipName} play failed: ${e.message}`);
        });
    }

    /**
     * Plays SFX for an in-world event
     * @param {string} clipName
     */
    playContextualSfx(clipName) {
        this.playSfx(clipName);
    }

    /**
     * Resolve clip name to file path (supporting randomized variation pools)
     * @param {string} clip
     * @param {number} [variant] a pool's file by number, wrapping; without it, a random one
     * @returns {string|null}
     */
    _getSfxPath(clip, variant) {
        const kenneyBase = '/assets/audio/sfx/kenney_rpg-audio/Audio/';
        const map = {
            'levelup': `${kenneyBase}handleSmallLeather.ogg`,
            'invasion': `${kenneyBase}bookFlip1.ogg`,
            'victory': `${kenneyBase}handleSmallLeather2.ogg`,
            'hit': `${kenneyBase}metalClick.ogg`,
            'task_done': `${kenneyBase}bookPlace1.ogg`,
            'drag': TOKEN_DRAG_SFX,
            'drop': TOKEN_DROP_SFX,
            'card_place': TOKEN_DROP_SFX,
            'card_swap': TOKEN_DRAG_SFX,
            'hero_swap': TOKEN_DRAG_SFX,
            'hero_assign': TOKEN_DROP_SFX,
            'item_equip': `${kenneyBase}beltHandle1.ogg`,
            'item_assign': `${kenneyBase}bookPlace2.ogg`,
            'tool_assign': `${kenneyBase}handleSmallLeather2.ogg`,
            'blueprint_assign': `${kenneyBase}bookOpen.ogg`,
            'unassign': `${kenneyBase}clothBelt2.ogg`,
            'ui_click': CALCULATOR_BUTTON_SFX,
            'button_click': CALCULATOR_BUTTON_SFX,
            'dock_pin': CALCULATOR_BUTTON_SFX,
            'dock_unpin': CALCULATOR_BUTTON_SFX,
            'quest_claim': COINS_HAND_SFX,
            'hall_star_chime': { want: '/assets/audio/sfx/hall_star_chime.ogg', fallback: `${kenneyBase}metalPot1.ogg` },
            'hall_constellation_chime': { want: '/assets/audio/sfx/hall_constellation_chime.ogg', fallback: `${kenneyBase}metalPot2.ogg` },
            'settle_fanfare': { want: '/assets/audio/sfx/settle_fanfare.ogg', fallback: `${kenneyBase}doorOpen_1.ogg` }
        };

        const target = map[clip];
        if (!target) return null;
        if (target.want) {
            this._sfxFallbacks.set(target.want, target.fallback);
            return this._missingSfx.has(target.want) ? target.fallback : target.want;
        }
        if (Array.isArray(target)) {
            const idx = Number.isInteger(variant)
                ? Math.abs(variant) % target.length
                : Math.floor(Math.random() * target.length);
            return target[idx];
        }
        return target;
    }
}

export const AudioSystem = new AudioSystemClass();


