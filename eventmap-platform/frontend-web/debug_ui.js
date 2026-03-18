const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer...');
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        page.on('console', msg => {
            console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
        });
        
        page.on('pageerror', err => {
            console.error(`[BROWSER PAGE ERROR] ${err.toString()}`);
        });

        console.log('Navigating to http://localhost:5173 (Vite default)...');
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
        
        console.log('Waiting for a few seconds to let websockets connect...');
        await new Promise(r => setTimeout(r, 5000));
        
        await browser.close();
        console.log('Done.');
    } catch(err) {
        console.error('Puppeteer Script Error:', err);
    }
})();
