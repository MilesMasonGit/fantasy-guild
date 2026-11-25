// Every word Limes says, in one place
//
// The owner reads and edits these at the eye-check. Limes is cheerful and blobby: short, warm,
// a little silly, clear words, easy to translate. Everything here is a draft until then.
//   talk     what Limes says when the player clicks it on the Starter Camp, one bubble per line
//   blurbs   what each screen's small Limes says on hover: that screen's basic mechanic
//   lessons  each lesson step's words, by where Limes says them (below)
//   moments  what Limes says once at a big moment
//   buttons  the words on the bubble's buttons
//
// A lesson step speaks through the Limes the player can see: on the Starter Camp's mat (`mat`),
// or a screen's small Limes while that screen is open (`bank`, `shop`, `guildHall`, `hallStar`,
// `worldMap`). Words for a screen make the step speak there; a step with none for the open
// screen stays with the mat's Limes. Each entry is one bubble per line (Next between them).
// The steps and what counts for each are `lessonPlan.js`. A name in braces is filled in from the
// content as Limes says it, so the words follow the ids in `LESSON_TARGETS`: {foundation} the
// Foundation, {building} Crafting's building, {craft} the craft suggested, {foe} the first foe,
// {defeatLoss} and {defeatGear} the Defeat penalty, worded from `DEFEAT_PENALTY`.

export const LIMES_TEXT = Object.freeze({
    /** Limes's name, as the bubble and the small sprites are labelled for screen readers. */
    name: 'Limes',

    talk: Object.freeze([
        'Blorp! Hello, guild master! I am Limes. I live here at the camp.',
        'Drag a hero onto a Token and they get to work. Trees give wood, bushes give berries. Easy!',
        'Lost? Look for my little face around the screens. Hover me and I explain things.',
        'You can drag me anywhere on the camp, too. I like a nice view. Blorp!'
    ]),

    blurbs: Object.freeze({
        bank: 'This is the Bank! Everything your heroes gather lands here. Drag a tool or some food onto a hero on the bar below to give it to them.',
        shop: 'The Shop! Drag a card onto the mat to buy it and place it. A Foundation becomes a building once a hero builds it.',
        worldMap: 'The world map! Your guild lives in the middle. Click a place to see what grows there, and settle new places as your guild grows.',
        guildHall: 'The Guild Hall! Each star is an upgrade. Click a star to see what it does and what it costs. Bunk Beds bring more heroes!',
        heroDrawer: 'Your hero! Here are their skills, their gear and how they fight. Drag gear from the Bank onto a slot to equip it.',
        hallStar: 'One star, lots of ranks! Each rank makes your guild a bit better. Pick a rank, check the price below, then press Upgrade. Blorp!',
        tokenCard: 'All about this Token! What it makes, the level a hero needs and what each go costs. Tokens in reach of each other can boost each other. Some have more recipes to pick, too!',
        fight: 'A fight! Your hero and the foe trade blows until one runs out of health. Hit what the foe is weak to, and bring elixirs for a tough one.',
        encyclopedia: 'The Encyclopedia! It remembers every item and Token you find. Search for anything to see where it comes from and what it is good for.',
        foundation: 'A Foundation! Place it on the mat, then send a hero to build it into a real building. Changed your mind? Drag it back here before it is built.'
    }),

    lessons: Object.freeze({
        // 1. Drag your hero to a Redberry Bush.
        bush: Object.freeze({
            mat: Object.freeze([
                'Blorp! Hello, guild master! I am Limes. Let me show you around the camp.',
                'See that red bush? Drag your hero onto it. Berries!'
            ])
        }),
        // 2. Collect (hover the loot).
        collect: Object.freeze({
            mat: Object.freeze(['Ooh, loot! What your heroes find drops on the mat. Hover over it to scoop it into the Bank.'])
        }),
        // 3. Search the scrap heap.
        heap: Object.freeze({
            mat: Object.freeze(['See that pile of junk by the Hall? Send a hero to dig through it. Old tools hide in there!'])
        }),
        // 3. Equip the woodaxe.
        axe: Object.freeze({
            mat: Object.freeze(['Trees need a woodaxe! Open the Bank, the yellow bubble, and find one.']),
            bank: Object.freeze(['There it is! Drag the Woodaxe onto your hero on the bar below.'])
        }),
        // 4. Chop wood.
        chop: Object.freeze({
            mat: Object.freeze(['Now drag your hero onto a tree. Chop chop! Wood builds almost everything.'])
        }),
        // 5. Buy Bunk Beds in the Guild Hall: a second hero.
        bunk_beds: Object.freeze({
            mat: Object.freeze(['One hero is lonely. Let us find a friend! Open the Guild Hall, the purple bubble.']),
            guildHall: Object.freeze(['Welcome to your Guild Hall! Click Bunk Beds, the glowing star.']),
            hallStar: Object.freeze(['Bunk Beds bring a new hero. Gather the wood it asks for, then press Upgrade. Blorp!'])
        }),
        // 6. Buy a Foundation...
        foundation: Object.freeze({
            mat: Object.freeze(['Time to build! Open the Shop, the green bubble.']),
            shop: Object.freeze(['Drag the {foundation} onto the mat. It is a floor for a building!'])
        }),
        // 6. ...and build Crafting's building on it.
        build: Object.freeze({
            mat: Object.freeze(['Click your Foundation and pick the {building}. Then drag a hero onto it to build it.'])
        }),
        // 7. Craft something.
        craft: Object.freeze({
            mat: Object.freeze(['A {building}! Click it, pick {craft}, then send a hero to make some. Crafting!'])
        }),
        // 8. A safe first fight: the weapon...
        weapon: Object.freeze({
            mat: Object.freeze(['Fighting time! First, open the Bank and find a sword.']),
            bank: Object.freeze(['Drag the sword onto your hero. Pointy end out!'])
        }),
        // 8. ...food...
        food: Object.freeze({
            mat: Object.freeze(['Fights make heroes hungry. Open the Bank and give your hero some food.']),
            bank: Object.freeze(['Drag some berries onto your hero. They eat when they get hurt. Yum!'])
        }),
        // 8. ...and the fight.
        fight: Object.freeze({
            mat: Object.freeze(['{defeatLoss}', '{defeatGear}', 'Now a little fight! Drag your hero onto a {foe}. You can do it!'])
        }),
        // Then the one big goal: settle a place on the world map.
        settle: Object.freeze({
            mat: Object.freeze([
                'You did it all! Blorp blorp! Now the big one: settle a new place.',
                'Open the world map, the blue bubble, and pick a place next to the camp.'
            ]),
            worldMap: Object.freeze(['This is the world! Click a place next to the camp to see what it asks for. Gather it all, then press Settle!'])
        })
    }),

    moments: Object.freeze({
        // The first place settled.
        first_settle: Object.freeze([
            'Blorp! Your first new place! The guild is growing up so fast.',
            'I will stay at the camp. Come and visit!'
        ])
    }),

    buttons: Object.freeze({
        next: 'Next',
        close: 'Close',
        /** The collapsed bubble: a click opens it again. */
        more: '…'
    })
});

/** The spots that have a small Limes with a blurb, in the order the eye-check walks them. */
export const LIMES_SPOTS = Object.freeze(Object.keys(LIMES_TEXT.blurbs));
