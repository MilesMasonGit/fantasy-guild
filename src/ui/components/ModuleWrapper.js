// Fantasy Guild - Module Wrapper Component
// Standard frame for all modular card traits

/**
 * Wrap module content in a standard frame
 * @param {Object} options
 * @param {string} options.moduleId - Unique ID
 * @param {string} options.type - Module type for styling (hero, input, action, etc.)
 * @param {string} options.title - Optional module title
 * @param {string} options.visibility - 'always' or 'expanded'
 * @param {string} options.cardState - Visibility state: 'always', 'base', 'assigned', or 'button:loot'/'button:combat'/'button:info'
 * @param {string} options.group - Button group name for panel toggling: 'loot', 'combat', 'info', or '' for non-button modules
 * @param {string} options.content - The inner HTML of the module
 * @returns {string} HTML string
 */
export function renderModuleWrapper(options) {
    const {
        moduleId,
        type = 'generic',
        title = '',
        visibility = 'always',
        cardState = 'base',
        group = '',
        content = ''
    } = options;

    const visibilityClass = visibility === 'expanded' ? 'card-module--expanded' : '';
    const typeClass = `card-module--${type}`;
    const groupAttr = group ? ` data-group="${group}"` : '';

    return `
        <div class="card-module ${typeClass} ${visibilityClass} p-2 rounded-md bg-white/5 border border-white/10 shadow-sm" data-module-id="${moduleId}" data-card-state="${cardState}"${groupAttr}>
            ${title ? `
                <div class="mb-1 border-b border-white/5 pb-1 flex justify-between items-center">
                    <span class="text-[10px] font-pixel font-bold uppercase tracking-wider text-gray-400">${title}</span>
                </div>
            ` : ''}
            <div class="card-module__content relative z-10">
                ${content}
            </div>
        </div>
    `;
}
