const puppeteer = require("puppeteer");
require("dotenv").config();

(async () => {
  try {
    // Launch a new browser instance
    const browser = await puppeteer.launch({
      headless: false, // Set to true if you don't want to see the browser
    });

    // Open a new browser page
    const page = await browser.newPage();

    // Navigate to the login page
    await page.goto("https://turboscribe.ai/login", {
      waitUntil: "networkidle2",
    });

    // Wait for the email input field to appear
    await page.waitForSelector('input[name="email"]');

    // Fill the email and password fields
    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);

    // Click the "Log In" button
    await page.click('button[type="submit"]');

    // Optionally, wait for navigation to complete
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Log a message after successful login
    console.log("Logged in successfully!");

    // Close browser after operation (comment out during development)
    // await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
