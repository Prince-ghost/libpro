// npm run seed-demo               adds demo listings to your DEVELOPMENT database
// npm run seed-demo -- --remove   deletes them (and the demo seller) again
import crypto from "node:crypto";
import argon2 from "argon2";
import { env } from "../lib/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { Book, User } from "../models/index.js";

const DEMO_EMAIL = "demo.seller@example.test";
const remove = process.argv.includes("--remove");

if (env.NODE_ENV === "production") {
  console.error("Refusing to run in production.");
  process.exit(1);
}

// [title, audience, class or course, category]
const SUBJECTS = [
  ["Physics", "school", "Class 11", "Physics"],
  ["Chemistry", "school", "Class 11", "Chemistry"],
  ["Mathematics", "school", "Class 12", "Mathematics"],
  ["Biology", "school", "Class 12", "Biology"],
  ["Data Structures", "college", "B.Tech CSE, Sem 3", "Computer Science"],
  ["Operating Systems", "college", "B.Tech CSE, Sem 4", "Computer Science"],
  ["Engineering Mathematics", "college", "B.Tech, Sem 2", "Mathematics"],
  ["Organic Chemistry", "college", "B.Sc, Sem 3", "Chemistry"],
  ["Quantitative Aptitude", "competitive", "Bank exams", "Aptitude"],
  ["General Knowledge", "competitive", "SSC exams", "General Knowledge"],
  ["English Grammar", "reference", "Class 9 to 10", "English"],
  ["Economics", "college", "B.Com, Sem 1", "Economics"],
];
const VARIANTS = ["Part 1", "Part 2", "Practice Workbook"];
const AUTHORS = ["R. Sharma", "A. Verma", "S. Gupta", "M. Singh", "K. Iyer", "P. Nair"];
const CONDITIONS = ["like_new", "good", "fair", "good", "poor"];
const PRICES = [12000, 18500, 25000, 32000, 45000, 9900, 60000, 15050]; // paise

function demoBooks(sellerId) {
  const books = Array.from({ length: 30 }, (_, i) => {
    const [name, audience, classOrCourse, category] = SUBJECTS[i % SUBJECTS.length];
    return {
      sellerId,
      title: `${name}: ${VARIANTS[Math.floor(i / SUBJECTS.length)]}`,
      author: AUTHORS[i % AUTHORS.length],
      category,
      audience,
      classOrCourse,
      edition: i % 3 === 0 ? "2023 edition" : undefined,
      condition: CONDITIONS[i % CONDITIONS.length],
      description: "Demo listing created by the seed script. Not a real book for sale.",
      priceMinor: PRICES[i % PRICES.length],
      moderationState: "approved",
      status: "active",
    };
  });
  // Harmless markup-like text, to check that the site always shows it as plain text.
  books.push({
    sellerId,
    title: "<b>Bold</b> <script>alert(1)</script> Notes",
    author: "A. Tester",
    category: "Testing",
    audience: "other",
    condition: "good",
    description: "Harmless markup-like text, to check that the site shows it as plain text.",
    priceMinor: 5000,
    moderationState: "approved",
    status: "active",
  });
  return books;
}

async function main() {
  const instance = await connectDb();
  const dbName = instance.connection.name;
  console.log(`Database: ${dbName}`);
  if (dbName.endsWith("_test")) {
    console.error("Refusing to seed the test database.");
    return 1;
  }

  const seller = await User.findOne({ email: DEMO_EMAIL });

  if (remove) {
    if (!seller) {
      console.log("Nothing to remove.");
      return 0;
    }
    const books = await Book.deleteMany({ sellerId: seller._id });
    await User.deleteOne({ _id: seller._id });
    console.log(`Removed ${books.deletedCount} demo books and the demo seller.`);
    return 0;
  }

  if (seller) {
    const count = await Book.countDocuments({ sellerId: seller._id });
    console.log(`Already seeded: the demo seller has ${count} books. Run with --remove first to start over.`);
    return 0;
  }

  // Nobody knows this password, so no one can log in as the demo seller.
  const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id });
  const demoSeller = await User.create({ name: "Demo Seller", email: DEMO_EMAIL, passwordHash });
  const docs = demoBooks(demoSeller._id);
  await Book.insertMany(docs);
  console.log(`Added ${docs.length} demo books, all approved and available, from ${DEMO_EMAIL}.`);
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