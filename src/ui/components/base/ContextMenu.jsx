import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { cn } from '../../utils/cn.js';
import { ChevronDown } from 'lucide-react';

/**
 * ContextMenu: A standardized dropdown menu component built on Headless UI Menu.
 * The Items container uses absolute positioning and high z-index to escape overflow constraints.
 */
export const ContextMenu = ({
    trigger,
    items = [],
    className,
    menuClassName,
    align = 'right' // 'left' | 'right'
}) => {
    return (
        <Menu as="div" className={cn("relative inline-block text-left w-full", className)}>
            <div>
                {trigger ? (
                    <Menu.Button as={Fragment}>
                        {trigger}
                    </Menu.Button>
                ) : (
                    <Menu.Button className="bg-gi-surface-hover/50 hover:bg-gi-primary/20 hover:text-gi-primary text-gi-text font-medium py-2 px-4 rounded transition-colors flex items-center gap-2 border border-gi-border w-full justify-between">
                        Options
                        <ChevronDown className="w-4 h-4" />
                    </Menu.Button>
                )}
            </div>

            {/* Portal-like effect: absolute positioning escapes normal flow, high z-index layers it over everything */}
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items
                    className={cn(
                        "absolute z-[250] mt-2 w-56 origin-top-right rounded-md bg-gi-surface border border-gi-border shadow-2xl focus:outline-none backdrop-blur-md",
                        align === 'right' ? 'right-0' : 'left-0',
                        menuClassName
                    )}
                >
                    <div className="p-1 flex flex-col gap-1">
                        {items.map((item, index) => (
                            <Menu.Item key={index} disabled={item.disabled}>
                                {({ active }) => (
                                    <button
                                        onClick={item.onClick}
                                        className={cn(
                                            "flex w-full items-center rounded-md px-2 py-2 text-sm font-sans transition-colors",
                                            active ? "bg-gi-primary text-white" : "text-gi-text",
                                            item.disabled && "opacity-50 cursor-not-allowed",
                                            item.danger && active && "bg-gi-danger"
                                        )}
                                    >
                                        {item.icon && <span className="mr-2 h-4 w-4">{item.icon}</span>}
                                        {item.label}
                                    </button>
                                )}
                            </Menu.Item>
                        ))}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};

export default ContextMenu;
