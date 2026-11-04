import type { FastifyRequest } from "fastify";
import { cursosComAcesso, eStaff } from "@/lib/mentoria-acesso";

type AulaComMedia = {
  gratuito: boolean;
  videoUrl: string | null;
  videoLocal: string | null;
  pdfUrl: string | null;
};
type CursoAcesso = { id: string; preco: number; bolsaId: string | null };

/**
 * As rotas de cursos são públicas, por isso é aqui que se decide quem recebe os links
 * dos vídeos e PDFs. Bloquear só no ecrã não chega: os links viriam na resposta.
 */
export async function lerAcessoCursos(req: FastifyRequest) {
  const usuarioId = await req
    .jwtVerify<{ sub: string }>()
    .then((token) => token.sub)
    .catch(() => null);

  const [staff, liberados] = usuarioId
    ? await Promise.all([eStaff(usuarioId), cursosComAcesso(usuarioId)])
    : [false, new Set<string>()];

  return function mediaDaAula(curso: CursoAcesso, aula: AulaComMedia) {
    const aberto =
      staff ||
      aula.gratuito ||
      liberados.has(curso.id) ||
      // Preço 0 num curso de bolsa não é gratuito: vem com a mentoria.
      (curso.preco <= 0 && !curso.bolsaId);
    return aberto
      ? { videoUrl: aula.videoUrl, videoLocal: aula.videoLocal, pdfUrl: aula.pdfUrl }
      : { videoUrl: null, videoLocal: null, pdfUrl: null };
  };
}
