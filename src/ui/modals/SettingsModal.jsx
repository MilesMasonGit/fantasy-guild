import React, { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { cn } from '../utils/cn.js';
import { Bell, MonitorPlay, Volume2, Wrench, Save } from 'lucide-react';

/**
 * SettingsModal
 * A 4-tabbed interface for global game settings.
 */
export const SettingsModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('notifications');
    const [settings, setSettings] = useState({});
    const [SaveManager, setSaveManager] = useState(null);

    // Read current settings when opened
    useEffect(() => {
        if (isOpen) {
            setSettings({ ...SettingsManager.settings });
            import('../../systems/core/SaveManager.js').then(module => setSaveManager(module.SaveManager));
        }
    }, [isOpen]);

    const handleSettingChange = (path, value) => {
        SettingsManager.set(path, value);
        setSettings(SettingsManager.getAll());
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
        { id: 'gameplay', label: 'Gameplay', icon: <MonitorPlay size={16} /> },
        { id: 'audio', label: 'Audio', icon: <Volume2 size={16} /> },
        { id: 'dev', label: 'Dev Tools', icon: <Wrench size={16} /> },
    ];

    const getVal = (path) => path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, settings);

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title="Protocol Settings" className="w-full max-w-3xl bg-gray-900 border-gi-primary/50 text-white">
            <div className="flex flex-col md:flex-row gap-4 h-full min-h-[400px]">
                {/* Vertical Sidebar */}
                <div className="w-full md:w-48 flex flex-col gap-2 border-r border-white/10 pr-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 w-full px-4 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all duration-300",
                                activeTab === tab.id ? "bg-gi-primary/20 text-white border-l-4 border-gi-primary" : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border-l-4 border-transparent"
                            )}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                    <div className="mt-auto pt-4 text-xs text-gray-600">v0.9.0</div>
                </div>

                {/* Content Panel */}
                <div className="flex-1 flex flex-col pt-2 h-[450px] overflow-y-auto custom-scrollbar px-2 pb-2">
                    {/* NOTIFICATIONS */}
                    {activeTab === 'notifications' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingToggle label="System Messages" value={getVal('showSystemMessages')} onChange={(v) => handleSettingChange('showSystemMessages', v)} description="Show messages like game saved, errors, etc." />
                            <SettingToggle label="Level Up Messages" value={getVal('showLevelUpMessages')} onChange={(v) => handleSettingChange('showLevelUpMessages', v)} />
                            <SettingToggle label="Loot Messages" value={getVal('showLootMessages')} onChange={(v) => handleSettingChange('showLootMessages', v)} />
                            <SettingSelect 
                                label="Notification Position" 
                                value={getVal('notifications.position')} 
                                onChange={(v) => handleSettingChange('notifications.position', v)} 
                                options={[
                                    { value: 'top_left', label: 'Top Left' },
                                    { value: 'top_right', label: 'Top Right' },
                                    { value: 'bottom_left', label: 'Bottom Left' },
                                    { value: 'bottom_right', label: 'Bottom Right' },
                                    { value: 'center_top', label: 'Center Top' },
                                    { value: 'center_bottom', label: 'Center Bottom' }
                                ]} 
                            />
                        </div>
                    )}

                    {/* GAMEPLAY */}
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
                                <button
                                    onClick={() => SaveManager?.save(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-gi-primary text-black font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all font-pixel shadow-lg"
                                >
                                    <Save className="w-4 h-4" /> Save Game Now
                                </button>
                            </div>
                            <SettingSelect label="Theme Mode" value={getVal('gameplay.themeMode')} onChange={(v) => handleSettingChange('gameplay.themeMode', v)} options={[{value: 'dark', label: 'Dark'}, {value: 'light', label: 'Light'}]} />
                            <SettingSelect 
                                label="Font Preference" 
                                value={getVal('ui.fontFamily')} 
                                onChange={(v) => handleSettingChange('ui.fontFamily', v)} 
                                options={[
                                    { value: 'pixel', label: 'Pixelify Sans' },
                                    { value: 'silkscreen', label: 'Silkscreen' },
                                    { value: 'dotgothic', label: 'DotGothic 16' },
                                    { value: 'inter', label: 'Modern Sans' }
                                ]} 
                            />
                            <SettingToggle 
                                label="Zoom to Cursor" 
                                value={getVal('ui.zoomToCursor')} 
                                onChange={(v) => handleSettingChange('ui.zoomToCursor', v)} 
                                description="Zoom towards your mouse instead of center screen"
                            />
                            <SettingToggle label="Animations" value={getVal('gameplay.enableAnimations')} onChange={(v) => handleSettingChange('gameplay.enableAnimations', v)} description="Disable for mobile performance" />

                            <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gi-primary uppercase tracking-[0.2em] mb-1 opacity-80">UI & HUD Toggles</span>
                                <SettingToggle label="Master Tooltips" value={getVal('ui.tooltipsEnabled')} onChange={(v) => handleSettingChange('ui.tooltipsEnabled', v)} />
                                <SettingToggle label="Card Badge Tooltips" value={getVal('ui.tooltipsCardBadges')} onChange={(v) => handleSettingChange('ui.tooltipsCardBadges', v)} />
                                <SettingToggle label="Boost Tile Tooltips" value={getVal('ui.tooltipsBoostTiles')} onChange={(v) => handleSettingChange('ui.tooltipsBoostTiles', v)} />
                                <SettingToggle label="Item Tooltips" value={getVal('ui.tooltipsItems')} onChange={(v) => handleSettingChange('ui.tooltipsItems', v)} />
                                <SettingToggle label="Item Fly Particles" value={getVal('ui.itemParticles')} onChange={(v) => handleSettingChange('ui.itemParticles', v)} description="Show items flying between cards and inventory" />
                            </div>
                        </div>
                    )}

                    {/* AUDIO */}
                    {activeTab === 'audio' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <SettingSlider label="Master Volume" value={getVal('audio.masterVolume')} onChange={(v) => handleSettingChange('audio.masterVolume', v)} />
                            <SettingSlider label="Music Volume" value={getVal('audio.musicVolume')} onChange={(v) => handleSettingChange('audio.musicVolume', v)} />
                            <SettingSlider label="SFX Volume" value={getVal('audio.sfxVolume')} onChange={(v) => handleSettingChange('audio.sfxVolume', v)} />
                        </div>
                    )}

                    {/* DEV TOOLS */}
                    {activeTab === 'dev' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingToggle label="Debug Mode" value={getVal('debugMode')} onChange={(v) => handleSettingChange('debugMode', v)} />
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <DevButton label="+1000 Resources" onClick={() => EventBus.publish('dev:give-all-resources')} />
                                <DevButton label="Spawn Hero" onClick={() => EventBus.publish('dev:spawn-hero')} />
                                <DevButton label="Spawn Entity..." onClick={() => EventBus.publish('dev:open-spawn-entity')} className="col-span-2" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between w-full border-t border-white/10 pt-4 mt-2">
                <button onClick={() => { SettingsManager.resetOptions(); setSettings(SettingsManager.getAll()); }} className="text-gray-500 hover:text-red-400 font-bold transition-colors text-sm px-4">
                    Reset Defaults
                </button>
                <button onClick={onClose} className="bg-gi-primary text-black font-bold uppercase tracking-widest px-8 py-2 rounded hover:brightness-110 transition-all font-pixel shadow-lg">
                    Done
                </button>
            </div>
        </GIModal>
    );
};

