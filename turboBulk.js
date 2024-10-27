const puppeteer = require("puppeteer");
require("dotenv").config();
const path = require("path");
const fs = require("fs");

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

    // new folder
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("li"));
      const newFolder = items.find(
        (item) => item.textContent.trim() === "New Folder"
      );
      newFolder?.click();
    });

    // Read and increment the folder number
    const filePath = path.join(__dirname, "folderNumber.txt");
    let folderNumber = 1;

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      folderNumber = parseInt(data, 10) + 1; // Increment by 1
    }

    // Wait for the popup to appear
    await page.waitForSelector('input[name="name"]');
    await page.type('input[name="name"]', folderNumber.toString());

    await page.evaluate(() => {
      const elements = document.querySelectorAll(
        "button.dui-btn.dui-btn-primary"
      );
      let button = null;

      elements.forEach((element) => {
        if (element.textContent.includes("Create Folder")) {
          button = element;
        }
      });

      // Check if we found the Create Folder button
      if (button) {
        console.log("button found:", button.outerHTML);
        button.click();
      } else {
        console.log("button not found.");
      }
    });
    // Write the updated folder number back to folderNumber.txt
    fs.writeFileSync(filePath, folderNumber.toString(), "utf-8");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
