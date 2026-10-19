import { wireNotifications } from '../notifications/routing.js';

// The engine's events reach the item stubs and the banners from here (`routing.js` says where each
// one goes). Imported once, for this, by `EngineBootstrap`.
wireNotifications();
