// Drag system constants: the shared vocabulary of the pointer-tracked drag-and-drop built on
// dnd-kit (see DndKit.jsx): payload kinds, the surfaces the pointer can be over (drives the
// 'bloom' ghost), and the SFX clip names (all already present in AudioSystem's map).

/** Payload kinds a draggable can carry. */
export const DRAG_KIND = {
    /** A board object: dragged to or from the mat, or straight off a loot sprite. */
    TOKEN: 'token',
    HERO: 'hero',
    ITEM: 'item',
    /**
     * A hero's flag: moves the flag. Carries `heroId`. Started by the flag itself **or by a
     * hero on the board**: the player never moves a hero. Dropping it on the Dock recalls.
     * `HERO` is only a hero carried out of the Dock or the hero sheet.
     */
    FLAG: 'flag'
};

/**
 * Surfaces the pointer can hover over during a drag. Containers tag themselves with
 * `data-dnd-surface="drawer|board"`; the provider hit-tests the pointer against the nearest
 * tagged ancestor each move.
 */
export const DND_SURFACE = {
    DRAWER: 'drawer',
    BOARD: 'board'
};

/**
 * SFX clips (keys into AudioSystem._getSfxPath). Fired via the `audio:play` EventBus channel.
 * There's no dedicated 'error' clip, so invalid reuses the soft cloth `unassign` sound.
 */
export const DRAG_SFX = {
    pickup: 'drag',
    invalid: 'unassign',
    dropDefault: 'drop',
    dropByKind: {
        // Tokens are weighty physical objects resting on a surface, so
        // they reuse the solid card-place thunk rather than a light click.
        [DRAG_KIND.TOKEN]: 'card_place',
        [DRAG_KIND.HERO]: 'hero_assign',
        [DRAG_KIND.FLAG]: 'hero_assign',
        [DRAG_KIND.ITEM]: 'item_equip'
    }
};
