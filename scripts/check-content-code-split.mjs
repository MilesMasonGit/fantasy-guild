#!/usr/bin/env node
/**
 * Keep authored content and code in separate commits.
 *
 * ## What this is guarding
 * `CMS-53` makes "Sync to Game" a one-way, full-file overwrite of `data/` from
 * the CMS's own workspace, and the decision's safety condition is explicit:
 * *"`data/` is never hand-edited again once the CMS is live"*. A full overwrite
 * cannot destroy anything the CMS has no model for, **provided nothing is ever
 * authored outside the CMS**.
 *
 * That condition was violated on 2026-09-06: a Token and a Map pool entry were
 * hand-written into `data/tokens.json` and `data/maps.json` during a code
 * slice, and the owner's next sync silently wiped them. Nothing malfunctioned —
 * the CMS did exactly what it is specified to do. The mistake was upstream.
 *
 * ## Why it checks the *mix* rather than banning data/ edits outright
 * Content commits are normal and good: the CMS now makes one itself after every
 * sync (see `commitSync` in `cms/vite-plugin-cms-api.js`). What is not normal is
 * a single commit carrying both — that is the signature of code work reaching
 * into `data/`, and it also makes the two impossible to roll back separately.
 *
 * So: `data/` alone is fine. Code alone is fine. Both together is the smell.
 *
 * ## Overriding
 * There are legitimate exceptions — a migration that must change a schema and
 * its content atomically, for instance. Set `ALLOW_CONTENT_CODE_MIX=1` for one
 * commit. Do that deliberately, not to make a red hook go away.
 */

import { execFileSync } from 'child_process';

const CONTENT = /^data\/.*\.json$/;
const CODE = /^(src|cms\/src)\//;

if (process.env.ALLOW_CONTENT_CODE_MIX === '1') {
    console.log('[content-split] Override set — skipping the check.');
    process.exit(0);
}

let staged = [];
try {
    staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        encoding: 'utf8'
    })
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
} catch {
    // No index, no repo, nothing to compare against — never block a commit
    // because the check itself could not run.
    process.exit(0);
}

const content = staged.filter(f => CONTENT.test(f));
const code = staged.filter(f => CODE.test(f));

if (!content.length || !code.length) process.exit(0);

const list = (files) => files.slice(0, 8).map(f => '    ' + f).join('\n')
    + (files.length > 8 ? `\n    …and ${files.length - 8} more` : '');

console.error(`
✖ This commit mixes authored content with code.

  Content (data/):
${list(content)}

  Code:
${list(code)}

Why this is blocked:

  The CMS is the exclusive authoring surface for Tokens, Items and Maps
  (CMS-1). "Sync to Game" overwrites data/ wholesale from the CMS's own
  workspace (CMS-53), so anything authored outside the CMS is destroyed by
  the next sync — silently, and by design.

  A commit touching both usually means code work has reached into data/.

What to do instead:

  • Content the game ships   → author it in the CMS, which commits its own
                               sync automatically.
  • Content a test needs     → a fixture in src/tests/fixtures/, which is
                               code and survives every sync.
  • Genuinely need both      → ALLOW_CONTENT_CODE_MIX=1 git commit ...
                               (deliberately, e.g. a schema migration)

  To split what you have now:  git restore --staged data/
`);

process.exit(1);
