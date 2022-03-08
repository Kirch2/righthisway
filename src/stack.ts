import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";

// // // //

interface LambdaEnvironmentVariables {
  EMAIL: string;
  PASSWORD: string;
  TYPE_FILTER: string;
  SEAT_COUNT: string;
  LOOK_AHEAD_DAY_COUNT: string;
  RESTAURANT_URL: string;
  RECON_MODE: string;
  ENABLE_SCREENSHOTS: string;
  S3_BUCKET_NAME: string;
  TABLE_NAME: string;
  PRIMARY_KEY: string;
}

interface LambdaEnvironmentInput {
  EMAIL?: string;
  PASSWORD?: string;
  TYPE_FILTER?: string;
  SEAT_COUNT?: number;
  LOOK_AHEAD_DAY_COUNT: number;
  RECON_MODE?: string;
  ENABLE_SCREENSHOTS?: boolean;
}

interface LambdaConfig {
  restaurantSlug: string;
  schedule?: string; // i.e "cron(0 5 ? * FRI *)"
  environment: LambdaEnvironmentInput;
}

interface ProvisionLambdaProps {
  stack: any; // TODO - add correct type
  screenshotsBucket: s3.Bucket;
  reservationsTable: dynamodb.Table;
  lambdaConfig: LambdaConfig;
}

function provisionLambda(props: ProvisionLambdaProps) {
  const { restaurantSlug, schedule = "cron(29,59 * ? * * *)" } =
    props.lambdaConfig;
  const {
    EMAIL = "john@doe.com",
    PASSWORD = "mypasword123",
    TYPE_FILTER = "",
    SEAT_COUNT = 4,
    LOOK_AHEAD_DAY_COUNT = 7,
    RECON_MODE = true,
    ENABLE_SCREENSHOTS = true,
  } = props.lambdaConfig.environment;

  // Build restaurant url
  const RESTAURANT_URL = `https://resy.com/cities/ny/${restaurantSlug}`;

  // Build environment variables for lambda function
  const lambdaEnvironment: LambdaEnvironmentVariables = {
    EMAIL,
    PASSWORD,
    TYPE_FILTER,
    SEAT_COUNT: String(SEAT_COUNT),
    LOOK_AHEAD_DAY_COUNT: String(LOOK_AHEAD_DAY_COUNT),
    RESTAURANT_URL,
    RECON_MODE: RECON_MODE ? "TRUE" : "FALSE",
    ENABLE_SCREENSHOTS: ENABLE_SCREENSHOTS ? "TRUE" : "FALSE",
    S3_BUCKET_NAME: props.screenshotsBucket.bucketName,
    TABLE_NAME: props.reservationsTable.tableName,
    PRIMARY_KEY: "itemId",
  };

  // Build lambda name
  const mode = RECON_MODE ? "recon" : "live";
  const lambdaName = `${restaurantSlug}--${LOOK_AHEAD_DAY_COUNT}-days-ahead--${SEAT_COUNT}-seats--${mode}-mode`;

  // Crawler Lambda
  const botLambda = new lambda.Function(props.stack, lambdaName, {
    code: new lambda.AssetCode("src/scrape-pdfs-from-website"),
    handler: "lambda.handler",
    runtime: lambda.Runtime.NODEJS_12_X,
    timeout: cdk.Duration.seconds(300),
    memorySize: 1024,
    environment: {
      ...lambdaEnvironment,
    },
  });

  props.screenshotsBucket.grantReadWrite(botLambda);
  props.reservationsTable.grantReadWriteData(botLambda);

  // Run botLambda on schedule cron
  const rule = new events.Rule(props.stack, `${lambdaName}-rule`, {
    schedule: events.Schedule.expression(schedule),
  });

  // Adds scrapePdfsFromWebsiteLambda as target for scheduled rule
  rule.addTarget(new targets.LambdaFunction(botLambda));
}

// // // //

export class PdfTextractPipeline extends cdk.Stack {
  // constructor(app: cdk.App, id: string) {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // Provisions S3 bucket for downloaded PDFs
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-readme.html#logging-configuration
    const screenshotsBucket: s3.Bucket = new s3.Bucket(
      this,
      "righthisway_screenshots_bucket"
    );

    // Defines pdfUrlsTable for PDF Download URLs
    const reservationsTable = new dynamodb.Table(this, "reservations", {
      partitionKey: {
        name: "itemId",
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      tableName: "reservations",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOTE - This removalPolicy is NOT recommended for production code
    });

    //    pdfUrlsTable.grantReadWriteData(downloadPdfToS3Lambda);

    // // // //
    // Provision Lambdas

    // Define array of LambdaConfig objects
    const lambdaConfigs: LambdaConfig[] = [
      // Raoul's - 4-top on fridays
      {
        restaurantSlug: "raoulsrestaurant",
        schedule: "cron(0 5 ? * FRI *)", // Friday@12:00:01AM
        environment: {
          SEAT_COUNT: 4,
          TYPE_FILTER: "Indoor",
          LOOK_AHEAD_DAY_COUNT: 7,
        },
      },
      // I Sodi 2-top recon
      {
        restaurantSlug: "i-sodi",
        environment: {
          SEAT_COUNT: 2,
          TYPE_FILTER: "",
          LOOK_AHEAD_DAY_COUNT: 13,
        },
      },
      // Overstory 2-top recon
      {
        restaurantSlug: "overstory",
        environment: {
          SEAT_COUNT: 2,
          TYPE_FILTER: "",
          LOOK_AHEAD_DAY_COUNT: 3,
        },
      },
      // L'Appart 2-top recon
      {
        restaurantSlug: "l-appart",
        environment: {
          SEAT_COUNT: 2,
          TYPE_FILTER: "",
          LOOK_AHEAD_DAY_COUNT: 28,
        },
      },
      // Ito 2-top recon
      {
        restaurantSlug: "ito",
        environment: {
          SEAT_COUNT: 2,
          TYPE_FILTER: "",
          LOOK_AHEAD_DAY_COUNT: 20,
        },
      },
      // Looks ahead at Carbone for 2+3+4 tops 30 days out, every 30 minutes
      ...[2, 3, 4].map((seatCount) => {
        return {
          restaurantSlug: "carbone",
          environment: {
            SEAT_COUNT: seatCount,
            LOOK_AHEAD_DAY_COUNT: 30,
          },
        };
      }),
    ];

    // // // // // s

    // Loop over + provision for each lambda config
    lambdaConfigs.forEach((config) => {
      provisionLambda({
        stack: this,
        screenshotsBucket,
        reservationsTable,
        lambdaConfig: config,
      });
    });
  }
}
