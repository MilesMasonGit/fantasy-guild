// the tool a Token's work needs: the gate (`WorkCheck`) and the tool that lends to it (`TileModifiers`)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { neededToolOf } from '../../config/registries/toolKinds.js';
import { isMarked } from './Demolition.js';

/**
 * The tool `instance`'s work needs (`neededToolOf`), or null when none is asked for: no instance,
 * or a Token marked for demolition.
 */
export function toolNeedOf(instance) {
    if (!instance || isMarked(instance)) return null;
    return neededToolOf(getTokenType(instance.typeId));
}
