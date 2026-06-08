import webPush from 'web-push';
import prisma from "@/lib/prisma";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}



// TODO: Move VAPID keys to environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
const publickey =  'BFNPdsaGGPaoeVfEDOCuOUnuZm2uJzwwkBztcsJdda31FTKd2QNyaYlrYhQkFRRTw6FXydes6NKe3oxJH4XVHok'
const privatekey = 'VsGujun0euJTJYttHuM9TksoP57Q72I4Iqk_RZGFGag'

webPush.setVapidDetails(
  'mailto:suporte@seusite.com', 
  publickey,
  privatekey
);

export class NotificationService {
  static async send(userId: string, title: string, content: string, path: string = '/') {
    try {

      // await prisma.notificacao.create({
      //   data: { authrId : userId, content: content }
      // });

      const user = await prisma.usuario.findFirst({
        where: { id: userId },
        select: { pushSubscription: true }
      });

      if (!user?.pushSubscription) return;

      const payload = JSON.stringify({
        title,
        body: content,
        url: path,
        tag: 'novo-servico-proximo' // Tag fixa para não empilhar 10 notificações iguais
      });


const subscription = typeof user.pushSubscription === 'string' 
  ? JSON.parse(user.pushSubscription) 
  : user.pushSubscription;

await webPush.sendNotification(subscription, payload);


    } catch (error: any) {
      if (error.code === 'ENOTFOUND') {
        console.error("Falha de DNS: Verifique a conexão com fcm.googleapis.com");
      } else if (error.statusCode === 410 || error.statusCode === 404) {
        await prisma.usuario.update({
          where: { id: userId },
          data: { pushSubscription: '' }
        });
      }
    }
  }
}