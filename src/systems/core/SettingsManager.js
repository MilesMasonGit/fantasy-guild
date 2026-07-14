// Fantasy Guild - Settings Manager
// Handles player configuration and persistence to localStorage

import { EventBus } from './EventBus.js';
import { logger } from '../../utils/Logger.js';

const SETTINGS_STORAGE_KEY = 'fantasy_guild_settings';

// Default settings configuration
const defaultSettings = {
    notifications: {
        masterToggle: true,
        heroEvents: true,
        inventoryEvents: true,
        questEvents: true,
        influenceEvents: true,
        defaultDuration: 5000,
        systemDuration: 15000,      // 15 seconds
        discoveryDuration: 15000,   // 15 seconds
        itemDuration: 0,            // Persistent
        heroDuration: 0,            // Persistent
        maxVisible: 10,
        position: 'center_bottom'
    },
    ui: {
        tooltipsEnabled: true,
        tooltipsCardBadges: true,
        tooltipsBoostTiles: true,
        tooltipsItems: true,
        compactMode: false,
        zoomToCursor: true,
        fontFamily: 'silkpixel', // Default to SilkPixel composite font
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        itemParticles: true,
        allCaps: true
    },
    audio: {
        masterVolume: 100,
        musicVolume: 50,
        sfxVolume: 50
    },
    gameplay: {
        autoSaveIntervalMinutes: 10,
        enableAnimations: true,
        themeMode: 'dark'
    },
    dev: {
        enabled: false // Only used if we want to hide the dev tab in production later
    }
};

class SettingsManagerClass {
    constructor() {
        this.settings = JSON.parse(JSON.stringify(defaultSettings));
        this.initialized = false;
    }

    /**
     * Initialize SettingsManager by loading from localStorage
     */
    init() {
        if (this.initialized) return;

        this.load();
        this.initialized = true;
        logger.info('SettingsManager', 'Initialized');
    }

    /**
     * Load settings from localStorage
     */
    load() {
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // One-time migration: 'top_right' was the old default; saves that
                // carry it should follow the new 'center_bottom' default instead.
                if (parsed.notifications?.position === 'top_right') {
                    delete parsed.notifications.position;
                }
                // Deep merge to ensure new default settings are added to existing saves
                this.settings = this._deepMerge(this.settings, parsed);
                logger.debug('SettingsManager', 'Settings loaded from storage');
            }
        } catch (e) {
            logger.error('SettingsManager', 'Failed to load settings', e);
        }
    }

    /**
     * Save current settings to localStorage
     */
    save() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
            EventBus.publish('settings_updated', this.settings);
            logger.debug('SettingsManager', 'Settings saved');
        } catch (e) {
            logger.error('SettingsManager', 'Failed to save settings', e);
        }
    }

    /**
     * Get a setting value using dot notation (e.g., 'notifications.masterToggle')
     * @param {string} path - The object path to the setting
     * @returns {*} The setting value or undefined if not found
     */
    get(path) {
        return path.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, this.settings);
    }

    /**
     * Set a setting value using dot notation and automatically save
     * @param {string} path - The object path to the setting
     * @param {*} value - The new value
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.settings;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }

        // Only trigger update if value actually changed
        if (current[keys[keys.length - 1]] !== value) {
            current[keys[keys.length - 1]] = value;
            this.save();
        }
    }

    /**
     * Get the entire settings object
     * @returns {Object} A deep copy of the settings object
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    /**
     * Reset settings to default
     */
    resetOptions() {
        this.settings = JSON.parse(JSON.stringify(defaultSettings));
        this.save();
        logger.info('SettingsManager', 'Settings reset to default');
    }

    /**
     * Helper for deep merging objects
     */
    _deepMerge(target, source) {
        let output = Object.assign({}, target);
        if (this._isObject(target) && this._isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this._isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this._deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    _isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
}

// Export singleton
export const SettingsManager = new SettingsManagerClass();