// --- INTERNAL SUB-COMPONENTS ---

const SettingToggle = ({ label, value, onChange, description }) => (
    <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/5">
        <div className="flex flex-col">
            <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
            {description && <span className="text-[10px] text-gray-500">{description}</span>}
        </div>
        <button
            onClick={() => onChange(!value)}
            className={cn("w-12 h-6 rounded-full relative transition-colors duration-300", value ? "bg-gi-success" : "bg-gray-700")}
        >
            <div className={cn("w-5 h-5 bg-white rounded-full absolute top-[2px] transition-transform duration-300", value ? "translate-x-[26px]" : "translate-x-[2px]")} />
        </button>
    </div>
);

const SettingSlider = ({ label, value = 100, onChange }) => (
    <div className="flex flex-col gap-2 p-3 bg-black/40 rounded border border-white/5">
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
            <span className="text-gi-primary font-pixel text-sm">{value}%</span>
        </div>
        <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full accent-gi-primary h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
    </div>
);

const SettingSelect = ({ label, value, options, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/5">
        <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
        <select
            value={String(value)}
            onChange={(e) => {
                let val = e.target.value;
                if (val === 'true') val = true; else if (val === 'false') val = false;
                else if (!isNaN(parseInt(val))) val = parseInt(val);
                onChange(val);
            }}
            className="bg-gray-900 border border-white/20 text-white rounded px-3 py-1.5 focus:border-gi-primary outline-none font-bold"
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

const DevButton = ({ label, onClick, className }) => (
    <button onClick={onClick} className={cn("bg-gi-base/40 hover:bg-gi-primary/20 border border-white/10 text-white/70 hover:text-white text-[10px] font-bold py-2 rounded transition-all uppercase tracking-widest", className)}>
        {label}
    </button>
);

export default SettingsModal;
