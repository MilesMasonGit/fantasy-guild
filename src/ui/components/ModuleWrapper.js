// Fantasy Guild - Module Wrapper Component
// Standard frame for all modular card traits

/**
 * Wrap module content in a standard frame
 * @param {Object} options
 * @param {string} options.moduleId - Unique ID
 * @param {string} options.type - Module type for styling (hero, input, action, etc.)
 * @param {string} options.title - Optional module title
 * @param {string} options.visibility - 'always' or 'expanded'
 * @param {string} options.content - The inner HTML of the module
 * @returns {string} HTML string
 */
export function renderModuleWrapper(options) {
    const {
        moduleId,
        type = 'generic',
        title = '',
        visibility = 'always',
        content = ''
    } = options;

    const visibilityClass = visibility === 'expanded' ? 'card-module--expanded' : '';
    const typeClass = `card-module--${type}`;

    return `
        <div class="card-module ${typeClass} ${visibilityClass}" data-module-id="${moduleId}">
            ${title ? `
                <div class="card-module__header">
                    <span class="card-module__title">${title}</span>
                </div>
            ` : ''}
            <div class="card-module__content">
                ${content}
            </div>
        </div>
    `;
}
