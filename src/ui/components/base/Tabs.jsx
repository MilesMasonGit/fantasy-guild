import React, { Fragment } from 'react';
import { Tab } from '@headlessui/react';
import { cn } from '../../utils/cn.js';

/**
 * Tabs: A standardized tabbed navigation logic component built on Headless UI Tab.
 */
export const Tabs = ({
    tabs = [],
    className,
    tabListClassName,
    tabPanelClassName,
    orientation = 'horizontal' // 'horizontal' | 'vertical'
}) => {
    return (
        <Tab.Group vertical={orientation === 'vertical'}>
            <div className={cn("flex w-full", orientation === 'vertical' ? 'flex-row' : 'flex-col', className)}>
                {/* Tab List */}
                <Tab.List
                    className={cn(
                        "flex border-gi-border/50",
                        orientation === 'vertical' ? 'flex-col border-r pr-2 gap-2' : 'flex-row border-b pb-2 gap-4',
                        tabListClassName
                    )}
                >
                    {tabs.map((tab, index) => (
                        <Tab as={Fragment} key={index}>
                            {({ selected }) => (
                                <button
                                    className={cn(
                                        "font-sans font-medium text-sm tracking-wide transition-all outline-none py-2 px-1 relative",
                                        "hover:text-gi-primary w-full text-left",
                                        selected ? "text-gi-primary" : "text-gi-muted"
                                    )}
                                >
                                    {tab.label}

                                    {/* Active State Indicator */}
                                    {selected && (
                                        <div
                                            className={cn(
                                                "absolute bg-gi-primary",
                                                orientation === 'vertical'
                                                    ? 'right-[-9px] top-0 bottom-0 w-1 rounded' // Pointing right for vertical tabs
                                                    : 'bottom-[-9px] left-0 right-0 h-1 rounded' // Pointing down for horizontal tabs
                                            )}
                                        />
                                    )}
                                </button>
                            )}
                        </Tab>
                    ))}
                </Tab.List>

                {/* Tab Panels */}
                <Tab.Panels
                    className={cn(
                        "flex-1 outline-none",
                        orientation === 'vertical' ? 'pl-6' : 'pt-6',
                        tabPanelClassName
                    )}
                >
                    {tabs.map((tab, index) => (
                        <Tab.Panel key={index} className="outline-none h-full">
                            {tab.content}
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </div>
        </Tab.Group>
    );
};

export default Tabs;
