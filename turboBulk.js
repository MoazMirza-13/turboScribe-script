const puppeteer = require("puppeteer");
require("dotenv").config();
const path = require("path");

(async () => {
  try {
    // Launch a new browser instance
    const browser = await puppeteer.launch({
      headless: false, //  true if you don't want to see the browser
    });

    // Open a new browser page
    const page = await browser.newPage();

    // Navigate to the login page
    await page.goto("https://turboscribe.ai/login", {
      waitUntil: "networkidle2",
    });
    await page.setViewport({
      width: 800,
      height: 800,
    });

    // Wait for the email input field to appear
    await page.waitForSelector('input[name="email"]');
    // Fill the email and password fields
    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Log a message after successful login
    console.log("Logged in successfully!");

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
