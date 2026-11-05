#!/usr/bin/env python3
"""Reads the content pages and reports questions, not errors.

Run from the repository root: python .claude/skills/content/check_content.py
- levels used twice in one page's recipe table
- ingredients nothing on any page makes or gives
- materials on a recipe list that no recipe uses
Open links and unfinished chains are expected. Names must match to be found.
"""
import glob, io, re, sys, collections

PAGES = sorted(glob.glob('docs/active/content_*.md'))
SOURCE_COLS = ('name', 'gives', 'catch', 'mote', 'herb', 'tool', 'ingredient', 'unlock', 'potion', 'fruit', 'crop')
# Raw things gathered or dropped that the pages name but don't list as their own row.
KNOWN_RAW = {'Water', 'Coal', 'Worm', 'Hide', 'Blue Scale', 'Red Scale', 'Silk', 'Wool', 'Stone', 'Bones', 'Feather'}


def tables(text):
    """Yields (header, rows) for each markdown table."""
    lines = text.splitlines()
    i = 0
    while i < len(lines) - 1:
        if lines[i].startswith('|') and re.match(r'^\|[-| ]+\|$', lines[i + 1].strip()):
            head = [c.strip().lower() for c in lines[i].strip().strip('|').split('|')]
            rows = []
            i += 2
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            yield head, rows
        else:
            i += 1


def clean(name):
    name = re.sub(r'\*\*|\*|`', '', name)
    name = re.sub(r'\(.*?\)', '', name)
    return name.strip()


def split_items(cell):
    out = []
    for part in re.split(r',| and |\bwith\b', clean(cell)):
        part = part.strip()
        if part:
            out.append(part)
    return out


def norm(item):
    """Plural and Motes forms, so 'Fire Motes' and 'Feathers' match."""
    return re.sub(r'(?<=[a-z])s$', '', item)


def main():
    sources = set(norm(x) for x in KNOWN_RAW)
    uses = collections.defaultdict(set)
    recipes = []
    dupes = []
    for page in PAGES:
        text = io.open(page, encoding='utf-8').read()
        short = page.split('content_')[-1][:-3]
        for head, rows in tables(text):
            for col in SOURCE_COLS:
                for k, h in enumerate(head):
                    if h == col or h.startswith(col):
                        for r in rows:
                            if k < len(r):
                                for x in split_items(r[k]):
                                    sources.add(norm(x))
                                    if col == 'mote':
                                        sources.add(norm(x + ' Motes'))
                                    if col == 'unlock':
                                        sources.add(norm(x.replace(' Field', '').replace(' Herb', '').replace(' Tree', '').replace(' Bush', '')))
            made = next((k for k, h in enumerate(head) if h.startswith('made with') or h == 'herbs'), None)
            lvl = next((k for k, h in enumerate(head) if 'level' in h), None)
            nm = next((k for k, h in enumerate(head) if h in ('name', 'potion', 'tool')), None)
            if made is None or nm is None:
                continue
            seen = collections.Counter()
            for r in rows:
                if len(r) <= max(made, nm) or '*open*' in r[nm]:
                    continue
                item = clean(r[nm])
                if lvl is not None and r[lvl].isdigit() and head[lvl] == 'level' and 'level there' not in head:
                    seen[r[lvl]] += 1
                kind = r[head.index('kind')] if 'kind' in head else ''
                inputs = split_items(r[made])
                weird = next((k for k, h in enumerate(head) if h == 'weird item'), None)
                base = next((k for k, h in enumerate(head) if h == 'base'), None)
                for k in (weird, base):
                    if k is not None and k < len(r):
                        inputs += split_items(r[k])
                recipes.append((short, r[lvl] if lvl is not None else '', item, kind, inputs))
                for x in inputs:
                    uses[norm(x)].add(item)
            for l, c in seen.items():
                if c > 1:
                    dupes.append(f'{short}: level {l} is used {c} times')
    made_names = set(norm(r[2]) for r in recipes)
    known = sources | made_names
    missing = collections.defaultdict(list)
    for short, l, item, kind, inputs in recipes:
        for x in inputs:
            if norm(x) not in known and not re.search(r'enemy drop|stub|Ore$|Wood$|\bgem\b', x):
                missing[x].append(f'{item} ({short} {l})')
    unused = [f'{r[2]} ({r[0]} {r[1]})' for r in recipes if r[3] == 'material' and norm(r[2]) not in uses and not r[2].endswith(('Arrowheads', 'Wire', 'Chain', 'Gears', 'Nails', 'Plank', 'Band'))]
    print(f'{len(PAGES)} pages, {len(recipes)} recipes read.\n')
    print('Levels used twice:')
    print('\n'.join('  ' + d for d in dupes) or '  none')
    print('\nIngredients nothing on these pages gives:')
    print('\n'.join(f'  {k}: {", ".join(v[:3])}' for k, v in sorted(missing.items())) or '  none')
    print('\nMaterials no recipe here uses (they may go to another skill):')
    print('\n'.join('  ' + u for u in sorted(unused)) or '  none')
    return 0


if __name__ == '__main__':
    sys.exit(main())
