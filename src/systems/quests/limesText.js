// Fantasy Guild - every word Limes says, in one place
//
// The owner reads and edits these at the eye-check. Limes is cheerful and blobby: short, warm,
// a little silly, clear words, easy to translate. Everything here is a placeholder until then.
//   talk     what Limes says when the player clicks it on the Starter Camp, one bubble per line
//   blurbs   what each screen's small Limes says on hover: that screen's basic mechanic
//   buttons  the words on the bubble's buttons
// The lessons' own words are not here: they come with the lessons.

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

    buttons: Object.freeze({
        next: 'Next',
        close: 'Close',
        /** The collapsed bubble: a click opens it again. */
        more: '…'
    })
});

/** The spots that have a small Limes with a blurb, in the order the eye-check walks them. */
export const LIMES_SPOTS = Object.freeze(Object.keys(LIMES_TEXT.blurbs));
