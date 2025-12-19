// Fantasy Guild - Logger Utility
// Centralized logging with dev/production modes

/**
 * Logger - Centralized debug logging system
 * 
 * Features:
 * - Automatic dev/production mode detection
 * - Log levels (debug, info, warn, error)
 * - Module/category prefixes
 * - Conditional logging based on environment
 * - Performance-friendly (no-op in production)
 */

class Logger {
    constructor() {
        // Auto-detect environment
        // In Vite: import.meta.env.DEV is true in development
        // In production build: import.meta.env.PROD is true
        this.isDevelopment = import.meta.env?.DEV ?? true;

        // Log levels (lower number = more important)
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        // Current minimum level to log (debug shows all)
        this.minLevel = this.levels.debug;

        // Module filter (empty = log all, set to limit to specific modules)
        this.moduleFilter = new Set(); // e.g., ['TaskSystem', 'InventoryManager']
    }

    /**
     * Check if logging is enabled for this level and module
     * @private
     */
    _shouldLog(level, module) {
        // Never log in production
        if (!this.isDevelopment) return false;

        // Check log level
        if (this.levels[level] < this.minLevel) return false;

        // Check module filter (if set)
        if (this.moduleFilter.size > 0 && !this.moduleFilter.has(module)) {
            return false;
        }

        return true;
    }

    /**
     * Format log message with module prefix
     * @private
     */
    _format(module, ...args) {
        return [`[${module}]`, ...args];
    }

    /**
     * Debug level logging (most verbose)
     * @param {string} module - Module name (e.g., 'TaskSystem', 'InventoryManager')
     * @param {...any} args - Arguments to log
     */
    debug(module, ...args) {
        if (this._shouldLog('debug', module)) {
            console.log(...this._format(module, ...args));
        }
    }

    /**
     * Info level logging (general information)
     * @param {string} module - Module name
     * @param {...any} args - Arguments to log
     */
    info(module, ...args) {
        if (this._shouldLog('info', module)) {
            console.info(...this._format(module, ...args));
        }
    }

    /**
     * Warning level logging
     * @param {string} module - Module name
     * @param {...any} args - Arguments to log
     */
    warn(module, ...args) {
        if (this._shouldLog('warn', module)) {
            console.warn(...this._format(module, ...args));
        }
    }

    /**
     * Error level logging (always logged, even in production)
     * @param {string} module - Module name
     * @param {...any} args - Arguments to log
     */
    error(module, ...args) {
        // Errors are always logged, even in production
        console.error(...this._format(module, ...args));
    }

    /**
     * Set minimum log level
     * @param {string} level - 'debug', 'info', 'warn', or 'error'
     */
    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.minLevel = this.levels[level];
        }
    }

    /**
     * Enable logging only for specific modules
     * @param {string[]} modules - Array of module names
     */
    filterModules(...modules) {
        this.moduleFilter = new Set(modules);
    }

    /**
     * Clear module filter (log all modules)
     */
    clearFilter() {
        this.moduleFilter.clear();
    }

    /**
     * Check if in development mode
     * @returns {boolean}
     */
    isDev() {
        return this.isDevelopment;
    }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };
