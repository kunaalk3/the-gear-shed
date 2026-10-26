export type Category =
  | "Marquees"
  | "Tables & Chairs"
  | "Audio Equipment"
  | "Sporting Equipment"
  | "Cooking Facilities";

export const CATEGORIES: Category[] = [
  "Marquees",
  "Tables & Chairs",
  "Audio Equipment",
  "Sporting Equipment",
  "Cooking Facilities",
];

export const TRANSACTION_TYPES = [
  "paid_hire",
  "temporary_free_loan",
  "permanent_donation",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  paid_hire: "Paid hire",
  temporary_free_loan: "Temporary free loan",
  permanent_donation: "Permanent donation",
};

export const EQUIPMENT_CONDITIONS = ["excellent", "good", "fair", "poor", "unknown"] as const;

export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unknown: "Condition not recorded",
};

export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && TRANSACTION_TYPES.includes(value as TransactionType);
}

export function isEquipmentCondition(value: unknown): value is EquipmentCondition {
  return typeof value === "string" && EQUIPMENT_CONDITIONS.includes(value as EquipmentCondition);
}

export function parseNonNegativeInteger(value: unknown): number | null {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= 2_147_483_647 ? amount : null;
}

export function parseHireFee(value: unknown): number | null {
  return parseNonNegativeInteger(value);
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: Category;
  description: string;
  images: string[];
  totalQuantity: number;
  transactionType: TransactionType;
  hireFee: number;
  condition: EquipmentCondition;
  conditionNotes: string;
  depositRequired: number;
  bookingConditions: string;
  cancellationRules: string;
  retired: boolean;
  ownerId: string | null;
  pickupNotes: string;
  dropoffNotes: string;
}

export type BookingStatus = "pending" | "approved" | "cancelled";

export interface Booking {
  id: string;
  itemId: string;
  requestId: string;
  startDate: string; // ISO date, e.g. 2026-08-10
  endDate: string; // ISO date, inclusive
  quantity: number;
  status: BookingStatus;
}

export interface BlackoutPeriod {
  id: string;
  itemId: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
}

export type OrgStatus = "pending" | "approved" | "rejected" | "retired";

export type UserRole = "requester" | "admin" | "org";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  organisation: string;
  phone: string;
  role: UserRole;
  orgStatus: OrgStatus;
  acceptedPaymentMethods: string[];
  termsAccepted: boolean;
  termsVersion: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export type LoanRequestStatus = "pending" | "approved" | "declined" | "cancelled";

export interface RequestStatusHistory {
  id: string;
  requestId: string;
  fromStatus: LoanRequestStatus | null;
  toStatus: LoanRequestStatus;
  actorUserId: string | null;
  actorName: string | null;
  reason: string;
  createdAt: string;
}

export type DepositChargeStatus = "none" | "card_saved" | "charged" | "failed";

export type BookingPaymentStatus =
  | "awaiting_payment_method"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "refund_failed"
  | "manual_review";

export interface BookingPayment {
  id: string;
  requestId: string;
  kind: "hire_fee" | "deposit";
  amountCents: number;
  currency: "aud";
  status: BookingPaymentStatus;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  chargedAt: string | null;
  refundedAt: string | null;
  failureMessage: string | null;
}

export interface LoanRequest {
  id: string;
  itemId: string;
  userId: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  requesterPhone: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  badHire: boolean;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  depositChargeStatus: DepositChargeStatus;
  depositChargedAt: string | null;
  bookingPayments?: BookingPayment[];
}

export interface Feedback {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export type NotificationType =
  | "new_request"
  | "request_approved"
  | "request_declined"
  | "request_cancelled"
  | "org_approved"
  | "org_rejected"
  | "new_org_pending"
  | "payment_method_saved"
  | "deposit_charged";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  requestId: string;
  itemId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}
