"""Pack F1: Fishing (brief 850; owner's plan content_fishing.md, amended 2026-11-24; owner answers 2026-11-24:
there is only water, each map holds 3-4 fish with at most one per lure; a Mythril Harpoon).
Built on ws_now.json (the owner's workspace)."""
import json, copy, os

HERE = os.path.dirname(os.path.abspath(__file__))
w = json.load(open(os.path.join(HERE, 'ws_now5.json'), encoding='utf-8'))['workspace']
I, T, E, R = w['items'], w['tokens'], w['effects'], w['recipePools']
entries = []
def add(op, kind, id_, value, note, art=False):
    e = {'op': op, 'kind': kind, 'id': id_, 'note': note}
    if value is not None: e['value'] = value
    if art: e['placeholderArt'] = True
    entries.append(e)
def tier_for(lvl): return 0 if lvl <= 5 else (2 if lvl <= 20 else 3)  # the stages as the content stands: Starter Camp to 5, Plane 2 to about 20
def recipe(sk, rid): return next(r for r in R[sk] if r['id'] == rid)
OUT = lambda iid, q=1: {'itemId': iid, 'chance': 100, 'minQty': q, 'maxQty': q, 'baseQty': {'min': q, 'max': q}, 'variable': False}
WATER = ['sea', 'fresh']

# ---------------------------------------------------------------- the fish
# id, name, level, cycle s, bait per catch, tool, sprite stand-in, new?
FISH = [
    ('item_raw_shrimp', 'Raw Shrimp', 1, 6, 0, 'trap', None, False),
    ('item_trout', 'Trout', 5, 8, 1, 'rod', None, False),
    ('item_anchovy', 'Anchovy', 25, 10, 1, 'rod', 'i_trout_raw', True),
    ('item_tropical_fish', 'Tropical Fish', 30, 11, 2, 'rod', None, False),
    ('item_oyster', 'Oyster', 25, 12, 2, 'trap', None, False),
    ('item_salmon', 'Salmon', 40, 12, 2, 'rod', None, False),
    ('item_tuna', 'Tuna', 45, 13, 2, 'rod', 'i_salmon_raw', True),
    ('item_stingray', 'Stingray', 54, 14, 3, 'harpoon', 'i_swordfish', True),
    ('item_lobster', 'Lobster', 50, 12, 2, 'trap', None, False),
    ('item_sturgeon', 'Sturgeon', 60, 15, 3, 'rod', 'i_salmon_raw', True),
    ('item_swordfish', 'Swordfish', 63, 16, 4, 'harpoon', None, False),
    ('item_shark', 'Shark', 83, 20, 5, 'harpoon', 'i_shark_raw', True),
    ('item_anglerfish', 'Anglerfish', 89, 18, 5, 'rod', 'i_trout_raw', True),
]
FISH_XP = {'item_raw_shrimp': 2, 'item_trout': 6, 'item_anchovy': 15, 'item_oyster': 15, 'item_tropical_fish': 18, 'item_salmon': 25, 'item_tuna': 30,
           'item_lobster': 35, 'item_stingray': 45, 'item_sturgeon': 55, 'item_swordfish': 70, 'item_shark': 110, 'item_anglerfish': 130}  # on the tree and vein ladder of the XP pass
FISH_SRC = {'item_tropical_fish': 'token_coral_reef', 'item_oyster': 'token_oyster_bed', 'item_shark': 'token_shark_waters'}
for iid, name, lvl, cyc, bait, tool, spr, new in FISH:
    block = {'level': lvl, 'cycleMs': cyc * 1000, 'bait': bait, 'xp': FISH_XP[iid]}
    src = FISH_SRC.get(iid, 'token_fishing_spot')
    if new:
        add('create', 'item', iid, {'name': name, 'description': '', 'type': 'material', 'sprite': spr, 'stackable': True, 'restoreAmount': 0,
            'equipSlot': '', 'value': 1, 'valueSource': src, 'autoSyncId': True, 'id': iid, 'tags': ['Fish', 'Seafood'], 'fish': block,
            'plan': {'status': 'live', 'tier': tier_for(lvl)}},
            f'{name}: a {tool} fish at Fishing {lvl}, {cyc} s a catch, {bait} Bait, {FISH_XP[iid]} XP. A neighbouring fish\'s picture stands in.', art=True)
    else:
        v = copy.deepcopy(I[iid]); v['fish'] = block; v['valueSource'] = src
        v['plan'] = {**(v.get('plan') or {}), 'status': (v.get('plan') or {}).get('status', 'live'), 'tier': tier_for(lvl)}
        v['plan'].pop('note', None)
        if v.get('plan', {}).get('status') == 'planned':
            v['plan'] = {'status': 'live', 'tier': tier_for(lvl)}
            v.setdefault('type', 'material'); v.setdefault('stackable', True); v.setdefault('sprite', 'i_shrimp_raw')
            v.setdefault('equipSlot', ''); v.setdefault('value', 1); v.setdefault('restoreAmount', 0); v.setdefault('tags', ['Fish', 'Seafood'])
        add('edit', 'item', iid, v, f'{name}: Fishing {lvl}, {cyc} s a catch, ' + ('no Bait (the Trap\'s free start).' if not bait else f'{bait} Bait a catch.') + f' Priced from {src}.')

