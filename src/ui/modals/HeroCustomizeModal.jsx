import React, { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { useEngine } from '../hooks/useEngine.js';
import { useGameState } from '../hooks/useGameState.js';
import { cn } from '../utils/cn.js';
import { Save, User, Image as ImageIcon } from 'lucide-react';
import ItemIcon from '../components/base/ItemIcon.jsx';

const AVAILABLE_SPRITES = [
    { id: 'hero_adventure', name: 'Adventurer' },
    { id: 'hero_knight', name: 'Knight' },
    { id: 'hero_rogue', name: 'Rogue' },
    { id: 'hero_warlock', name: 'Warlock' },
    { id: 'hero_wizard', name: 'Wizard' },
];

/**
 * HeroCustomizeModal
 * Allows the user to rename a hero and select their professional sprite.
 */
export const HeroCustomizeModal = ({ isOpen, onClose, heroId }) => {
    const engine = useEngine();
    const hero = useGameState(
        state => heroId ? engine.HeroManager.getHero(heroId) : null,
        ['heroes_updated'],
        null,
        { deps: [heroId] }
    );

    const [name, setName] = useState('');
    const [selectedSprite, setSelectedSprite] = useState('');

    // Reset local state when hero or modal state changes
    useEffect(() => {
        if (isOpen && hero) {
            setName(hero.name || '');
            setSelectedSprite(hero.spriteId || hero.classId || 'hero_adventure');
        }
    }, [isOpen, hero]);

    if (!isOpen || !hero) return null;

    const handleSave = () => {
        if (!name.trim()) return;
        
        engine.HeroManager.updateHeroProfile(hero.id, {
            name: name.trim(),
            spriteId: selectedSprite
        });
        
        onClose();
    };

    return (
        <GIModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Designate Hero Identity" 
            className="w-full max-w-lg bg-gray-900 border-gi-primary/50 text-white"
        >
            <div className="flex flex-col gap-8">
                
                {/* 1. Name Input Section */}
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gi-primary">
                        <User size={12} /> Registry Designation
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter hero name..."
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-lg font-bold text-white focus:border-gi-primary focus:ring-1 focus:ring-gi-primary outline-none transition-all font-pixel"
                    />
                </div>

                {/* 2. Sprite Selection Section */}
                <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gi-primary">
                        <ImageIcon size={12} /> Visual Avatar
                    </label>
                    
                    <div className="grid grid-cols-5 gap-3">
                        {AVAILABLE_SPRITES.map((sprite) => (
                            <button
                                key={sprite.id}
                                onClick={() => setSelectedSprite(sprite.id)}
                                className={cn(
                                    "relative aspect-square flex items-center justify-center rounded-lg border-2 transition-all p-1 group",
                                    selectedSprite === sprite.id 
                                        ? "bg-gi-primary/20 border-gi-primary shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-105" 
                                        : "bg-black/40 border-white/5 hover:border-white/20"
                                )}
                            >
                                <div className="w-full h-full flex items-center justify-center">
                                    <ItemIcon 
                                        item={{ sprite: sprite.id, classId: sprite.id }} 
                                        size={48} 
                                        className={cn(
                                            "transition-transform",
                                            selectedSprite === sprite.id ? "brightness-110" : "opacity-60 group-hover:opacity-100"
                                        )}
                                    />
                                </div>
                                {selectedSprite === sprite.id && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gi-primary rounded-full flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider text-center">
                        Select a unique aesthetic for {name || 'this hero'}
                    </p>
                </div>

                {/* 3. Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold uppercase tracking-widest rounded-lg transition-all"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className={cn(
                            "flex-[2] flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-widest rounded-lg transition-all font-pixel shadow-lg",
                            name.trim() 
                                ? "bg-gi-primary text-black hover:brightness-110 shadow-gi-primary/20" 
                                : "bg-gray-700 text-gray-500 cursor-not-allowed"
                        )}
                    >
                        <Save className="w-4 h-4" /> Finalize Profile
                    </button>
                </div>
            </div>
        </GIModal>
    );
};

export default HeroCustomizeModal;
