// npm run seed-demo               adds demo listings to your DEVELOPMENT database
// npm run seed-demo -- --remove   deletes them (and the demo seller) again
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import sharp from "sharp";
import { env } from "../lib/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { Book, Image, User } from "../models/index.js";

const DEMO_EMAIL = "demo.seller@example.test";
const remove = process.argv.includes("--remove");
const COVER_DIR = fileURLToPath(new URL("../assets/demo-covers/", import.meta.url));

if (env.NODE_ENV === "production") {
  console.error("Refusing to run in production.");
  process.exit(1);
}

// [title, audience, class or course, category]
const SUBJECTS = [
  ["Mathematics", "school", "Class 9", "Mathematics"],
  ["Science", "school", "Class 9", "Science"],
  ["English", "school", "Class 9", "English"],
  ["Social Science", "school", "Class 9", "Social Science"],
  ["Mathematics", "school", "Class 10", "Mathematics"],
  ["Science", "school", "Class 10", "Science"],
  ["English", "school", "Class 10", "English"],
  ["Social Science", "school", "Class 10", "Social Science"],
  ["Physics", "school", "Class 11", "Physics"],
  ["Chemistry", "school", "Class 11", "Chemistry"],
  ["Mathematics", "school", "Class 11", "Mathematics"],
  ["Biology", "school", "Class 11", "Biology"],
  ["English", "school", "Class 11", "English"],
  ["Physics", "school", "Class 12", "Physics"],
  ["Chemistry", "school", "Class 12", "Chemistry"],
  ["Mathematics", "school", "Class 12", "Mathematics"],
  ["Biology", "school", "Class 12", "Biology"],
  ["English", "school", "Class 12", "English"],
  ["Data Structures", "college", "B.Tech CSE, Sem 3", "Computer Science"],
  ["Operating Systems", "college", "B.Tech CSE, Sem 4", "Computer Science"],
  ["Engineering Mathematics", "college", "B.Tech, Sem 2", "Mathematics"],
  ["Organic Chemistry", "college", "B.Sc, Sem 3", "Chemistry"],
  ["Database Management Systems", "college", "B.Tech CSE, Sem 5", "Computer Science"],
  ["Computer Networks", "college", "B.Tech CSE, Sem 5", "Computer Science"],
  ["Programming in Java", "college", "BCA, Sem 3", "Computer Science"],
  ["Web Development", "college", "BCA, Sem 4", "Computer Science"],
  ["Financial Accounting", "college", "B.Com, Sem 1", "Economics"],
  ["Business Economics", "college", "B.Com, Sem 2", "Economics"],
  ["Microeconomics", "college", "BA Economics, Sem 1", "Economics"],
  ["Business Management", "college", "BBA, Sem 2", "Management"],
  ["Marketing Management", "college", "MBA, Sem 1", "Management"],
  ["Research Methodology", "college", "BA, Sem 4", "General Knowledge"],
  ["Advanced Database Systems", "college", "MCA, Sem 2", "Computer Science"],
  ["Machine Learning", "college", "M.Tech AI, Sem 1", "Computer Science"],
  ["Digital Signal Processing", "college", "M.Tech ECE, Sem 2", "Engineering"],
  ["Human Anatomy", "college", "B.Sc Nursing, Year 1", "Medical"],
  ["Physiology", "college", "MBBS, Year 1", "Medical"],
  ["Pharmacology", "college", "B.Pharm, Sem 4", "Medical"],
  ["Constitutional Law", "college", "LLB, Sem 1", "Law"],
  ["Psychology", "college", "BA Psychology, Sem 2", "Arts"],
  ["Fundamentals of Design", "college", "B.Des, Year 1", "Design"],
  ["Quantitative Aptitude", "competitive", "Bank exams", "Aptitude"],
  ["General Knowledge", "competitive", "SSC exams", "General Knowledge"],
  ["English Grammar", "reference", "Class 9 to 10", "English"],
];
const VARIANTS = ["Part 1", "Part 2", "Practice Workbook"];
const AUTHORS = ["R. Sharma", "A. Verma", "S. Gupta", "M. Singh", "K. Iyer", "P. Nair"];
const CONDITIONS = ["like_new", "good", "fair", "good", "poor"];
const PRICES = [12000, 18500, 25000, 32000, 45000, 9900, 60000, 15050]; // paise

