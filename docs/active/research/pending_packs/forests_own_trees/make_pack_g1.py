"""Pack G1: Forests and Orchards own their trees (brief 860 R2, T-689, T-691's forest slice). Built on ws_now2.json."""
import json, copy, os
HERE = os.path.dirname(os.path.abspath(__file__))
w = json.load(open(os.path.join(HERE, 'ws_now5.json'), encoding='utf-8'))['workspace']
T, E = w['tokens'], w['effects']
entries = []
def add(op, kind, id_, value, note):
    e = {'op': op, 'kind': kind, 'id': id_, 'note': note}
    if value is not None: e['value'] = value
    entries.append(e)
ALLOW = {'oak': 5, 'fir': 5, 'birch': 5, 'maple': 4, 'cedar': 4, 'mahogany': 4, 'ebony': 4}
for sp, n in ALLOW.items():
    tid = f'token_{sp}_forest'; v = copy.deepcopy(T[tid]); name = sp.capitalize()
    v['spawner'] = {k: x for k, x in v['spawner'].items() if k != 'upkeep'}; v['spawner']['allowance'] = n
    v['effects'] = [e for e in v.get('effects', []) if e['effectId'] != f'effect_{sp}_forest_growth']
    v['description'] = f'Plants up to {n} {name} Trees nearby and regrows their Stumps, for free. Operates passively without requiring a hero.'
    add('edit', 'token', tid, v, f'{v["name"]}: plants and regrows its own {n} trees for free (owner: about 4 or 5 a species; fewer for the slower woods); no seedling upkeep, no Growth boost.')
    st = f'token_{sp}_stump'; s = copy.deepcopy(T[st]); s['grows'] = {k: x for k, x in s['grows'].items() if k != 'cost'}
    add('edit', 'token', st, s, f'{s["name"]}: regrows free while its own Forest stands (no seedling).')
v = copy.deepcopy(T['token_apple_orchard'])
v['spawner'] = {k: x for k, x in v['spawner'].items() if k != 'upkeep'}
v['effects'] = [e for e in v.get('effects', []) if e['effectId'] != 'effect_apple_orchard_growth']
n = v['spawner']['allowance']
v['description'] = f'Plants up to {n} Apple Trees nearby; picked bare, they fruit again while it stands. Operates passively without requiring a hero.'
add('edit', 'token', 'token_apple_orchard', v, f'Apple Orchard: plants its own {n} Apple Trees for free (its count kept); no seed upkeep, no Growth boost.')
for sp in list(ALLOW) + ['apple_orchard']:
    eid = f'effect_{sp}_forest_growth' if sp != 'apple_orchard' else 'effect_apple_orchard_growth'
    add('delete', 'effect', eid, None, f'{E[eid]["name"]}: Forests and Orchards no longer speed regrowth (brief 860 R2).')
print(json.dumps(T['token_apple_tree'].get('respawn'))[:300])
pack = {'format': 'fantasy-guild-change-pack', 'version': 1, 'id': '2026-11-24-forests-own-trees', 'createdAt': '2026-11-24T23:30:00Z',
        'asked': 'Forests and Orchards own their trees (brief 860 R2, T-691): free planting and regrowth of their own, a count per species, the Growth boosts gone. Sync together with the R2 code (the director merges it with this pack).',
        'entries': entries}
json.dump(pack, open(os.path.join(HERE, '2026-11-24-forests-own-trees.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(len(entries), 'entries')
