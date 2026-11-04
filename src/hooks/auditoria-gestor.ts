import type { FastifyInstance, FastifyRequest } from "fastify";
import { notificarAdmins } from "@/lib/notificar-admins";
import prisma from "@/lib/prisma";

type Params = Record<string, string>;

type Operacao = {
  /** "Fulano <feito>": criou um documento */
  feito: string;
  /** "Fulano tentou <tentativa>": criar um documento */
  tentativa: string;
  entidade: string;
  link: string;
  /** Lê o nome antes da operação: depois de excluir, já não existe. */
  nome?: (params: Params) => Promise<string | null | undefined>;
};

const nomeDocumento = ({ id }: Params) =>
  prisma.documento.findUnique({ where: { id }, select: { titulo: true } }).then((d) => d?.titulo);
const nomeBolsa = ({ id }: Params) =>
  prisma.bolsa.findUnique({ where: { id }, select: { titulo: true } }).then((b) => b?.titulo);
const nomeCurso = ({ id, cursoId }: Params) =>
  prisma.curso.findUnique({ where: { id: id ?? cursoId }, select: { titulo: true } }).then((c) => c?.titulo);
const nomeAulaCurso = ({ aulaId }: Params) =>
  prisma.aula.findUnique({ where: { id: aulaId }, select: { titulo: true } }).then((a) => a?.titulo);
const nomeAulaOnline = ({ id }: Params) =>
  prisma.aulaOnline.findUnique({ where: { id }, select: { titulo: true } }).then((a) => a?.titulo);
const nomeNovidade = ({ id }: Params) =>
  prisma.novidade.findUnique({ where: { id }, select: { title: true } }).then((n) => n?.title);
const nomeComunidade = ({ id }: Params) =>
  prisma.community.findUnique({ where: { id }, select: { nome: true } }).then((c) => c?.nome);
const nomeInscricao = ({ id }: Params) =>
  prisma.bolsaInscricao
    .findUnique({ where: { id }, select: { bolsa: { select: { titulo: true } } } })
    .then((i) => i?.bolsa.titulo);
const nomePagamentoCurso = ({ id }: Params) =>
  prisma.cursoPagamento
    .findUnique({ where: { id }, select: { curso: { select: { titulo: true } } } })
    .then((p) => p?.curso.titulo);

const operacao = (
  feito: string,
  tentativa: string,
  entidade: string,
  link: string,
  nome?: Operacao["nome"]
): Operacao => ({ feito, tentativa, entidade, link, nome });

