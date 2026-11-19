#!/usr/bin/env python3
"""Reads the content catalogue and reports questions, not errors.

Run from the worktree root: python .claude/skills/content/check_content.py [marks.json]
- ids used twice, and ingredients or outputs that point at no entry
- levels used twice in one skill's recipes
- ingredients with no source (not made, not given, no 'from')
- materials no recipe uses
- entries with no art code
With a marks file (an ArtifactData list of the board's 'marks' saved as JSON), it also
lists locked entries, and marks whose entry no longer exists.
Open levels and unfinished chains are expected.
"""
import collections, json, os, sys

sys.path.insert(0, os.path.dirname(__file__))
import catalogue as cat

RECIPE_SKIP_TYPES = {'Material', 'Ingredient', 'Catch', 'Mote', 'Herb'}
# Materials that are made for later skills or a mechanism still to come.
MATERIAL_WAITS = ('Arrowheads', 'Wire', 'Chain', 'Gears', 'Nails', 'Plank', 'Band', 'Seedling')


def main():
    entries = cat.load()
    by_id = {}
    twice = []
    for e in entries:
        if e['id'] in by_id:
            twice.append(e['id'])
        by_id[e['id']] = e
    uses, gives = cat.users(entries), cat.givers(entries)

    dangling = collections.defaultdict(list)
    for e in entries:
        for i in e.get('madeWith', []) + e.get('gives', []):
            if i not in by_id:
                dangling[i].append(e['name'])

    levels = collections.defaultdict(list)
    for e in entries:
        if e.get('level') is not None and e.get('madeWith') and e.get('type') not in RECIPE_SKIP_TYPES:
            levels[(e['skill'], e['level'])].append(e['name'])
    dupes = [f"{s} {l}: {', '.join(n)}" for (s, l), n in sorted(levels.items(), key=lambda x: (x[0][0], x[0][1])) if len(n) > 1]

    no_source = sorted(f"{by_id[i]['name']} (used by {', '.join(by_id[u]['name'] for u in uses[i][:3])})"
                       for i in uses if i in by_id and not by_id[i].get('madeWith')
                       and i not in gives and not by_id[i].get('from'))
    # Construction's costs are a rule by tier on its page, not per building.
    page = open(os.path.join('docs', 'active', 'content_construction.md'), encoding='utf-8').read()
    costs = page.split('## Costs by tier', 1)[-1].split('\n## ', 1)[0]
    unused = sorted(f"{e['name']} ({e['skill']} {e.get('level')})" for e in entries
                    if e.get('type', '').lower() == 'material' and e['id'] not in uses and e['name'] not in costs
                    and not e['name'].endswith(MATERIAL_WAITS))
    no_art = sorted(f"{e['name']} ({e['skill']})" for e in entries if not e.get('art') and e.get('section', '').find('conversion') < 0)

    print(f'{len(entries)} entries in {cat.PATH}.\n')
    for title, rows in (('Ids used twice', twice),
                        ('Links to no entry', [f"{k}: from {', '.join(v[:3])}" for k, v in sorted(dangling.items())]),
                        ('Levels used twice in one skill', dupes),
                        ('Ingredients with no source', no_source),
                        ('Materials no recipe uses (they may wait on a later skill)', unused),
                        ('Entries with no art code', no_art)):
        print(title + ':')
        print('\n'.join('  ' + r for r in rows) or '  none')
        print()

    if len(sys.argv) > 1:
        marks = json.load(open(sys.argv[1], encoding='utf-8'))
        docs = marks.get('documents', marks) if isinstance(marks, dict) else marks
        rows = {d.get('id') or d.get('doc_id'): d.get('data', d) for d in docs}
        locked = sorted(by_id[i]['name'] for i, m in rows.items() if m.get('locked') and i in by_id)
        lost = sorted(i for i in rows if i not in by_id)
        print('Locked entries (ask the owner before changing these):')
        print('\n'.join('  ' + n for n in locked) or '  none')
        print('\nMarks whose entry is gone (renamed id?):')
        print('\n'.join('  ' + n for n in lost) or '  none')
    return 0


if __name__ == '__main__':
    sys.exit(main())
