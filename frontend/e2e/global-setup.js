import { execFileSync } from "node:child_process";
import path from "node:path";

// Empties the TEST database before every run, so the tests always start from a known state.
// The reset script forces test mode and refuses to run on any database not ending in _test.
export default function globalSetup() {
  const backend = path.resolve(process.cwd(), "../backend");
  const output = execFileSync(process.execPath, ["scripts/reset-test-db.js"], {
    cwd: backend,
    env: { ...process.env, NODE_ENV: "test" },
    encoding: "utf8",
    timeout: 180_000,
  });
  if (!/Database: \S+_test\b/.test(output)) {
    throw new Error("Stopped: the reset did not report a database whose name ends in _test.");
  }
  console.log(output.trim());
}