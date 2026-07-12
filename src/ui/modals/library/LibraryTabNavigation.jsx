import React from 'react';
import { cn } from '../../utils/cn.js';
import { Book, Box, Skull, ChevronRight, Search } from 'lucide-react';

export const LibraryTabNavigation = ({
    searchScope,
    setSearchScope,
    setSearchMode,
    handleClearAll
}) => {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-display font-bold text-gi-primary gi-caps tracking-widest flex items-center gap-2">
                    <Search size={14} />
                    Search
                </label>
                <button
                    onClick={handleClearAll}
                    className="text-[10px] font-display font-bold text-gi-gold hover:text-white gi-caps tracking-widest transition-colors"
                >
                    Clear All
                </button>
            </div>
            
            <div className="flex flex-col gap-2">
                {[
                    { id: 'cards', label: 'Cards', icon: Book },
                    { id: 'items', label: 'Items', icon: Box },
                    { id: 'enemies', label: 'Enemies', icon: Skull }
                ].map(s => {
                    const Icon = s.icon;
                    const isActive = searchScope === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => {
                                setSearchScope(s.id);
                                setSearchMode('name');
                            }}
                            className={cn(
                                "w-full flex items-center px-6 py-4 rounded-xl border-2 transition-all relative group",
                                isActive
                                    ? "bg-white/5 border-white/40 text-white"
                                    : "bg-transparent border-white/5 text-gi-muted hover:border-white/20 hover:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <ChevronRight 
                                    size={20} 
                                    strokeWidth={3} 
                                    className="absolute left-2 text-white animate-in fade-in slide-in-from-left-1 duration-300" 
                                />
                            )}
                            
                            <div className={cn(
                                "flex items-center gap-4 transition-transform duration-300",
                                isActive ? "translate-x-8" : "translate-x-0"
                            )}>
                                <Icon size={24} strokeWidth={2.5} />
                                <span className="text-lg font-display font-bold gi-caps tracking-widest">
                                    {s.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
