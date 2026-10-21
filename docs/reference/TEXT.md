# On-screen text and translation

The game will be translated (owner, 2026-10-08), so the words a player reads
live in **one strings file per language**, not inside the screens' code. The
format was picked 2026-10-20. Screens built before then still have their text
written into the code; converting them is a later pass. **Every new screen,
panel or message uses the strings file from the start.**

## Where the text lives

- `src/i18n/en.json`: English, the source every other language is translated
  from. Plain JSON, so a translator can edit it with any text editor.
- Keys are **grouped by screen**: the first level is the screen or panel
  (`settings`, `shop`, `heroPanel`), the second is the line on it. `common`
  holds the words many screens share (Close, Cancel, Back).

```json
{
    "common": { "close": "Close" },
    "shop": {
        "title": "Shop",
        "buy": "Buy {item}",
        "stock": { "one": "{count} left", "other": "{count} left" }
    }
}
```

## Using it in code

```js
import { t } from '../i18n/index.js';   // path from the file you are in

t('common.close')                 // "Close"
t('shop.buy', { item: 'Pickaxe' }) // "Buy Pickaxe"
t('shop.stock', { count: 3 })     // picks the plural form by count
```

- `{name}` in the text is filled from the second argument. A placeholder with
  no value stays visible as `{name}`, so the mistake shows on screen.
- A **plural** entry is an object of forms (`one`, `other`, and for some
  languages `few`, `many`...); the form is chosen by `count` using the
  browser's own plural rules for the current language. `other` is required.
- A **missing key** shows the key itself on screen (`shop.buy`) and logs one
  warning in the dev build, so it is noticed rather than silently blank.

## Naming keys

- **camelCase** words, dot-separated: `heroPanel.equipHint`, never
  `hero_panel.EquipHint` (a test checks the file).
- Name a key for **what the line is**, not for its English words:
  `shop.notEnoughGold`, not `shop.youCantAffordThis`. The words can then
  change without renaming the key.
- One key per sentence. Build a line from placeholders inside one text
  (`"Buy {item}"`), never by gluing translated pieces together in code:
  other languages put words in a different order.
- Write the text in normal sentence case. The **All caps** setting turns it
  into capitals on screen; don't type capitals into the file.
- Numbers keep the house format (`3/99`, `1,154`, `0:34`; see
  [`UI_STYLE.md`](UI_STYLE.md)): format them in code and pass them in as
  placeholders.

## What it does not cover

- **Game content** (Token, item, hero and skill names, descriptions, quest
  text) is authored in the CMS and lives in `data/*.json`. How content is
  translated is a separate decision, not made yet.
- Text already written into existing screens, until the conversion pass.

## Adding a second language

1. Copy `src/i18n/en.json` to `src/i18n/<code>.json` (`fr.json`, `de.json`,
   using the standard two-letter language code) and translate the values,
   never the keys. Every `.json` file in that folder is picked up as a
   language without any code change.
2. A key the new file leaves out shows the English text, so a part-translated
   file is safe to ship while translation continues.
3. Not built yet, needed for the first real second language: a language
   choice in Settings that calls `setLanguage('<code>')`, saves the choice,
   and applies it at start-up. `t()` is read when a screen draws, so a switch
   only shows once the screens draw again; the simplest is to apply the choice
   at start-up and ask for a restart.
4. Check the longest translations in the running game: German and French
   lines are often a third longer than English.

The code is `src/i18n/index.js`; its test is `src/tests/I18n.test.js`.
