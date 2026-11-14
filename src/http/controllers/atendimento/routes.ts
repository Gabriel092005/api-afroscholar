import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { contactosDeVendas, enviarContactosAoAtendimento, gerarPdfContactos } from "@/lib/atendimento";
import prisma from "@/lib/prisma";
import {
  enviarPdfWhatsapp,
  lerTokenPdf,
  linkPdfContactos,
  linkWhatsapp,
  normalizarNumero,
  whatsappApiConfigurada,
} from "@/lib/whatsapp";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

/** Período da lista: os últimos N dias (por omissão 30, no máximo um ano). */
const periodoSchema = z.object({
  dias: z.coerce.number().int().min(1).max(365).default(30),
});

const envioSchema = periodoSchema.extend({
  mensagem: z.string().trim().max(1000).optional(),
});

function desdeHaDias(dias: number) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

function responderErro(req: FastifyRequest, res: FastifyReply, erro: unknown, mensagem: string) {
  if (erro instanceof z.ZodError) {
    return res.status(400).send({ message: erro.errors.map((e) => e.message).join(", ") });
  }
  req.log.error(erro);
  return res.status(500).send({ message: erro instanceof Error ? erro.message : mensagem });
}

export async function atendimentoRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  /** Resumo para o painel: equipa de atendimento e totais do período. */
  fastify.get("/admin/atendimento/resumo", apenasAdmin, async (req, res) => {
    try {
      const { dias } = periodoSchema.parse(req.query);
      const [equipa, contactos] = await Promise.all([
        prisma.user.findMany({
          where: { role: "ATENDIMENTO" },
          select: { id: true, nome: true, email: true, phone: true, estado_conta: true },
          orderBy: { nome: "asc" },
        }),
        contactosDeVendas(desdeHaDias(dias)),
      ]);
      const pagaram = contactos.filter((c) => c.pagou).length;
      return res.send({ dias, equipa, total: contactos.length, pagaram, naoPagaram: contactos.length - pagaram });
    } catch (erro) {
      return responderErro(req, res, erro, "Erro ao carregar o resumo do atendimento.");
    }
  });

  /** O mesmo PDF que vai por email, para o administrador ver antes de enviar. */
  fastify.get("/admin/atendimento/contactos.pdf", apenasAdmin, async (req, res) => {
    try {
      const { dias } = periodoSchema.parse(req.query);
      const desde = desdeHaDias(dias);
      const pdf = await gerarPdfContactos(await contactosDeVendas(desde), desde);
      return res
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="contactos-vendas-${new Date().toISOString().slice(0, 10)}.pdf"`)
        .send(pdf);
    } catch (erro) {
      return responderErro(req, res, erro, "Erro ao gerar o PDF de contactos.");
    }
  });

  /** Envia o PDF por email a toda a equipa de atendimento activa. */
  fastify.post("/admin/atendimento/enviar-contactos", apenasAdmin, async (req, res) => {
    try {
      const { dias, mensagem } = envioSchema.parse(req.body ?? {});
      const resultado = await enviarContactosAoAtendimento(desdeHaDias(dias), mensagem || undefined);
      if (resultado.destinatarios === 0) {
        return res.status(400).send({ message: "Não há nenhuma conta activa com o cargo de Atendimento." });
      }
      return res.send(resultado);
    } catch (erro) {
      return responderErro(req, res, erro, "Erro ao enviar os contactos.");
    }
  });

  /** Resumo em texto para a mensagem de WhatsApp. */
  async function resumoParaWhatsapp(dias: number, mensagem?: string) {
    const contactos = await contactosDeVendas(desdeHaDias(dias));
    const naoPagaram = contactos.filter((c) => !c.pagou).length;
    const texto =
      (mensagem ? `${mensagem} ` : "") +
      `Lista de contactos dos últimos ${dias} dias: ${naoPagaram} por concluir o pagamento (ligar primeiro) e ${contactos.length - naoPagaram} que já pagaram.`;
    return { contactos, texto };
  }

  async function equipaComWhatsapp() {
    const equipa = await prisma.user.findMany({
      where: { role: "ATENDIMENTO", estado_conta: "ACTIVA" },
      select: { id: true, nome: true, phone: true },
      orderBy: { nome: "asc" },
    });
    return equipa.map((m) => ({ ...m, numero: normalizarNumero(m.phone) }));
  }

  /** Links wa.me prontos, um por atendente, com o resumo e o link seguro (48h) para o PDF. */
  fastify.get("/admin/atendimento/whatsapp", apenasAdmin, async (req, res) => {
    try {
      const { dias, mensagem } = envioSchema.parse(req.query);
      const [{ texto }, equipa] = await Promise.all([resumoParaWhatsapp(dias, mensagem), equipaComWhatsapp()]);
      const mensagemFinal = `${texto}\n\nPDF (válido 48h): ${linkPdfContactos(dias)}`;
      return res.send({
        apiConfigurada: whatsappApiConfigurada(),
        equipa: equipa.map((m) => ({
          id: m.id,
          nome: m.nome,
          phone: m.phone,
          link: m.numero ? linkWhatsapp(m.numero, mensagemFinal) : null,
        })),
      });
    } catch (erro) {
      return responderErro(req, res, erro, "Erro ao preparar as mensagens de WhatsApp.");
    }
  });

  /** Envio automático pela WhatsApp Cloud API (precisa de estar configurada). */
  fastify.post("/admin/atendimento/enviar-whatsapp", apenasAdmin, async (req, res) => {
    try {
      if (!whatsappApiConfigurada()) {
        return res.status(400).send({ message: "A API do WhatsApp não está configurada. Use os links de WhatsApp." });
      }
      const { dias, mensagem } = envioSchema.parse(req.body ?? {});
      const [{ contactos, texto }, equipa] = await Promise.all([resumoParaWhatsapp(dias, mensagem), equipaComWhatsapp()]);
      const numeros = equipa.map((m) => m.numero).filter((n): n is string => Boolean(n));
      if (numeros.length === 0) {
        return res.status(400).send({ message: "Nenhum atendente tem número de telefone no perfil." });
      }
      const pdf = await gerarPdfContactos(contactos, desdeHaDias(dias));
      const data = new Date().toISOString().slice(0, 10);
      const r = await enviarPdfWhatsapp(numeros, pdf, `contactos-vendas-${data}.pdf`, texto);
      return res.send({ ...r, semNumero: equipa.length - numeros.length });
    } catch (erro) {
      return responderErro(req, res, erro, "Erro ao enviar pelo WhatsApp.");
    }
  });

  /** O link do WhatsApp: descarrega o PDF sem sessão, com um token que expira em 48h. */
  fastify.get("/atendimento/contactos.pdf", async (req, res) => {
    const token = (req.query as { token?: string }).token;
    const dias = token ? lerTokenPdf(token) : null;
    if (!dias) return res.status(401).send({ message: "Link inválido ou expirado. Peça um novo ao administrador." });
    const desde = desdeHaDias(dias);
    const pdf = await gerarPdfContactos(await contactosDeVendas(desde), desde);
    return res
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="contactos-vendas-${new Date().toISOString().slice(0, 10)}.pdf"`)
      .send(pdf);
  });
}
