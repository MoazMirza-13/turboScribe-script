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

    // Wait for the email input field to appear
    await page.waitForSelector('input[name="email"]');
    // Fill the email and password fields
    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Log a message after successful login
    console.log("Logged in successfully!");

    // Click the "Transcribe Files" button // open popup
    await page.click("span.dui-btn-primary");
    console.log("Clicked the 'Transcribe Files' button!");

    // Select "Urdu" from the dropdown
    await page.waitForSelector('select[name="language"]');
    await page.select('select[name="language"]', "Urdu");
    console.log("Language selected: Urdu");

    // Wait for the file input field to appear
    await page.waitForSelector('input[type="file"]');
    const filePath = path.resolve(__dirname, "Recording.m4a");
    // Upload the file
    const input = await page.$('input[type="file"]');
    await input.uploadFile(filePath);
    console.log("File uploaded!");

    // Wait for the file to be fully uploaded by checking the "100%" indicator
    await page.waitForFunction(
      () => {
        const progress = document.querySelector(
          "[data-dz-uploadprogress-percentage]"
        );
        return (
          progress &&
          progress.innerText === "100%" &&
          progress.style.display === "none"
        );
      }
      // { timeout: 60000 }  // Set a timeout in case the upload takes longer or to catch the error
    );
    console.log("File fully uploaded and recognized!");

    await page.click("button.dui-btn.dui-btn-primary.w-full"); // transcribe btn
    console.log("Clicked the 'Transcribe' button!");

    // Close browser after operation (comment out during development)
    // await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
