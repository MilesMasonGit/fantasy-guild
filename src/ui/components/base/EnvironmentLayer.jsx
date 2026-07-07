import React from 'react';

/**
 * EnvironmentLayer - L5: Environment
 * Full-screen overlay above all entities for weather/cloud shadows.
 */
const EnvironmentLayer = ({ activeAreaId }) => {
    // Currently a placeholder for future L5 effects.
    // Could eventually render rain, fog, or moving cloud shadows based on activeAreaId.
    return (
        <div className="absolute inset-0 z-[100] pointer-events-none">
            {/* Map over full-screen environmental FX here in the future */}
        </div>
    );
};

export default React.memo(EnvironmentLayer);