# Cooking for the new fish, each opening at its Fishing level (owner's rule)
COOK = [('item_shark', 'item_cooked_shark', 'Cooked Shark', 83, 1350, 'i_shark')]  # the other new fish wait for the Cooking review (owner 2026-11-24)
for raw, cid, name, lvl, xp, spr in COOK:
    add('create', 'item', cid, {'name': name, 'description': '', 'type': 'food', 'sprite': spr, 'stackable': True, 'restoreAmount': 8 + lvl // 4,
        'equipSlot': 'food', 'value': 1, 'valueSource': f'recipe_{cid[5:]}', 'autoSyncId': True, 'id': cid, 'tags': ['Food', 'Fish', 'Cooked'],
        'plan': {'status': 'live', 'tier': tier_for(lvl)}}, f'{name}: cooked from its fish at Cooking {lvl}. A neighbouring picture stands in.', art=True)
    add('create', 'recipe', f'recipe_{cid[5:]}', {'id': f'recipe_{cid[5:]}', 'name': name, 'skill': 'cooking', 'levelRequirement': lvl, 'requiresContext': [],
        'inputs': [{'itemId': raw, 'quantity': 1}], 'outputs': [OUT(cid)], 'durationMs': 17000 + lvl * 215, 'stationChargeCost': 1, 'xp': xp,
        'sim': {'tempo': 'medium', 'purpose': 'iph'}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'{name} at Cooking {lvl}, the level that catches its fish. XP on the Cooking curve, for the balance tool to confirm.')

# ---------------------------------------------------------------- Bait and its recipes
add('create', 'item', 'item_bait', {'name': 'Bait', 'description': '', 'type': 'material', 'sprite': 'i_fish_bait', 'stackable': True, 'restoreAmount': 0,
    'equipSlot': 'consumable', 'value': 1, 'valueSource': 'recipe_bait_from_raw_shrimp', 'autoSyncId': True, 'id': 'item_bait', 'tags': ['Bait'],
    'plan': {'status': 'live', 'tier': 0}}, 'Bait: the one Bait for all fishing (owner 2026-11-24), carried in a consumable cell; each fish says how much a catch spends.')
for iid in ('item_worm_bait', 'item_shrimp_bait', 'item_trout_bait', 'item_salmon_bait', 'item_swordfish_chum'):
    add('delete', 'item', iid, None, f'{I[iid]["name"]}: replaced by the one Bait (owner 2026-11-24).')
for sk, rid in (('crafting', 'recipe_worm_bait'), ('crafting', 'recipe_shrimp_bait')):
    add('delete', 'recipe', rid, None, f'{recipe(sk, rid)["name"]}: Bait is a Fishing recipe now (owner 2026-11-24).')
BAIT = [('item_raw_shrimp', 1, 3), ('item_worm', 2, 2), ('item_trout', 5, 4), ('item_anchovy', 25, 4), ('item_tropical_fish', 30, 5),
        ('item_oyster', 25, 5), ('item_salmon', 40, 6), ('item_tuna', 45, 6), ('item_stingray', 54, 8), ('item_lobster', 50, 6),
        ('item_sturgeon', 60, 8), ('item_swordfish', 63, 10), ('item_shark', 83, 12), ('item_anglerfish', 89, 12)]
names = {f[0]: f[1] for f in FISH}; names['item_worm'] = 'Worm'
for src, lvl, qty in BAIT:
    rid = f'recipe_bait_from_{src[5:]}'
    add('create', 'recipe', rid, {'id': rid, 'name': f'Bait from {names[src]}', 'skill': 'fishing', 'levelRequirement': lvl, 'requiresContext': [],
        'inputs': [{'itemId': src, 'quantity': 1}], 'outputs': [OUT('item_bait', qty)], 'durationMs': 4000, 'stationChargeCost': 1,
        'xp': max(1, lvl // 10), 'sim': {'tempo': 'quick', 'purpose': 'iph'}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'Bait from {names[src]}: {qty} Bait at the Bait Shed, Fishing {lvl} ("if they can catch it, they can make it into bait"; rarer fish give more). Little XP.')

# ---------------------------------------------------------------- lures (Crafting, about their fish's level)
LURES = [('item_fly_lure', 'Fly Lure', 11, ['item_trout', 'item_salmon'], [('item_wool', 1), ('item_copper_nails', 1)]),
         ('item_spinner_lure', 'Spinner Lure', 30, ['item_anchovy', 'item_sturgeon'], [('item_iron_nails', 2), ('item_fir_plank', 1)]),
         ('item_glow_lure', 'Glow Lure', 38, ['item_tuna', 'item_anglerfish'], [('item_beeswax_comb', 2), ('item_iron_nails', 1)])]
for iid, name, lvl, fish, ins in LURES:
    for i, _ in ins: assert i in I, i
    add('create', 'item', iid, {'name': name, 'description': '', 'type': 'material', 'sprite': 'i_fish_bait', 'stackable': True, 'restoreAmount': 0,
        'equipSlot': 'consumable', 'value': 1, 'valueSource': f'recipe_{iid[5:]}', 'autoSyncId': True, 'id': iid, 'tags': ['Lure'],
        'lure': {'fish': fish, 'breakChance': 5}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'{name}: picks {names[fish[0]]} or {names[fish[1]]}, whichever the map holds (one per map); 5% to break each catch. The bait picture stands in.', art=True)
    add('create', 'recipe', f'recipe_{iid[5:]}', {'id': f'recipe_{iid[5:]}', 'name': name, 'skill': 'crafting', 'levelRequirement': lvl, 'requiresContext': [],
        'inputs': [{'itemId': i, 'quantity': q} for i, q in ins], 'outputs': [OUT(iid, 3)], 'durationMs': 15000, 'stationChargeCost': 1,
        'xp': max(2, lvl), 'sim': {'tempo': 'medium', 'purpose': 'iph'}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'{name}: 3 at Crafting {lvl}, near the level of its first fish (a free Crafting level).')

# ---------------------------------------------------------------- tools: Bait saving, harpoons, the net goes
for iid, save in (('item_fishing_rod', 0), ('item_fine_fishing_rod', 1), ('item_master_rod', 2)):
    v = copy.deepcopy(I[iid]); v['tool'] = {**v['tool'], 'baitSaving': save}
    add('edit', 'item', iid, v, f'{v["name"]}: saves {save} Bait a catch (a better rod spends less, owner 2026-11-24).')
HARP = [('item_mythril_harpoon', 'Mythril Harpoon', 54, 1, 0, [('item_mythril_ingot', 3), ('item_maple_plank', 2)]),
        ('item_adamantine_harpoon', 'Adamantine Harpoon', 63, 2, 1, [('item_adamantine_ingot', 3), ('item_mahogany_plank', 2)]),
        ('item_darkmetal_harpoon', 'Darkmetal Harpoon', 83, 3, 2, [('item_darkmetal_ingot', 3), ('item_ebony_plank', 2)])]
for iid, name, lvl, tier, save, ins in HARP:
    for i, _ in ins: assert i in I, i
    add('create', 'item', iid, {'name': name, 'description': '', 'type': 'tool', 'sprite': 'i_rod_wood', 'stackable': False, 'restoreAmount': 0,
        'equipSlot': 'hand', 'value': 1, 'valueSource': f'recipe_{iid[5:]}', 'autoSyncId': True, 'id': iid, 'tags': ['Tool'],
        'tool': {'kind': 'harpoon', 'tier': tier, 'baitSaving': save}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'{name}: catches any harpoon fish (Stingray, Swordfish, Shark); tier {tier}, saves {save} Bait a catch. The rod picture stands in.', art=True)
    add('create', 'recipe', f'recipe_{iid[5:]}', {'id': f'recipe_{iid[5:]}', 'name': name, 'skill': 'smithing', 'levelRequirement': lvl, 'requiresContext': [],
        'inputs': [{'itemId': i, 'quantity': q} for i, q in ins], 'outputs': [OUT(iid)], 'durationMs': 17000 + lvl * 215, 'stationChargeCost': 1,
        'xp': 10 + lvl, 'sim': {'tempo': 'medium', 'purpose': 'iph'}, 'plan': {'status': 'live', 'tier': tier_for(lvl)}},
        f'{name} at Smithing {lvl}.')
add('delete', 'effect', 'effect_fishing_net', None, 'Fishing Net: the plan has Rod, Harpoon and Trap only; no item carries it (the director removes the kind after).')

# ---------------------------------------------------------------- the maps: one fish per lure each, plus a Trap catch
# lure pairs: Fly Trout/Salmon, Spinner Anchovy/Sturgeon, Glow Tuna/Anglerfish
MAPS = {  # biome: (rod fish, trap catch, harpoon fish)
    'meadow':   (['item_trout', 'item_anchovy', 'item_tuna'], 'item_raw_shrimp', []),
    'forest':   (['item_trout', 'item_sturgeon', 'item_tuna'], 'item_raw_shrimp', []),
    'mountain': (['item_salmon', 'item_sturgeon', 'item_tuna'], 'item_raw_shrimp', []),
    'bog':      (['item_trout', 'item_sturgeon', 'item_anglerfish'], 'item_raw_shrimp', ['item_stingray']),
    'coast':    (['item_salmon', 'item_anchovy', 'item_anglerfish'], 'item_lobster', ['item_stingray', 'item_swordfish']),
}
ROD_W = {'item_trout': 60, 'item_salmon': 40, 'item_anchovy': 50, 'item_sturgeon': 25, 'item_tuna': 35, 'item_anglerfish': 15}
def pools_for(maps, harpoon_default=None, shoal=False):
    out = []
    for biome, (rod, trap, harp) in maps.items():
        out.append({'tool': 'fishing_rod', 'bait': 'item_bait', 'biomes': [biome], 'catches': [{'itemId': f, 'weight': ROD_W[f] * (1 if not shoal else 1) + (20 if shoal else 0)} for f in rod]})
        out.append({'tool': 'fishing_trap', 'bait': None if trap == 'item_raw_shrimp' else 'item_bait', 'biomes': [biome], 'catches': [{'itemId': trap, 'weight': 100}]})
        if harp: out.append({'tool': 'harpoon', 'bait': 'item_bait', 'biomes': [biome], 'catches': [{'itemId': f, 'weight': 60 if f == 'item_stingray' else 40} for f in harp]})
    rod, trap, harp = maps['meadow']  # anywhere else reads as meadow (the Starter Camp's ground)
    out.append({'tool': 'fishing_rod', 'bait': 'item_bait', 'catches': [{'itemId': f, 'weight': ROD_W[f]} for f in rod]})
    out.append({'tool': 'fishing_trap', 'bait': None, 'catches': [{'itemId': 'item_raw_shrimp', 'weight': 100}]})
    if harpoon_default: out.append({'tool': 'harpoon', 'bait': 'item_bait', 'catches': harpoon_default})
    return out

shoal = copy.deepcopy(T['token_fish_shoal'])
def spot_token(tid, name, sprite, spot, pools, desc, rarity='common', tags=('Water', 'Fishing Spot')):
    v = {k: shoal[k] for k in ('tokenType', 'size', 'requiresHero', 'acceptedTokens', 'staysPut', 'standsOn') if k in shoal}
    v.update({'name': name, 'description': desc, 'sprite': sprite, 'rarity': rarity, 'tier': 1, 'tags': list(tags), 'uses': None, 'autoSyncId': True, 'id': tid,
              'config': {'skill': 'fishing', 'skillRequired': 1, 'cycleTimeMs': 8000, 'xp': 2, 'inputs': [], 'outputs': []},
              'sim': {'tempo': 'fast', 'purpose': 'iph', 'xpPinned': True}, 'spot': spot, 'catchPools': pools})
    return v

spot = spot_token('token_fishing_spot', 'Fishing Spot', 't_fish_spot',
    {'water': WATER, 'biomes': [], 'everyMinutes': 3, 'most': 3, 'leaveChance': 3, 'unworkedMinutes': 20}, pools_for(MAPS),
    'Fish gather here for a while, then move on.')
add('create', 'token', 'token_fishing_spot', {**spot, 'plan': {'status': 'live', 'tier': 0}},
    'Fishing Spot: drifts in on any water about every 3 minutes, at most 3 a map; 3% to move on each catch, 20 minutes unworked. '
    'Each map holds three rod fish (one per lure), one Trap catch and on two maps harpoon fish (owner 2026-11-24). The Fish Shoal picture stands in.', art=True)

v = copy.deepcopy(shoal)
for k in ('needsTool',): v.pop(k, None)
v.update({'uses': None, 'config': {**v['config'], 'outputs': []}, 'spot': {'water': WATER, 'biomes': [], 'everyMinutes': 0, 'most': 1, 'leaveChance': 1, 'unworkedMinutes': 30},
          'catchPools': pools_for(MAPS, [{'itemId': 'item_stingray', 'weight': 60}, {'itemId': 'item_swordfish', 'weight': 40}], shoal=True),
          'plan': {'status': 'live', 'tier': 0}})
v['catchPools'] = [p if p['tool'] != 'harpoon' or 'biomes' not in p else p for p in v['catchPools']]
add('edit', 'token', 'token_fish_shoal', v, 'Fish Shoal: a spot kind brought by its event only; the map\'s own fish with the rarer ones weighted up, harpoon fish anywhere, '
    'and it stays (1% to move on a catch). Its old fixed 4-fish output and 100 charges go (T-604).')

RARE = [('token_coral_reef', 'Coral Reef', ['coast'], 45, [{'tool': 'fishing_rod', 'bait': 'item_bait', 'catches': [{'itemId': 'item_tropical_fish', 'weight': 100}]}],
         'Tropical Fish swim only here.', 'Coral Reef: rare, warm sea only (coast maps), about every 45 minutes; its fixed catch is Tropical Fish by rod.'),
        ('token_oyster_bed', 'Oyster Bed', ['coast', 'bog'], 40, [{'tool': 'fishing_trap', 'bait': 'item_bait', 'catches': [{'itemId': 'item_oyster', 'weight': 100}]}],
         'Oysters cling to the rocks here.', 'Oyster Bed: rare, coast and bog maps, about every 40 minutes; Oyster by Trap with Bait. Pearl joins as a rare find once Pearls have their gear.'),
        ('token_shark_waters', 'Shark-Infested Waters', ['coast'], 60, [{'tool': 'harpoon', 'bait': 'item_bait', 'catches': [{'itemId': 'item_shark', 'weight': 100}]}],
         'Fins circle in the water.', 'Shark-Infested Waters: rare, coast maps, about every hour; the Shark by any harpoon.')]
for tid, name, biomes, every, pools, desc, note in RARE:
    t = spot_token(tid, name, 't_fish_spot', {'water': WATER, 'biomes': biomes, 'everyMinutes': every, 'most': 1, 'leaveChance': 8, 'unworkedMinutes': 20},
                   pools, desc, rarity='rare')
    add('create', 'token', tid, {**t, 'plan': {'status': 'live', 'tier': 3}}, note + ' 8% to move on a catch. The Fish Shoal picture stands in.', art=True)
add('create', 'token', 'token_shipwreck', {'name': 'Shipwreck', 'plan': {'status': 'planned', 'tier': 2,
    'note': 'A rare spot kind with the Shipwreck\'s goods as its fixed catch (owner 2026-11-24); waits for its goods (a Fishing rare table, T-553).'}, 'autoSyncId': True, 'id': 'token_shipwreck'},
    'Shipwreck: Planned, waits for its goods.')

# ---------------------------------------------------------------- the fixed waters go
for tid in ('token_coast', 'token_river', 'token_lake', 'token_bog_pool', 'token_shrimp_coast'):
    add('delete', 'token', tid, None, f'{T[tid]["name"]}: water is ground now; fishing spots come and go on it (owner 2026-11-24).')
sc = copy.deepcopy(w['starterCamp']); sc['tokens'] = [t for t in sc['tokens'] if t['typeId'] not in ('token_coast',)]
add('edit', 'starterCamp', 'starterCamp', sc, 'Starter Camp: its Coast Token at (1460, 270) goes; spots arrive on the camp\'s pond.')
wd = copy.deepcopy(w['world'])
for l in wd['lines']:
    if l['id'] == 'waters': l['origins'] = {r: [] for r in l['origins']}
add('edit', 'world', 'world', wd, 'World: the Waters line keeps its place but places nothing (its Coast, River, Lake, Bog Pool and Shrimp Coast are retired); fish come from spots on each map\'s water, by its biome.')

# ---------------------------------------------------------------- buildings
hut = copy.deepcopy(T['token_fishing_hut']); hut['camp'] = {k: v for k, v in hut['camp'].items() if k != 'reach'}
add('edit', 'token', 'token_fishing_hut', hut, 'Fishing Hut: its unread reach (280) goes; every camp works the one standard reach.')

yard = T['token_builders_yard']
add('create', 'effect', 'effect_bait_shed_station', {'id': 'effect_bait_shed_station', 'name': 'Bait Shed Station',
    'statements': [{'id': 'stm_bait_shed_station', 'keyword': 'station', 'payload': {'skill': 'fishing'}, 'to': None, 'when': None, 'upkeep': None}],
    'autoSyncId': True}, 'Bait Shed: works as Fishing\'s station, for making Bait.')
shed = copy.deepcopy(yard)
shed.update({'name': 'Bait Shed', 'description': 'Works as a Fishing station: Bait Shed.', 'id': 'token_bait_shed', 'sprite': 't_market_fish',
             'effects': [{'effectId': 'effect_bait_shed_station', 'scale': 1}], 'plan': {'status': 'live', 'tier': 0}})
shed['config'] = {**shed['config'], 'skill': 'fishing'}
add('create', 'token', 'token_bait_shed', shed, 'Bait Shed: where Bait is made from fish. On today\'s Foundations until the Dock is approved. The Fishing Hut picture stands in.', art=True)
chum = {k: copy.deepcopy(T['token_fishing_hut'][k]) for k in ('tokenType', 'rarity', 'tier', 'tags', 'acceptedTokens', 'size', 'uses', 'requiresHero', 'config')}
chum.update({'tokenType': 'buff', 'requiresHero': False, 'config': None, 'name': 'Chum Station', 'description': 'Fishing spots turn up a third more often on the water nearby.', 'sprite': 't_market_fish',
             'autoSyncId': True, 'id': 'token_chum_station', 'spotRate': {'percent': 30}, 'plan': {'status': 'live', 'tier': 2}})
add('create', 'token', 'token_chum_station', chum, 'Chum Station: spots arrive 30 % more often on water in its reach (the 30 % building target) (owner\'s Dock building, named here). On today\'s Foundations. The Fishing Hut picture stands in.', art=True)
base = recipe('construction', 'recipe_build_fishing_hut')
for rid, name, tid, lvl, ins in (('recipe_build_bait_shed', 'Build Bait Shed', 'token_bait_shed', 2, [('item_oak_wood', 10), ('item_stone', 5)]),
                                 ('recipe_build_chum_station', 'Build Chum Station', 'token_chum_station', 12, [('item_oak_wood', 15), ('item_stone', 10), ('item_bait', 20)])):
    b = copy.deepcopy(base)
    b.update({'id': rid, 'name': name, 'levelRequirement': lvl, 'inputs': [{'itemId': i, 'quantity': q} for i, q in ins],
              'outputs': [{**base['outputs'][0], 'tokenId': tid}], 'plan': {'status': 'live', 'tier': tier_for(lvl)}})
    add('create', 'recipe', rid, b, f'{name}: Construction {lvl}, ' + ', '.join(f'{q} {I[i]["name"] if i in I else "Bait"}' for i, q in ins) + '.')

pack = {'format': 'fantasy-guild-change-pack', 'version': 1, 'id': '2026-11-24-fishing-spots',
        'createdAt': '2026-11-24T22:00:00Z',
        'asked': 'Fishing (brief 850, owner review 2026-11-24): fishing spots on the water, one Bait, three lures, harpoons, Bait recipes, the fixed waters retired. Sync together with the fishing code (the director merges it with this pack).',
        'entries': entries}
json.dump(pack, open(os.path.join(HERE, '2026-11-24-fishing-spots.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(len(entries), 'entries')
