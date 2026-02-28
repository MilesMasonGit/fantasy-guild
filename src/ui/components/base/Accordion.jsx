import React from 'react';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn.js';

/**
 * Accordion: A vertically collapsing section wrapper built on Headless UI Disclosure.
 * Uses a CSS grid transition for smooth height expansion and collapse.
 */
export const Accordion = ({
    title,
    defaultOpen = false,
    className,
    headerClassName,
    contentClassName,
    children
}) => {
    return (
        <Disclosure defaultOpen={defaultOpen}>
            {({ open }) => (
                <div className={cn("flex flex-col border border-gi-border/30 rounded overflow-hidden bg-gi-surface/50", className)}>
                    <Disclosure.Button
                        className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-left font-display font-bold text-gi-text focus:outline-none transition-colors",
                            "hover:bg-gi-surface-hover hover:text-gi-primary",
                            open ? "bg-gi-surface-hover border-b border-gi-border/50 text-gi-primary" : "bg-transparent",
                            headerClassName
                        )}
                    >
                        <span>{title}</span>
                        <ChevronRight
                            className={cn(
                                "h-5 w-5 transition-transform duration-200 text-gi-muted",
                                open ? "rotate-90 text-gi-primary" : ""
                            )}
                        />
                    </Disclosure.Button>

                    <Transition
                        show={open}
                        enter="transition-all duration-300 ease-out overflow-hidden"
                        enterFrom="opacity-0 max-h-0"
                        enterTo="opacity-100 max-h-[1000px]" // Use a reasonably large max-height
                        leave="transition-all duration-200 ease-in overflow-hidden"
                        leaveFrom="opacity-100 max-h-[1000px]"
                        leaveTo="opacity-0 max-h-0"
                    >
                        <Disclosure.Panel static className={cn("px-4 py-3", contentClassName)}>
                            {children}
                        </Disclosure.Panel>
                    </Transition>
                </div>
            )}
        </Disclosure>
    );
};

export default Accordion;
