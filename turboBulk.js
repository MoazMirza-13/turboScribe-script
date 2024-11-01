const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const puppeteer = require("puppeteer");
require("dotenv").config();

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

// Load service account credentials from a file
async function authorize() {
  try {
    const key = JSON.parse(fs.readFileSync("key.json")); // Load your service account key file
    const client = new google.auth.GoogleAuth({
      credentials: key,
      scopes: SCOPES,
    });

    const auth = await client.getClient();
    return auth;
  } catch (error) {
    console.log(error);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listAllFiles(auth, folderId) {
  const drive = google.drive({ version: "v3", auth });
  let allFiles = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`, // No MIME type filter
      fields: "files(id, name), nextPageToken",
      pageSize: 100, // Fetch 100 files at a time
      pageToken: pageToken, // Use pagination token
    });

    allFiles = allFiles.concat(res.data.files); // Concatenate the new files
    pageToken = res.data.nextPageToken; // Get the next page token

    // Pause for 2 seconds before the next API call
    await sleep(2000);
  } while (pageToken); // Continue fetching until there are no more pages

  // console.log(`Files retrieved from folder ID ${folderId}:`, allFiles);
  return allFiles;
}

(async () => {
  try {
    const auth = await authorize();
    const folderId = `1hcS1ftRRN_EG7GR92-ft6Y4kmbFik-_l`; // Update with your folder ID
    const allFiles = await listAllFiles(auth, folderId);
    console.log("Total Files:", allFiles.length); // Log the total number of files

    // Check file count in transcribedFiles.txt
    const transcribedFilePath = path.join(__dirname, "transcribedFiles.txt");
    let fileCount = 0;
    if (fs.existsSync(transcribedFilePath)) {
      const transcribedData = fs.readFileSync(transcribedFilePath, "utf-8");
      fileCount = transcribedData.split("\n").filter(Boolean).length;
    }
    console.log("Already Transcribed Files count: " + fileCount);

    // setup for audios and transcribed files
    const transcribedFilesPath = path.join(__dirname, "transcribedFiles.txt");

    // Read already transcribed files from .txt file
    let transcribedFiles = [];
    if (fs.existsSync(transcribedFilesPath)) {
      transcribedFiles = fs
        .readFileSync(transcribedFilesPath, "utf-8")
        .split("\n")
        .filter(Boolean);
    }

    // Use the allFiles array from Google Drive
    const audioFilesToTranscribe = allFiles
      .filter((file) => !transcribedFiles.includes(file.name)) // Ensure the file name is not transcribed
      .slice(0, 1); // Choose the number of files, testing only one file at a time

    if (audioFilesToTranscribe.length === 0) {
      console.log("No new audio files to transcribe.");
      return;
    }

    async function downloadFile(auth, fileId, filePath) {
      try {
        const drive = google.drive({ version: "v3", auth });
        const dest = fs.createWriteStream(filePath);

        await new Promise((resolve, reject) => {
          drive.files
            .get({ fileId: fileId, alt: "media" }, { responseType: "stream" })
            .then((res) => {
              res.data
                .on("end", () => {
                  console.log(`Downloaded: ${filePath}`);
                  resolve();
                })
                .on("error", (err) => {
                  console.error("Error downloading file.", err);
                  reject(err);
                })
                .pipe(dest);
            });
        });
      } catch (error) {
        console.log(error);
      }
    }

    for (const file of audioFilesToTranscribe) {
      const audioFilePath = path.join(__dirname, "audios", file.name);
      await downloadFile(auth, file.id, audioFilePath); // Download each file before proceeding
    }

    // Launch a new browser instance
    const browser = await puppeteer.launch({
      headless: true, // true if you don't want to see the browser
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

    const previousFolderPath = path.join(__dirname, "previousFolder.txt");
    // Check if previousFolder.txt exists and is empty
    let previousFolderUrl = "";
    if (fs.existsSync(previousFolderPath)) {
      previousFolderUrl = fs.readFileSync(previousFolderPath, "utf-8").trim();
    }

    // choose number of files after which a new folder will be created
    if (fileCount % 1000 === 0 || !previousFolderUrl || fileCount === 0) {
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

    for (const file of audioFilesToTranscribe) {
      const audioFilePath = path.join(__dirname, "audios", file.name); // Use full path for the downloaded file
      // Open the popup for file upload
      const popupBtn = await page.waitForSelector("span.dui-btn-primary");
      await popupBtn.click();
      console.log("Opened popup for file:", file.name);

      // Select "Urdu" from the dropdown
      await page.waitForSelector('select[name="language"]');
      await page.select('select[name="language"]', "Urdu");
      console.log("Language selected: Urdu");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Upload the file using the full local file path
      const input = await page.$('input[type="file"]');
      await input.uploadFile(audioFilePath);
      console.log("File uploaded:", file.name);

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

      console.log("File fully uploaded and recognized:", file.name);

      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Scroll to the "Transcribe" button to ensure it’s visible
      await page.$eval("button.dui-btn.dui-btn-primary.w-full", (button) => {
        button.scrollIntoView();
      });

      // Click the "Transcribe" button
      await page.click("button.dui-btn.dui-btn-primary.w-full");
      console.log("Clicked 'Transcribe' button for file:", file.name);
    }

    console.log("All files uploaded and transcribed!");

    await new Promise((resolve) => setTimeout(resolve, 5000)); // check

    // Append newly transcribed files to the .txt file
    fs.appendFileSync(
      transcribedFilesPath,
      audioFilesToTranscribe.map((file) => file.name).join("\n") + "\n" // Use the name of the files
    );

    await browser.close();

    const audiosDir = path.join(__dirname, "audios");

    // After processing all files
    fs.readdir(audiosDir, (err, files) => {
      if (err) {
        console.error(`Error reading directory: ${audiosDir}`, err);
        return;
      }
      // Delete each file in the audios directory
      files.forEach((file) => {
        const filePath = path.join(audiosDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file: ${filePath}`, err);
          } else {
            console.log(`Deleted file: ${filePath}`);
          }
        });
      });
    });
  } catch (error) {
    console.log(error);
    process.exit(1); // Terminate the script if an error occurs
  }
})();
