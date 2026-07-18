// Fantasy Guild - Card Manager
//
// Post-rework this is a thin surface over the two card helpers the deck loop
// still needs. The old dispatcher exposed lookups, transformations, project
// and assignment facades that all operated on the retired `cards.active`
// arrays / card cache; they were removed in the code-review Wave 4 sweep
// (CR-007/CR-018/CR-027). Card DATA now lives in `areaStates[].deckSlots`
// (flyweight slots) and LoopRunner's runtime-only `_activeCards` map.

import { CardFactory } from './logic/CardFactory.js';
import * as Utils from './logic/CardManagerUtils.js';

export const generateId = (prefix) => CardFactory.generateId(prefix);

export const bumpCardRev = Utils.bumpCardRev;
export const cloneTraits = Utils.cloneTraits;
