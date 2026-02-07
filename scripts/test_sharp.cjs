const sharp = require('sharp');
// Create a small pure red image
const red = Buffer.alloc(4, 0); // Placeholder
const img = sharp({
    create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
});

async function test1() {
    try {
        console.log("Testing .quantize(64, { dither: 0 })...");
        await img.clone().quantize(16, { dither: 0 }).toBuffer();
        console.log("Success: .quantize(N, options)");
    } catch (e) {
        console.log("Failed: .quantize(N, options)", e.message);
    }
}

async function test2() {
    try {
        console.log("Testing .quantize({ colors: 64, dither: 0 })...");
        await img.clone().quantize({ colors: 16, dither: 0 }).toBuffer();
        console.log("Success: .quantize(options)");
    } catch (e) {
        console.log("Failed: .quantize(options)", e.message);
    }
}

async function run() {
    await test1();
    await test2();
}
run();
