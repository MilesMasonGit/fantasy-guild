# Fantasy Guild - Code Style Guide

## Module Export Patterns

**Use these conventions for new code:**

### Stateless Utilities → Named Exports
```javascript
// ✅ Good - utilities/helpers
export function formatTime(ms) { ... }
export function calculateXP(level) { ... }
```

### Stateful Systems → Singleton Objects
```javascript
// ✅ Good - systems with state (init, internal tracking)
export const InventoryManager = {
    _cache: null,
    init() { ... },
    addItem(id, amount) { ... }
};
```

### Data Registries → Named Exports + Lookup Functions
```javascript
// ✅ Good - static game data
export const CARD_TEMPLATES = { ... };
export function getCard(id) { return CARD_TEMPLATES[id]; }
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | PascalCase | `HeroManager.js` |
| Functions | camelCase | `getHero()` |
| Constants | UPPER_SNAKE | `MAX_ENERGY` |
| Private | _prefixed | `_displayCache` |

---

## Import Style

```javascript
// ✅ Preferred
import { getHero, createHero } from '../hero/HeroManager.js';
import { TICK_INTERVAL_MS } from '../../config/constants.js';

// ⚠️ Only when needed (many functions)
import * as HeroManager from '../hero/HeroManager.js';
```

---

## Comments

- Use JSDoc for public functions
- Skip obvious comments
- Use `// TODO:` for future work