// Só o que muda dados relevantes. Mensagens no chat ou marcar notificações como lidas não entram.
const OPERACOES: Record<string, Operacao> = {
  "POST /gestor/documentos": operacao("carregou um documento", "carregar um documento", "documento", "/gestor/documentos"),
  "PUT /gestor/documentos/:id": operacao("editou um documento", "editar um documento", "documento", "/gestor/documentos", nomeDocumento),
  "DELETE /gestor/documentos/:id": operacao("excluiu um documento", "excluir um documento", "documento", "/gestor/documentos", nomeDocumento),

  "POST /bolsas": operacao("criou uma bolsa", "criar uma bolsa", "bolsa", "/admin/bolsas"),
  "PUT /bolsas/:id": operacao("editou uma bolsa", "editar uma bolsa", "bolsa", "/admin/bolsas", nomeBolsa),
  "DELETE /bolsas/:id": operacao("excluiu uma bolsa", "excluir uma bolsa", "bolsa", "/admin/bolsas", nomeBolsa),
  "PUT /inscricoes/:id/avaliar": operacao("avaliou uma inscrição", "avaliar uma inscrição", "inscricao", "/admin/inscricoes", nomeInscricao),

  "POST /cursos": operacao("criou um curso", "criar um curso", "curso", "/admin/cursos"),
  "PUT /cursos/:id": operacao("editou um curso", "editar um curso", "curso", "/admin/cursos", nomeCurso),
  "DELETE /cursos/:id": operacao("excluiu um curso", "excluir um curso", "curso", "/admin/cursos", nomeCurso),
  "POST /cursos/:id/publicar": operacao("alterou a publicação de um curso", "publicar um curso", "curso", "/admin/cursos", nomeCurso),
  "POST /cursos/:cursoId/aulas": operacao("adicionou uma aula ao curso", "adicionar uma aula ao curso", "curso", "/admin/cursos", nomeCurso),
  "DELETE /cursos/:cursoId/aulas/:aulaId": operacao("removeu uma aula de um curso", "remover uma aula de um curso", "curso", "/admin/cursos", nomeAulaCurso),
  "PUT /cursos/pagamentos/:id/avaliar": operacao("avaliou um pagamento de curso", "avaliar um pagamento de curso", "pagamento", "/admin/cursos/pagamentos", nomePagamentoCurso),

  "POST /aulas": operacao("agendou uma aula ao vivo", "agendar uma aula ao vivo", "aula", "/admin/aulas-online"),
  "PATCH /aulas/:id/status": operacao("alterou o estado de uma aula ao vivo", "alterar o estado de uma aula ao vivo", "aula", "/admin/aulas-online", nomeAulaOnline),
  "DELETE /aulas/:id": operacao("excluiu uma aula ao vivo", "excluir uma aula ao vivo", "aula", "/admin/aulas-online", nomeAulaOnline),

  "POST /mentorias": operacao("criou uma mentoria", "criar uma mentoria", "mentoria", "/admin/mentoria"),

  "POST /novidades": operacao("criou uma novidade", "criar uma novidade", "novidade", "/admin/novidades"),
  "PUT /novidades/:id": operacao("editou uma novidade", "editar uma novidade", "novidade", "/admin/novidades", nomeNovidade),
  "DELETE /novidades/:id": operacao("excluiu uma novidade", "excluir uma novidade", "novidade", "/admin/novidades", nomeNovidade),

  "POST /comunidades": operacao("criou uma comunidade", "criar uma comunidade", "comunidade", "/admin/comunidades"),
  "PUT /comunidades/:id": operacao("editou uma comunidade", "editar uma comunidade", "comunidade", "/admin/comunidades", nomeComunidade),
  "DELETE /comunidades/:id": operacao("excluiu uma comunidade", "excluir uma comunidade", "comunidade", "/admin/comunidades", nomeComunidade),
  "PUT /comunidades/:id/solicitacoes/:membroId": operacao("respondeu a um pedido de entrada", "responder a um pedido de entrada", "comunidade", "/admin/comunidades", nomeComunidade),
  "DELETE /comunidades/:id/membros/:membroId": operacao("removeu um membro de uma comunidade", "remover um membro de uma comunidade", "comunidade", "/admin/comunidades", nomeComunidade),

  "PATCH /admin/analise-documento/:id": operacao("alterou uma análise de documento", "alterar uma análise de documento", "analise", "/admin/analise-documento"),
  "PUT /update": operacao("alterou os dados da conta", "alterar os dados da conta", "usuario", "/admin/gestores"),
};

const LINK_NEGADO = "/admin/gestores";
const INTERVALO_REPETIDOS_MS = 10 * 60 * 1000;

// A mesma recusa repetida (duplo clique, ecrã a recarregar) só avisa uma vez.
const ultimosAvisos = new Map<string, number>();

function jaAvisado(chave: string) {
  const agora = Date.now();
  if (ultimosAvisos.size > 1000) {
    for (const [k, quando] of ultimosAvisos) {
      if (agora - quando > INTERVALO_REPETIDOS_MS) ultimosAvisos.delete(k);
    }
  }
  const anterior = ultimosAvisos.get(chave);
  if (anterior && agora - anterior < INTERVALO_REPETIDOS_MS) return true;
  ultimosAvisos.set(chave, agora);
  return false;
}

type Registo = { nome?: string | null; resposta?: { titulo?: unknown; message?: unknown } };
const registos = new WeakMap<FastifyRequest, Registo>();

const operacaoDe = (req: FastifyRequest) => OPERACOES[`${req.method} ${req.routeOptions.url}`];

