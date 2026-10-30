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
            says: 'Bare hands move nothing. Give them an axe. The trees will not wait for ever.',
            instruction: 'Open the Item Bank (yellow orb) and drag the Woodaxe onto your Hero. A Hero needs the right tool in hand to chop, mine, fish or reap.'
        }),
        cart_flag: Object.freeze({
            title: 'Send Your Hero to a Tree',
            says: 'A tree. Any tree. Point them at it, and the wood will follow.',
            instruction: 'Drag your Hero (on the mat, or from the hero bar) onto a tree. They walk there and chop it.'
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
            instruction: 'Click the Wood Foundation, choose what to build, then drag a Hero onto it to build it.'
        }),
        cart_craft: Object.freeze({
            title: 'Craft Something',
            says: 'Now make a thing that was not there before. That is the whole trick, really.',
            instruction: 'Click your new station, choose a recipe, then drag a Hero onto it to craft it once.'
        }),
        cart_camp: Object.freeze({
            title: 'Build a Camp',
            says: 'One tree at a time? The forest will outlive you. Build them a camp among the trees.',
            instruction: 'Put a Wood Foundation near some trees, click it, choose the Logging Camp, and drag a Hero onto it to build it. Then drag a Hero onto the camp: they chop every tree around it, one after another.'
        }),
        // ⚠️ A draft: the owner rewrites it at the eye-check.
        cart_copper_tool: Object.freeze({
            title: 'Make a Copper Tool',
            says: 'Copper. The first metal, or the last one I remember. Melt it down and give it an edge.',
            instruction: 'Mine copper ore and smelt it into ingots at a Furnace. Then make a Copper Pickaxe or a Copper Woodaxe at a Copper Smithy.'
        }),
        // ⚠️ A draft: the owner rewrites it at the eye-check.
        cart_goblin: Object.freeze({
            title: 'Beat a Goblin',
            says: 'The goblins by the camp took something of mine. Maps, I think. Three of them. Fetch them back.',
            instruction: 'Give a Hero food first (drag it from the Item Bank onto them): goblins hit hard. Then drag the Hero onto a goblin by the Goblin Camp and beat it.'
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
