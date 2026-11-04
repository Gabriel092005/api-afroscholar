import { bolsasComMentoria, eStaff, temMentoriaPaga } from "@/lib/mentoria-acesso";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function meuAcessoMentoria(req: FastifyRequest, res: FastifyReply) {
  try {
    const usuarioId = req.user.sub;
    const [staff, paga, bolsas, acessos] = await Promise.all([
      eStaff(usuarioId),
      temMentoriaPaga(usuarioId),
      bolsasComMentoria(usuarioId),
      prisma.mentoriaAcesso.findMany({
        where: { usuarioId, expiraEm: { gt: new Date() } },
        select: { bolsaId: true, mentoriaId: true, expiraEm: true },
      }),
    ]);
    return res.send({ ia: staff || paga, bolsas, acessos });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao verificar o acesso." });
  }
}
