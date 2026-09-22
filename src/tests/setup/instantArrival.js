// Fantasy Guild — test setup: heroes arrive the moment they claim.
//
// Before Hero Movement M1 a hero worked a Token the instant their flag claimed
// it, and several thousand tests are written that way. Walking now sits in
// between, so every test file starts with instant arrival on. The walking tests
// (`HeroMotion.test.js`) switch it off with `setInstantArrival(false)`.
//
// ⚠️ A global marker, NOT an import of `BoardState`: a setup file that loads
// game modules loads them before the test file's `vi.mock` calls, and those
// mocks then silently fail to apply (found with TerrainPainting's mocked
// terrain switch). `BoardState` reads this marker when it loads.

globalThis.__FG_INSTANT_ARRIVAL__ = true;
