import { db, PRIMARY_KEY, RESTAURANT_URL, TABLE_NAME } from "./constants";
import { getDateParam } from "./getDateParam";

// // // //
export function saveToDB(props: {
  time: string;
  type: string;
  seatCount: string;
  ranAt: string;
}) {
  const { time, type, seatCount, ranAt } = props;
  const slug = RESTAURANT_URL.replace("https://resy.com/cities/ny/", "");
  const dateParam = getDateParam();
  const documentId = `res-${slug}-${time}-${type}-${seatCount}-${dateParam}`;
  // Defines the item we're inserting into the database
  const item: any = {
    [PRIMARY_KEY]: documentId,
    restaurant: slug,
    date: dateParam,
    time,
    type,
    seatCount,
    ranAt,
  };

  // Defines the params for db.put
  const params = {
    TableName: TABLE_NAME,
    Item: item,
  };

  // Inserts the record into the DynamoDB table
  return db.put(params).promise();
}
