import React from 'react';
import { logger } from '../../../utils/Logger.js';

/**
 * A render exception on the mat, in the dock or in a drawer would otherwise unmount the WHOLE
 * React app while the engine kept ticking and saving underneath it, leaving a black screen
 * with no sign the game is still alive.
 * When part of the screen crashes, only THAT area is replaced by a small plain panel saying
 * so, with a Reload button; the rest of the game keeps working. So this is deliberately one
 * boundary per surface (`MatBoard`, the hero dock, the Bank panel, the drawers), not one
 * around everything, plus one more at the very root as a last resort for whatever isn't under
 * a named surface yet.
 * A plain class component: `componentDidCatch` / `getDerivedStateFromError` are the only way
 * to catch a render error in React, hooks included.
 */
// ⚠️ The whole UI sits under `pointer-events-none`, so a fallback must take clicks back itself.
// A fallback left in the flow of a surface that is normally placed absolutely would crowd the
// mat or the hero bar out of its row, so those surfaces name a `corner` and get a small panel
// pinned in the corner of their own (positioned) parent instead.
const CORNERS = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'top-center': 'top-3 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
    'bottom-center': 'bottom-3 left-1/2 -translate-x-1/2',
};

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
            const corner = CORNERS[this.props.corner];
            return (
                <div
                    data-error-boundary={this.props.label || 'surface'}
                    data-error-corner={this.props.corner || undefined}
                    className={`pointer-events-auto flex flex-col items-center justify-center gap-3 text-center bg-black/60 border border-gi-danger/40 rounded-xl text-gi-text select-none ${
                        corner ? `absolute z-50 p-3 w-max max-w-[16rem] ${corner}` : 'p-6 h-full w-full'
                    }`}
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
