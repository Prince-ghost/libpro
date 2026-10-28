import app from "./app.js";
import { env } from "./lib/env.js";
import { connectDb, disconnectDb } from "./lib/db.js";
import "./models/index.js";

async function start() {
  let mongooseInstance;
  try {
    mongooseInstance = await connectDb();
  } catch {
    console.error(
      "Could not connect to the database. Check MONGODB_URI, your Atlas IP access list, and your credentials."
    );
    process.exit(1);
  }
  console.log(`Connected to database "${mongooseInstance.connection.name}"`);

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();