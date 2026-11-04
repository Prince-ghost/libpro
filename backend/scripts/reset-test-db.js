// Empties every collection in the TEST database. It forces test mode first, so it can never
// touch your real database, and it refuses to run unless the database name ends in _test.
import "dotenv/config";

process.env.NODE_ENV = "test"; // must happen before lib/db.js is loaded
const { connectDb, disconnectDb } = await import("../lib/db.js");

try {
  const instance = await connectDb();
  const name = instance.connection.name;
  console.log(`Database: ${name}`);
  if (!name.endsWith("_test")) {
    console.error("Refusing to run: this is not a test database.");
    process.exitCode = 1;
  } else {
    const collections = await instance.connection.db.collections();
    for (const collection of collections) {
      const result = await collection.deleteMany({});
      console.log(`${collection.collectionName}: removed ${result.deletedCount}`);
    }
    console.log("Test database is empty.");
  }
} catch (err) {
  console.error(`Failed: ${err.message}`); // never prints the connection string
  process.exitCode = 1;
} finally {
  await disconnectDb();
}