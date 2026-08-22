import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSystem, BGM_PLAYLIST } from '../systems/core/AudioSystem.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EventBus } from '../systems/core/EventBus.js';

describe('AudioSystem Soundtrack & Playlist Engine', () => {
    beforeEach(() => {
        SettingsManager.init();
    });

    it('contains all 8 soundtrack BGM tracks in playlist', () => {
        expect(BGM_PLAYLIST.length).toBe(8);
        const ids = BGM_PLAYLIST.map(t => t.id);
        expect(ids).toContain('gentle_pause');
        expect(ids).toContain('guitar_hearth');
        expect(ids).toContain('hearthside');
        expect(ids).toContain('piano_hearth');
        expect(ids).toContain('quiet_trail');
        expect(ids).toContain('tide_and_timber');
        expect(ids).toContain('warm_cedar');
        expect(ids).toContain('woolen_keys');
    });

    it('shuffles and advances playlist without immediate repeat', () => {
        AudioSystem.playlistQueue = [];
        AudioSystem._replenishQueue();

        expect(AudioSystem.playlistQueue.length).toBe(8);

        const first = AudioSystem.playlistQueue.shift();
        AudioSystem.currentTrack = first;

        // Force queue empty to trigger replenishment
        AudioSystem.playlistQueue = [];
        AudioSystem._replenishQueue();

        expect(AudioSystem.playlistQueue.length).toBe(8);
        expect(AudioSystem.playlistQueue[0].id).not.toBe(first.id);
    });

    it('publishes bgm:track_changed event when track advances', () => {
        const events = [];
        EventBus.subscribe('bgm:track_changed', (e) => events.push(e));

        AudioSystem.playlistQueue = [{ id: 'test_track', title: 'Test Track', file: 'Gentle Pause.m4a' }];
        AudioSystem.playNextTrack();

        expect(AudioSystem.getCurrentTrack()?.id).toBe('test_track');
        expect(events.length).toBeGreaterThan(0);
        expect(events[events.length - 1].track.id).toBe('test_track');
    });

    it('resolves button_click to a calculator button audio file', () => {
        const path = AudioSystem._getSfxPath('button_click');
        expect(path).toContain('zapsplat_office_calculator_button_single_press_');
        expect(path.endsWith('.mp3')).toBe(true);
    });

    it('resolves quest_claim to a handling coins loose change audio file', () => {
        const path = AudioSystem._getSfxPath('quest_claim');
        expect(path).toContain('zapsplat_foley_money_several_coins_loose_change_place_into_another_persons_hand_');
        expect(path.endsWith('.mp3')).toBe(true);
    });

    it('resolves hero_assign to sibling book/leather drop audio variations', () => {
        const path = AudioSystem._getSfxPath('hero_assign');
        expect(path).toMatch(/(bookPlace[1-3]|dropLeather)\.ogg$/);
    });

    it('resolves token drag to sibling cloth audio variations', () => {
        const path = AudioSystem._getSfxPath('drag');
        expect(path).toMatch(/cloth[1-4]\.ogg$/);
    });

    it('resolves token drop/card_place to sibling book/leather drop audio variations', () => {
        const dropPath = AudioSystem._getSfxPath('drop');
        expect(dropPath).toMatch(/(bookPlace[1-3]|dropLeather)\.ogg$/);

        const cardPlacePath = AudioSystem._getSfxPath('card_place');
        expect(cardPlacePath).toMatch(/(bookPlace[1-3]|dropLeather)\.ogg$/);
    });
});
