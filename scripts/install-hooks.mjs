#!/usr/bin/env node
/**
 * Install the repo's git hooks.
 *
 * `.git/hooks` is not tracked by git, so a fresh clone starts with none. The
 * hook bodies live in `scripts/` where they can be reviewed and versioned;
 * this writes the thin wrappers that call them.
 *
 * Idempotent — run it whenever a hook goes missing, or after a fresh clone.
 */
import fs from 'fs';
import path from 'path';

const HOOKS = {
    'pre-commit': [
        '#!/bin/sh',
        '# Keep authored content and code in separate commits.',
        '#',
        '# The real check lives in scripts/check-content-code-split.mjs so it is',
        '# versioned and reviewable; this wrapper only exists because .git/hooks is',
        '# not itself tracked by git. Reinstall with: npm run hooks:install',
        'exec node scripts/check-content-code-split.mjs',
        ''
    ].join('\n')
};

const dir = path.resolve('.git', 'hooks');
if (!fs.existsSync(dir)) {
    console.error('No .git/hooks directory — is this a git repository?');
    process.exit(1);
}

for (const [name, body] of Object.entries(HOOKS)) {
    const target = path.join(dir, name);
    fs.writeFileSync(target, body, 'utf8');
    try {
        fs.chmodSync(target, 0o755);
    } catch {
        // Windows filesystems may refuse the mode bit; git still runs the hook.
    }
    console.log(`Installed ${name}`);
}
