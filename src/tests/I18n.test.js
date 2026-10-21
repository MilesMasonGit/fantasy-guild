// @vitest-environment node
// The strings lookup (src/i18n, docs/reference/TEXT.md): keys by screen, placeholders,
// plural forms, English as the fallback and a one-time dev warning for a missing key.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { t, setLanguage, getLanguage, languages, registerLanguage } from '../i18n/index.js';
import en from '../i18n/en.json';

describe('t()', () => {
    afterEach(() => { setLanguage('en'); vi.restoreAllMocks(); });

    it('finds English text by screen.key', () => {
        expect(languages()).toContain('en');
        expect(getLanguage()).toBe('en');
        expect(t('common.close')).toBe(en.common.close);
    });

    it('fills {placeholders} and leaves unknown ones visible', () => {
        registerLanguage('en', { ...en, test: { greet: 'Hello {name}, {missing}' } });
        expect(t('test.greet', { name: 'Ada' })).toBe('Hello Ada, {missing}');
        registerLanguage('en', en);
    });

    it('picks a plural form by count', () => {
        registerLanguage('en', { ...en, test: { heroes: { one: '{count} hero', other: '{count} heroes' } } });
        expect(t('test.heroes', { count: 1 })).toBe('1 hero');
        expect(t('test.heroes', { count: 3 })).toBe('3 heroes');
        registerLanguage('en', en);
    });

    it('falls back to English for a key a language lacks', () => {
        registerLanguage('xx', { common: { close: 'Schliessen' } });
        expect(setLanguage('xx')).toBe(true);
        expect(t('common.close')).toBe('Schliessen');
        expect(t('common.cancel')).toBe(en.common.cancel);
    });

    it('shows the key and warns once for missing text', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(t('nowhere.atAll')).toBe('nowhere.atAll');
        expect(t('nowhere.atAll')).toBe('nowhere.atAll');
        expect(t('common')).toBe('common');
        const missing = warn.mock.calls.filter(c => String(c.join(' ')).includes('nowhere.atAll'));
        expect(missing).toHaveLength(1);
    });

    it('refuses a language with no strings file', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(setLanguage('zz')).toBe(false);
        expect(getLanguage()).toBe('en');
    });
});

describe('en.json', () => {
    it('groups keys by screen in camelCase, every leaf text or a plural form', () => {
        const bad = [];
        const walk = (node, path) => {
            for (const [k, v] of Object.entries(node)) {
                const here = path ? `${path}.${k}` : k;
                if (!/^[a-z][a-zA-Z0-9]*$/.test(k)) bad.push(`${here}: key name`);
                if (typeof v === 'string') continue;
                if (v && typeof v === 'object' && 'other' in v) {
                    if (!Object.values(v).every(x => typeof x === 'string')) bad.push(`${here}: plural forms`);
                    continue;
                }
                if (v && typeof v === 'object') walk(v, here);
                else bad.push(`${here}: not text`);
            }
        };
        walk(en, '');
        expect(bad).toEqual([]);
        for (const screen of Object.values(en)) expect(typeof screen).toBe('object');
    });
});
