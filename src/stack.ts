import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";

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

    // // // //
    // Provisions scrape-pdfs-from-website lambda
    // NOTE - we bump the memory to 1024mb here to accommodate the memory requirements for Puppeteer

    // DownloadURL Crawler Lambda
    const scrapePdfsFromWebsiteLambda = new lambda.Function(
      this,
      "scrapePdfsFromWebsiteLambda",
      {
        code: new lambda.AssetCode("src/scrape-pdfs-from-website"),
        handler: "lambda.handler",
        runtime: lambda.Runtime.NODEJS_12_X,
        timeout: cdk.Duration.seconds(300),
        memorySize: 1024,
        environment: {
          EMAIL: "john@doe.com",
          PASSWORD: "itemId",
          TYPE_FILTER: "Standard",
          SEAT_COUNT: "4",
          RESTAURANT_URL: "https://resy.com/cities/ny/stk-meatpacking",
          RECON_MODE: "TRUE",
          S3_BUCKET_NAME: screenshotsBucket.bucketName,
        },
      }
    );

    screenshotsBucket.grantReadWrite(scrapePdfsFromWebsiteLambda);

    // Run `scrape-pdfs-from-website` every 12 hours
    // See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, "Rule", {
      schedule: events.Schedule.expression("cron(0 5 ? * FRI *)"),
    });

    // Adds scrapePdfsFromWebsiteLambda as target for scheduled rule
    rule.addTarget(new targets.LambdaFunction(scrapePdfsFromWebsiteLambda));
  }
}
