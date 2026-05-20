import React from 'react';
import { getLogicalPosition } from '../../../utils/CoordinateUtils.js';

/**
 * TableFXLayer - L1: Table FX
 * Placed beneath the StaticGridLayer. Container for under-board effects (lava glows, runes).
 */
const TableFXLayer = ({ extents }) => {
    // Currently a placeholder for future L1 effects.
    return (
        <div className="absolute inset-0 z-[5] pointer-events-none">
            {/* Map over FX data here in the future */}
        </div>
    );
};

export default React.memo(TableFXLayer);
