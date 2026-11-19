#!/usr/bin/env python3
"""Builds the Guild Balance Dials page's files from the content catalogue.

Run from the worktree root: python .claude/skills/content/build_balance.py <out dir>
Writes guild_balance_dials.html, solver.js (balance_solver.cjs, the one copy of the rules'
calculation) and catalogue.json. Then republish to the page's URL (SKILL.md) with `root` =
<out dir> and `files` = ["solver.js", "catalogue.json"].
"""
import os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    shutil.copy(os.path.join(HERE, 'balance.html'), os.path.join(out, 'guild_balance_dials.html'))
    shutil.copy(os.path.join(HERE, 'balance_solver.cjs'), os.path.join(out, 'solver.js'))
    shutil.copy(os.path.join('docs', 'active', 'content_catalogue.json'), os.path.join(out, 'catalogue.json'))
    print('built', out)


if __name__ == '__main__':
    main()
