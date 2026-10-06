// Fantasy Guild — test setup: heroes arrive the moment they claim.
//
// ⚠️ A global marker, NOT an import of `BoardState`: a setup file that loads
// game modules loads them before the test file's `vi.mock` calls, and those
// mocks then silently fail to apply (found with TerrainPainting's mocked
// terrain switch). `BoardState` reads this marker when it loads.

globalThis.__FG_INSTANT_ARRIVAL__ = true;
