import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUILD_UPGRADES, UPGRADE_SPRITES } from '../config/guildUpgrades.js';

const PUBLIC = resolve(__dirname, '../../public');
const onDisk = (webPath) => existsSync(`${PUBLIC}${webPath}`);

/**
 * ⭐ **Every Guild Hall upgrade draws real art** (Token Lifecycle feedback
 * Q7). The Token art moved into per-family folders and these paths were left
 * pointing at the old flat folder, so the screen drew broken images.
 *
 * `public/assets` is untracked, so a checkout without the art (a fresh
 * worktree) skips the file check rather than failing it.
 */
describe('Guild Hall upgrade sprites', () => {
    it('gives every upgrade track a sprite from UPGRADE_SPRITES', () => {
        const known = new Set(Object.values(UPGRADE_SPRITES));
        for (const def of GUILD_UPGRADES) {
            expect(def.sprite, def.id).toBeTruthy();
            expect(known.has(def.sprite), def.id).toBe(true);
        }
    });

    it.skipIf(!existsSync(`${PUBLIC}/assets`))('points every sprite at a file that exists', () => {
        const missing = Object.entries(UPGRADE_SPRITES).filter(([, path]) => !onDisk(path));
        expect(missing).toEqual([]);
    });
});
