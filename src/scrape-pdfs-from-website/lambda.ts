import * as chromium from "chrome-aws-lambda";
import * as fs from "fs";
import * as AWS from "aws-sdk";
import { Page } from "puppeteer";
import { getPreferredReservation } from "./getPreferredReservation";
const s3obj = new AWS.S3();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
const EMAIL = process.env.EMAIL || "";
const PASSWORD = process.env.PASSWORD || "";
const SEAT_COUNT = process.env.SEAT_COUNT || "4";
const LOOK_AHEAD_DAY_COUNT: number = Number(process.env.LOOK_AHEAD_DAY_COUNT);
const TYPE_FILTER = process.env.TYPE_FILTER || "";
const RECON_MODE: boolean = process.env.RECON_MODE === "TRUE";
const ENABLE_SCREENSHOTS: boolean = process.env.ENABLE_SCREENSHOTS === "TRUE";
const RESTAURANT_URL =
  process.env.RESTAURANT_URL || "https://resy.com/cities/ny/stk-meatpacking";

// Start time of the lambda
const lambdaStartTime = new Date();

// // // //

// Define "delay" function
function delay(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, timeout);
  });
}

// // // //

// Array to store all screenshot filepaths
const SCREENSHOTS: string[] = [];

function uploadToS3(props: { path: string }) {
  const filepath = props.path;

  // We want
  // - restaurant-name/getDateParam()/seat-count/start-time/screenshot.png

  // 1 - get name of the screenshot.png
  // Takes "/tmp/file.png" and makes "file.png"
  const filename = filepath.replace("/tmp/", "");
  const restaurantName = RESTAURANT_URL.replace(
    "https://resy.com/cities/ny/",
    ""
  );

  // Build human-readable "ran-at" directory name
  const ranAt = lambdaStartTime
    .toUTCString()
    .replace(",", "")
    .replace(/\s/g, "-")
    .toLowerCase();

  // TODO - build this string
  const destinationPath = `${restaurantName}/${getDateParam()}/${SEAT_COUNT}-top/${ranAt}/${filename}`;

  // Saves new file to S3
  return new Promise((resolve, reject) => {
    s3obj
      .upload({
        Bucket: S3_BUCKET_NAME,
        Key: destinationPath,
        Body: fs.readFileSync(filepath),
      })
      .send((err, data) => {
        console.log(err, data);
        // Logs error
        if (err) {
          console.log(`upload-file --> ERROR`);
          console.log(err);
          reject(err);
          return;
        }
        console.log(`upload-file --> SUCCESS --> ${filepath}`);
        resolve(true);
      });
  });
}

function takeScreenshot(page: Page, filename: string) {
  if (ENABLE_SCREENSHOTS === false) {
    return;
  }
  // builds filepath -> `/tmp/01-page-loaded.png`
  const filepath = `/tmp/${leftPad(SCREENSHOTS.length + 1)}-${filename}`;
  SCREENSHOTS.push(filepath);
  console.log(`takeScreenshot: ${filepath}`);
  return page.screenshot({ path: filepath });
}

// // // //

function leftPad(num: number) {
  if (num < 10) {
    return `0${num}`;
  }
  return String(num);
}

function getDateParam() {
  const lookAheadms = LOOK_AHEAD_DAY_COUNT * 24 * 60 * 60 * 1000;
  const utcOffset = 5 * 60 * 60 * 1000;
  const reservationDate = new Date(
    Number(new Date()) + lookAheadms - utcOffset
  );
  const month = reservationDate.getUTCMonth() + 1;
  const day = reservationDate.getUTCDate();
  const year = reservationDate.getUTCFullYear();
  const dateParam = `${year}-${leftPad(month)}-${leftPad(day)}`;
  return dateParam;
}

// // // //

