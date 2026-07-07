import React, { createContext } from 'react';

export const EngineContext = createContext(null);

export const EngineProvider = ({ engine, children }) => {
    return (
        <EngineContext.Provider value={engine}>
            {children}
        </EngineContext.Provider>
    );
};

export const useEngine = () => {
    const context = React.useContext(EngineContext);
    if (!context) {
        throw new Error('useEngine must be used within an EngineProvider');
    }
    return context;
};
