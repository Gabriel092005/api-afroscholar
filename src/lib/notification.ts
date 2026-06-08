// import admin from "firebase-admin";
// import { io } from "../server"; 
// import { prisma } from "./prisma"; 
// import serviceAccount from '@/lib/liberal-c2c86-firebase-adminsdk-fbsvc-581e7b364c.json';

// // INICIALIZAÇÃO OBRIGATÓRIA
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
//   });
// }

// export async function sendNotification(userId: string, title: string, body: string) {
//   // 1. Enviar via Socket.io (Para quem está com o app aberto)
//   io.to(userId).emit("notification", { 
//     title, 
//     body, 
//     createdAt: new Date() 
//   });

//   // 2. Buscar o token no banco (Agora que o campo existe)
//   const user = await prisma.usuario.findUnique({
//     where: { id: Number(userId) },
//     select: { fcm_token: true } // Buscamos apenas o token por performance
//   });

//   // 3. Enviar via Push (Para quem está com o app fechado)
//   if (user?.fcm_token) {
//     try {
//       await admin.messaging().send({
//         token: user.fcm_token,
//         notification: {
//           title,
//           body,
//         },
//         android: {
//           priority: "high",
//           notification: {
//             sound: "default",
//             clickAction: "FLUTTER_NOTIFICATION_CLICK", // Útil se usar Flutter/React Native
//           }
//         },
//         apns: {
//           payload: {
//             aps: {
//               sound: "default",
//               badge: 1,
//             },
//           },
//         },
//       });
//       console.log(`Push enviado para o usuário: ${userId}`);
//     } catch (error) {
//       console.error("Erro ao enviar Push Firebase:", error);
      
//       // DICA: Se o erro for 'registration-token-not-registered', 
//       // o token expirou e você deve removê-lo do banco.
//     }
//   }
// }