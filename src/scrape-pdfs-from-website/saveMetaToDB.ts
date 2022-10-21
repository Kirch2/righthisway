import { RESTAURANT_URL, PRIMARY_KEY, TABLE_NAME, db } from "./constants";

export function saveMetaToDB(props: { restaurantMeta: any; ranAt: string }) {
  const slug = RESTAURANT_URL.replace("https://resy.com/cities/ny/", "");
  const documentId = `restaurant-meta-${slug}`;
  // Defines the item we're inserting into the database
  const item: any = {
    [PRIMARY_KEY]: documentId,
    restaurant: slug,
    ranAt: props.ranAt,
    metadata: props.restaurantMeta,
  };

  // Defines the params for db.put
  const params = {
    TableName: TABLE_NAME,
    Item: item,
  };

  // Inserts the record into the DynamoDB table
  return db.put(params).promise();
}
