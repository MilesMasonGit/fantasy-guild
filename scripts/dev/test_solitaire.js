import puppeteer from 'puppeteer';

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Navigating to game...');
    await page.goto('http://localhost:5173');

    console.log('Waiting for load...');
    await page.waitForTimeout(2000);

    console.log('Injecting test state...');
    await page.evaluate(() => {
        // Find the "Explore Abandoned Guild Hall" card
        const cardArea = document.querySelector('.card-stack');
        if (!cardArea) return;

        // Let's spawn a hero and manually attach it to the first active card's stack
        window.CardManager = window.__CardManager || window.CardManager;
        window.HeroManager = window.__HeroManager || window.HeroManager;
        window.GameState = window.__GameState || window.GameState;

        if (window.GameState && window.GameState.cards && window.GameState.cards.active.length > 0) {
            const exploreCard = window.GameState.cards.active.find(c => c.templateId === 'explore_abandoned_guild_hall');

            if (exploreCard) {
                // Mock a hero if one doesn't exist
                const testHero = {
                    id: 'hero_test_1',
                    name: 'Sir Ghalon',
                    icon: '🧔',
                    energy: 8,
                    maxEnergy: 10,
                    status: 'idle'
                };

                // Add to GameState
                if (!window.GameState.heroes) window.GameState.heroes = [];
                window.GameState.heroes.push(testHero);

                // Assign to stack
                if (!exploreCard.stack) exploreCard.stack = [];
                exploreCard.stack.push({ type: 'hero', id: testHero.id });

                // Force a UI refresh
                const uiModule = window.__UI || window.CenterPanel;
                if (window.updateCardStack) {
                    window.updateCardStack();
                } else if (window.EventBus) {
                    window.EventBus.publish('cards_updated');
                }
            }
        }
    });

    console.log('Waiting for render...');
    await page.waitForTimeout(1000);

    const screenshotPath = 'c:\\Users\\16048\\.gemini\\antigravity\\brain\\3a4b41e6-3daf-412a-86cf-7b36577aa0ca\\solitaire_visual_test.png';
    console.log('Taking screenshot...');
    await page.screenshot({ path: screenshotPath });

    console.log(`Saved screenshot to ${screenshotPath}`);
    await browser.close();
})();
