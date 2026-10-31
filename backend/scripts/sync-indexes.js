// Run once against a new or production database: npm run indexes
// In production the app does not create indexes by itself (autoIndex is off), and the unique
// email index is what stops two accounts sharing one email, so this step matters.
import { connectDb, disconnectDb } from "../lib/db.js";
import * as models from "../models/index.js";

async function main() {
  const instance = await connectDb();
  console.log(`Database: ${instance.connection.name}`);
  for (const [name, model] of Object.entries(models)) {
    await model.createIndexes();
    console.log(`Indexes ready: ${name}`);
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error(`Failed: ${err.message}`); // never prints the connection string
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());