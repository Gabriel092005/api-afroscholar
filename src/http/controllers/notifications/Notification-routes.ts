import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '@/lib/prisma';
import { verifyJWT } from '../middleware/verify-jwt';
import { env } from '@/Env';
import z from 'zod';

export async function NotificationRoutes(app: FastifyInstance) {
  // ── Push registration ───────────────────────────────────────────────
  app.get('/push/public_key', async () => {
    return { publickey: env.VAPID_PUBLIC_KEY };
  });

  app.post('/push/register', { onRequest: [verifyJWT] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }),
    });

    try {
      const { subscription } = schema.parse(req.body);
      await prisma.user.update({
        where: { id: req.user.sub },
        data: { pushSubscription: subscription as any },
      });
      return reply.status(201).send({ message: 'Inscrição salva com sucesso!' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('[push/register]', error);
      return reply.status(500).send({ error: 'Erro ao salvar inscrição' });
    }
  });

  // ── GET /notificacoes ─────────────────────────────────────────────
  app.get('/notificacoes', { onRequest: [verifyJWT] }, async (request, reply) => {
    const { sub: usuarioId } = request.user;

    const notificacoes = await prisma.notification.findMany({
      where: { userId: usuarioId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return reply.send(notificacoes.map(n => ({
      id: n.id,
      titulo: n.titulo,
      conteudo: n.content,
      tipo: n.tipo,
      link: n.link,
      entidade: n.entidade,
      entidadeId: n.entidadeId,
      visualizada: n.visualizada,
      created_at: n.created_at,
      usuarioId: n.userId,
    })));
  });

  // ── PATCH /notificacoes/:id/lida ───────────────────────────────────
  app.patch('/notificacoes/:id/lida', { onRequest: [verifyJWT] }, async (request, reply) => {
    const { sub: usuarioId } = request.user;
    const { id } = request.params as { id: string };

    await prisma.notification.updateMany({
      where: { id, userId: usuarioId },
      data:  { visualizada: true },
    });

    return reply.status(204).send();
  });

  // ── PATCH /notificacoes/marcar-todas-lidas ─────────────────────────
  app.patch('/notificacoes/marcar-todas-lidas', { onRequest: [verifyJWT] }, async (request, reply) => {
    const { sub: usuarioId } = request.user;

    await prisma.notification.updateMany({
      where: { userId: usuarioId, visualizada: false },
      data:  { visualizada: true },
    });

    return reply.status(204).send();
  });
}
