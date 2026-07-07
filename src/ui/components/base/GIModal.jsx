import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import GISurface from './GISurface.jsx';

/**
 * GIModal: A standardized, accessible overlay component built on Headless UI Dialog.
 * Handles focus trapping, escape-to-close, and smooth enter/exit animations.
 */
export const GIModal = ({
    isOpen,
    onClose = () => { },
    title,
    children,
    className,
    maxWidth = "max-w-2xl"
}) => {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[300]" onClose={onClose}>
                {/* Backdrop */}
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

                {/* Container for centering */}
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
                                {/* Header */}
                                {(title || (onClose && onClose !== (() => { })?.toString())) && (
                                    <div className="flex items-center justify-between p-6 border-b border-gi-border/50 bg-gi-surface/30 shrink-0">
                                        {title && (
                                            <Dialog.Title as="h3" className="text-xl font-bold font-base text-gi-primary tracking-wide uppercase">
                                                {title}
                                            </Dialog.Title>
                                        )}

                                        {/* Only show X if it's not the default no-op */}
                                        {onClose && typeof onClose === 'function' && onClose.toString() !== '() => {}' && (
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

                                {/* Content */}
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
