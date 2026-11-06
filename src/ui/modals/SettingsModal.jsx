import { useState, useEffect } from 'react';
import GIModal from '../components/base/GIModal.jsx';
import { SettingsManager, IS_DEV_BUILD, autoSaveChoices } from '../../systems/core/SettingsManager.js';
// Static: SaveManager is already in the main chunk (main.jsx and the slot screen import it),
// so a dynamic import here would split nothing.
import { SaveManager } from '../../systems/core/SaveManager.js';
import { cn } from '../utils/cn.js';
import { Monitor, Volume2, Wrench, Save, Type, Sliders } from 'lucide-react';
import { TypographyScaleModal } from './TypographyScaleModal.jsx';
import { KitButton, KIT_BUTTON_TONE, PixelToggle } from '../components/base/KitButton.jsx';
import { t } from '../../i18n/index.js';

const AUTO_SAVE_LABEL = { 1: 'settings.autoSave1', 10: 'settings.autoSave10', 60: 'settings.autoSave60', 0: 'settings.autoSaveOff' };

const FONT_OPTIONS = [
    { value: 'silkpixel', label: 'SilkPixel (Default)' },
    { value: 'pixel', label: 'Pixelify Sans' },
    { value: 'silkscreen', label: 'Silkscreen' },
    { value: 'dotgothic', label: 'DotGothic 16' },
    { value: 'inter', label: 'Modern Sans' }
];

const BACKGROUND_OPTIONS = [
    { value: 'u_table_wood_spruce', label: 'Spruce Planks (Default)' },
    { value: 'u_table_wood_planks_oak', label: 'Oak Planks' },
    { value: 'u_table_mountain', label: 'Mountain' },
    { value: 'u_table_forest', label: 'Forest' }
];

/** The settings window: three tabs, Display, Game and Audio, and Dev Tools in dev builds only. */
export const SettingsModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('display');
    const [settings, setSettings] = useState({});
    const [isTypographyOpen, setIsTypographyOpen] = useState(false);

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
        { id: 'display', label: t('settings.tabDisplay'), icon: <Monitor size={16} /> },
        { id: 'game', label: t('settings.tabGame'), icon: <Save size={16} /> },
        { id: 'audio', label: t('settings.tabAudio'), icon: <Volume2 size={16} /> },
        { id: 'dev', label: t('settings.tabDev'), icon: <Wrench size={16} /> }
    ].filter(tab => tab.id !== 'dev' || IS_DEV_BUILD);

    const getVal = (path) => path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, settings);
    const bind = (path) => ({ settingKey: path, value: getVal(path), onChange: (v) => handleSettingChange(path, v) });

    return (
        <GIModal isOpen={isOpen} onClose={onClose} title={t('settings.title')} backdrop="settings" className="w-full max-w-3xl text-white">
            <div className="flex flex-col md:flex-row gap-4 h-full min-h-[400px]">
                <div className="w-full md:w-48 flex flex-col gap-2 border-r border-white/10 pr-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            data-settings-tab={tab.id}
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
                    {activeTab === 'display' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <div className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                                        <Type className="w-4 h-4 text-gi-primary" /> {t('settings.textSize')}
                                    </span>
                                    <span className="ui-text-body text-gray-400 mt-0.5">{t('settings.textSizeHint')}</span>
                                </div>
                                <KitButton
                                    tone={KIT_BUTTON_TONE.PLAIN}
                                    onClick={() => setIsTypographyOpen(true)}
                                    className="shrink-0"
                                    buttonClassName="gap-2 px-3 py-1 text-xs uppercase tracking-wider"
                                >
                                    <Sliders className="w-3.5 h-3.5" /> {t('settings.textSizeAdjust')}
                                </KitButton>
                            </div>
                            <SettingSelect label={t('settings.font')} options={FONT_OPTIONS} {...bind('ui.fontFamily')} />
                            <SettingToggle label={t('settings.allCaps')} description={t('settings.allCapsHint')} {...bind('ui.allCaps')} />
                            <SettingToggle label={t('settings.menuRight')} description={t('settings.menuRightHint')} {...bind('ui.bubbleMenuRight')} />
                            <SettingSelect label={t('settings.background')} options={BACKGROUND_OPTIONS} {...bind('ui.backgroundTile')} />
                            <SettingToggle label={t('settings.flyingItems')} description={t('settings.flyingItemsHint')} {...bind('ui.itemParticles')} />
                            <SettingToggle
                                label={t('settings.itemStubs')}
                                description={t('settings.itemStubsHint')}
                                {...bind('notifications.itemStubs')}
                                value={getVal('notifications.itemStubs') !== false}
                            />
                        </div>
                    )}

                    {activeTab === 'game' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingSelect
                                label={t('settings.autoSave')}
                                options={autoSaveChoices().map(min => ({ value: min, label: t(AUTO_SAVE_LABEL[min]) }))}
                                {...bind('gameplay.autoSaveIntervalMinutes')}
                            />
                            <div className="pt-4 border-t border-white/10">
                                <KitButton
                                    onClick={() => SaveManager.save(true)}
                                    className="w-full"
                                    buttonClassName="gap-2 py-2 uppercase tracking-widest"
                                >
                                    <Save className="w-4 h-4" /> {t('settings.saveNow')}
                                </KitButton>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                            <SettingSlider label={t('settings.masterVolume')} {...bind('audio.masterVolume')} />
                            <SettingSlider label={t('settings.musicVolume')} {...bind('audio.musicVolume')} />
                            <SettingSlider label={t('settings.sfxVolume')} {...bind('audio.sfxVolume')} />
                        </div>
                    )}

                    {activeTab === 'dev' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                            <SettingToggle label={t('settings.debugMode')} {...bind('debugMode')} />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between w-full border-t border-white/10 pt-4 mt-2">
                <button onClick={() => { SettingsManager.resetOptions(); setSettings(SettingsManager.getAll()); }} className="text-gray-500 hover:text-red-400 font-bold transition-colors text-sm px-4 cursor-pointer">
                    {t('settings.resetDefaults')}
                </button>
                <KitButton onClick={onClose} className="mr-1 mb-1" buttonClassName="uppercase tracking-widest px-8 py-1.5">
                    {t('settings.done')}
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

const SettingToggle = ({ label, value, onChange, description, settingKey }) => (
    <div data-setting={settingKey} className="flex items-center justify-between gap-3 py-1.5">
        <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wide">{label}</span>
            {description && <span className="ui-text-body text-gray-500">{description}</span>}
        </div>
        <PixelToggle on={!!value} onClick={() => onChange(!value)} />
    </div>
);

const SettingSlider = ({ label, value = 100, onChange, settingKey }) => (
    <div data-setting={settingKey} className="flex flex-col gap-2 py-1.5">
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white tracking-wide">{label}</span>
            <span className="text-gi-primary text-sm">{value}%</span>
        </div>
        <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="ui-range w-full" />
    </div>
);

const SettingSelect = ({ label, value, options, onChange, settingKey }) => (
    <div data-setting={settingKey} className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm font-bold text-white tracking-wide">{label}</span>
        <select
            value={String(value)}
            onChange={(e) => {
                let val = e.target.value;
                if (val === 'true') val = true; else if (val === 'false') val = false;
                else if (!isNaN(parseInt(val))) val = parseInt(val);
                onChange(val);
            }}
            className="ui-pixel-edge bg-black/60 text-white px-3 py-1 outline-none font-bold cursor-pointer"
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

export default SettingsModal;
