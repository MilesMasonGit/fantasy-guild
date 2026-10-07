// Game code logs through the shared logger at debug level, which buried a
// normal run in ~25,000 lines. Tests only need warnings and errors; a test
// that wants debug/info output can lower `logger.minLevel` itself.
import { logger } from '../../utils/Logger.js';

logger.minLevel = logger.levels.warn;
