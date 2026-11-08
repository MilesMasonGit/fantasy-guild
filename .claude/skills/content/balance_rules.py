#!/usr/bin/env python3
"""The balance rules' formulas (docs/reference/BALANCE_RULES.md), with the page's tables.

Run from the repository root: python .claude/skills/content/balance_rules.py
Every number on the rules page comes from here; change a constant, re-run, and copy the tables.
"""

# The pace curve (owner, 2026-11-07): one smooth rule, each level 6.5 % longer than the last,
# 3 minutes at level 1, for a well-optimized player.
PACE_START_MINUTES = 3
PACE_GROWTH = 1.065
XP_HOUR_AT_1 = 1660      # what level 1's 83 XP in 3 minutes makes an hour; keeps today's start
OLD_TASK_PER_TIER = 2    # an old task is this many times slower 20 levels later (owner, 2026-11-07)
CYCLE_BASE = {'gather': 6, 'prepare': 8, 'make': 12}   # seconds at level 0
CYCLE_GROWTH = 1.15      # a little longer every 20 levels
COUNT_DOUBLES_EVERY = 40  # levels: ingredient counts double every two tiers
FINDS_A_DAY = {'bonus find': 20, 'rare gear drop': 1}
PAYBACK_HOURS = (1, 24)   # an upgrade's payback at level 1 and level 80


def minutes_per_level(level):
    return PACE_START_MINUTES * PACE_GROWTH ** (level - 1)


def xp_an_hour(level):
    """The XP an hour a task unlocked at this level pays."""
    return XP_HOUR_AT_1 * OLD_TASK_PER_TIER ** ((level - 1) / 20)


def xp_to_next(level):
    """The new XP table: XP from this level to the next, so the curve's time holds."""
    return round(xp_an_hour(level) * minutes_per_level(level) / 60)


def cycle(kind, level):
    return CYCLE_BASE[kind] * CYCLE_GROWTH ** (level / 20)


def make_seconds(level, bars):
    """A make step takes longer the more bars it uses, so XP per bar doesn't favour the smallest item."""
    return cycle('make', level) * (1 + 0.2 * (bars - 1))


def xp_level(unlock, next_unlock):
    """The level whose XP an hour a task pays: halfway to the skill's next unlock."""
    return (unlock + next_unlock) / 2 if next_unlock > unlock + 1 else unlock


def xp_per_action(kind, level, seconds=None):
    return max(1, round(xp_an_hour(level) * (seconds or cycle(kind, level)) / 3600))


def count(base, level):
    return max(1, round(base * 2 ** (level / COUNT_DOUBLES_EVERY)))


def chance_for(finds_a_day, seconds):
    return finds_a_day * seconds / 86400


def payback_hours(level):
    lo, hi = PAYBACK_HOURS
    return lo * (hi / lo) ** (max(level, 0) / 80)


# The boost budget (owner, 2026-11-07): what an optimized hero holds at each tier, in percent.
# Speed is a cut to work time (boosts add up; the game caps the stack at 80 %, the rules at 65 %).
TIERS = [('Copper', 1), ('Iron', 20), ('Silver', 30), ('Mythril', 40), ('Gold', 50), ('Adamantine', 60), ('Darkmetal', 80)]
OPT_SPEED_CUT = [20, 30, 35, 40, 45, 50, 60]
OPT_XP = [10, 10, 15, 15, 20, 20, 20]
TYPICAL_SHARE = 0.5      # a typical player holds about half of each speed and XP boost
GATHERERS_BARE_COPPER = 2.2   # gatherers a smelter needs with no boosts (review)
OPT_YIELD_OVER_TYPICAL = 1.25
RARE = [(0, 100), (0, 100), (0, 100), (50, 150), (50, 150), (50, 250), (50, 250)]   # (typical, optimized)
# How each kind is shared among sources at optimized: buildings carry the most (owner).
SHARES = {
    'speed': [('Faster Work building', 0.5), ('Hall stars', 0.25), ('drink', 1 / 6), ('skill perk', 1 / 12)],
    'yield': [('Double Output building (a sure double at most)', 0.25), ('Hall stars', 0.5), ('camp variants and perks', 0.25)],
    'xp': [('More XP building', 0.5), ('Hall stars', 0.25), ('drink', 0.25)],
}


def budget():
    rows = []
    for k, (name, lv) in enumerate(TIERS):
        growth = 2 ** (lv / COUNT_DOUBLES_EVERY)
        typ_yield = growth - 1
        opt_yield = (1 + typ_yield) * OPT_YIELD_OVER_TYPICAL - 1
        o = 1 / (1 - OPT_SPEED_CUT[k] / 100) * (1 + OPT_XP[k] / 100)
        t_cut, t_xp = OPT_SPEED_CUT[k] * TYPICAL_SHARE, OPT_XP[k] * TYPICAL_SHARE
        t = 1 / (1 - t_cut / 100) * (1 + t_xp / 100)
        rows.append(dict(name=name, lv=lv, opt_cut=OPT_SPEED_CUT[k], typ_cut=t_cut, opt_xp=OPT_XP[k], typ_xp=t_xp,
                         opt_yield=opt_yield * 100, typ_yield=typ_yield * 100, rare=RARE[k], O=o, T=t,
                         gather_typ=GATHERERS_BARE_COPPER * growth / (1 + typ_yield),
                         gather_opt=GATHERERS_BARE_COPPER * growth / (1 + opt_yield),
                         gather_bare=GATHERERS_BARE_COPPER * growth))
    return rows


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
    print('\nBoost budget: tier | speed cut typ/opt | XP typ/opt | yield typ/opt | rare finds typ/opt | earns vs bare typ/opt | opt over typ | gatherers per crafter bare/typ/opt')
    for r in budget():
        print(f"| {r['name']} ({r['lv']}) | {r['typ_cut']:.0f} / {r['opt_cut']} % | +{r['typ_xp']:.0f} / +{r['opt_xp']} % | +{r['typ_yield']:.0f} / +{r['opt_yield']:.0f} % | +{r['rare'][0]} / +{r['rare'][1]} % | {r['T']:.2f}x / {r['O']:.2f}x | {r['O'] / r['T']:.2f}x | {r['gather_bare']:.1f} / {r['gather_typ']:.1f} / {r['gather_opt']:.1f} |")
    last = budget()[-1]
    for kind, shares in SHARES.items():
        total = {'speed': last['opt_cut'], 'yield': last['opt_yield'], 'xp': last['opt_xp']}[kind]
        print(kind, 'at darkmetal, optimized:', ', '.join(f'{n} {total * s:.0f} %' for n, s in shares))
    print('\nOld task, 20 / 40 / 98 levels on:', OLD_TASK_PER_TIER, OLD_TASK_PER_TIER ** 2, round(xp_an_hour(99) / xp_an_hour(1), 1), 'times slower')


if __name__ == '__main__':
    main()
