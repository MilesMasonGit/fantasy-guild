import { CARDS } from './src/config/registries/cardRegistry.js';
console.log("Loaded cards count:", Object.keys(CARDS).length);
console.log("Is wheat_field present?:", !!CARDS['wheat_field']);
if (CARDS['wheat_field']) {
    console.log("Wheat field card def:", CARDS['wheat_field']);
} else {
    console.log("Sample keys:", Object.keys(CARDS).slice(0, 10));
}
