/**
 * @deprecated THIS MODAL IS DEPRECATED.
 * Area discovery is now handled via Map Fragments and the World Map UI.
 */
import React, { useState, useMemo } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { cn } from '../utils/cn.js';
import { Search, Map } from 'lucide-react';
import { BIOMES as BiomeRegistry } from '../../config/registries/biomeRegistry.js';
import * as NotificationSystem from '../../systems/core/NotificationSystem.js';
import { EventBus } from '../../systems/core/EventBus.js';

/**
 * SpawnAreaModal
 * Developer utility screen to force-spawn Biome decks onto the playmat.
 */
export const SpawnAreaModal = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    // Transform and sort registry into an array once
    const allBiomes = useMemo(() => {
        return Object.values(BiomeRegistry)
            .filter(biome => biome && biome.id)
            .map(biome => ({
                id: biome.id,
                name: biome.name,
                icon: biome.icon || '🗺️',
                category: biome.category || 'unknown'
            }))
            .sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.name.localeCompare(b.name);
            });
    }, []);

    // Filter based on search term
    const filteredBiomes = useMemo(() => {
        if (!searchTerm) return allBiomes;
        const lowerTerm = searchTerm.toLowerCase();
        return allBiomes.filter(biome =>
            biome.name.toLowerCase().includes(lowerTerm) ||
            biome.category.toLowerCase().includes(lowerTerm)
        );
    }, [allBiomes, searchTerm]);

    // Handle spawn action
    const handleSpawn = () => {
        if (!selectedId) return;
        NotificationSystem.warning('SpawnAreaModal is deprecated. Use the World Map to discover areas.');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Dev Tools: Spawn Area"
            className="w-full max-w-md bg-gray-900 border-purple-500/50 text-white"
        >
            <div className="flex flex-col gap-4">

                {/* Search Bar */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setSelectedId(null); // Clear selection on search
                        }}
                        placeholder="Search areas by name or category..."
                        className="w-full bg-black/60 border border-white/20 text-white font-pixel text-xs py-2 pl-9 pr-3 rounded focus:border-purple-500 outline-none"
                    />
                </div>

                {/* List Container */}
                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar bg-black/40 border border-white/10 rounded p-1">
                    {filteredBiomes.length === 0 ? (
                        <div className="text-gray-500 text-center py-8 font-pixel text-xs">No areas found.</div>
                    ) : (
                        filteredBiomes.map(biome => (
                            <div
                                key={biome.id}
                                onClick={() => setSelectedId(biome.id)}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border",
                                    selectedId === biome.id
                                        ? "bg-purple-900/40 border-purple-500"
                                        : "bg-transparent border-transparent hover:bg-white/5"
                                )}
                            >
                                <span className="text-xl drop-shadow-md w-6 text-center">{biome.icon}</span>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm tracking-wide">{biome.name}</span>
                                    <span className="text-[10px] text-gray-500 uppercase">{biome.category}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Actions */}
                <button
                    onClick={handleSpawn}
                    disabled={!selectedId}
                    className={cn(
                        "w-full py-2.5 rounded font-bold font-pixel tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                        selectedId
                            ? "bg-purple-600 hover:bg-purple-500 text-white drop-shadow-[0_0_10px_rgba(147,51,234,0.4)]"
                            : "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                    )}
                >
                    <Map size={18} />
                    Spawn Area Deck
                </button>

            </div>
        </GIModal>
    );
};

export default SpawnAreaModal;
