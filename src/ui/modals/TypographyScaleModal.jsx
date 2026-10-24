import { useRef, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { GIModal } from '../components/base/GIModal.jsx';
import { KitButton, KIT_BUTTON_TONE } from '../components/base/KitButton.jsx';

export const DEFAULT_FONT_SIZES = [
    { key: '--font-size-xxs', label: 'XXS (Extra Extra Small)', defaultVal: 14 },
    { key: '--font-size-xs', label: 'XS (Extra Small)', defaultVal: 16 },
    { key: '--font-size-sm', label: 'SM (Small)', defaultVal: 18 },
    { key: '--font-size-base', label: 'BASE (Standard)', defaultVal: 20 },
    { key: '--font-size-lg', label: 'LG (Large)', defaultVal: 24 },
    { key: '--font-size-xl', label: 'XL (Extra Large)', defaultVal: 32 },
    { key: '--font-size-2xl', label: '2XL (Double Large)', defaultVal: 48 },
];

/**
 * The Typography Scale window: sliders that preview every text size live. Save & Close keeps
 * them; Escape and the X put back the sizes it opened with. Mount it only while open, so it
 * reads the sizes afresh each time.
 * ⚠️ A window of its own (a nested dialog), not an overlay drawn inside Settings: Settings'
 * panel is transformed, which would make it the box a `fixed` child is laid out in.
 */
export const TypographyScaleModal = ({ isOpen, onClose }) => {
    const [sizes, setSizes] = useState(() => {
        const saved = SettingsManager.get('ui.fontSizes') || {};
        const initial = {};
        DEFAULT_FONT_SIZES.forEach(f => {
            if (saved[f.key] != null) {
                initial[f.key] = saved[f.key];
            } else {
                const valStr = typeof document !== 'undefined'
                    ? getComputedStyle(document.documentElement).getPropertyValue(f.key).trim()
                    : '';
                const val = valStr ? parseInt(valStr, 10) : f.defaultVal;
                initial[f.key] = isNaN(val) ? f.defaultVal : val;
            }
        });
        return initial;
    });
    const openedWith = useRef(sizes);

    if (!isOpen) return null;

    const handleSliderChange = (key, value) => {
        const next = { ...sizes, [key]: value };
        setSizes(next);
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty(key, `${value}px`);
        }
    };

    const handleReset = () => {
        const reset = {};
        DEFAULT_FONT_SIZES.forEach(f => {
            reset[f.key] = f.defaultVal;
            if (typeof document !== 'undefined') {
                document.documentElement.style.setProperty(f.key, `${f.defaultVal}px`);
            }
        });
        setSizes(reset);
        SettingsManager.set('ui.fontSizes', reset);
    };

    const handleSaveAndClose = () => {
        SettingsManager.set('ui.fontSizes', sizes);
        onClose();
    };

    // Leaving without saving puts back the sizes the window opened with: the preview goes too.
    const handleCancel = () => {
        SettingsManager.applyFontSizes(openedWith.current);
        onClose();
    };

    return (
        <GIModal isOpen={isOpen} onClose={handleCancel} title="Typography Scale" maxWidth="max-w-[540px]" layer="inner">
            <div data-typography-window className="flex flex-col max-h-[70vh] text-gi-text">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-5 custom-scrollbar pr-1">
                    <p className="text-xs text-gi-muted normal-case tracking-normal">
                        Drag the sliders to adjust typography sizing in real time. The entire game interface will immediately scale to preview your layout fit.
                    </p>

                    <div className="space-y-4">
                        {DEFAULT_FONT_SIZES.map(f => {
                            const currentVal = sizes[f.key] ?? f.defaultVal;
                            return (
                                <div key={f.key} data-typography-row className="space-y-2 py-1">
                                    <div className="flex justify-between items-baseline text-xs font-bold text-gi-primary">
                                        <span>{f.label}</span>
                                        <span className="text-xs text-gi-gold tabular-nums font-bold">
                                            {currentVal}px
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="8"
                                        max="64"
                                        value={currentVal}
                                        onChange={(e) => handleSliderChange(f.key, Number(e.target.value))}
                                        className="ui-range w-full"
                                    />
                                    <div className="py-1.5 text-center mt-1">
                                        <div
                                            style={{ fontSize: `${currentVal}px` }}
                                            className="uppercase leading-tight tracking-wider truncate"
                                        >
                                            12 Nature: Harvesting 99 Oak.
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-3 mt-3 border-t border-gi-border flex items-center justify-between gap-3">
                    <KitButton
                        tone={KIT_BUTTON_TONE.PLAIN}
                        onClick={handleReset}
                        buttonClassName="px-3 py-1 text-xs uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                    </KitButton>
                    <KitButton
                        onClick={handleSaveAndClose}
                        className="mr-1 mb-1"
                        buttonClassName="px-5 py-1 text-xs uppercase tracking-widest"
                    >
                        <Check className="w-4 h-4" /> Save & Close
                    </KitButton>
                </div>
            </div>
        </GIModal>
    );
};

export default TypographyScaleModal;
