import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { io } from "@/server";
import { upload } from "@/utills/multer";
import { PushService } from "@/lib/push-service";

const mensagemSchema = z.object({
  content: z.string().optional().default(""),
  tipo: z.enum(["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT"]).optional().default("TEXT"),
  anexoUrl: z.string().optional(),
});

export async function enviarMensagem(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const membro = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!membro) {
      return res.status(403).send({ error: "Forbidden", message: "Não é membro desta comunidade." });
    }

    let anexoUrl: string | undefined;
    let tipo: string = "TEXT";
    let content: string = "";

    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("multipart/form-data")) {
      await new Promise<void>((resolve, reject) => {
        upload.single("file")(req.raw as any, res.raw as any, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const rawReq = req.raw as any;
      const file = rawReq.file;

      content = rawReq.body?.content || "";
      tipo = rawReq.body?.tipo || (file ? "DOCUMENT" : "TEXT");

      if (file) {
        const ext = file.mimetype?.split("/")[0];
        if (!tipo || tipo === "TEXT") {
          if (ext === "image") tipo = "IMAGE";
          else if (ext === "video") tipo = "VIDEO";
          else if (ext === "audio") tipo = "AUDIO";
          else tipo = "DOCUMENT";
        }
        anexoUrl = `/uploads/${file.filename}`;
      }
    } else {
      const body = mensagemSchema.parse(req.body);
      content = body.content;
      tipo = body.tipo;
      anexoUrl = body.anexoUrl;
    }

    const mensagem = await prisma.communityMessage.create({
      data: {
        content,
        tipo: tipo as any,
        anexoUrl,
        comunidadeId: id,
        usuarioId,
      },
      include: {
        usuario: {
          select: { id: true, nome: true, image_path: true },
        },
      },
    });

    io.to(`comunidade:${id}`).emit("nova_mensagem", mensagem);

    // Notificar membros (BD + push + Socket.IO)
    const membros = await prisma.communityMember.findMany({
      where: { comunidadeId: id, usuarioId: { not: usuarioId } },
      select: { usuarioId: true },
    });

    for (const m of membros) {
      io.to(m.usuarioId).emit("nova_notificacao", {
        id: '',
        titulo: `💬 ${mensagem.usuario.nome} enviou uma mensagem`,
        conteudo: content.substring(0, 120),
        tipo: 'COMUNIDADE',
        link: `/comunidades/${id}`,
        visualizada: false,
        created_at: new Date().toISOString(),
      });
    }

    PushService.notifyCommunityMembers(id, mensagem.usuario.nome, content, usuarioId);

    return res.status(201).send(mensagem);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    if (error?.message?.includes("Multer")) {
      return res.status(400).send({ error: "Upload failed", message: error.message });
    }
    console.error("[enviar-mensagem]", error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao enviar mensagem." });
  }
}
