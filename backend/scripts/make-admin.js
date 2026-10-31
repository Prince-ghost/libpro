// Run locally: npm run make-admin -- someone@example.com [--revoke]
// The only way to create or remove an admin. It uses the credentials in your own .env file,
// so it can only be run by someone who already controls the server and the database.
import { z } from "zod";
import { connectDb, disconnectDb } from "../lib/db.js";
import { User, AuditEvent } from "../models/index.js";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const rawEmail = args.find((arg) => !arg.startsWith("--"));

const parsedEmail = z.string().trim().toLowerCase().email().max(254).safeParse(rawEmail);
if (!parsedEmail.success) {
  console.error("Usage: npm run make-admin -- <email> [--revoke]");
  process.exit(1);
}
const email = parsedEmail.data;

async function main() {
  const instance = await connectDb();
  console.log(`Database: ${instance.connection.name}`);

  const user = await User.findOne({ email });
  if (!user) {
    console.error("No account with that email. Register it through the app first.");
    return 1;
  }

  if (revoke) {
    if (user.role !== "admin") {
      console.log("That account is not an admin. Nothing changed.");
      return 0;
    }
    const admins = await User.countDocuments({ role: "admin" });
    if (admins <= 1) {
      console.error("Refusing to remove the last admin.");
      return 1;
    }
    await User.updateOne({ _id: user._id }, { $set: { role: "user" } });
    await AuditEvent.create({ source: "cli", action: "admin.revoke", targetType: "user", targetId: user._id });
    console.log("Done: that account is no longer an admin.");
    return 0;
  }

  if (user.status !== "active") {
    console.error("That account is disabled. Enable it before making it an admin.");
    return 1;
  }
  if (user.role === "admin") {
    console.log("That account is already an admin. Nothing changed.");
    return 0;
  }
  await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
  await AuditEvent.create({ source: "cli", action: "admin.grant", targetType: "user", targetId: user._id });
  console.log("Done: that account is now an admin.");
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`Failed: ${err.message}`); // never prints the connection string
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());