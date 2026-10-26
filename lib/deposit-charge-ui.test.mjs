import assert from "node:assert/strict";
import test from "node:test";
import {
  canRetryDepositCharge,
  shouldShowDepositChargeFailureNote,
} from "./deposit-charge-ui.ts";

test("failure note is shown only for a failed, positive-deposit bad hire eligible for retry", () => {
  assert.equal(shouldShowDepositChargeFailureNote(25, true, "failed"), true);
  assert.equal(shouldShowDepositChargeFailureNote(0, true, "failed"), false);
  assert.equal(shouldShowDepositChargeFailureNote(25, false, "failed"), false);
  assert.equal(shouldShowDepositChargeFailureNote(25, true, "card_saved"), false);
  assert.equal(shouldShowDepositChargeFailureNote(25, true, "charged"), false);
});

test("retry eligibility matches the existing charge button state rules", () => {
  assert.equal(canRetryDepositCharge(25, true, "card_saved"), true);
  assert.equal(canRetryDepositCharge(25, true, "failed"), true);
  assert.equal(canRetryDepositCharge(25, false, "failed"), false);
  assert.equal(canRetryDepositCharge(0, true, "failed"), false);
  assert.equal(canRetryDepositCharge(25, true, "charged"), false);
});
