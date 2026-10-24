import { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
// Static: SaveManager is already in the main chunk (main.jsx and the slot screen import it),
// so a dynamic import here would split nothing.
import { SaveManager } from '../../systems/core/SaveManager.js';
import { cn } from '../utils/cn.js';
import { Bell, MonitorPlay, Volume2, Wrench, Save, Eye, Type, Sliders } from 'lucide-react';
import { TypographyScaleModal } from './TypographyScaleModal.jsx';
import { KitButton, KIT_BUTTON_TONE, PixelToggle } from '../components/base/KitButton.jsx';

/** SettingsModal: a tabbed interface for global game settings. */
export const SettingsModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('accessibility');
    const [settings, setSettings] = useState({});
    const [isTypographyOpen, setIsTypographyOpen] = useState(false);

    // Read current settings when opened
    useEffect(() => {
        if (isOpen) {
            setSettings({ ...SettingsManager.settings });
        }
    }, [isOpen]);

    const handleSettingChange = (path, value) => {
        SettingsManager.set(path, value);
        setSettings(SettingsManager.getAll());
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'accessibility', label: 'Accessibility', icon: <Eye size={16} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
        { id: 'gameplay', label: 'Gameplay', icon: <MonitorPlay size={16} /> },
        { id: 'audio', label: 'Audio', icon: <Volume2 size={16} /> },
        { id: 'dev', label: 'Dev Tools', icon: <Wrench size={16} /> },
    // Debug Mode is for dev and perf builds: a shipped build has no Dev Tools tab.
    ].filter(tab => tab.id !== 'dev' || import.meta.env.DEV || import.meta.env.MODE === 'perf');

    const getVal = (path) => path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, settings);

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title="Settings" className="w-full max-w-3xl text-white">
            <div className="flex flex-col md:flex-row gap-4 h-full min-h-[400px]">
                <div className="w-full md:w-48 flex flex-col gap-2 border-r border-white/10 pr-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 w-full px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer",
                                activeTab === tab.id ? "text-white border-l-2 border-[var(--color-ui-gold)]" : "text-gray-500 hover:text-white border-l-2 border-transparent"
                            )}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                    {/**
                     * Injected from package.json by Vite's `define`, so the only version
                     * number a player ever sees cannot be forgotten at a bump.
                     */}
                    <div className="mt-auto pt-4 text-xs text-gray-600">v{__APP_VERSION__}</div>
                </div>

                <div className="flex-1 flex flex-col pt-2 h-[450px] overflow-y-auto custom-scrollbar px-2 pb-2">
                    {activeTab === 'accessibility' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <div className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                                        <Type className="w-4 h-4 text-gi-primary" /> Typography Scale
                                    </span>
                                    <span className="ui-text-body text-gray-400 mt-0.5">
                                        Customize font sizes from XXS (14px) to 2XL (48px) with real-time UI preview
                                    </span>
                                </div>
                                <KitButton
                                    tone={KIT_BUTTON_TONE.PLAIN}
                                    onClick={() => setIsTypographyOpen(true)}
                                    className="shrink-0"
                                    buttonClassName="gap-2 px-3 py-1 text-xs uppercase tracking-wider"
                                >
                                    <Sliders className="w-3.5 h-3.5" /> Adjust Scale
                                </KitButton>
                            </div>

                            <SettingSelect 
                                label="Font Preference" 
                                value={getVal('ui.fontFamily')} 
                                onChange={(v) => handleSettingChange('ui.fontFamily', v)} 
                                options={[
                                    { value: 'silkpixel', label: 'SilkPixel (Default)' },
                                    { value: 'pixel', label: 'Pixelify Sans' },
                                    { value: 'silkscreen', label: 'Silkscreen' },
                                    { value: 'dotgothic', label: 'DotGothic 16' },
                                    { value: 'inter', label: 'Modern Sans' }
                                ]} 
                            />

                            <SettingToggle 
                                label="All Caps Text" 
                                value={getVal('ui.allCaps')} 
                                onChange={(v) => handleSettingChange('ui.allCaps', v)} 
                                description="Convert standard headers and labels to uppercase for readability"
                            />

                            {/* Disabled with 'coming soon' rather than wired or removed. */}
                            <SettingSelect settingKey="gameplay.themeMode" disabled label="Theme Mode" value={getVal('gameplay.themeMode')} onChange={(v) => handleSettingChange('gameplay.themeMode', v)} options={[{value: 'dark', label: 'Dark'}, {value: 'light', label: 'Light'}]} />

                            <SettingToggle
                                settingKey="ui.zoomToCursor"
                                disabled
                                label="Zoom to Cursor"
                                value={getVal('ui.zoomToCursor')}
                                onChange={(v) => handleSettingChange('ui.zoomToCursor', v)}
                                description="Zoom towards your mouse instead of center screen"
                            />

                            <SettingToggle
                                settingKey="gameplay.enableAnimations"
                                disabled
                                label="Animations"
                                value={getVal('gameplay.enableAnimations')}
                                onChange={(v) => handleSettingChange('gameplay.enableAnimations', v)}
                                description="Disable animations for reduced motion / performance"
                            />
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingToggle
                                settingKey="notifications.itemStubs"
                                label="Item Stubs"
                                value={getVal('notifications.itemStubs') !== false}
                                onChange={(v) => handleSettingChange('notifications.itemStubs', v)}
                                description="Show items gained and spent at the top right of the mat"
                            />
                        </div>
                    )}

                    {activeTab === 'gameplay' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingSelect 
                                label="Auto-Save Interval" 
                                value={getVal('gameplay.autoSaveIntervalMinutes')} 
                                onChange={(v) => handleSettingChange('gameplay.autoSaveIntervalMinutes', v)} 
                                options={[
                                    { value: 1, label: '1 Minute (Dev)' },
                                    { value: 10, label: '10 Minutes' },
                                    { value: 60, label: '1 Hour' },
                                    { value: 0, label: 'Off' }
                                ]} 
                            />
                            <div className="pt-4 border-t border-white/10">
                                <KitButton
                                    onClick={() => SaveManager.save(true)}
                                    className="w-full"
                                    buttonClassName="gap-2 py-2 uppercase tracking-widest"
                                >
                                    <Save className="w-4 h-4" /> Save Game Now
                                </KitButton>
                            </div>
                            <SettingSelect 
                                label="Background Tile" 
                                value={getVal('ui.backgroundTile')} 
                                onChange={(v) => handleSettingChange('ui.backgroundTile', v)} 
                                options={[
                                    { value: 'u_table_wood_spruce', label: 'Spruce Planks (Default)' },
                                    { value: 'u_table_wood_planks_oak', label: 'Oak Planks' },
                                    { value: 'u_table_mountain', label: 'Mountain' },
                                    { value: 'u_table_forest', label: 'Forest' }
                                ]} 
                            />

                            <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-2">
                                <span className="ui-text-body font-bold text-gi-primary uppercase tracking-[0.2em] mb-1 opacity-80">UI & HUD Toggles</span>
                                <SettingToggle label="Menu on Right Side" value={getVal('ui.bubbleMenuRight')} onChange={(v) => handleSettingChange('ui.bubbleMenuRight', v)} description="Dock the bubble menu on the right edge of the screen" />
                                <SettingToggle settingKey="ui.tooltipsEnabled" disabled label="Master Tooltips" value={getVal('ui.tooltipsEnabled')} onChange={(v) => handleSettingChange('ui.tooltipsEnabled', v)} />
                                <SettingToggle settingKey="ui.tooltipsItems" disabled label="Item Tooltips" value={getVal('ui.tooltipsItems')} onChange={(v) => handleSettingChange('ui.tooltipsItems', v)} />
                                <SettingToggle settingKey="ui.itemParticles" label="Flying Items" value={getVal('ui.itemParticles')} onChange={(v) => handleSettingChange('ui.itemParticles', v)} description="Show collected items flying from the mat to the item stubs or the Guild Hall" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <SettingSlider label="Master Volume" value={getVal('audio.masterVolume')} onChange={(v) => handleSettingChange('audio.masterVolume', v)} />
                            <SettingSlider label="Music Volume" value={getVal('audio.musicVolume')} onChange={(v) => handleSettingChange('audio.musicVolume', v)} />
                            <SettingSlider label="SFX Volume" value={getVal('audio.sfxVolume')} onChange={(v) => handleSettingChange('audio.sfxVolume', v)} />
                        </div>
                    )}

                    {activeTab === 'dev' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingToggle label="Debug Mode" value={getVal('debugMode')} onChange={(v) => handleSettingChange('debugMode', v)} />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between w-full border-t border-white/10 pt-4 mt-2">
                <button onClick={() => { SettingsManager.resetOptions(); setSettings(SettingsManager.getAll()); }} className="text-gray-500 hover:text-red-400 font-bold transition-colors text-sm px-4 cursor-pointer">
                    Reset Defaults
                </button>
                <KitButton onClick={onClose} className="mr-1 mb-1" buttonClassName="uppercase tracking-widest px-8 py-1.5">
                    Done
                </KitButton>
            </div>

            {isTypographyOpen && (
                <TypographyScaleModal
                    isOpen
                    onClose={() => {
                        setIsTypographyOpen(false);
                        setSettings(SettingsManager.getAll());
                    }}
                />
            )}
        </GIModal>
    );
};


