import { randomUUID } from "crypto";
import { createNotification, getAdminUsers } from "@/lib/data/queries";
import type { NotificationType } from "@/lib/types";

export async function notifyUser(userId: string, type: NotificationType, message: string, link: string) {
  await createNotification({
    id: randomUUID(),
    userId,
    type,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

export async function notifyAdmins(type: NotificationType, message: string, link: string) {
  const admins = await getAdminUsers();
  await Promise.all(admins.map((admin) => notifyUser(admin.id, type, message, link)));
}
