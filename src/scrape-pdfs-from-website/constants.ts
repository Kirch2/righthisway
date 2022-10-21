import * as AWS from "aws-sdk";
export const s3obj = new AWS.S3();
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
export const EMAIL = process.env.EMAIL || "";
export const db = new AWS.DynamoDB.DocumentClient();
export const TABLE_NAME = process.env.TABLE_NAME || "";
export const PRIMARY_KEY = process.env.PRIMARY_KEY || "";
export const PASSWORD = process.env.PASSWORD || "";
export const SEAT_COUNT = process.env.SEAT_COUNT || "4";
export const LOOK_AHEAD_DAY_COUNT: number = Number(
  process.env.LOOK_AHEAD_DAY_COUNT
);
export const TYPE_FILTER = process.env.TYPE_FILTER || "";
export const RECON_MODE: boolean = process.env.RECON_MODE === "TRUE";
export const ENABLE_SCREENSHOTS: boolean =
  process.env.ENABLE_SCREENSHOTS === "TRUE";
export const RESTAURANT_URL =
  process.env.RESTAURANT_URL || "https://resy.com/cities/ny/stk-meatpacking";
export const lambdaStartTime = new Date();
export const SCREENSHOTS: string[] = [];

import { leftPad } from "./leftPad";
export function getDateParam() {
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

export const dateParam = getDateParam();
