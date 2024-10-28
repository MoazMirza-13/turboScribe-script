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

    // Click the "Transcribe Files" button // open popup
    await page.click("span.dui-btn-primary");
    console.log("Clicked the 'Transcribe Files' button!");

    // Select "Urdu" from the dropdown
    await page.waitForSelector('select[name="language"]');
    await page.select('select[name="language"]', "Urdu");
    console.log("Language selected: Urdu");

    const transcribedFilesPath = path.join(__dirname, "transcribedFiles.txt");

    // Read already transcribed files from .txt file
    let transcribedFiles = [];
    if (fs.existsSync(transcribedFilesPath)) {
      transcribedFiles = fs
        .readFileSync(transcribedFilesPath, "utf-8")
        .split("\n")
        .filter(Boolean);
    }

    // Fetch audio files and filter out already transcribed ones
    const audiosDir = path.join(__dirname, "audios");
    const allAudioFiles = fs.readdirSync(audiosDir);
    const audioFilesToTranscribe = allAudioFiles
      .filter((file) => !transcribedFiles.includes(file))
      .slice(0, 10); // files that are not in transcribedFiles

    if (audioFilesToTranscribe.length === 0) {
      console.log("No new audio files to transcribe.");
      return;
    }

    if (allAudioFiles.length === 0) {
      throw new Error("No audio files found in the 'audios' directory.");
    }

    // Iterate over each file and upload it sequentially
    for (const file of audioFilesToTranscribe) {
      const filePath = path.join(audiosDir, file);
      console.log(`Uploading file: ${filePath}`);

      await page.waitForSelector('input[type="file"]');
      const input = await page.$('input[type="file"]');
      await input.uploadFile(filePath);
      console.log(`File uploaded: ${file}`);

      // Wait for upload and recognition completion
      await page.waitForFunction(() => {
        const progress = document.querySelector(
          "[data-dz-uploadprogress-percentage]"
        );
        return (
          progress &&
          progress.innerText === "100%" &&
          progress.style.display === "none"
        );
      });
      console.log(`File fully uploaded and recognized: ${file}`);
    }

    // Wait until all files have uploaded
    const totalFiles = audioFilesToTranscribe.length;

    await page.waitForFunction(
      (totalFiles) => {
        const completedUploads = document.querySelectorAll(
          "[data-dz-uploadprogress-percentage]"
        );
        const completedCount = Array.from(completedUploads).filter(
          (progress) => {
            return (
              progress.innerText === "100%" && progress.style.display === "none"
            );
          }
        ).length;

        console.log(`Completed uploads: ${completedCount}/${totalFiles}`); // Log the count of completed uploads
        return completedCount === totalFiles; // Ensure all files are completed
      },
      {},
      totalFiles
    );

    console.log("All files fully uploaded!");

    // Scroll to the "Transcribe" button to make sure it's visible
    await page.$eval("button.dui-btn.dui-btn-primary.w-full", (button) => {
      button.scrollIntoView();
    });

    // Now click the "Transcribe" button
    await page.click("button.dui-btn.dui-btn-primary.w-full"); // transcribe btn
    console.log("Clicked the 'Transcribe' button!");

    // Append newly transcribed files to the .txt file
    fs.appendFileSync(
      transcribedFilesPath,
      audioFilesToTranscribe.join("\n") + "\n"
    );

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
