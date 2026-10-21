// The game's on-screen text, one strings file per language (docs/reference/TEXT.md).
import { logger } from '../utils/Logger.js';

// Every `<code>.json` beside this file is a language: adding one needs no code.
const LANGUAGES = Object.fromEntries(
    Object.entries(import.meta.glob('./*.json', { eager: true, import: 'default' }))
        .map(([file, table]) => [file.slice(2, -5), table])
);
const FALLBACK = 'en';

let current = FALLBACK;
const warned = new Set();

/** The codes of the languages there is a strings file for. */
export function languages() {
    return Object.keys(LANGUAGES);
}

/** Switch every later `t()` call to `code`; an unknown code keeps the current language. */
export function setLanguage(code) {
    if (!LANGUAGES[code]) {
        logger.warn('i18n', `No strings file for language "${code}"`);
        return false;
    }
    current = code;
    return true;
}

/** Add or replace a language's table at run time (tests). */
export function registerLanguage(code, table) {
    LANGUAGES[code] = table;
}

export function getLanguage() {
    return current;
}

function lookup(table, key) {
    let node = table;
    for (const part of key.split('.')) {
        if (node == null || typeof node !== 'object') return undefined;
        node = node[part];
    }
    return node;
}

function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (whole, name) => (vars[name] ?? whole).toString());
}

/**
 * The text for `key` ('screen.key') in the current language, with `{name}`
 * placeholders filled from `vars`. An entry written as `{ one, other, ... }`
 * picks its form by `vars.count`. A key missing from the language falls back to
 * English; missing from English too, it shows the key itself and warns once (dev).
 */
export function t(key, vars = {}) {
    let entry = lookup(LANGUAGES[current], key);
    if (entry === undefined && current !== FALLBACK) entry = lookup(LANGUAGES[FALLBACK], key);
    if (entry !== null && typeof entry === 'object') {
        const form = new Intl.PluralRules(current).select(Number(vars.count ?? 0));
        entry = entry[form] ?? entry.other;
    }
    if (typeof entry !== 'string') {
        if (!warned.has(key)) {
            warned.add(key);
            logger.warn('i18n', `Missing text for "${key}"`);
        }
        return key;
    }
    return fill(entry, vars);
}
