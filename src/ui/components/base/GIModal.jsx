import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useEscapeLayer } from '../../utils/escapeLayers.js';

/**
 * GIModal: A standardized, accessible overlay component built on Headless UI Dialog.
 * Handles focus trapping and smooth enter/exit animations.
 * ⚠️ A window closes on its X, its own buttons and Escape, never on a click outside it (only
 * light pop-ups do that). So Headless UI's own close is switched off and Escape comes from the
 * shared layers (`escapeLayers.js`), one layer per press.
 */
const NOOP = () => { };

export const GIModal = ({
    isOpen,
    onClose,
    title,
    children,
    className,
    maxWidth = "max-w-2xl",
    hideClose = false,
    layer = 'modal'
}) => {
    // Headless UI always needs a function here, but 'can this be dismissed?' is decided
    // explicitly: a caller that supplies no `onClose`, or passes `hideClose`, gets no dismiss
    // control (so the un-dismissable boot screen shows no X).
    const canClose = !hideClose && typeof onClose === 'function';
    // A window with no X still holds its layer, so Escape closes nothing under it.
    useEscapeLayer(!!isOpen, canClose ? onClose : null);
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className={cn('relative', layer === 'inner' ? 'z-(--z-modal-inner)' : 'z-(--z-modal)')} onClose={NOOP}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-4"
                        >
                            <Dialog.Panel
                                className={cn(
                                    "w-full transform overflow-hidden rounded-lg bg-gi-base border border-gi-border",
                                    "text-left align-middle gi-shadow-deep transition-all relative font-sans flex flex-col",
                                    maxWidth,
                                    className
                                )}
                            >
                                {(title || canClose) && (
                                    <div className="flex items-center justify-between p-6 border-b border-gi-border/50 bg-gi-surface/30 shrink-0">
                                        {title && (
                                            <Dialog.Title as="h3" className="text-xl font-bold font-base text-gi-primary tracking-wide uppercase">
                                                {title}
                                            </Dialog.Title>
                                        )}

                                        {canClose && (
                                            <button
                                                type="button"
                                                className="ml-auto rounded-md text-gi-muted hover:text-gi-danger hover:bg-gi-danger/10 transition-colors p-1"
                                                onClick={onClose}
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="p-6 flex-1 min-h-0 overflow-hidden">
                                    {children}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default GIModal;
