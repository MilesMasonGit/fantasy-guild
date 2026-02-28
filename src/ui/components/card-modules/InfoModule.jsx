import React from 'react';

/**
 * InfoModule
 * A standardized text block for displaying lore, tutorials, or descriptive paragraphs within a card.
 * Designed to handle legacy Vanilla HTML string injections safely.
 * 
 * @param {Object} props
 * @param {string} props.title - Optional sub-header for the text block
 * @param {string|React.ReactNode} props.content - The main body text or HTML string
 * @param {string} props.variant - 'lore' (italicized/secondary) or 'mechanic' (primary font)
 */
const InfoModule = ({ title, content, variant = 'mechanic' }) => {
    if (!content) return null;

    // Define typography styles based on semantic intentionality
    const typographyClass = variant === 'lore'
        ? 'text-xs text-gray-400 italic leading-relaxed font-serif tracking-wide'
        : 'text-xs text-gray-200 leading-relaxed font-medium';

    const isString = typeof content === 'string';

    return (
        <div className="flex flex-col gap-1.5 p-2 bg-black/20 rounded-md border border-white/5 shadow-inner">
            {title && (
                <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
                        {title}
                    </span>
                </div>
            )}

            <div className={`whitespace-pre-wrap ${typographyClass}`}>
                {isString ? (
                    // React strictly escapes strings; legacy Vanilla relied on raw HTML injections (e.g. <br> or <b>) for flavor text.
                    // We must dangerously set inner HTML here to mirror vanilla behavior exactly during the port.
                    <span dangerouslySetInnerHTML={{ __html: content }} />
                ) : (
                    // Fallback for native React node passing in newer architectures
                    content
                )}
            </div>
        </div>
    );
};

export default InfoModule;
