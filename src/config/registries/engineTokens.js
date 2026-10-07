// Fantasy Guild — Engine-owned Token types

/**
 * ⭐ **Token types the engine owns, defined in code rather than in `data/`.**
 *
 * The one member is the **quest Token**. Quests are
 * Tokens on the mat now, spawned by the Guild Hall (`QuestTokens.js`); what a
 * quest asks and pays lives on the instance (`instance.quest`), so the type
 * itself holds nothing a designer would tune.
 *
 * ## Why not in `data/tokens.json`
 * The CMS is the only authoring surface for `data/`, and its one-way sync
 * destroys whatever it does not model. This type is never
 * authored, so it never enters `data/`, and the CMS never sees it.
 *
 * ## Kept out of the content set on purpose
 * `tokenRegistry.getTokenType(id)` (and the readers built on it: names,
 * sprites, starting charges, the saved-game check) falls back to this table,
 * so an instance on the mat resolves like any Token. But `TOKENS`,
 * `getAllTokenTypes()` and `listTokenTypeIds()` stay **content only**: the
 * content audits (`ContentAudit`, `ContentRules`, `TerrainRegistry`'s "accounts
 * for all N Tokens"), the Shop's listing and the economic simulator walk those,
 * and an engine type is none of their business — it has no terrain, no price,
 * no recipe and no work.
 *
 * ⚠️ A content Token may not take one of these ids: the content one would win
 * in `TOKENS`, and the engine would lose its type. `QuestTokens.test.js` pins
 * that no shipped Token does.
 */

/** The quest Token's type id. */
export const QUEST_TOKEN_TYPE = 'token_quest';

export const ENGINE_TOKEN_TYPES = Object.freeze({
    [QUEST_TOKEN_TYPE]: Object.freeze({
        id: QUEST_TOKEN_TYPE,
        name: 'Quest',
        description: 'A notice from the Guild Hall. Do what it asks, then click it to claim the reward.',
        // A full path: `resolveSpritePath` returns an `assets/…` path as is,
        // so no manifest entry is needed.
        sprite: 'assets/ui/quest_board.png',
        tokenType: 'quest',
        rarity: 'common',
        tier: 1,
        tags: [],
        size: 1,
        // Unlimited: a quest is not worn down, it is claimed (and then removed).
        uses: null,
        // No hero works a quest. No `config`, so
        // it has no work at all; `requiresHero: false` makes that explicit to
        // the readers that check it (`Flags`, `workSkillRule`).
        requiresHero: false,
        config: null,
        engineOwned: true
    })
});

/** An engine-owned Token type by id, or null. */
export function engineTokenType(typeId) {
    return ENGINE_TOKEN_TYPES[typeId] || null;
}