function lerResposta(payload: unknown): Registo["resposta"] {
  if (typeof payload !== "string" || payload.length > 20_000) return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

async function usuarioDoPedido(req: FastifyRequest): Promise<string | null> {
  const atual = (req.user as { sub?: string } | undefined)?.sub;
  if (atual) return atual;
  return req
    .jwtVerify<{ sub: string }>()
    .then((token) => token.sub)
    .catch(() => null);
}

/** O corpo em multipart é lido pelo multer e fica no pedido original. */
function corpoDoPedido(req: FastifyRequest): Record<string, unknown> {
  const raw = (req.raw as unknown as { body?: Record<string, unknown> }).body;
  return { ...((req.body as Record<string, unknown> | null) ?? {}), ...(raw ?? {}) };
}

function detalhesDoPedido(corpo: Record<string, unknown>): string[] {
  const detalhes: string[] = [];
  if (corpo.preco !== undefined && corpo.preco !== "") {
    const preco = Number(corpo.preco);
    if (Number.isFinite(preco)) {
      detalhes.push(preco > 0 ? `Preço: ${preco.toLocaleString("pt-PT")} Kz` : "Gratuito");
    }
  }
  if (typeof corpo.status === "string") detalhes.push(`Estado: ${corpo.status}`);
  return detalhes;
}

/**
 * Avisa os administradores do que os gestores fazem, ou tentam fazer.
 *
 * Fica à volta das rotas, e não em cada controlador, para uma recusa da verificação
 * de permissões também contar: nesses casos o controlador nunca chega a correr.
 */
export function registarAuditoriaGestor(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => {
    const params = (req.params ?? {}) as Params;
    const op = operacaoDe(req);
    if (!op?.nome) return;
    const nome = await op.nome(params).catch(() => null);
    registos.set(req, { nome });
  });

  app.addHook("onSend", async (req, _reply, payload) => {
    if (operacaoDe(req)) {
      registos.set(req, { ...registos.get(req), resposta: lerResposta(payload) });
    } else if (_reply.statusCode === 401 || _reply.statusCode === 403) {
      registos.set(req, { resposta: lerResposta(payload) });
    }
    return payload;
  });

  // Depois de a resposta sair: um aviso falhado não pode afetar o pedido do gestor.
  app.addHook("onResponse", async (req, reply) => {
    try {
      if (!req.routeOptions.url) return;
      const op = operacaoDe(req);
      const status = reply.statusCode;
      const recusado = status === 401 || status === 403;
      if (!op && !recusado) return;

      const usuarioId = await usuarioDoPedido(req);
      if (!usuarioId) return;
      const gestor = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { nome: true, role: true },
      });
      if (gestor?.role !== "GESTOR") return;

      const conseguiu = status < 400;
      const params = (req.params ?? {}) as Params;
      const registo = registos.get(req);

      if (!conseguiu && jaAvisado(`${usuarioId}:${req.method}:${req.url}`)) return;

      const corpo = corpoDoPedido(req);
      const nome =
        registo?.nome ??
        (registo?.resposta?.titulo as string | undefined) ??
        (typeof corpo.titulo === "string" ? corpo.titulo : undefined) ??
        (typeof corpo.nome === "string" ? corpo.nome : undefined);

      const partes = [
        ...(nome ? [`"${nome}"`] : []),
        ...(op ? detalhesDoPedido(corpo) : []),
        ...(!op ? [`Pedido: ${req.method} ${req.routeOptions.url}`] : []),
        ...(!conseguiu
          ? [
              typeof registo?.resposta?.message === "string" && registo.resposta.message !== "unauthorized"
                ? `Motivo: ${registo.resposta.message}`
                : recusado
                  ? "Motivo: sem permissão"
                  : "Motivo: dados inválidos ou erro no servidor",
            ]
          : []),
      ];

      await notificarAdmins({
        titulo: conseguiu
          ? `${gestor.nome} ${op!.feito}`
          : `${gestor.nome} tentou ${op?.tentativa ?? "aceder a uma área sem permissão"}`,
        conteudo: partes.join(" · "),
        tipo: conseguiu ? "INFO" : "ERRO",
        link: op?.link ?? LINK_NEGADO,
        entidade: op?.entidade ?? "acesso",
        entidadeId: params.id ?? params.cursoId,
      });
    } catch (error) {
      req.log.error(error, "Falha ao avisar os administradores");
    }
  });
}
