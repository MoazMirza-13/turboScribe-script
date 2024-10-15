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

    // Wait for the tbody to be present
    await page.waitForSelector("tbody");
    // Get the number of rows in the tbody
    const rowCount = await page.evaluate(() => {
      const tbody = document.querySelector("tbody");
      return tbody ? tbody.querySelectorAll("tr").length : 0;
    });
    console.log(`Number of rows in tbody before transcribtion: ${rowCount}`);

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

    // Wait for a new row to appear
    await page.waitForFunction(
      async (initialCount) => {
        const newRowCount = await new Promise((resolve) => {
          const tbody = document.querySelector("tbody");
          resolve(tbody ? tbody.querySelectorAll("tr").length : 0);
        });
        return newRowCount > initialCount;
      },
      { timeout: 60000 }, // Timeout after 60 seconds
      rowCount
    );

    // After waiting, get the new row count
    const newRowCount = await page.evaluate(() => {
      const tbody = document.querySelector("tbody");
      return tbody ? tbody.querySelectorAll("tr").length : 0;
    });
    console.log(`Number of rows in tbody after transcription: ${newRowCount}`);

    if (rowCount !== newRowCount) {
      // Get the first row of the table
      const firstRow = await page.$("tbody tr:first-child");

      // Wait until the SVG is present in the sixth <td> of the first row
      await page
        .waitForFunction(() => {
          const svg = document.querySelector(
            "tbody tr:first-child td:nth-child(6) svg"
          );
          return svg && svg.outerHTML.includes("text-success");
        })
        .then(() => {
          console.log("SVG is found in the sixth <td>.");
        })
        .catch(() => {
          console.log("SVG not found in the sixth <td> within the timeout.");
        });

      // Use page.click to ensure Puppeteer interacts with the dropdown button
      const buttonSelector =
        "tbody tr:first-child td:nth-child(7) .dui-dropdown.dui-dropdown-end";

      await page.waitForSelector(buttonSelector); // Ensure button is available
      await page.click(buttonSelector); // Click using Puppeteer's click function
      console.log("Dropdown should be open now.");

      // wait function for a delay
      const waitForTimeout = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await waitForTimeout(1000);

      // Use evaluate to scan the entire dropdown and click the "Export Transcript"
      const clicked = await page.evaluate(() => {
        const paragraphs = Array.from(document.querySelectorAll(".dui-menu p"));
        const exportTranscript = paragraphs.find((p) =>
          p.textContent.includes("Export Transcript")
        );

        if (exportTranscript) {
          exportTranscript.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log("Clicked on 'Export Transcript'.");
      } else {
        console.log("Export Transcript not found.");
      }

      await waitForTimeout(500);

      // Wait for the popup form to appear
      await page.waitForSelector("form.flex.flex-col.space-y-4"); // Adjust the selector if necessary

      // Wait a bit for the form to fully render
      await waitForTimeout(500);

      await page.evaluate(async () => {
        const srtCheckbox = document.querySelector('input[name="bool:srt?"]');
        if (srtCheckbox) {
          srtCheckbox.checked = true; // Select the checkbox
          console.log("Checkbox clicked");

          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Select all buttons with the specified class
          const elements = document.querySelectorAll(
            "button.dui-btn.dui-btn-primary"
          );

          let downloadButton = null;

          // Log each button's outerHTML and check for the "Download" button
          elements.forEach((element) => {
            // console.log(element.outerHTML);

            if (element.textContent.includes("Download")) {
              downloadButton = element;
            }
          });

          // Check if we found the download button
          if (downloadButton) {
            console.log("Download button found:", downloadButton.outerHTML);
            downloadButton.click();
          } else {
            console.log("Download button not found.");
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 6000)); // testing timeout for downloading
      });
    }
    await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
