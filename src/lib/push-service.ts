import webPush from 'web-push';
import prisma from "@/lib/prisma";
import { env } from "@/Env";

webPush.setVapidDetails(
  'mailto:suporte@afroscholars.academy',
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export class PushService {
  static async sendToUser(userId: string, title: string, body: string, url: string = '/') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushSubscription: true },
      });

      if (!user?.pushSubscription) return;

      const payload = JSON.stringify({ title, body, url, tag: 'community-message' });

      const subscription =
        typeof user.pushSubscription === 'string'
          ? JSON.parse(user.pushSubscription)
          : user.pushSubscription;

      await webPush.sendNotification(subscription, payload);
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await prisma.user.update({
          where: { id: userId },
          data: { pushSubscription: null },
        });
      }
    }
  }

  static async notifyCommunityMembers(
    comunidadeId: string,
    senderName: string,
    messageContent: string,
    excludeUserId: string,
    routePrefix: string = '',
  ) {
    const members = await prisma.communityMember.findMany({
      where: { comunidadeId, usuarioId: { not: excludeUserId } },
      select: { usuarioId: true },
    });

    if (members.length === 0) return;

    const shortContent = messageContent.substring(0, 120);
    const link = `${routePrefix}/comunidades/${comunidadeId}`;

    const notificationData = {
      titulo: `💬 ${senderName} enviou uma mensagem`,
      content: shortContent,
      tipo: 'COMUNIDADE' as const,
      link,
      entidade: 'comunidade',
      entidadeId: comunidadeId,
    };

    const notificationRecords = members.map(m => ({
      ...notificationData,
      userId: m.usuarioId,
    }));

    await prisma.notification.createMany({ data: notificationRecords });

    for (const member of members) {
      PushService.sendToUser(member.usuarioId, notificationData.titulo, notificationData.content, link);
    }
  }
}
