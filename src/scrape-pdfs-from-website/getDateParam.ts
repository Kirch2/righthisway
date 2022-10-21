import { LOOK_AHEAD_DAY_COUNT } from "./constants";
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
