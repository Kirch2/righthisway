// // // //
export function leftPad(num: number) {
  if (num < 10) {
    return `0${num}`;
  }
  return String(num);
}
