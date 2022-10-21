import * as fs from "fs";
import { RESTAURANT_URL, SEAT_COUNT, s3obj, S3_BUCKET_NAME } from "./constants";
import { getDateParam } from "./getDateParam";

export function uploadToS3(props: { path: string; ranAt: string }) {
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

  // TODO - build this string
  const destinationPath = `${restaurantName}/${getDateParam()}/${SEAT_COUNT}-top/${
    props.ranAt
  }/${filename}`;

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
