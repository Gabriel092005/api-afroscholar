import type { PagamentoMomenu, TipoPagamentoMomenu } from "@/generated/client";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { enviarEmailComAnexo } from "@/lib/mail";
import prisma from "@/lib/prisma";

/** Fontes base do PDF: não precisam de ficheiros no servidor. */
const impressora = new PdfPrinter({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});

const ROTULO_TIPO: Record<TipoPagamentoMomenu, string> = {
  CURSO: "Curso",
  BOLSA: "Bolsa",
  MENTORIA: "Mentoria",
  DOCUMENTO: "Documento",
  ANALISE: "Análise de documento",
};

const formatarKz = (valor: number) => `${valor.toLocaleString("pt-PT")} Kz`;
const formatarData = (data: Date) =>
  data.toLocaleString("pt-PT", { timeZone: "Africa/Luanda", dateStyle: "short", timeStyle: "short" });

type Venda = Pick<PagamentoMomenu, "tipo" | "alvoId">;

/**
 * O nome do que foi vendido, o telefone dado no pedido (a inscrição na bolsa pede um)
 * e o caminho no site onde o cliente pode retomar a compra.
 */
export async function detalheDaVenda(
  venda: Venda
): Promise<{ produto: string; telefone: string | null; caminho: string }> {
  const tipo = ROTULO_TIPO[venda.tipo];
  try {
    if (venda.tipo === "CURSO") {
      const alvo = await prisma.cursoPagamento.findUnique({
        where: { id: venda.alvoId },
        select: { curso: { select: { id: true, titulo: true } } },
      });
      return {
        produto: `${tipo}: ${alvo?.curso.titulo ?? "—"}`,
        telefone: null,
        caminho: alvo ? `/cursos/${alvo.curso.id}` : "/cursos",
      };
    }
    if (venda.tipo === "BOLSA") {
      const alvo = await prisma.bolsaInscricao.findUnique({
        where: { id: venda.alvoId },
        select: { telefone: true, tipoInteresse: true, bolsa: { select: { id: true, titulo: true } } },
      });
      const servico = alvo?.tipoInteresse ? ` (${alvo.tipoInteresse.toLowerCase()})` : "";
      const query = alvo?.tipoInteresse ? `?servico=${alvo.tipoInteresse.toLowerCase()}` : "";
      return {
        produto: `${tipo}${servico}: ${alvo?.bolsa.titulo ?? "—"}`,
        telefone: alvo?.telefone ?? null,
        caminho: alvo ? `/bolsas/${alvo.bolsa.id}${query}` : "/bolsas",
      };
    }
    if (venda.tipo === "MENTORIA") {
      const alvo = await prisma.mentoriaInscricao.findUnique({
        where: { id: venda.alvoId },
        select: { mentoria: { select: { nome: true, bolsaId: true } } },
      });
      return {
        produto: `${tipo}: ${alvo?.mentoria.nome ?? "—"}`,
        telefone: null,
        caminho: alvo?.mentoria.bolsaId ? `/bolsas/${alvo.mentoria.bolsaId}?servico=mentoria` : "/bolsas",
      };
    }
    if (venda.tipo === "DOCUMENTO") {
      const alvo = await prisma.documentoCompra.findUnique({
        where: { id: venda.alvoId },
        select: { documento: { select: { titulo: true } } },
      });
      return { produto: `${tipo}: ${alvo?.documento.titulo ?? "—"}`, telefone: null, caminho: "/documentos" };
    }
  } catch {
    // O alvo pode ter sido apagado; o tipo chega para a equipa saber do que se trata.
  }
  return {
    produto: tipo,
    telefone: null,
    caminho: venda.tipo === "ANALISE" ? "/analise-documento" : "/minhas-atividades",
  };
}

export type ContactoVenda = {
  nome: string;
  email: string;
  telefone: string;
  produtos: string[];
  valor: number;
  ultimaTentativa: Date;
  pagou: boolean;
};

/**
 * Uma linha por cliente que tentou comprar no período. Conta como "pagou" quem tem pelo menos
 * um pagamento concluído; os restantes ficaram com pagamentos falhados ou por pagar.
 */
export async function contactosDeVendas(desde: Date): Promise<ContactoVenda[]> {
  const pagamentos = await prisma.pagamentoMomenu.findMany({
    where: { created_at: { gte: desde }, usuarioId: { not: null } },
    orderBy: { created_at: "desc" },
    select: {
      tipo: true,
      alvoId: true,
      valor: true,
      status: true,
      created_at: true,
      usuario: { select: { id: true, nome: true, email: true, phone: true } },
    },
  });

  // A lista vem da mais recente para a mais antiga: a primeira linha de cada cliente é a última tentativa.
  const porCliente = new Map<string, ContactoVenda & { valorPago: number; valorUltima: number }>();
  for (const p of pagamentos) {
    if (!p.usuario) continue;
    const detalhe = await detalheDaVenda(p);
    const atual = porCliente.get(p.usuario.id) ?? {
      nome: p.usuario.nome,
      email: p.usuario.email,
      telefone: p.usuario.phone ?? "",
      produtos: [],
      valor: 0,
      ultimaTentativa: p.created_at,
      pagou: false,
      valorPago: 0,
      valorUltima: p.valor,
    };
    if (!atual.telefone && detalhe.telefone) atual.telefone = detalhe.telefone;
    if (!atual.produtos.includes(detalhe.produto)) atual.produtos.push(detalhe.produto);
    if (p.status === "PAGO") {
      atual.pagou = true;
      atual.valorPago += p.valor;
    }
    porCliente.set(p.usuario.id, atual);
  }

  // Quem pagou: o total pago. Quem não pagou: o valor da última tentativa, não a soma das repetições.
  return [...porCliente.values()].map(({ valorPago, valorUltima, ...c }) => ({
    ...c,
    valor: c.pagou ? valorPago : valorUltima,
  }));
}

