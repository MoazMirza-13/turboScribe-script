const puppeteer = require("puppeteer");
require("dotenv").config();
const path = require("path");
const fs = require("fs");

(async () => {
  try {
    // Launch a new browser instance
    const browser = await puppeteer.launch({
      headless: false, //  true if you don't want to see the browser
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Open a new browser page
    const page = await browser.newPage();

    // Set a user agent to appear less like a bot
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36"
    );

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

    // Check file count in transcribedFiles.txt
    const transcribedFilePath = path.join(__dirname, "transcribedFiles.txt");
    let fileCount = 0;
    if (fs.existsSync(transcribedFilePath)) {
      const transcribedData = fs.readFileSync(transcribedFilePath, "utf-8");
      fileCount = transcribedData.split("\n").filter(Boolean).length;
    }
    console.log("File count: " + fileCount);

    const previousFolderPath = path.join(__dirname, "previousFolder.txt");
    // Check if previousFolder.txt exists and is empty
    let previousFolderUrl = "";
    if (fs.existsSync(previousFolderPath)) {
      previousFolderUrl = fs.readFileSync(previousFolderPath, "utf-8").trim();
    }

    // choose number of files after which a new folder will be created
    if (fileCount % 1000 === 0 || !previousFolderUrl) {
      console.log("creating a new folder...");

      // Folder number logic
      const folderFilePath = path.join(__dirname, "folderNumber.txt");
      let folderNumber = 1;

      if (fs.existsSync(folderFilePath)) {
        const data = fs.readFileSync(folderFilePath, "utf-8");
        folderNumber = parseInt(data, 10) + 1; // Increment by 1
      }

      // Folder creation
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll("li"));
        const newFolder = items.find(
          (item) => item.textContent.trim() === "New Folder"
        );
        newFolder?.click();
      });

      await page.waitForSelector('input[name="name"]');
      await page.type('input[name="name"]', folderNumber.toString());

      await page.evaluate(() => {
        const elements = document.querySelectorAll(
          "button.dui-btn.dui-btn-primary"
        );
        const button = Array.from(elements).find((element) =>
          element.textContent.includes("Create Folder")
        );
        button?.click();
      });

      // Write the updated folder number back to folderNumber.txt
      fs.writeFileSync(folderFilePath, folderNumber.toString(), "utf-8");
      await page.waitForNavigation({ waitUntil: "networkidle2" });

      // Get and save the new folder URL
      const newFolderUrl = page.url();
      fs.writeFileSync(
        path.join(__dirname, "previousFolder.txt"),
        newFolderUrl,
        "utf-8"
      );
    } else {
      // Navigate to previous folder URL if files are fewer
      console.log("navigating to previous folder...");

      if (fs.existsSync(previousFolderPath)) {
        const previousFolderUrl = fs.readFileSync(previousFolderPath, "utf-8");
        await page.goto(previousFolderUrl, { waitUntil: "networkidle2" });
        console.log("Navigated to previous folder URL:", previousFolderUrl);
      } else {
        console.log("No previous folder URL found.");
      }
    }

    //  setup for audios and transcribed files
    const transcribedFilesPath = path.join(__dirname, "transcribedFiles.txt");
    const audiosDir = path.join(__dirname, "audios");

    // Read already transcribed files from .txt file
    let transcribedFiles = [];
    if (fs.existsSync(transcribedFilesPath)) {
      transcribedFiles = fs
        .readFileSync(transcribedFilesPath, "utf-8")
        .split("\n")
        .filter(Boolean);
    }

    // Fetch audio files and filter out already transcribed ones
    const allAudioFiles = fs.readdirSync(audiosDir);
    const audioFilesToTranscribe = allAudioFiles
      .filter((file) => !transcribedFiles.includes(file))
      .slice(0, 1); // choose the number of files // testing only one file at a time

    if (audioFilesToTranscribe.length === 0) {
      console.log("No new audio files to transcribe.");
      return;
    }

    for (const file of audioFilesToTranscribe) {
      const filePath = path.join(audiosDir, file);

      // Open the popup
      const popupBtn = await page.waitForSelector("span.dui-btn-primary");
      await popupBtn.click();
      console.log("Opened popup for file:", file);

      // Select "Urdu" from the dropdown
      await page.waitForSelector('select[name="language"]');
      await page.select('select[name="language"]', "Urdu");
      console.log("Language selected: Urdu");

      // Upload the file
      await page.waitForSelector('input[type="file"]');
      const input = await page.$('input[type="file"]');
      await input.uploadFile(filePath);
      console.log("File uploaded:", file);

      // Wait for all previously uploaded files to reach completion
      await page.waitForFunction(
        () => {
          const uploads = document.querySelectorAll(
            ".dz-preview.dz-file-preview.dz-success.dz-complete[data-handle]"
          );
          return (
            uploads.length ===
            document.querySelectorAll(".dz-preview.dz-file-preview").length
          );
        },
        { timeout: 7200000 } // for test
      );

      console.log("File fully uploaded and recognized:", file);

      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Scroll to the "Transcribe" button to ensure it’s visible
      await page.$eval("button.dui-btn.dui-btn-primary.w-full", (button) => {
        button.scrollIntoView();
      });

      // Click the "Transcribe" button
      await page.click("button.dui-btn.dui-btn-primary.w-full");
      console.log("Clicked 'Transcribe' button for file:", file);
    }

    console.log("All files uploaded and transcribed!");

    await new Promise((resolve) => setTimeout(resolve, 5000)); // check

    // Append newly transcribed files to the .txt file
    fs.appendFileSync(
      transcribedFilesPath,
      audioFilesToTranscribe.join("\n") + "\n"
    );

    // curretnly turboscribe is giving "Try again later"  // you can use this code if you want to download the uploaded files in bulk

    // to download all the uploaded files after they got transcribed
    // // check all files got transcribed
    // totalFiles = audioFilesToTranscribe.length;
    // const timeoutDuration = 7200 * 1000; // 2 hours in milliseconds
    // let lastChangeTime = Date.now(); // Track the last time a change occurred

    // // Start the MutationObserver to monitor UI changes
    // await page.evaluate(() => {
    //   const observer = new MutationObserver(() => {
    //     // Notify the Node.js context that a change has occurred
    //     window.lastChangeDetected = true;
    //   });

    //   // Start observing the <tbody> element for child additions
    //   const targetNode = document.querySelector("tbody");
    //   if (targetNode) {
    //     observer.observe(targetNode, { childList: true, subtree: true });
    //   }
    // });

    // // Function to check for inactivity
    // const checkForInactivity = async () => {
    //   while (true) {
    //     await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second

    //     // Check if enough time has passed without changes
    //     if (Date.now() - lastChangeTime > timeoutDuration) {
    //       throw new Error("No UI changes detected within the timeout period.");
    //     }

    //     // Reset the last change time if a change is detected
    //     const changeDetected = await page.evaluate(
    //       () => window.lastChangeDetected
    //     );
    //     if (changeDetected) {
    //       lastChangeTime = Date.now();
    //       await page.evaluate(() => {
    //         window.lastChangeDetected = false; // Reset the flag
    //       });
    //     }
    //   }
    // };

    // // Start the inactivity check in the background
    // checkForInactivity();

    // // Function to wait for SVGs with dynamic checking
    // const waitForSVGs = async (totalFiles) => {
    //   const checkInterval = 5000; // Check every 5 seconds
    //   let allSVGsFound = false;

    //   while (!allSVGsFound) {
    //     await new Promise((resolve) => setTimeout(resolve, checkInterval));

    //     const rows = await page.evaluate(() => {
    //       const rows = Array.from(document.querySelectorAll("tbody tr"));
    //       return rows.map((row) => {
    //         const svg = row.querySelector("td:nth-child(6) svg");
    //         return svg && svg.outerHTML.includes("text-success");
    //       });
    //     });

    //     const count = rows.filter(Boolean).length;

    //     console.log(`Current SVG count: ${count}/${totalFiles}`); // Log current count
    //     if (count === totalFiles) {
    //       allSVGsFound = true; // Break the loop if all SVGs are found
    //     }
    //   }

    //   console.log("All SVGs are found for the processed files."); // Log to Node.js console
    //   await new Promise((resolve) => setTimeout(resolve, 2000));

    //   // Wait for the checkbox label, then check the checkbox
    //   await page.evaluate(() => {
    //     // Select the checkbox using its label
    //     const checkbox = document.querySelector(
    //       'thead th label input[type="checkbox"]'
    //     );
    //     if (checkbox && !checkbox.checked) {
    //       checkbox.click(); // Check the checkbox if it's not already checked
    //       console.log("checkbox clicked");
    //     }
    //   });

    //   // Select all div elements with role="link"
    //   const exportButton = await page.evaluateHandle(() => {
    //     const linkElements = document.querySelectorAll('div[role="link"]');
    //     let exportElement = null;

    //     linkElements.forEach((element) => {
    //       const span = element.querySelector("span");
    //       if (span && span.textContent.includes("Export")) {
    //         exportElement = element;
    //       }
    //     });

    //     return exportElement; // Return the element to be clicked
    //   });

    //   // Check if the export button was found, then click
    //   if (exportButton) {
    //     console.log("Export button found.");
    //     await exportButton.click();
    //   } else {
    //     console.log("Export button not found.");
    //   }
    //   await exportButton.dispose();

    //   // Wait for the checkbox to be available in the DOM
    //   const srtCheckbox = await page.waitForSelector(
    //     'input[name="bool:srt?"]',
    //     { visible: true }
    //   );
    //   // Check if the checkbox was found, then set it as checked inside the evaluate function
    //   await page.evaluate((checkbox) => {
    //     if (checkbox) {
    //       checkbox.checked = true; // Select the checkbox
    //       console.log("SRT Checkbox clicked");
    //     }
    //   }, srtCheckbox);

    //   // download
    //   await page.evaluate(async () => {
    //     const elements = document.querySelectorAll(
    //       "button.dui-btn.dui-btn-primary"
    //     );
    //     let downloadButton = null;
    //     // Log each button's outerHTML and check for the "Download" button
    //     elements.forEach((element) => {
    //       if (element.textContent.includes("Download")) {
    //         downloadButton = element;
    //       }
    //     });
    //     // Check if we found the download button
    //     if (downloadButton) {
    //       console.log("Download button found:", downloadButton.outerHTML);
    //       downloadButton.click();
    //     } else {
    //       console.log("Download button not found.");
    //     }

    //     await new Promise((resolve) => setTimeout(resolve, 10000)); // testing timeout for downloading
    //   });
    //   //
    // };

    // // Call the wait function
    // await waitForSVGs(totalFiles);

    await browser.close();
  } catch (error) {
    console.log(error);
    process.exit(1); // Terminate the script if an error occurs
  }
})();