export const handler = async (
  event: any = {},
  context: any = {}
): Promise<any> => {
  // Log start message
  console.log("scrape-pdfs-from-website -> start");
  console.log(event);

  // Defines the start URL for the script
  // const url = "https://resy.com/cities/ny/raoulsrestaurant?date=2022-02-18&seats=4";
  const dateParam = getDateParam();
  const url = `${RESTAURANT_URL}?date=${dateParam}&seats=${SEAT_COUNT}`;

  // Log URL
  console.log("url");

  console.log(url);

  console.log("dateParam");
  console.log(dateParam);

  // Define
  let result = null;
  let browser = null;

  try {
    // Defines browser
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    // Defines page
    let page = await browser.newPage();

    console.log("Page Created");

    // console.log("10 second delay start");
    // delay(10 * 1000);
    // console.log("10 second delay end");

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Delay 4 seconds
    await delay(4000);

    await takeScreenshot(page, "page-load.png");

    // Log "loaded" message
    console.log("First Page Loaded");

    // // // // //
    // // // // //
    // LOGIN

    // SKIP LOGIN if RECON_MODE === TRUE
    if (RECON_MODE === false) {
      // Click "login" button
      await page.click(".Button--login");

      // Delay 1.5s
      await delay(1500);

      // Click "Login with email + password" button
      await page.click(".AuthView__Footer > Button");

      // Delay + type email
      await delay(250);
      await page.type("#email", EMAIL);

      // Delay + type password
      await delay(1000);
      await page.type("#password", PASSWORD);

      // Click login button
      const loginButton = await page.$(".Button--primary");
      await loginButton?.click();
      console.log(`Login Button Found? ${String(!!loginButton)}`);

      console.log("LoggedIn!");

      await takeScreenshot(page, "after-login.png");

      await delay(2000);
    }

    // // // // //

    // wait for next minute

    const curSeconds: number = new Date().getSeconds();
    const waitTime: number = 60 - curSeconds;
    console.log(`wait until next minute: ${waitTime} seconds`);
    await delay(waitTime);
    console.log("reloading page");

    await page.reload();

    // Wait 1.5 seconds

    await delay(1500);

    // // // // //
    // // // // //
    // MAKE RESERVATION

    console.log("Scroll start");

    // Scroll down 800px
    await page.evaluate(() => {
      window.scrollBy(0, 400);
    });

    console.log("Scroll done");

    await takeScreenshot(page, "after-scroll.png");

    // Delay 2.5s
    await delay(2500);

    console.log("Start reservation lookup");
    const availableReservations: any[] = [];
    const reservationButtons = await page.$$("resy-reservation-button");

    console.log(reservationButtons.length + " reservations available");

    await Promise.all(
      reservationButtons.map((el: any) => {
        return new Promise(async (resolve) => {
          // console.log(el);
          const type = await el.$eval(".type", (node: any) => node.innerHTML);
          const time = await el.$eval(".time", (node: any) => node.innerHTML);
          console.log(time + ": " + type);
          const availableReservation = { type, time, button: el };
          availableReservations.push(availableReservation);
          resolve(true);
        });
      })
    );

    const selectedReservation = getPreferredReservation(
      availableReservations,
      TYPE_FILTER,
      RECON_MODE
    );
    if (!selectedReservation) {
      console.log("no available reservations");
      // Upload all screenshots to S3
      await Promise.all(SCREENSHOTS.map((path) => uploadToS3({ path })));
      return;
    }

    await takeScreenshot(page, "before-click-selected-res.png");
    selectedReservation.button?.click();

    // Delay 5s
    await delay(5000);

    await takeScreenshot(page, "after-delay.png");

    // Actually make the reservation
    // Short-circuit IFF RECON_MODE === TRUE
    // Get the source of the desired iframe
    const iframeSrc = await page.evaluate(
      `Array.from(document.querySelectorAll('iframe')).map(f => f.getAttribute("src")).find(f => f.includes("https://widgets.resy.com"))`
    );

    if (typeof iframeSrc !== "string") {
      console.log("Iframe Source -> not found, or not a string");
      console.log(iframeSrc);
      return;
    }

    console.log("iframeSrc");
    console.log(iframeSrc);

    // Naviagate to reserve page
    await page.goto(iframeSrc, { waitUntil: "domcontentloaded" });
    console.log("Navigated to reserve page");

    // Wait 3x
    await delay(3000);

    await takeScreenshot(page, "before-reserve.png");
    // // // //

    // Click "Reserve" button
    const reserveButton = await page.$(".Button--primary");

    // Only click reserveButton when RECON_MODE is false
    if (RECON_MODE === false) {
      await reserveButton?.click();
    }

    console.log(`reserveButton Defined? ${String(!!reserveButton)}`);

    await delay(2000);

    await takeScreenshot(page, "before-confirm.png");

    // Click "Confirm" button
    const confirmButton = await page.$(".Button--double-confirm");
    await confirmButton?.click();
    console.log(`ConfirmButton Defined? ${String(!!confirmButton)}`);
    console.log("Reservation confirmed!");

    await takeScreenshot(page, "after-confirm.png");

    console.log("Start delay");
    await delay(4000);
    console.log("End delay");

    // Log "reserving" message
    console.log(
      `Reserving: table for ${SEAT_COUNT} at ${selectedReservation.time} on ${dateParam}`
    );

    await takeScreenshot(page, "after-reservation.png");

    // // // // //

    // Upload all screenshots to S3
    await Promise.all(SCREENSHOTS.map((path) => uploadToS3({ path })));

    // // // // //

    // Done message
    console.log("Done!");
  } catch (error) {
    return context.fail(error);
  } finally {
    // Close the puppeteer browser
    if (browser !== null) {
      await browser.close();
    }
  }

  // Logs "shutdown" statement
  console.log("scrape-pdfs-from-website -> shutdown");
  return context.succeed(result);
};
