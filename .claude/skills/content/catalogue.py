"""Reads and writes the content catalogue, docs/active/content_catalogue.json.

The catalogue is the one copy of every planned item, Token, building and event
(owner, 2026-11-18). Chain pages keep the rulings; the Guild Art Board is built
from this file by build_board.py. One entry per line, so a diff shows what moved.

Entry fields (only id, name, category, skill and level are always there):
  id        stable key; never change it, even on a rename (the board's locks hang on it)
  name      what the player sees
  category  item | token | building | event
  type      the kind in the page's words (Melee weapon, food, Token, ...)
  skill     the skill that makes, gathers or builds it
  level     the level it unlocks at, or null
  madeWith  ingredient ids
  gives     ids a Token or building gives
  from      where a raw thing comes from, in words (enemy drop, Wishing Well)
  art       H have, A adapt, N new, or absent
  artNote   the art cell's words after the code
  page      the chain page holding its rulings
  section   the heading on that page
  notes     any other column, by its name
"""
import json, os, re

PATH = os.path.join('docs', 'active', 'content_catalogue.json')
FIELDS = ['id', 'name', 'category', 'type', 'skill', 'level', 'madeWith', 'gives', 'from',
          'art', 'artNote', 'page', 'section', 'notes']
RUNGS = [(80, 'Darkmetal'), (60, 'Adamantine'), (50, 'Gold'), (40, 'Mythril'), (30, 'Silver'), (20, 'Iron'), (0, 'Copper')]


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def rung(level):
    """The ladder's rung for a level (amended ladder, 2026-11-04)."""
    if level is None:
        return 'Unplaced'
    return next(n for lo, n in RUNGS if level >= lo)


def load(path=PATH):
    with open(path, encoding='utf-8') as f:
        return json.load(f)['entries']


def save(entries, path=PATH):
    rows = []
    for e in entries:
        row = {k: e[k] for k in FIELDS if k in e and e[k] not in ('', [], {}, None)}
        row['level'] = e.get('level')
        rows.append({k: row[k] for k in FIELDS if k in row})
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{"format": "fantasy-guild-content-catalogue", "version": 1,\n "entries": [\n')
        f.write(',\n'.join('  ' + json.dumps(r, ensure_ascii=False) for r in rows))
        f.write('\n]}\n')


def users(entries):
    """id -> ids of the entries that use it as an ingredient."""
    out = {}
    for e in entries:
        for i in e.get('madeWith', []):
            out.setdefault(i, []).append(e['id'])
    return out


def givers(entries):
    """id -> ids of the Tokens and buildings that give it."""
    out = {}
    for e in entries:
        for i in e.get('gives', []):
            out.setdefault(i, []).append(e['id'])
    return out
