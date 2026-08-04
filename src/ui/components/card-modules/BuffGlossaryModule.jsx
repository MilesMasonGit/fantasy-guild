import React from 'react';
import { cn } from '../../utils/cn.js';

// Lightweight dictionary of status effects
const STATUS_EFFECT_DICTIONARY = {
    'poisoned': 'Take damage over time.',
    'hasted': 'Perform actions 20% faster.',
    'stunned': 'Cannot act for a short duration.',
    'empowered': 'Deal 50% more damage.',
    'protected': 'Reduces incoming damage by 30%.'
};

export const BuffGlossaryModule = React.memo(({ trait, card, template, ...props }) => {
    // We expect the trait to have a `text` field containing the MTG style buff.
    const buffText = props.text || trait?.text || card?.buffText || template?.buffText;

    if (!buffText) return null;

    // Find any keywords mentioned in the buff text (case-insensitive)
    const keywordsFound = Object.keys(STATUS_EFFECT_DICTIONARY).filter(keyword => 
        buffText.toLowerCase().includes(keyword.toLowerCase())
    );

    return (
        <div className={cn("flex flex-col gap-2 w-full mt-2", props.className)}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                Passive
            </div>
            
            {/* MTG Style Text (Italicized, evocative) */}
            <div className="text-pixel-sm text-gi-text font-serif italic leading-relaxed whitespace-pre-wrap">
                {buffText}
            </div>

            {/* Glossary definitions */}
            {keywordsFound.length > 0 && (
                <div className="mt-1 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    {keywordsFound.map(keyword => (
                        <div key={keyword} className="flex gap-1 text-[10px] leading-tight">
                            <span className="font-bold text-gi-primary capitalize">{keyword}:</span>
                            <span className="text-gi-muted">{STATUS_EFFECT_DICTIONARY[keyword]}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default BuffGlossaryModule;
