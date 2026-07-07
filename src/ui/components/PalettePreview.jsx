import React, { useState } from 'react';
import { useGameEvent } from '../hooks/useGameEvent';
import Button from './base/Button.jsx';
import GISurface from './base/GISurface.jsx';
import GICard from './base/GICard.jsx';
import CardSlot from './base/CardSlot.jsx';
import GIDraggable from './base/GIDraggable.jsx';
import GITitleModule from './base/GITitleModule.jsx';
import Badge from './base/Badge.jsx';
import GIModal from './base/GIModal.jsx';
import ContextMenu from './base/ContextMenu.jsx';
import Tabs from './base/Tabs.jsx';
import { Settings, Shield, Sword, FlaskConical } from 'lucide-react';

const Swatch = ({ name, colorClass, purpose }) => (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-gi-surface border border-gi-border">
        <div className={`h-20 w-full rounded-lg ${colorClass} shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-gi-border`}></div>
        <div className="font-sans mt-2">
            <h3 className="text-gi-text font-bold text-lg">{name}</h3>
            <code className="text-gi-primary text-xs bg-gi-base px-2 py-1 rounded-md">{colorClass}</code>
            <p className="text-gi-muted text-sm mt-3 leading-relaxed">{purpose}</p>
        </div>
    </div>
);

