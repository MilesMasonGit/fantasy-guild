// Demolition: which Tokens may be taken off the mat for good

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isGuildHall } from './MatCap.js';
import * as Landmarks from './Landmarks.js';

/**
 * Whether `instance` may be removed for good. Never the Guild Hall (or a type that cannot leave the
 * mat) and never a landmark, except while the dev layout tool is on (`Landmarks.setLayoutEditing`).
 * Today the discard bin and `Placement.removePlacedToken` ask it.
 */
export function canDemolish(instance) {
    if (!instance?.typeId) return false;
    if (isGuildHall(instance) || getTokenType(instance.typeId)?.cannotLeaveBoard) return false;
    return !Landmarks.isLandmark(instance) || Landmarks.isLayoutEditing();
}
