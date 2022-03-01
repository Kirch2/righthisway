import * as chromium from "chrome-aws-lambda";
const EMAIL = process.env.EMAIL || "";
const PASSWORD = process.env.PASSWORD || "";
const SEAT_COUNT = process.env.SEAT_COUNT || "4";
const TYPE_FILTER = process.env.TYPE_FILTER || "Indoor";
const RESTAURANT_URL =
  process.env.RESTAURANT_URL || "https://resy.com/cities/ny/stk-meatpacking";

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

function leftPad(num: number) {
  if (num < 10) {
    return `0${num}`;
  }
  return String(num);
}

function getDateParam() {
  const oneWeekms = 7 * 24 * 60 * 60 * 1000;
  const utcOffset = 5 * 60 * 60 * 1000;
  const oneWeekFromNow = new Date(Number(new Date()) + oneWeekms - utcOffset);
  const month = oneWeekFromNow.getUTCMonth() + 1;
  const day = oneWeekFromNow.getUTCDate();
  const year = oneWeekFromNow.getUTCFullYear();
  const dateParam = `${year}-${leftPad(month)}-${leftPad(day)}`;
  return dateParam;
}

// // // //

const preferredTimes = ["9:00PM", "9:15PM", "9:30PM", "9:45PM", "10:00PM"];

function getPreferredReservation(allReservations: any[]) {
  const matchesTypePreference = allReservations.filter(
    (r) => r.type === TYPE_FILTER
  );

  let preferredReservation: any = undefined;
  preferredTimes.forEach((t) => {
    if (preferredReservation !== undefined) {
      return;
    }
    preferredReservation = matchesTypePreference.find((r) => r.time === t);
  });

  return preferredReservation;
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

    console.log("15 second delay start");
    delay(15 * 1000);
    console.log("15 second delay end");

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Delay 5 seconds
    await delay(5000);

    // Log "loaded" message
    console.log("First Page Loaded");

    // // // // //
    // // // // //
    // LOGIN

    // Click "login" button
    await page.click(".Button--login");

    // Delay 2s
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

    await delay(3000);

    // // // // //
    // // // // //
    // MAKE RESERVATION

    console.log("Scroll start");

    // Scroll down 600px
    await page.evaluate(() => {
      window.scrollBy(0, 800);
    });

    console.log("Scroll done");

    // Delay 3s
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

    const selectedReservation = getPreferredReservation(availableReservations);
    if (!selectedReservation) {
      console.log("no available reservations");
      return;
    }
    selectedReservation.button.click();

    //////////////

    // Delay 5s
    await delay(5000);

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

    // Wait 5x
    await delay(5000);

    // // // //

    // Click "Reserve" button
    const reserveButton = await page.$(".Button--primary");
    await reserveButton?.click();
    console.log(`reserveButton Defined? ${String(!!reserveButton)}`);

    await delay(3000);

    // Click "Confirm" button
    // UNCOMMENT THIS FOR LIVE FIRE
    const confirmButton = await page.$(".Button--double-confirm");
    await confirmButton?.click();
    console.log(`ConfirmButton Defined? ${String(!!confirmButton)}`);
    console.log("Reservation confirmed!");

    console.log("Start delay");
    await delay(5000);
    console.log("End delay");

    // Log "reserving" message
    console.log(
      `Reserving: table for ${SEAT_COUNT} at ${selectedReservation.time} on ${dateParam}`
    );

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