export const PalettePreview = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

    useGameEvent('toggle-palette-preview', () => {
        setIsVisible(prev => !prev);
    });

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black pointer-events-auto">
            <div className="bg-gi-base border border-gi-border shadow-2xl rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-8 relative font-sans">
                <header className="mb-10 text-center relative border-b border-gi-border pb-6">
                    <button
                        onClick={() => setIsVisible(false)}
                        className="absolute right-0 top-0 w-10 h-10 flex flex-col items-center justify-center bg-gi-surface-hover text-gi-text rounded hover:bg-gi-danger hover:text-white transition-colors border border-gi-border"
                        title="Close Preview"
                    >
                        <span className="block w-4 h-0.5 bg-current rotate-45 translate-y-0.5"></span>
                        <span className="block w-4 h-0.5 bg-current -rotate-45 -translate-y-0.5"></span>
                    </button>
                    <h1 className="text-4xl font-display text-gi-primary tracking-wider drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">Retro-Modern Cyber-Guild</h1>
                    <p className="text-gi-muted uppercase tracking-widest mt-2 text-sm">Phase 4: Design Tokens & Palette Proposal</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <div className="col-span-full">
                        <h2 className="text-2xl text-gi-text border-b border-gi-border pb-2 mb-4 font-bold tracking-wide">1. Core Backgrounds (The Void)</h2>
                    </div>
                    <Swatch name="Base Background" colorClass="bg-gi-base" purpose="The deepest layer. Used for the HTML body and root application background to create immense depth." />
                    <Swatch name="Surface Panel" colorClass="bg-gi-surface" purpose="The main container color for Cards, Side Panels, and Modals. Will be combined with backdrop-blur." />
                    <Swatch name="Surface Hover" colorClass="bg-gi-surface-hover" purpose="Used to rapidly indicate interactivity when the mouse touches a card or panel element." />

                    <div className="col-span-full mt-4">
                        <h2 className="text-2xl text-gi-text border-b border-gi-border pb-2 mb-4 font-bold tracking-wide">2. Brand & Action (The Neon)</h2>
                    </div>
                    <Swatch name="Primary Cyan" colorClass="bg-gi-primary" purpose="The dominant action color. Used for progress bars, primary buttons, and active tabs." />
                    <Swatch name="Accent Purple" colorClass="bg-gi-accent" purpose="Secondary highlights. Used for magical elements, epic tier borders, and premium interactions." />

                    <div className="col-span-full mt-4">
                        <h2 className="text-2xl text-gi-text border-b border-gi-border pb-2 mb-4 font-bold tracking-wide">3. Semantic Status (The Indicators)</h2>
                    </div>
                    <Swatch name="Success Emerald" colorClass="bg-gi-success" purpose="Indicates task completion, health regeneration, or successful crafting." />
                    <Swatch name="Warning Amber" colorClass="bg-gi-warning" purpose="Indicates pending actions, required resources, or mid-tier rarity." />
                    <Swatch name="Danger Red" colorClass="bg-gi-danger" purpose="Indicates wounded heroes, active combat/invasions, or destructive actions (sell/retire)." />

                    <div className="col-span-full mt-4">
                        <h2 className="text-2xl text-gi-text border-b border-gi-border pb-2 mb-4 font-bold tracking-wide">4. Typography & Layout</h2>
                    </div>
                    <Swatch name="Main Text" colorClass="bg-gi-text" purpose="High contrast text for premium readability on dark surfaces (Stats, descriptions)." />
                    <Swatch name="Muted Text" colorClass="bg-gi-muted" purpose="Secondary text for lore, sub-labels, and disabled states." />
                    <Swatch name="Glass Border" colorClass="bg-gi-border" purpose="Subtle 15% white borders used to define the edges of glassmorphic panels and UI cards." />
                </div>

                <GISurface className="mt-12 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gi-primary"></div>
                    <h3 className="text-xl font-bold text-gi-text mb-6 font-display tracking-widest pl-4">Component Demonstration Area</h3>

                    <div className="flex flex-col gap-10 pl-4">
                        <div>
                            <h4 className="text-gi-muted uppercase tracking-wider text-sm mb-4">GI-Button Variants</h4>
                            <div className="flex gap-4 items-center">
                                <Button variant="primary">Primary Action</Button>
                                <Button variant="secondary">Secondary Action</Button>
                                <Button variant="danger">Danger</Button>
                                <Button variant="ghost">Ghost</Button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-gi-muted uppercase tracking-wider text-sm mb-4">GI-Card & GI-CardSlot</h4>
                            <div className="flex gap-6 items-start flex-wrap">
                                <div className="flex flex-col gap-2 w-64">
                                    <CardSlot id="preview-slot-1" />
                                    <GIDraggable id="preview-card-1" data={{ id: "preview-card-1", type: "card", rarity: "common", title: "Standard Card", subtitle: "Common (Test Drag Me!)" }}>
                                        <GICard rarity="common">
                                            <div className="flex-1 bg-gi-surface-hover/50 rounded border border-dashed border-gi-border/30 flex items-center justify-center text-gi-muted/50 mb-2">Image Area</div>
                                            <div className="p-2">
                                                <div className="text-gi-text font-bold text-lg drop-shadow-md">Standard Card</div>
                                                <div className="text-gi-muted text-xs mt-1 drop-shadow-md">Common (Test Drag Me!)</div>
                                            </div>
                                        </GICard>
                                    </GIDraggable>
                                </div>

                                <GICard rarity="epic">
                                    <div className="flex-1 bg-gi-accent/10 rounded border border-dashed border-gi-accent/30 flex items-center justify-center text-gi-accent/50 mb-2">Epic Artifact</div>
                                    <div className="p-2">
                                        <div className="text-gi-accent font-bold text-lg drop-shadow-md">Premium Card</div>
                                        <div className="text-gi-text text-xs mt-1 drop-shadow-md">Epic Rarity Glow</div>
                                    </div>
                                </GICard>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-gi-muted uppercase tracking-wider text-sm mb-4">Typography & Badges</h4>
                            <div className="flex flex-col gap-6 max-w-lg">
                                <GITitleModule
                                    title="Eldric the Bold"
                                    subtitle="Warrior · Level 5"
                                    variant="hero"
                                    icon={<span className="text-xl">⚔️</span>}
                                />
                                <GITitleModule
                                    title="Ancient Tome"
                                    subtitle="Relic · +50 Knowledge"
                                    variant="item"
                                    icon={<span className="text-xl">📖</span>}
                                />
                                <div className="flex gap-4 p-4 rounded bg-gi-base border border-gi-border">
                                    <Badge value="Ready" variant="success" icon="✓" />
                                    <Badge value="Low Health" variant="danger" icon="!" />
                                    <Badge value="500 Gold" variant="warning" icon="💰" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-gi-muted uppercase tracking-wider text-sm mb-4">Headless UI Demonstrations (Phase 6)</h4>
                            <div className="flex flex-col xl:flex-row gap-8 items-start">
                                {/* Demo Modal Trigger */}
                                <div className="flex-1 min-w-[300px] border border-gi-border border-dashed p-6 rounded text-center">
                                    <h5 className="text-gi-text font-bold mb-4 font-display">GI-Modal</h5>
                                    <p className="text-gi-muted text-sm mb-6 max-w-sm mx-auto">Click below to open a modal. Notice the blur backdrop, focus trapping, and 'Escape' key support.</p>
                                    <Button variant="primary" onClick={() => setIsDemoModalOpen(true)}>Open Demo Modal</Button>
                                </div>

                                {/* Demo Menu */}
                                <div className="flex-1 min-w-[300px] border border-gi-border border-dashed p-6 rounded text-center h-48 flex flex-col justify-center">
                                    <h5 className="text-gi-text font-bold mb-4 font-display">GI-Menu (Dropdown)</h5>
                                    <div className="w-48 mx-auto">
                                        <ContextMenu
                                            items={[
                                                { label: "View Identity", icon: <Shield /> },
                                                { label: "Assign to Area", icon: <Sword /> },
                                                { label: "Revoke Access", danger: true }
                                            ]}
                                        />
                                    </div>
                                    <p className="text-gi-muted text-xs mt-4">Escapes overflow-hidden contexts.</p>
                                </div>

                                {/* Demo Tabs */}
                                <div className="flex-1 min-w-[300px] border border-gi-border border-dashed p-6 rounded">
                                    <h5 className="text-gi-text font-bold mb-4 font-display text-center">GI-Tabs</h5>
                                    <Tabs
                                        orientation="horizontal"
                                        tabs={[
                                            {
                                                label: "Weapons",
                                                content: <div className="text-gi-muted p-4 border border-gi-border rounded bg-gi-surface/50 text-sm text-center"><Sword className="w-8 h-8 text-gi-primary mx-auto mb-2 opacity-50" /> Weapon Inventory</div>
                                            },
                                            {
                                                label: "Armor",
                                                content: <div className="text-gi-muted p-4 border border-gi-border rounded bg-gi-surface/50 text-sm text-center"><Shield className="w-8 h-8 text-gi-primary mx-auto mb-2 opacity-50" /> Armor Inventory</div>
                                            },
                                            {
                                                label: "Consumables",
                                                content: <div className="text-gi-muted p-4 border border-gi-border rounded bg-gi-surface/50 text-sm text-center"><FlaskConical className="w-8 h-8 text-gi-primary mx-auto mb-2 opacity-50" /> Consumable Inventory</div>
                                            }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </GISurface>
            </div>

            {/* The Demo Modal */}
            <GIModal
                isOpen={isDemoModalOpen}
                onClose={() => setIsDemoModalOpen(false)}
                title="System Assessment Complete"
                maxWidth="max-w-md"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-gi-success/10 rounded-full text-gi-success border border-gi-success/30">
                        <Settings className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-gi-text font-bold text-lg">Headless Framework Active</h4>
                        <p className="text-gi-muted text-sm">ARIA attributes functioning nominally.</p>
                    </div>
                </div>
                <div className="border-t border-gi-border/50 pt-4 flex gap-3 justify-end">
                    <Button variant="ghost" onClick={() => setIsDemoModalOpen(false)}>Dismiss</Button>
                    <Button variant="primary" onClick={() => setIsDemoModalOpen(false)}>Acknowledge</Button>
                </div>
            </GIModal>
        </div>
    );
};

export default PalettePreview;
