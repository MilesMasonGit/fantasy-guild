Status: draft

# Hero orders: drag a hero to a job

*Owner interview, 2026-10-28. Replaces the flag and Work Permissions system
(GDD §4 "How heroes choose work", brief 140's drawer). Owner's reason: area
flags with per-skill permissions and priorities are familiar to Dwarf
Fortress and Rimworld players but too complicated for this game; one hero,
one job means less micromanagement.*

## The idea

Heroes live on the playmat. **Click a hero, drag them onto a Token, and they
walk there and work that one Token.** Area work comes back through **camps**:
built Tokens (Logging Camp, Mining Camp, Fishing Hut, Farmstead) where a hero
works every Token of that skill within the camp's reach.

## Orders

- **Drop on a Token** the hero can work: they walk there and work only it.
  The same order covers a station, a Field, a Promotion Token or the Hall.
- **Drop on a camp**: they work that camp's skill on any Token in its reach
  (below).
- **Drop on an enemy**: they fight that one enemy. **Drop on an enemy camp**
  (Goblin Camp): it acts as a camp for combat, and the hero hunts whatever
  that camp spawns, waiting for the next one when it is empty. Bosses work
  the same way: drop the hero on the boss.
- **Drop on blank ground**: a plain "go here". The pennant appears on the spot
  and fades out once the hero arrives; the hero then idles there.
- **Drop on the Hall**: go home and idle.
- Dragging from the hero's roster tab works as well as dragging the figure.

## When the job stops

- **The hero waits where they are** (owner): a resting vein, a regrowing tree,
  a growing Field, a station out of an input ("Needs Coal"), an enemy waiting
  to respawn. Today's waiting words stay ("Waiting for Copper Vein").
- **Content follows**: rest, regrow and respawn times get shorter so a waiting
  hero is not idle for long (owner, CMS work; see the owner's to-do).
- A Token that is gone for good (used up, nothing coming back): the hero
  shows a **"needs a job"** mark on the mat and their roster tab.
- **One hero per link** (owner): a hero no longer mines and then smelts on
  their own. The miner feeds the Bank, the Furnace's hero draws from it. Each
  extra hero is worth more; the Bunk Beds price is reviewed so a second hero
  comes early (content).

## Camps

- **Logging Camp, Mining Camp, Fishing Hut, Farmstead** to start (owner). Other
  skills don't need one. Each camp is its own Token type and may have its own
  twist (variety per Token).
- **Built on a Foundation** by a Construction hero, like a station (owner).
- **Reach per camp**, authored in the CMS like a spawner's reach; supports or a
  camp's own upgrades may widen it (owner). **Scouting Flags retires** from the
  Hall.
- **Any number of heroes** may work from one camp (owner); each takes their own
  Token, one hero per Token as today. The camp's reach and the Tokens in it
  are the natural limit.
- A camp hero picks the nearest free Token of the camp's skill they can work
  (level, tool), waits silently for a resting or growing one, and finishes a
  cycle before moving on (today's "sticky" rule).
- **Farmstead**: harvests ripe Fields in its reach (Fields already sow and grow
  themselves).
- Hovering a camp, or a hero working from one, shows its reach ring.

## Fighting

- Heroes fight only when sent, or when attacked. **The Fight permission goes.**
- **Hostile enemies still ambush** a hero working near their camp (the camp's
  watch area); the hero fights back, then returns to their job. Node ambushes
  are unchanged.
- **After a defeat** the hero limps home, heals for the wound time, then
  **waits at the Hall** for a new order (owner). Their pennant is cleared.

## What the player sees

- **The pennant marks the job**: the owner's small pennant sits at the top of
  the Token, **drawn behind the Token's sprite** so it shows through the
  transparent parts (owner). The same pennant for every hero for now; hero
  colours and colour-blind cues wait for the owner's art pass (T-151).
- The hero figure working at the Token is the main marker. Hovering a hero or
  their roster tab highlights their job (and a camp's reach ring).
- **The dock stays as a roster** (owner): heroes are always on the mat, idle
  ones loiter near the Hall; a tab finds the hero on the mat and opens their
  sheet, shows idle, hurt or busy, and can be dragged from.
- **The Work Permissions drawer goes** (owner), with its launcher at the left
  end of the hero bar. The skills' purpose lines move to the skill list on the
  hero sheet.

## Defaults the planning agent set (owner may change)

- **While dragging a hero, the Tokens they can work glow.** Dropping on one
  they cannot work (level, tool, skill) shows the reason ("Needs Pickaxe") and
  the hero stays where they were.
- **Dropping on a Token another hero works**: the newcomer waits beside it, as
  a second hero on a busy enemy does today.
- **Old saves**: a flag pinned to a Token becomes an order on that Token; an
  area flag becomes a hero idling where the flag stood. Rules and priorities
  are dropped.
- **Atlas travel**: returning to a Region, each hero resumes their order
  there (today: "starts at the flag").
- **Tutorial**: "plant a flag" becomes "send your Recruit to a tree"; a
  later step builds a first camp.

## Changed or retired

- Area flags, the flag radius, Work Permissions (rules, priorities, the
  combined Fight rule), the drawer and its launcher (brief 140), Scouting
  Flags.
- Brief 250's pennant changes meaning: from "every hero's flag" to the job and
  move marker described above.
- The engine's offline catch-up and the bench scenarios change their work (an
  accepted work change).

## Rollout (owner)

One brief in three phases, each with a look:

1. **Orders**: drag-to-Token, heroes on the mat, roster dock, pennant marker,
   permissions removed, old saves converted, enemy and boss orders. One
   eye-check; the owner may stop here if it does not feel right.
2. **Camps**: the camp behaviour, the four camps as content shapes, enemy
   camps as hunting grounds, reach rings. Eye-check.
3. **Clean-up**: tutorial text, the GDD, the old flag and rules code removed.

## Owner's to-do (CMS, after phase 2)

- Shorter rest, regrow and respawn times where a waiting hero idles too long.
- Camp Tokens: art, Foundation recipes, reach.
- Review the Bunk Beds price so a second hero comes early.
