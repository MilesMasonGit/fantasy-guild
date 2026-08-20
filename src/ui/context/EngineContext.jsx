import React, { createContext } from 'react';

export const EngineContext = createContext(null);

export const EngineProvider = ({ engine, children }) => {
    return (
        <EngineContext.Provider value={engine}>
            {children}
        </EngineContext.Provider>
    );
};

// The `useEngine` hook lives in `src/ui/hooks/useEngine.js` — that is the one
// every component imports. A duplicate copy used to sit here with no importers
// at all; it was deleted so there is only one answer to "which useEngine?".
