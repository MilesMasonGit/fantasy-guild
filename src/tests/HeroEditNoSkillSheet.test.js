import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

// The hero panel is the one place a hero's skills are listed; the Edit modal only edits.
describe('one skill list per hero', () => {
    it('the Edit Hero modal embeds no skill sheet of its own', () => {
        expect(read('ui/modals/HeroEditModal.jsx')).not.toMatch(/SkillSheet|SkillRow|heroSkillList/);
        expect(existsSync(join(process.cwd(), 'src/ui/components/hero/HeroSkillSheet.jsx'))).toBe(false);
    });

    it('the hero panel draws its HP with the shared VitalBar, the one the style sheet shows', () => {
        expect(read('ui/components/drawer/HeroInspectionSheet.jsx')).toMatch(/<VitalBar /);
        expect(read('ui/dev/StyleSheetPage.jsx')).toMatch(/<VitalBar /);
    });
});
