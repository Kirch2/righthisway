import {
  RECON_MODE,
  EMAIL,
  PASSWORD,
  TYPE_FILTER,
  SEAT_COUNT,
  lambdaStartTime,
  SCREENSHOTS,
  dateParam,
} from "./constants";
import { delay } from "./delay";
import { getPreferredReservation } from "./getPreferredReservation";
import { saveMetaToDB } from "./saveMetaToDB";
import { saveToDB } from "./saveToDB";
import { uploadToS3 } from "./uploadToS3";

export async function runScript(props: any) {
  const { page, url, takeScreenshot, ranAt } = props;

  console.log("Page Created");

  // Setup network callback
  let restaurantMeta: any = null;
  page.on("response", async (response: any) => {
    // console.log("Response callback");
    if (restaurantMeta !== null) return;

    // Get the request
    const req = response.request();

    // Get the url of the request
    const requestUrl = req.url();
    // console.log(`Response from ${requestUrl}`);

    // If the requestUrl is hitting api/v4/find -> capture response
    // if (requestUrl.includes("https://api.resy.com/4/find")) {
    if (requestUrl.includes("https://api.resy.com/")) {
      // console.log("Parsing JSON response");
      try {
        restaurantMeta = await response.json();
      } catch (e) {
        // console.log("Error parsing");
        console.log(e);
      }
      console.log("Captured restaurant metadata");
    }
  });

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
  const startMin = lambdaStartTime.getMinutes();
  const currentMin = new Date().getMinutes();
  let waitTime: number = 1;
  if (startMin === currentMin) {
    console.log("counting down to next min");
    const curSeconds: number = new Date().getSeconds();
    waitTime = (60 - curSeconds) * 1000;
    waitTime = waitTime + 2000;
  }

  console.log(`wait until next minute: ${waitTime} seconds`);
  await delay(waitTime);
  console.log("reloading page");

  await page.reload({ waitUntil: "domcontentloaded" });
  console.log("page reloaded");

  // Wait 1.0 seconds
  await delay(1000);

  // // // // //
  // // // // //
  // MAKE RESERVATION

  console.log("Scroll start");

  // Scroll down 400px
  await page.evaluate(() => {
    window.scrollBy(0, 400);
  });

  console.log("Scroll done");

  await takeScreenshot(page, "after-scroll.png");

  // Delay 1.0s
  await delay(1000);

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
    await Promise.all(SCREENSHOTS.map((path) => uploadToS3({ path, ranAt })));
    await Promise.all(
      availableReservations.map((r) => {
        return saveToDB({
          seatCount: SEAT_COUNT,
          time: r.time,
          type: r.type,
          ranAt,
        });
      })
    );
    // Save restaurant meta to database
    await saveMetaToDB({ restaurantMeta, ranAt });
    return;
  }

  await takeScreenshot(page, "before-click-selected-res.png");
  selectedReservation.button?.click();

  // Delay 5s
  await delay(2500);

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
  await delay(1500);

  await takeScreenshot(page, "before-reserve.png");
  // // // //

  // Click "Reserve" button
  const reserveButton = await page.$(".Button--primary");

  // Only click reserveButton when RECON_MODE is false
  if (RECON_MODE === false) {
    await reserveButton?.click();
  }

  console.log(`reserveButton Defined? ${String(!!reserveButton)}`);

  await delay(1000);

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
  await Promise.all(SCREENSHOTS.map((path) => uploadToS3({ path, ranAt })));

  await Promise.all(
    availableReservations.map((r) => {
      return saveToDB({
        seatCount: SEAT_COUNT,
        time: r.time,
        type: r.type,
        ranAt,
      });
    })
  );

  // Save restaurant meta to database
  await saveMetaToDB({ restaurantMeta, ranAt });

  // // // // //

  // Done message
  console.log("Done!");
}
