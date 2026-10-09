// Fantasy Guild — test helper: which components rendered, by name, while counting.
//
// ⚠️ Import this before anything that imports React: it stands in for React DevTools, which
// React tells about every commit it makes, and React only looks for it as it loads.
//
// A component counts once for each commit it rendered in (its function ran), not for commits
// it sat out; a memoised component that bailed out does not count. Memo components count under
// their inner function's name.

const counts = new Map();
let counting = false;

// The bundler renames a memo's inner function that shares its outer name (`MatToken2`).
const plain = (name) => (name ? name.replace(/\d+$/, '') : null);

function nameOf(fiber) {
    const t = fiber.elementType ?? fiber.type;
    if (!t) return null;
    if (typeof t === 'function') return plain(t.displayName || t.name);
    const inner = t.type || t.render;
    if (typeof inner === 'function') return plain(inner.displayName || inner.name);
    return null;
}

// Function, class, forwardRef, memo and simple-memo fibers.
const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
// React marks a fiber whose render function ran in this commit.
const PERFORMED_WORK = 1;

function visit(fiber, mounting) {
    const prev = fiber.alternate;
    if (COMPONENT_TAGS.has(fiber.tag) && (mounting || !prev || (fiber.flags & PERFORMED_WORK))) {
        const name = nameOf(fiber);
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    // A subtree React did not touch keeps the children of the last commit: skip it.
    if (mounting || !prev) {
        for (let c = fiber.child; c; c = c.sibling) visit(c, true);
    } else if (fiber.child !== prev.child) {
        for (let c = fiber.child; c; c = c.sibling) visit(c, !c.alternate);
    }
}

globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    isDisabled: false,
    checkDCE() {},
    inject(renderer) {
        const id = this.renderers.size + 1;
        this.renderers.set(id, renderer);
        return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    onCommitFiberRoot(_id, root) {
        if (!counting) return;
        for (let c = root.current.child; c; c = c.sibling) visit(c, !c.alternate);
    }
};

export const renders = {
    /** Start counting from zero. */
    start() { counts.clear(); counting = true; },
    stop() { counting = false; },
    /** How many commits `name` rendered in since `start`. */
    of(name) { return counts.get(name) || 0; },
    /** Every name counted since `start`, for a failing test to show. */
    all() { return Object.fromEntries(counts); }
};
