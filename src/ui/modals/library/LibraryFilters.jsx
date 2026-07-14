import React from 'react';
import { cn } from '../../utils/cn.js';
import { Search, ChevronDown, Check, Box, Sword, Hand, MapPin } from 'lucide-react';
import { SKILLS, SUB_SKILL_TO_PARENT } from '../../../config/registries/index.js';

// All 15 skills from the registry, with a "Combat" umbrella entry first.
const SKILL_FILTER_OPTIONS = [
    { id: 'combat', name: 'Combat (Any)' },
    ...Object.values(SKILLS).map(s => ({ id: s.id, name: s.name }))
];

// Sub-skill tags from the registry funnel map, alphabetized.
const SUB_SKILL_FILTER_OPTIONS = Object.keys(SUB_SKILL_TO_PARENT)
    .sort()
    .map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));

export const LibraryFilters = ({
    searchScope,
    searchMode,
    setSearchMode,
    searchTerm,
    setSearchTerm,
    minLevel,
    setMinLevel,
    maxLevel,
    setMaxLevel,
    statusFilter,
    setStatusFilter,
    typeFilters,
    toggleTypeFilter,
    skillFilters,
    toggleSkillFilter,
    subSkillFilters,
    toggleSubSkillFilter,
    areaFilters,
    toggleAreaFilter,
    areaSets,
    openDropdowns,
    toggleDropdown
}) => {
    return (
        <div className="flex flex-col gap-6">
            {/* Contextual Search Parameters (Enemies) */}
            {searchScope === 'enemies' && (
                <div className="flex gap-1 p-1 bg-black/20 rounded-lg border border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {[
                        { id: 'name', label: 'Name' },
                        { id: 'drop', label: 'Drop' },
                        { id: 'type', label: 'Type' }
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSearchMode(m.id)}
                            className={cn(
                                "flex-1 py-1 rounded-md text-[9px] font-display font-bold gi-caps tracking-tighter transition-all",
                                searchMode === m.id
                                    ? "bg-gi-primary text-gi-primary-text"
                                    : "text-gi-muted hover:text-gi-text"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Search Controls */}
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={
                            searchScope === 'cards' ? "Search by name..." :
                            searchScope === 'items' ? "Search Name or Tag" :
                            `Search by ${searchMode}...`
                        }
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-sans focus:outline-none focus:border-gi-primary/50 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="text-gi-muted hover:text-gi-text"
                            >
                                &times;
                            </button>
                        )}
                        <Search size={14} className="text-gi-muted" />
                    </div>
                </div>

                {/* Level Range Filters */}
                {searchScope !== 'items' && (
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={minLevel}
                                onChange={(e) => setMinLevel(e.target.value)}
                                placeholder="Min Lvl"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-sans focus:outline-none focus:border-gi-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={maxLevel}
                                onChange={(e) => setMaxLevel(e.target.value)}
                                placeholder="Max Lvl"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-sans focus:outline-none focus:border-gi-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Discovery Toggles */}
            <div className="flex flex-col gap-1.5">
                <button
                    onClick={() => setStatusFilter(statusFilter === 'discovered' ? 'all' : 'discovered')}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                        statusFilter === 'discovered'
                            ? "bg-gi-primary/10 border border-gi-primary/30 text-gi-primary"
                            : "hover:bg-white/5 text-gi-muted"
                    )}
                >
                    <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        statusFilter === 'discovered' ? "bg-gi-primary border-gi-primary" : "border-white/20 bg-black/20"
                    )}>
                        {statusFilter === 'discovered' && <Check size={10} className="text-black" strokeWidth={4} />}
                    </div>
                    <span className="flex-1 text-left">Discovered</span>
                </button>
                <button
                    onClick={() => setStatusFilter(statusFilter === 'undiscovered' ? 'all' : 'undiscovered')}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                        statusFilter === 'undiscovered'
                            ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                            : "hover:bg-white/5 text-gi-muted"
                    )}
                >
                    <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        statusFilter === 'undiscovered' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                    )}>
                        {statusFilter === 'undiscovered' && <Check size={10} className="text-black" strokeWidth={4} />}
                    </div>
                    <span className="flex-1 text-left">Missing</span>
                </button>

                {searchScope !== 'items' && (
                    <>
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'playmat' ? 'all' : 'playmat')}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                statusFilter === 'playmat'
                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                    : "hover:bg-white/5 text-gi-muted"
                            )}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                statusFilter === 'playmat' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                            )}>
                                {statusFilter === 'playmat' && <Check size={10} className="text-black" strokeWidth={4} />}
                            </div>
                            <span className="flex-1 text-left">On Playmat</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter(statusFilter === 'storage' ? 'all' : 'storage')}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                statusFilter === 'storage'
                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                    : "hover:bg-white/5 text-gi-muted"
                            )}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                statusFilter === 'storage' ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                            )}>
                                {statusFilter === 'storage' && <Check size={10} className="text-black" strokeWidth={4} />}
                            </div>
                            <span className="flex-1 text-left">In Storage</span>
                        </button>
                    </>
                )}
            </div>

            {/* Advanced Filters (Hidden in Item Mode) */}
            {searchScope !== 'items' && (
                <div className="flex flex-col gap-8">
                    {/* Card Types Dropdown */}
                    <div className="flex flex-col border-b border-gi-border/20 pb-2">
                        <button
                            onClick={() => toggleDropdown('types')}
                            className="flex items-center justify-between w-full py-2 group/drop"
                        >
                            <label className="text-[10px] font-display font-bold text-gi-primary gi-caps tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                <Box size={14} />
                                Card Types
                                {typeFilters.size > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                        {typeFilters.size}
                                    </span>
                                )}
                            </label>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-gi-muted transition-transform duration-300",
                                    !openDropdowns.has('types') && "-rotate-90"
                                )}
                            />
                        </button>

                        {openDropdowns.has('types') && (
                            <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                {['Combat', 'Task', 'Project', 'Blueprint', 'Artifact'].map(type => {
                                    const t = type.toLowerCase();
                                    const isActive = typeFilters.has(t);
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => toggleTypeFilter(t)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                isActive
                                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                    : "hover:bg-white/5 text-gi-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                            )}>
                                                {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                            </div>
                                            <span className="flex-1 text-left">{type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Skills Dropdown */}
                    <div className="flex flex-col border-b border-gi-border/20 pb-2">
                        <button
                            onClick={() => toggleDropdown('skills')}
                            className="flex items-center justify-between w-full py-2 group/drop"
                        >
                            <label className="text-[10px] font-display font-bold text-gi-primary gi-caps tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                <Sword size={14} />
                                Skills
                                {skillFilters.size > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                        {skillFilters.size}
                                    </span>
                                )}
                            </label>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-gi-muted transition-transform duration-300",
                                    !openDropdowns.has('skills') && "-rotate-90"
                                )}
                            />
                        </button>

                        {openDropdowns.has('skills') && (
                            <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                {SKILL_FILTER_OPTIONS.map(skill => {
                                    const isActive = skillFilters.has(skill.id);
                                    return (
                                        <button
                                            key={skill.id}
                                            onClick={() => toggleSkillFilter(skill.id)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                isActive
                                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                    : "hover:bg-white/5 text-gi-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                            )}>
                                                {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                            </div>
                                            <span className="flex-1 text-left">{skill.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sub-skills Dropdown */}
                    <div className="flex flex-col border-b border-gi-border/20 pb-2">
                        <button
                            onClick={() => toggleDropdown('subskills')}
                            className="flex items-center justify-between w-full py-2 group/drop"
                        >
                            <label className="text-[10px] font-display font-bold text-gi-primary gi-caps tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                <Hand size={14} />
                                Sub-skills
                                {subSkillFilters.size > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                        {subSkillFilters.size}
                                    </span>
                                )}
                            </label>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-gi-muted transition-transform duration-300",
                                    !openDropdowns.has('subskills') && "-rotate-90"
                                )}
                            />
                        </button>

                        {openDropdowns.has('subskills') && (
                            <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                {SUB_SKILL_FILTER_OPTIONS.map(sub => {
                                    const isActive = subSkillFilters.has(sub.id);
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => toggleSubSkillFilter(sub.id)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                isActive
                                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                    : "hover:bg-white/5 text-gi-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                            )}>
                                                {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                            </div>
                                            <span className="flex-1 text-left">{sub.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Areas Dropdown */}
                    <div className="flex flex-col border-b border-gi-border/20 pb-2">
                        <button
                            onClick={() => toggleDropdown('areas')}
                            className="flex items-center justify-between w-full py-2 group/drop"
                        >
                            <label className="text-[10px] font-display font-bold text-gi-primary gi-caps tracking-widest flex items-center gap-2 cursor-pointer group-hover/drop:text-gi-gold transition-colors">
                                <MapPin size={14} />
                                Areas
                                {areaFilters.size > 0 && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gi-primary/20 text-[8px] text-gi-primary">
                                        {areaFilters.size}
                                    </span>
                                )}
                            </label>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-gi-muted transition-transform duration-300",
                                    !openDropdowns.has('areas') && "-rotate-90"
                                )}
                            />
                        </button>

                        {openDropdowns.has('areas') && (
                            <div className="flex flex-col gap-1 mt-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                {areaSets.map(area => {
                                    const isActive = areaFilters.has(area.id);
                                    return (
                                        <button
                                            key={area.id}
                                            onClick={() => toggleAreaFilter(area.id)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-sans",
                                                isActive
                                                    ? "bg-gi-gold/10 border border-gi-gold/30 text-gi-gold"
                                                    : "hover:bg-white/5 text-gi-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                isActive ? "bg-gi-gold border-gi-gold" : "border-white/20 bg-black/20"
                                            )}>
                                                {isActive && <Check size={10} className="text-black" strokeWidth={4} />}
                                            </div>
                                            <span className="flex-1 text-left">{area.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
