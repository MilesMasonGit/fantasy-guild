// Fantasy Guild - every word of the cartographer's tutorial, in one place
//
// The owner reads and edits these at the eye-check. Each step has:
//   title        what the quest Token is called (plain, so the player knows what to do)
//   says         the cartographer's line (his voice: eerie, muddled, never cruel)
//   instruction  how to do it, in the plain UI voice
// Short, and written to be translated: no wordplay that only works in English.

export const TUTORIAL_TEXT = Object.freeze({
    /** Who speaks the steps, shown on the quest's tooltip. */
    speaker: 'The Cartographer',
    /** The tag on a tutorial quest's tooltip. */
    tag: 'Tutorial',
    /** The reward line for the step that pays the first maps. */
    firstMaps: 'The first maps',

    steps: Object.freeze({
        cart_recruit: Object.freeze({
            title: 'Recruit a Hero',
            says: 'Another guildmaster. Or the same one again? No matter. You will need hands.',
            instruction: 'Open the Guild Hall (purple orb, top left) and buy Bunk Beds. The first Hero is free.'
        }),
        cart_tool: Object.freeze({
            title: 'Equip a Tool',
            says: 'Bare hands move nothing. Give them a pick, or an axe. Whichever you trust.',
            instruction: 'Open the Item Bank (yellow orb) and drag a Pickaxe or a Woodaxe onto your Hero. A Hero needs the right tool in hand to mine, chop, fish or reap.'
        }),
        cart_flag: Object.freeze({
            title: 'Plant a Flag',
            says: 'Put them somewhere. Not anywhere. Somewhere with work in it.',
            instruction: 'Drag your Hero from the hero bar onto the mat, near a tree or a vein. The flag marks where they work.'
        }),
        cart_gather: Object.freeze({
            title: 'Gather',
            says: 'Wood, stone, ore. The world is written in them. Take a little back.',
            instruction: 'Let your Hero gather 3 times.'
        }),
        cart_loot: Object.freeze({
            title: 'Collect Loot',
            says: 'Things fall out of the world. Pick them up before I forget they were there.',
            instruction: 'Hover over the items on the mat to collect 10 of them.'
        }),
        cart_foundation: Object.freeze({
            title: 'Buy a Foundation',
            says: 'This hall had floors once. I am almost sure of it. Lay one down.',
            instruction: 'Open the Shop (green orb) and drag a Wood Foundation onto the mat.'
        }),
        cart_station: Object.freeze({
            title: 'Build a Station',
            says: 'A floor is only a promise. Build something on it. Something useful, mind.',
            instruction: 'Click the Wood Foundation, choose what to build, and let a Hero build it.'
        }),
        cart_craft: Object.freeze({
            title: 'Craft Something',
            says: 'Now make a thing that was not there before. That is the whole trick, really.',
            instruction: 'Click your new station, choose a recipe, and let a Hero craft it once.'
        }),
        cart_inspect: Object.freeze({
            title: 'Inspect an Old Site',
            says: 'Those old stones about the camp. I built them. Or someone like me did. Look closer.',
            instruction: 'Click one of the old sites on the mat to see what it asks for.'
        }),
        // ⚠️ A draft: the owner rewrites it at the eye-check.
        cart_copper_tool: Object.freeze({
            title: 'Make a Copper Tool',
            says: 'Copper. The first metal, or the last one I remember. Melt it down and give it an edge.',
            instruction: 'Mine copper ore, smelt it into ingots at a Furnace, then make a copper tool there: a Pickaxe, a Woodaxe or a Sickle.'
        }),
        // ⚠️ A draft: the owner rewrites it at the eye-check.
        cart_goblin: Object.freeze({
            title: 'Beat a Goblin',
            says: 'The goblins by the camp took something of mine. Maps, I think. Three of them. Fetch them back.',
            instruction: 'Give a Hero food first (drag it from the Item Bank onto them): goblins hit hard. Then plant their flag by the Goblin Camp and beat one goblin.'
        }),
        cart_settle: Object.freeze({
            title: 'Write a World',
            says: 'My maps! Had I lost them? Lay them on the table and a world writes itself.',
            instruction: 'Open the Atlas (blue orb), put a map on the Cartography table, and Settle.'
        }),
        cart_travel: Object.freeze({
            title: 'Move the Guild',
            says: 'The Hall goes where the maps say. It always has. Hold on to something.',
            instruction: 'In the Atlas, Travel to your new Region. The Starter Camp stays as you left it.'
        })
    })
});