function tabelaDeContactos(contactos: ContactoVenda[], vazio: string): Content {
  if (contactos.length === 0) return { text: vazio, italics: true, color: "#6b7280", margin: [0, 4, 0, 16] };
  return {
    margin: [0, 4, 0, 18],
    table: {
      headerRows: 1,
      widths: [16, "*", 78, "*", "*", 62, 62],
      body: [
        ["#", "Nome", "Telefone", "Email", "Produto(s)", "Valor", "Última tentativa"].map((t) => ({
          text: t,
          bold: true,
          color: "#ffffff",
          fillColor: "#059669",
        })),
        ...contactos.map((c, i) => [
          String(i + 1),
          c.nome,
          c.telefone || "—",
          c.email,
          c.produtos.join("\n"),
          formatarKz(c.valor),
          formatarData(c.ultimaTentativa),
        ]),
      ],
    },
    layout: {
      fillColor: (linha: number) => (linha > 0 && linha % 2 === 0 ? "#f3f4f6" : null),
      hLineColor: () => "#e5e7eb",
      vLineColor: () => "#e5e7eb",
    },
  };
}

/** PDF com duas listas: quem não pagou (ligar primeiro) e quem pagou (acompanhamento). */
export function gerarPdfContactos(contactos: ContactoVenda[], desde: Date): Promise<Buffer> {
  const naoPagaram = contactos.filter((c) => !c.pagou);
  const pagaram = contactos.filter((c) => c.pagou);

  const documento: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 36, 28, 36],
    defaultStyle: { font: "Helvetica", fontSize: 8.5 },
    info: { title: "Contactos para a equipa de vendas" },
    footer: (pagina, total) => ({
      text: `Afroscholars — página ${pagina} de ${total}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
    }),
    content: [
      { text: "Contactos para a equipa de vendas", fontSize: 16, bold: true, color: "#111827" },
      {
        text: `Período: desde ${formatarData(desde)} · Gerado em ${formatarData(new Date())} · ${contactos.length} cliente(s)`,
        color: "#6b7280",
        margin: [0, 2, 0, 14],
      },
      { text: `Não pagaram (${naoPagaram.length})`, fontSize: 12, bold: true, color: "#b91c1c" },
      tabelaDeContactos(naoPagaram, "Nenhum cliente com pagamento por concluir neste período."),
      { text: `Pagaram (${pagaram.length})`, fontSize: 12, bold: true, color: "#047857" },
      tabelaDeContactos(pagaram, "Nenhum pagamento concluído neste período."),
    ],
  };

  return new Promise((resolve, reject) => {
    const pdf = impressora.createPdfKitDocument(documento);
    const partes: Buffer[] = [];
    pdf.on("data", (parte: Buffer) => partes.push(parte));
    pdf.on("end", () => resolve(Buffer.concat(partes)));
    pdf.on("error", reject);
    pdf.end();
  });
}

/** Envia o PDF de contactos a todas as contas activas de atendimento. */
export async function enviarContactosAoAtendimento(desde: Date, mensagem?: string) {
  const [equipa, contactos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ATENDIMENTO", estado_conta: "ACTIVA" },
      select: { email: true },
    }),
    contactosDeVendas(desde),
  ]);
  if (equipa.length === 0) {
    return { enviados: 0, destinatarios: 0, contactos: contactos.length, pagaram: 0, naoPagaram: 0 };
  }

  const pdf = await gerarPdfContactos(contactos, desde);
  const naoPagaram = contactos.filter((c) => !c.pagou).length;
  const pagaram = contactos.length - naoPagaram;
  const data = new Date().toISOString().slice(0, 10);

  const enviados = await enviarEmailComAnexo(
    equipa.map((m) => m.email),
    `Contactos para ligar — ${data}`,
    {
      titulo: "Contactos para a equipa de vendas",
      resumo: `${naoPagaram} cliente(s) por concluir o pagamento e ${pagaram} que já pagaram.`,
      saudacao: "Olá, equipa!",
      paragrafos: [
        ...(mensagem ? [mensagem] : []),
        `Em anexo está a lista de clientes que tentaram comprar desde ${formatarData(desde)}.`,
      ],
      lista: [`Não pagaram: ${naoPagaram} (ligar primeiro)`, `Pagaram: ${pagaram} (acompanhamento)`],
    },
    [{ filename: `contactos-vendas-${data}.pdf`, content: pdf, contentType: "application/pdf" }]
  );

  return { enviados, destinatarios: equipa.length, contactos: contactos.length, pagaram, naoPagaram };
}
