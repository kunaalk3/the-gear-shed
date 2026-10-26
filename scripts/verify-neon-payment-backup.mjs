import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  verifyNeonPaymentBackup,
} from "./neon-payment-backup-verification.mjs";

async function main() {
  const result = await verifyNeonPaymentBackup(process.env);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown verification failure.";
    console.error(`Neon backup verification stopped: ${safeMessage}`);
    process.exitCode = 1;
  });
}
