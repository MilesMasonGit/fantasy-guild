import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('BROWSER ERROR:', msg.text());
        } else {
            console.log('BROWSER LOG:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('BROWSER PAGE ERROR:', err.message);
    });

    console.log("Navigating to localhost:5173...");
    await page.goto('http://localhost:5173');

    console.log("Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Extracting active cards from GameState...");
    try {
        const activeCount = await page.evaluate(() => {
            return window._GameState ? window._GameState.cards.active.length : -1;
        });
        console.log("Active cards count:", activeCount);
    } catch (e) {
        console.error("Could not read GameState");
    }

    await browser.close();
    console.log("Done.");
})();
