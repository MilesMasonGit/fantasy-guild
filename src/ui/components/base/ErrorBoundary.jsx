import React from 'react';
import { logger } from '../../../utils/Logger.js';

/**
 * ⭐ **CR3-203**: there was no error boundary anywhere in the tree. Any render
 * exception — on the mat, in the dock, in a drawer — unmounted the WHOLE React
 * app while the engine kept ticking and saving underneath it, so the player
 * saw a black screen and had no way to tell their game was still alive
 * (the handoff's black-screen crash; its specific cause is fixed, but nothing
 * was added to catch the next one).
 *
 * Owner ruling: when part of the screen crashes, only THAT area is replaced
 * by a small plain panel saying so, with a Reload button; the rest of the
 * game keeps working. So this is deliberately one boundary per surface
 * (`MatBoard`, the hero dock, the Bank panel, the drawers), not one boundary
 * around everything — plus one more at the very root as a last resort for
 * whatever isn't under a named surface yet.
 *
 * A plain class component: `componentDidCatch` / `getDerivedStateFromError`
 * are the only way to catch a render error in React, hooks included.
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        logger.error(
            'ErrorBoundary',
            `${this.props.label || 'A surface'} crashed:`,
            error,
            info?.componentStack
        );
    }

    handleReload = () => {
        if (typeof window !== 'undefined' && window.location?.reload) {
            window.location.reload();
        }
    };

    render() {
        if (this.state.error) {
            return (
                <div
                    data-error-boundary={this.props.label || 'surface'}
                    className="flex flex-col items-center justify-center gap-3 p-6 h-full w-full text-center bg-black/60 border border-gi-danger/40 rounded-xl text-gi-text select-none"
                >
                    <p className="text-sm font-bold text-gi-danger">Something went wrong here</p>
                    <button
                        type="button"
                        onClick={this.handleReload}
                        className="px-4 py-1.5 rounded-lg bg-gi-primary/20 border border-gi-primary/60 text-xs font-bold uppercase tracking-wide hover:bg-gi-primary/30 cursor-pointer"
                    >
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
