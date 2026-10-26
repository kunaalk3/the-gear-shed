import type { DepositChargeStatus } from "@/lib/types";

export function canRetryDepositCharge(
  depositAmount: number,
  badHire: boolean,
  status: DepositChargeStatus
): boolean {
  return (
    depositAmount > 0 &&
    badHire &&
    (status === "card_saved" || status === "failed")
  );
}

export function shouldShowDepositChargeFailureNote(
  depositAmount: number,
  badHire: boolean,
  status: DepositChargeStatus
): boolean {
  return status === "failed" && canRetryDepositCharge(depositAmount, badHire, status);
}
