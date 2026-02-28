import React, { createContext } from 'react';

export const EngineContext = createContext(null);

export const EngineProvider = ({ engine, children }) => {
    return (
        <EngineContext.Provider value={engine}>
            {children}
        </EngineContext.Provider>
    );
};
