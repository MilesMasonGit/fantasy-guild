import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { calculateHeroLevel } from '../../../systems/hero/HeroGenerator.js';
import { getClass, getTrait } from '../../../config/registries/index.js';

/**
 * InformationModule
 * Displays the Hero's RPG background logic (Level, Class, Trait).
 * Intended to sit immediately beneath the HeaderModule.
 * 
 * @param {Object} props
 * @param {Object} props.hero - The hero data object containing classId, traitId, and skills.
 */
export const InformationModule = ({
    hero,
    className
}) => {
    if (!hero) return null;

    // Memoize the level calculation from the legacy engine
    const level = useMemo(() => calculateHeroLevel(hero.skills || {}), [hero.skills]);

    // Lookup full display names from registries
    const heroClass = getClass(hero.classId);
    const heroTrait = getTrait(hero.traitId);

    const traitName = heroTrait?.name || hero.traitId || 'Unknown Trait';
    const classNameFull = heroClass?.name || hero.classId || 'Unknown Class';

    return (
        <div className={cn("text-[10px] text-gray-400 font-pixel w-full truncate", className)}>
            {hero.isVillager ? (
                <span className="opacity-80">Villager</span>
            ) : (
                <>
                    <span className="text-gi-primary font-bold mr-1">LV.{level}</span>
                    <span className="opacity-60 mr-1">—</span>
                    <span className="opacity-90">{traitName} {classNameFull}</span>
                </>
            )}
        </div>
    );
};

export default InformationModule;
