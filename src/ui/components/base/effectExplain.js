import { getPaletteEntry } from '../../../config/registries/modifierPalette.js';
import { effectName } from '../../../config/registries/effectWords.js';
import { effectTypesIn } from '../../../systems/effects/statementText.js';
import { t } from '../../../i18n/index.js';

/**
 * What an effect name means, for its hover: every screen that names an effect reads its one
 * description here, from the palette's `explains`.
 */

/** An effect's name and description (`{ type, name, text }`), or null for one with no description. */
export function explainOf(type) {
    const entry = getPaletteEntry(type);
    if (!entry?.explains) return null;
    return { type, name: effectName(entry), text: entry.explains };
}

/** "Speed: A cycle takes less time", or null. */
export function explainLine(type) {
    const e = explainOf(type);
    return e ? t('effectExplain.line', { name: e.name, text: e.text }) : null;
}

/** One line per effect, each once, in the order given. */
export function explainLinesOf(types) {
    return [...new Set(types || [])].map(explainLine).filter(Boolean);
}

/** The effects a list of rule statements names, each once, in order. */
export function effectTypesOfStatements(statements, names = {}) {
    return [...new Set((statements || []).flatMap(s => effectTypesIn(s, names)))];
}
