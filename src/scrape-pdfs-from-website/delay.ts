// // // //
// Define "delay" function
export function delay(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, timeout);
  });
}
