import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';

describe('SettingsManager — Typography scale & accessibility settings', () => {
    beforeEach(() => {
        localStorage.clear();
        SettingsManager.settings = SettingsManager._deepMerge({}, SettingsManager.getAll());
        SettingsManager.resetOptions();
    });

    it('has the correct default typography scale values', () => {
        const fontSizes = SettingsManager.get('ui.fontSizes');
        expect(fontSizes).toEqual({
            '--font-size-xxs': 14,
            '--font-size-xs': 16,
            '--font-size-sm': 18,
            '--font-size-base': 20,
            '--font-size-lg': 24,
            '--font-size-xl': 32,
            '--font-size-2xl': 48
        });
    });

    it('persists customized font sizes to localStorage', () => {
        const customSizes = {
            '--font-size-xxs': 15,
            '--font-size-xs': 17,
            '--font-size-sm': 19,
            '--font-size-base': 21,
            '--font-size-lg': 25,
            '--font-size-xl': 33,
            '--font-size-2xl': 49
        };

        SettingsManager.set('ui.fontSizes', customSizes);
        expect(SettingsManager.get('ui.fontSizes')).toEqual(customSizes);

        // Simulate reload by creating a new instance / calling load
        SettingsManager.load();
        expect(SettingsManager.get('ui.fontSizes')).toEqual(customSizes);
    });

    it('resets font sizes when resetOptions is invoked', () => {
        SettingsManager.set('ui.fontSizes.--font-size-base', 28);
        expect(SettingsManager.get('ui.fontSizes.--font-size-base')).toBe(28);

        SettingsManager.resetOptions();
        expect(SettingsManager.get('ui.fontSizes.--font-size-base')).toBe(20);
    });
});
