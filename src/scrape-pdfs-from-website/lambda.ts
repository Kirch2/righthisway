import * as chromium from "chrome-aws-lambda";
import { Page } from "puppeteer";
import { leftPad } from "./leftPad";
import { getDateParam } from "./getDateParam";
import {
  ENABLE_SCREENSHOTS,
  RESTAURANT_URL,
  SEAT_COUNT,
  lambdaStartTime,
  SCREENSHOTS,
} from "./constants";
import { runScript } from "./runScript";
// Start time of the lambda

// Build human-readable "ran-at" directory name
const ranAt = lambdaStartTime
  .toUTCString()
  .replace(",", "")
  .replace(/\s/g, "-")
  .toLowerCase();

// // // //

// Array to store all screenshot filepaths

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

    await runScript({ page, url, takeScreenshot, ranAt });
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