function demoBooks(sellerId) {
  const books = Array.from({ length: SUBJECTS.length * 2 }, (_, i) => {
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

function coverFileFor({ title, classOrCourse, category }) {
  const baseName = title.split(":")[0];
  const classMatch = /^Class (9|10|11|12)$/.exec(classOrCourse);
  if (classMatch) {
    const subject = {
      "Social Science": classMatch[1] === "9" ? "economics" : "social-science",
      Mathematics: "mathematics",
      Science: "science",
      English: "english",
      Physics: "physics",
      Chemistry: "chemistry",
      Biology: "biology",
    }[baseName];
    return subject
      ? `class-${classMatch[1]}-${subject}.jpg`
      : "general-communication-skills.jpg";
  }

  const lower = `${baseName} ${classOrCourse} ${category}`.toLowerCase();
  const matches = [
    ["data structures", "btech-data-structures.jpg"],
    ["operating systems", "btech-operating-systems.jpg"],
    ["database management", "btech-database-management.jpg"],
    ["computer networks", "btech-computer-networks.jpg"],
    ["software engineering", "btech-software-engineering.jpg"],
    ["machine learning", "btech-ai-machine-learning.jpg"],
    ["digital signal", "btech-electronics.jpg"],
    ["engineering mathematics", "btech-discrete-mathematics.jpg"],
    ["organic chemistry", "bsc-chemistry.jpg"],
    ["programming in java", "bca-java.jpg"],
    ["web development", "bca-web-development.jpg"],
    ["advanced database", "mca-data-analytics.jpg"],
    ["business management", "bba-principles-management.jpg"],
    ["marketing management", "mba-marketing-management.jpg"],
    ["financial accounting", "bcom-financial-accounting.jpg"],
    ["business economics", "bcom-business-law.jpg"],
    ["microeconomics", "bcom-financial-accounting.jpg"],
    ["human anatomy", "nursing-anatomy-physiology.jpg"],
    ["physiology", "mbbs-anatomy.jpg"],
    ["pharmacology", "bpharm-pharmacology.jpg"],
    ["constitutional law", "llb-constitutional-law.jpg"],
    ["psychology", "ba-psychology.jpg"],
    ["fundamentals of design", "bdes-design-foundations.jpg"],
    ["research methodology", "general-critical-thinking.jpg"],
    ["quantitative aptitude", "general-financial-literacy.jpg"],
    ["general knowledge", "general-world-history.jpg"],
    ["english grammar", "general-communication-skills.jpg"],
    ["economics", "bcom-financial-accounting.jpg"],
  ];
  return matches.find(([text]) => lower.includes(text))?.[1] ?? "general-environment.jpg";
}

async function imageData(buffer) {
  const open = () => sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" });
  const full = await open()
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await open()
    .rotate()
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return { full: full.data, thumb, width: full.info.width, height: full.info.height };
}

async function attachDemoCovers(bookDocs) {
  const availableCovers = new Set(await fs.readdir(COVER_DIR));
  const imageDocs = [];
  for (const book of bookDocs) {
    const requestedCover = coverFileFor(book);
    const coverName = availableCovers.has(requestedCover)
      ? requestedCover
      : "general-environment.jpg";
    const buffer = await fs.readFile(path.join(COVER_DIR, coverName));
    const processed = await imageData(buffer);
    const image = new Image({
      ownerId: book.sellerId,
      bookId: book._id,
      contentType: "image/webp",
      width: processed.width,
      height: processed.height,
      bytes: processed.full.length,
      full: processed.full,
      thumb: processed.thumb,
    });
    book.imageKeys = [String(image._id)];
    imageDocs.push(image);
  }
  await Image.insertMany(imageDocs);
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
    const images = await Image.deleteMany({ ownerId: seller._id });
    const books = await Book.deleteMany({ sellerId: seller._id });
    await User.deleteOne({ _id: seller._id });
    console.log(`Removed ${books.deletedCount} demo books, ${images.deletedCount} covers and the demo seller.`);
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
  const docs = demoBooks(demoSeller._id).map((book) => new Book(book));
  await attachDemoCovers(docs);
  await Book.insertMany(docs);
  console.log(`Added ${docs.length} demo books with covers, all approved and available, from ${DEMO_EMAIL}.`);
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