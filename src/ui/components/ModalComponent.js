// Fantasy Guild - Modal Component
// Phase 21: Save UI

/**
 * ModalComponent - Reusable modal wrapper
 * 
 * Usage:
 * const modal = renderModal(content, { title: 'My Modal' });
 * document.body.appendChild(modal);
 * bindModal(modal, { onClose: () => {} });
 */

/**
 * Render a modal with backdrop
 * @param {string} content - HTML content for modal body
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.className - Additional CSS class
 * @param {boolean} options.hideClose - Hide the close button
 * @returns {HTMLElement}
 */
export function renderModal(content, options = {}) {
    const {
        title = '',
        className = '',
        hideClose = false
    } = options;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'modal-backdrop';

    backdrop.innerHTML = `
        <div class="modal ${className}">
            ${title || !hideClose ? `
                <header class="modal__header">
                    ${title ? `<h2 class="modal__title">${title}</h2>` : '<div></div>'}
                    ${!hideClose ? `<button class="modal__close" id="modal-close" title="Close">&times;</button>` : ''}
                </header>
            ` : ''}
            <div class="modal__body">
                ${content}
            </div>
        </div>
    `;

    return backdrop;
}

/**
 * Bind modal event handlers
 * @param {HTMLElement} modalElement - The modal backdrop element
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onClose - Called when modal is closed
 */
export function bindModal(modalElement, handlers = {}) {
    const { onClose } = handlers;

    // Close on backdrop click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            if (onClose) onClose();
        }
    });

    // Close on X button click
    const closeBtn = modalElement.querySelector('#modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (onClose) onClose();
        });
    }

    // Close on Escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            if (onClose) onClose();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Show a modal by appending it to the body
 * @param {HTMLElement} modalElement 
 */
export function showModal(modalElement) {
    document.body.appendChild(modalElement);
    // Trigger animation
    requestAnimationFrame(() => {
        modalElement.classList.add('modal-backdrop--visible');
    });
}

/**
 * Hide and remove a modal
 * @param {HTMLElement} modalElement 
 */
export function hideModal(modalElement) {
    modalElement.classList.remove('modal-backdrop--visible');
    modalElement.addEventListener('transitionend', () => {
        if (modalElement.parentNode) {
            modalElement.parentNode.removeChild(modalElement);
        }
    }, { once: true });

    // Fallback if no transition
    setTimeout(() => {
        if (modalElement.parentNode) {
            modalElement.parentNode.removeChild(modalElement);
        }
    }, 350);
}
