import type { DepositChargeStatus } from "@/lib/types";

export type PaymentSetupCheckStatus = DepositChargeStatus | "not_found" | "unavailable";
export type PaymentSetupConfirmation =
  | "saved"
  | "failed"
  | "not_found"
  | "not_confirmed";

export async function waitForPaymentSetupConfirmation(
  readStatus: () => Promise<PaymentSetupCheckStatus>,
  wait: (milliseconds: number) => Promise<void>,
  attempts = 10,
  intervalMilliseconds = 1500
): Promise<PaymentSetupConfirmation> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await readStatus();
    if (status === "card_saved" || status === "charged") return "saved";
    if (status === "failed") return "failed";
    if (status === "not_found") return "not_found";
    if (status === "unavailable") return "not_confirmed";
    if (attempt + 1 < attempts) await wait(intervalMilliseconds);
  }

  return "not_confirmed";
}
