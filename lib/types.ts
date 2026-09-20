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

export interface EquipmentItem {
  id: string;
  name: string;
  category: Category;
  description: string;
  images: string[];
  totalQuantity: number;
  depositRequired: number; // 0 means no deposit; display-only in this phase, no payment flow yet
  bookingConditions: string;
  cancellationRules: string;
  retired: boolean;
  ownerId: string | null;
  pickupNotes: string;
  dropoffNotes: string;
}

export type BookingStatus = "pending" | "approved";

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
}

export type PublicUser = Omit<User, "passwordHash">;

export type LoanRequestStatus = "pending" | "approved" | "declined";

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
  | "org_approved"
  | "org_rejected"
  | "new_org_pending";

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
