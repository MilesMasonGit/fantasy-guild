import React, { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SettingsManager } from '../../systems/core/SettingsManager.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { cn } from '../utils/cn.js';
import { Bell, MonitorPlay, Volume2, Wrench, Save } from 'lucide-react';

/**
 * SettingsModal
 * A 4-tabbed interface for global game settings.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 */
export const SettingsModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('notifications');
    const [settings, setSettings] = useState({});
    const [SaveManager, setSaveManager] = useState(null);

    // Read current settings when opened
    useEffect(() => {
        if (isOpen) {
            setSettings({ ...SettingsManager.settings });
            // Dynamically import SaveManager when modal opens
            import('../../systems/core/SaveManager.js').then(module => {
                setSaveManager(module.SaveManager);
            });
        }
    }, [isOpen]);

    const handleSettingChange = (path, value) => {
        SettingsManager.set(path, value);
        // Update local state to force re-render
        setSettings(SettingsManager.getAll());
    };

    const handleReset = () => {
        SettingsManager.resetOptions();
        setSettings({ ...SettingsManager.settings });
    };

    const handleManualSave = () => {
        if (SaveManager) {
            SaveManager.save(true);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
        { id: 'gameplay', label: 'Gameplay', icon: <MonitorPlay size={16} /> },
        { id: 'audio', label: 'Audio', icon: <Volume2 size={16} /> },
        { id: 'dev', label: 'Dev Tools', icon: <Wrench size={16} /> },
    ];

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
    };

    // Helper to render a toggle row
    const renderToggle = (label, settingKey, description) => {
        const value = getNestedValue(settings, settingKey);
        return (
            <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/5">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
                    {description && <span className="text-[10px] text-gray-500">{description}</span>}
                </div>
                <button
                    onClick={() => handleSettingChange(settingKey, !value)}
                    className={cn(
                        "w-12 h-6 rounded-full relative transition-colors duration-300 pointer-events-auto cursor-pointer",
                        value ? "bg-gi-success" : "bg-gray-700"
                    )}
                >
                    <div className={cn(
                        "w-5 h-5 bg-white rounded-full absolute top-[2px] transition-transform duration-300 drop-shadow-md",
                        value ? "translate-x-[26px]" : "translate-x-[2px]"
                    )} />
                </button>
            </div>
        );
    };

    // Helper to render a slider row
    const renderSlider = (label, settingKey, min, max, description) => {
        const value = getNestedValue(settings, settingKey) ?? 100;
        return (
            <div className="flex flex-col gap-2 p-3 bg-black/40 rounded border border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
                        {description && <span className="text-[10px] text-gray-500">{description}</span>}
                    </div>
                    <span className="text-gi-primary font-pixel text-sm">{value}%</span>
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => handleSettingChange(settingKey, parseInt(e.target.value))}
                    className="w-full accent-gi-primary cursor-pointer h-1.5 bg-gray-700 rounded-lg appearance-none"
                />
            </div>
        );
    };

    // Helper to render a generic select or input
    const renderSelect = (label, settingKey, options, description) => {
        const value = getNestedValue(settings, settingKey);
        return (
            <div className="flex items-center justify-between p-3 bg-black/40 rounded border border-white/5">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-white font-pixel tracking-wide">{label}</span>
                    {description && <span className="text-[10px] text-gray-500">{description}</span>}
                </div>
                <select
                    value={String(value)}
                    onChange={(e) => {
                        let val = e.target.value;
                        if (val === 'true') val = true;
                        if (val === 'false') val = false;
                        if (!isNaN(parseInt(val)) && val !== 'true' && val !== 'false') val = parseInt(val);
                        handleSettingChange(settingKey, val);
                    }}
                    className="bg-gray-900 border border-white/20 text-white rounded px-3 py-1.5 focus:border-gi-primary outline-none font-bold"
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <GIModal
            isOpen={isOpen}
            onClose={onClose}
            title="Protocol Settings"
            className="w-full max-w-3xl bg-gray-900 border-gi-primary/50 text-white"
        >
            <div className="flex flex-col md:flex-row gap-4 h-full min-h-[400px]">

                {/* Vertical Sidebar */}
                <div className="w-full md:w-48 flex flex-col gap-2 border-r border-white/10 pr-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 w-full px-4 py-3 rounded text-sm font-bold uppercase tracking-wider transition-all duration-300",
                                activeTab === tab.id
                                    ? "bg-gi-primary/20 text-white border-l-4 border-gi-primary"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border-l-4 border-transparent"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}

                    <div className="mt-auto pt-4 flex gap-2 w-full justify-between items-center text-xs text-gray-600">
                        v0.9.0
                    </div>
                </div>

                {/* Content Panel */}
                <div className="flex-1 flex flex-col pt-2 h-[450px] overflow-y-auto custom-scrollbar px-2 pb-2">

                    {/* TAB: NOTIFICATIONS */}
                    <div style={{ display: activeTab === 'notifications' ? 'flex' : 'none' }} className="flex-col gap-3 fade-in duration-300">
                        {renderToggle('System Messages', 'showSystemMessages', 'Show messages like game saved, errors, etc.')}
                        {renderToggle('Level Up Messages', 'showLevelUpMessages', 'Show notifications when a hero levels up')}
                        {renderToggle('Loot Messages', 'showLootMessages', 'Show notifications when items are acquired')}
                        {renderToggle('Worker Idle Alerts', 'showWorkerIdleAlerts', 'Show notifications when a task runs out of materials')}

                        {renderSelect('Toast Duration', 'toastDurationMs', [
                            { value: 2000, label: 'Fast (2s)' },
                            { value: 4000, label: 'Normal (4s)' },
                            { value: 8000, label: 'Slow (8s)' }
                        ], 'How long notification toasts stay on screen')}
                    </div>

                    {/* TAB: GAMEPLAY */}
                    <div style={{ display: activeTab === 'gameplay' ? 'flex' : 'none' }} className="flex-col gap-3 fade-in duration-300">
                        {renderSelect('Auto-Save Interval', 'gameplay.autoSaveIntervalMinutes', [
                            { value: 1, label: '1 Minute (Dev)' },
                            { value: 10, label: '10 Minutes' },
                            { value: 60, label: '1 Hour' },
                            { value: 480, label: '8 Hours' },
                            { value: 1440, label: '24 Hours' },
                            { value: 0, label: 'Off' }
                        ], 'How often the game automatically saves to LocalStorage')}

                        <div className="pt-4 border-t border-white/10">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                Manual Persistence
                            </label>
                            <button
                                onClick={handleManualSave}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-gi-primary text-black font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all font-pixel drop-shadow-[0_0_10px_rgba(46,204,113,0.4)]"
                            >
                                <Save className="w-4 h-4" />
                                Save Game Now
                            </button>
                        </div>

                        {renderSelect('Theme Mode', 'gameplay.themeMode', [
                            { value: 'dark', label: 'Dark Mode' },
                            { value: 'light', label: 'Light Mode' }
                        ], 'UI Color palette (Requires refresh)')}

                        {renderSelect('Font Preference', 'ui.fontFamily', [
                            { value: 'pixel', label: 'Pixelify Sans' },
                            { value: 'silkscreen', label: 'Silkscreen' },
                            { value: 'dotgothic', label: 'DotGothic 16 (SNES)' },
                            { value: 'micro5', label: 'Micro 5' },
                            { value: 'inter', label: 'Modern Sans' }
                        ], 'Affects body text style')}

                        {renderToggle('Animations', 'gameplay.enableAnimations', 'Enable fluid transitions and combat animations (Disable for performance)')}
                    </div>

                    {/* TAB: AUDIO */}
                    <div style={{ display: activeTab === 'audio' ? 'flex' : 'none' }} className="flex-col gap-4 fade-in duration-300">
                        {renderSlider('Master Volume', 'audio.masterVolume', 0, 100)}
                        {renderSlider('Music Volume', 'audio.musicVolume', 0, 100)}
                        {renderSlider('SFX Volume', 'audio.sfxVolume', 0, 100)}
                    </div>

                    {/* TAB: DEV TOOLS */}
                    <div style={{ display: activeTab === 'dev' ? 'flex' : 'none' }} className="flex-col gap-3 fade-in duration-300">
                        <p className="text-gray-500 text-sm mb-2">Development utilities and cheats.</p>

                        {renderToggle('Debug Mode', 'debugMode', 'Shows additional stats and logs raw errors to console')}

                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button
                                onClick={() => EventBus.publish('dev:give-all-resources')}
                                className="bg-purple-900/60 hover:bg-purple-800 border border-purple-500/50 text-white text-xs font-bold py-2 rounded transition-colors"
                            >
                                +1000 All Resources
                            </button>
                            <button
                                onClick={() => EventBus.publish('dev:spawn-hero')}
                                className="bg-purple-900/60 hover:bg-purple-800 border border-purple-500/50 text-white text-xs font-bold py-2 rounded transition-colors"
                            >
                                Spawn New Hero
                            </button>
                            <button
                                onClick={() => EventBus.publish('dev:open-spawn-item')}
                                className="bg-blue-900/60 hover:bg-blue-800 border border-blue-500/50 text-white text-xs font-bold py-2 rounded transition-colors col-span-2"
                            >
                                Spawn Item...
                            </button>
                            <button
                                onClick={() => EventBus.publish('dev:open-spawn-card')}
                                className="bg-blue-900/60 hover:bg-blue-800 border border-blue-500/50 text-white text-xs font-bold py-2 rounded transition-colors col-span-2"
                            >
                                Open Spawning Modal...
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom Global Actions */}
            <div className="flex justify-between w-full border-t border-white/10 pt-4 mt-2">
                <button
                    onClick={handleReset}
                    className="text-gray-500 hover:text-red-400 font-bold transition-colors text-sm px-4"
                >
                    Reset Defaults
                </button>
                <button
                    onClick={onClose}
                    className="bg-gi-primary text-black font-bold uppercase tracking-widest px-8 py-2 rounded hover:brightness-110 transition-all font-pixel drop-shadow-[0_0_10px_rgba(46,204,113,0.4)]"
                >
                    Done
                </button>
            </div>
        </GIModal>
    );
};

export default SettingsModal;