// A control with nothing behind it yet (not wired, or marked 'coming soon') is DISABLED rather
// than left to look live: a player could flip it and nothing would happen. `disabled` greys
// the row, blocks the control, and adds the '(Coming soon)' tag; it never changes `value` or
// `onChange`, so re-wiring it later is just dropping the prop.
const SettingToggle = ({ label, value, onChange, description, disabled = false, settingKey }) => (
    <div data-setting={settingKey} data-setting-disabled={disabled || undefined} className={cn("flex items-center justify-between gap-3 py-1.5", disabled && "opacity-50")}>
        <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wide">
                {label}
                {disabled && <span className="ml-2 ui-text-body font-normal normal-case text-gi-muted">(Coming soon)</span>}
            </span>
            {description && <span className="ui-text-body text-gray-500">{description}</span>}
        </div>
        <PixelToggle
            on={!!value}
            onClick={() => { if (!disabled) onChange(!value); }}
            disabled={disabled}
        />
    </div>
);

const SettingSlider = ({ label, value = 100, onChange }) => (
    <div className="flex flex-col gap-2 py-1.5">
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white tracking-wide">{label}</span>
            <span className="text-gi-primary text-sm">{value}%</span>
        </div>
        <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="ui-range w-full" />
    </div>
);

const SettingSelect = ({ label, value, options, onChange, disabled = false, settingKey }) => (
    <div data-setting={settingKey} data-setting-disabled={disabled || undefined} className={cn("flex items-center justify-between gap-3 py-1.5", disabled && "opacity-50")}>
        <span className="text-sm font-bold text-white tracking-wide">
            {label}
            {disabled && <span className="ml-2 ui-text-body font-normal normal-case text-gi-muted">(Coming soon)</span>}
        </span>
        <select
            value={String(value)}
            disabled={disabled}
            onChange={(e) => {
                if (disabled) return;
                let val = e.target.value;
                if (val === 'true') val = true; else if (val === 'false') val = false;
                else if (!isNaN(parseInt(val))) val = parseInt(val);
                onChange(val);
            }}
            className={cn(
                "ui-pixel-edge bg-black/60 text-white px-3 py-1 outline-none font-bold cursor-pointer",
                disabled && "cursor-not-allowed"
            )}
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

export default SettingsModal;
