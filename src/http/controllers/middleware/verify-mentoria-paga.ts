import { eStaff, temMentoriaPaga } from "@/lib/mentoria-acesso";
import { FastifyReply, FastifyRequest } from "fastify";

/** A IA está incluída na mentoria: quem ainda não pagou recebe 403, sem gastar uso da IA. */
export async function verifyMentoriaPaga(request: FastifyRequest, reply: FastifyReply) {
  const usuarioId = request.user.sub;
  if ((await eStaff(usuarioId)) || (await temMentoriaPaga(usuarioId))) return;

  return reply.status(403).send({
    error: "MENTORIA_NECESSARIA",
    message: "A inteligência artificial está incluída na mentoria. Adquira uma mentoria para a usar.",
  });
}
