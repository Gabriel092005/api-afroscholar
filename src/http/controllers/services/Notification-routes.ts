import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import webPush from 'web-push';
import z from "zod";
import prisma from "@/lib/prisma";


const publickey = 'BFNPdsaGGPaoeVfEDOCuOUnuZm2uJzwwkBztcsJdda31FTKd2QNyaYlrYhQkFRRTw6FXydes6NKe3oxJH4XVHok';
const privatekey ='VsGujun0euJTJYttHuM9TksoP57Q72I4Iqk_RZGFGag';

webPush.setVapidDetails(
  'mailto:seu-email@exemplo.com',
  publickey,
  privatekey
);

export async function NotificacaoRoutes(app: FastifyInstance) {

  app.get('/push/public_key', async () => {
    return { publickey };
  });

  app.addHook('onRequest', verifyJWT);

  app.post('/push/register', async (req:FastifyRequest, reply:FastifyReply) => {
    const registerSchema = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string()
        })
      })
    });

    try {
      const { subscription } = registerSchema.parse(req.body);
      const userId = req.user.sub;

      await prisma.usuario.update({
        where: { id: userId },
        data: { 
          pushSubscription: subscription 
        }
      });

      return reply.status(201).send({ message: "Inscrição salva com sucesso!" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ message: "Dados de subscrição inválidos", errors: error.errors });
      }

      console.error("ERRO NO REGISTRO:", error);
      return reply.status(500).send({ error: "Erro interno ao salvar inscrição" });
    }
  });
}