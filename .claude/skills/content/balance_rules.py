#!/usr/bin/env python3
"""The balance rules' formulas (docs/reference/BALANCE_RULES.md), with the page's tables.

Run from the repository root: python .claude/skills/content/balance_rules.py
Every number on the rules page comes from here; change a constant, re-run, and copy the tables.
"""

# The pace curve (the ladder's ruling): minutes one level takes, geometric between points,
# read the way the ledger reads it (settings.js, minutesPerLevelAt).
PACE = [(1, 3), (10, 8), (20, 30), (40, 180), (60, 720), (99, 1440)]
XP_HOUR_AT_1 = 1660      # what level 1's 83 XP in 3 minutes makes an hour; keeps today's start
OLD_TASK_PER_TIER = 2    # an old task is this many times slower 20 levels later (owner, 2026-11-07)
CYCLE_BASE = {'gather': 6, 'prepare': 8, 'make': 12}   # seconds at level 0
CYCLE_GROWTH = 1.15      # a little longer every 20 levels
COUNT_DOUBLES_EVERY = 40  # levels: ingredient counts double every two tiers
FINDS_A_DAY = {'bonus find': 20, 'rare gear drop': 1}
PAYBACK_HOURS = (1, 24)   # an upgrade's payback at level 1 and level 80


def minutes_per_level(level):
    if level <= PACE[0][0]:
        return PACE[0][1]
    for (a, am), (b, bm) in zip(PACE, PACE[1:]):
        if level <= b:
            return am * (bm / am) ** ((level - a) / (b - a))
    return PACE[-1][1]


def xp_an_hour(level):
    """The XP an hour a task unlocked at this level pays."""
    return XP_HOUR_AT_1 * OLD_TASK_PER_TIER ** ((level - 1) / 20)


def xp_to_next(level):
    """The new XP table: XP from this level to the next, so the curve's time holds."""
    return round(xp_an_hour(level) * minutes_per_level(level) / 60)


def cycle(kind, level):
    return CYCLE_BASE[kind] * CYCLE_GROWTH ** (level / 20)


def xp_per_action(kind, level):
    return max(1, round(xp_an_hour(level) * cycle(kind, level) / 3600))


def count(base, level):
    return max(1, round(base * 2 ** (level / COUNT_DOUBLES_EVERY)))


def chance_for(finds_a_day, seconds):
    return finds_a_day * seconds / 86400


def payback_hours(level):
    lo, hi = PAYBACK_HOURS
    return lo * (hi / lo) ** (max(level, 0) / 80)


def main():
    print('XP table: level | minutes a level | XP an hour | XP to next | XP to here')
    for lv in (1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 98):
        print(f'| {lv} | {minutes_per_level(lv):,.0f} | {xp_an_hour(lv):,.0f} | {xp_to_next(lv):,} | {sum(xp_to_next(x) for x in range(1, lv)):,} |')
    total = sum(xp_to_next(x) for x in range(1, 99))
    print(f'total to 99: {total:,}; on a level-1 task alone: {total / xp_an_hour(1) / 24:,.0f} days')
    print('\nCycle seconds by kind at 1, 20, 30, 40, 50, 60, 80')
    for k in CYCLE_BASE:
        print(k, [round(cycle(k, lv), 1) for lv in (1, 20, 30, 40, 50, 60, 80)])
    print('\nIngots: metal | level | ore | coal | seconds | XP | a chestplate (5 bars)')
    for n, lv in (('Copper', 1), ('Iron', 20), ('Silver', 30), ('Mythril', 40), ('Gold', 50), ('Adamantine', 60), ('Darkmetal', 80)):
        ore, coal = count(2, lv), count(1, lv)
        print(f'| {n} | {lv} | {ore} | {coal} | {cycle("prepare", lv):.1f} | {xp_per_action("prepare", lv)} | {5 * ore} ore, {5 * coal} coal |')
    print('\nVeins: metal | level | seconds | XP | bonus find 1 in')
    for n, lv in (('Copper', 1), ('Iron', 20), ('Mythril', 40), ('Adamantine', 60), ('Darkmetal', 80)):
        s = cycle('gather', lv)
        print(f'| {n} | {lv} | {s:.1f} | {xp_per_action("gather", lv)} | {round(1 / chance_for(20, s)):,} |')
    print('\nRare gear drop on a 12 s fight: 1 in', round(1 / chance_for(1, 12)))
    print('Payback hours at 1, 20, 40, 60, 80:', [round(payback_hours(lv), 1) for lv in (1, 20, 40, 60, 80)])
    print('\nBread: link | level | kind | seconds | XP')
    for n, kind, lv in (('Wheat', 'gather', 4), ('Flour', 'prepare', 4), ('Dough', 'prepare', 4), ('Bread', 'make', 7)):
        print(f'| {n} | {lv} | {kind} | {cycle(kind, lv):.1f} | {xp_per_action(kind, lv)} |')
    print("\nMaster's Draught: link | level | kind | seconds | XP")
    for n, kind, lv in (('Starflower', 'gather', 80), ('Moonpetal', 'gather', 60), ("Master's Draught", 'make', 90)):
        print(f'| {n} | {lv} | {kind} | {cycle(kind, lv):.1f} | {xp_per_action(kind, lv)} |')
    print('each herb in the Draught:', count(1, 90))
    print('\nOld task, 20 / 40 / 98 levels on:', OLD_TASK_PER_TIER, OLD_TASK_PER_TIER ** 2, round(xp_an_hour(99) / xp_an_hour(1), 1), 'times slower')


if __name__ == '__main__':
    main()
