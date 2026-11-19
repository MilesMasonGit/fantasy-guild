#!/usr/bin/env python3
"""Builds the Guild Art Board's files from the content catalogue.

Run from the worktree root: python .claude/skills/content/build_board.py <out dir>
Writes <out dir>/guild_art_board.html, board.json, sprites/, and files.json (the list to
pass as the Artifact tool's `files`, with `root` = <out dir>). Then republish to the
board's URL (SKILL.md). Sprites and live items are read from the main checkout, where
the owner's new art lands.
"""
import collections, glob, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import catalogue as cat

MATS = r'^(copper|iron|silver|mythril|gold|adamantine|darkmetal|oak|fir|birch|maple|cedar|mahogany|ebony|leather|linen|wool|silk)\s+'


def main_checkout():
    common = subprocess.run(['git', 'rev-parse', '--git-common-dir'], capture_output=True, text=True).stdout.strip()
    return os.path.dirname(os.path.abspath(common))


def words(s):
    return [re.sub(r's$', '', w) for w in re.findall(r'[a-z]+', s.lower()) if w not in ('of', 'the', 'and')]


def main():
    out = sys.argv[1]
    main_dir = main_checkout()
    entries = cat.load()
    by_id = {e['id']: e for e in entries}
    uses, gives = cat.users(entries), cat.givers(entries)

    live = {}
    for f in ('items.json', 'tokens.json'):
        for v in json.load(open(os.path.join(main_dir, 'data', f), encoding='utf-8')).values():
            if v.get('name') and v.get('sprite'):
                live.setdefault(v['name'].lower(), v['sprite'])
    files = {}
    for p in glob.glob(os.path.join(main_dir, 'public', 'assets', '**', '*.png'), recursive=True):
        if re.search(r'/(items|tokens|enemies)/', p.replace('\\', '/')):
            files.setdefault(os.path.splitext(os.path.basename(p))[0], p)

    if os.path.isdir(os.path.join(out, 'sprites')):
        shutil.rmtree(os.path.join(out, 'sprites'))
    os.makedirs(os.path.join(out, 'sprites'))
    shipped = set()

    def ship(sid):
        if sid not in shipped:
            shutil.copy(files[sid], os.path.join(out, 'sprites', sid + '.png'))
            shipped.add(sid)
        return 'sprites/' + sid + '.png'

    def by_file(ws):
        best = None
        for sid in files:
            parts = set(re.sub(r's$', '', w) for w in sid.lower().split('_')[1:])
            if ws and all(w in parts for w in ws) and (best is None or len(sid) < len(best)):
                best = sid
        return best

    name = lambda i: by_id[i]['name'] if i in by_id else i
    view = []
    drawn_by_base = collections.defaultdict(list)
    for e in entries:
        v = {'id': e['id'], 'name': e['name'], 'category': e['category'], 'kind': e.get('type', ''),
             'skill': e.get('skill', ''), 'level': e.get('level'), 'rung': cat.rung(e.get('level')),
             'madeWith': [name(i) for i in e.get('madeWith', [])], 'gives': [name(i) for i in e.get('gives', [])],
             'usedBy': sorted(name(i) for i in uses.get(e['id'], [])),
             'givenBy': sorted(name(i) for i in gives.get(e['id'], [])),
             'from': e.get('from', ''), 'art': e.get('art', ''), 'artNote': e.get('artNote', ''),
             'page': e.get('page', ''), 'section': e.get('section', ''), 'notes': e.get('notes', {})}
        sid = live.get(e['name'].lower())
        v['inGame'] = bool(sid)
        if not (sid and sid in files) and v['art'] in ('H', 'A', ''):
            sid = by_file(words(e['name']))
            v['spriteGuess'] = bool(sid)
        if sid and sid in files:
            v['sprite'] = ship(sid)
            if v['art'] in ('H', ''):
                drawn_by_base[re.sub(MATS, '', e['name'].lower())].append(v)
        view.append(v)
    for v in view:
        if v['art'] == 'A' and not v.get('sprite'):
            base = re.sub(MATS, '', v['name'].lower())
            src = drawn_by_base.get(base)
            if src:
                v['adaptFrom'], v['adaptSprite'] = src[0]['name'], src[0]['sprite']
            else:
                sid = by_file(words(base))
                if sid:
                    v['adaptFrom'], v['adaptSprite'] = sid, ship(sid)

    json.dump(view, open(os.path.join(out, 'board.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    shutil.copy(os.path.join(HERE, 'board.html'), os.path.join(out, 'guild_art_board.html'))
    listed = ['board.json'] + ['sprites/' + s + '.png' for s in sorted(shipped)]
    json.dump(listed, open(os.path.join(out, 'files.json'), 'w'))
    c = collections.Counter(v['art'] or '?' for v in view)
    print(f"{len(view)} entries, art {dict(c)}, {len(shipped)} sprites; "
          f"have-art with no file: {sum(1 for v in view if v['art'] == 'H' and not v.get('sprite'))}")
    print('files list:', os.path.join(out, 'files.json'))


if __name__ == '__main__':
    main()
