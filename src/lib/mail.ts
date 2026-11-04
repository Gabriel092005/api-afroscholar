import nodemailer from "nodemailer";
import { env } from "@/Env";
import prisma from "@/lib/prisma";

const MARCA = "Afroscholars";
const COR = "#059669";
const LEMA = "Transformando o potencial angolano em sucesso global.";

/** Os servidores SMTP limitam os destinatários por mensagem: uma lista grande falharia inteira. */
const DESTINATARIOS_POR_LOTE = 50;
const PAUSA_ENTRE_LOTES_MS = 1000;
const TENTATIVAS = 2;
const PAUSA_ENTRE_TENTATIVAS_MS = 2000;

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  pool: true,
  maxConnections: 3,
  // Sem isto, um servidor SMTP parado prende o envio durante minutos.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

function emailConfigurado() {
  return Boolean(env.SMTP_USER && env.SMTP_PASS);
}

function remetente() {
  return env.EMAIL_FROM || { name: MARCA, address: env.SMTP_USER };
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** As descrições vêm do editor de texto rico, e um corte a meio deixaria etiquetas partidas. */
function textoSimples(html: string) {
  return html
    .replace(/<[^>]*>?/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ConteudoEmail = {
  titulo: string;
  /** Aparece na caixa de entrada, ao lado do assunto. */
  resumo: string;
  saudacao?: string;
  paragrafos: string[];
  lista?: string[];
  destaque?: { titulo: string; texto: string };
  botao?: { texto: string; href: string };
  nota?: string;
};

/**
 * Todo o texto é escapado aqui, por isso nome, título ou feedback nunca entram como HTML.
 * Os estilos ficam em linha e o layout em tabelas porque é o que os clientes de email
 * respeitam; a versão em texto ajuda a entrega e serve quem não mostra HTML.
 */
export function montarEmail(conteudo: ConteudoEmail) {
  const { titulo, resumo, saudacao, paragrafos, lista, destaque, botao, nota } = conteudo;
  const ano = new Date().getFullYear();
  const paragrafo = (texto: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escaparHtml(texto)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escaparHtml(resumo)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${COR};padding:20px 24px;font-size:16px;font-weight:bold;color:#ffffff;">${MARCA}</td>
          </tr>
          <tr>
            <td style="padding:28px 24px 12px;">
              <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#111827;">${escaparHtml(titulo)}</h1>
              ${saudacao ? paragrafo(saudacao) : ""}
              ${paragrafos.map(paragrafo).join("\n              ")}
              ${lista ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:#374151;">${lista.map((item) => `<li>${escaparHtml(item)}</li>`).join("")}</ul>` : ""}
              ${destaque ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#374151;"><strong>${escaparHtml(destaque.titulo)}</strong><br>${escaparHtml(destaque.texto)}</td></tr></table>` : ""}
              ${botao ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background-color:${COR};border-radius:8px;"><a href="${escaparHtml(botao.href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escaparHtml(botao.texto)}</a></td></tr></table>
              <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7280;">Se o botão não funcionar, copie este endereço para o navegador:<br><a href="${escaparHtml(botao.href)}" style="color:${COR};word-break:break-all;">${escaparHtml(botao.href)}</a></p>` : ""}
              ${nota ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7280;">${escaparHtml(nota)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
              © ${ano} ${MARCA} — ${LEMA}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    titulo,
    saudacao,
    ...paragrafos,
    ...(lista ?? []).map((item) => `- ${item}`),
    destaque && `${destaque.titulo}\n${destaque.texto}`,
    botao && `${botao.texto}: ${botao.href}`,
    nota,
    `© ${ano} ${MARCA}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}

function falhaTemporaria(erro: unknown) {
  const { code, responseCode } = erro as { code?: string; responseCode?: number };
  if (responseCode) return responseCode >= 400 && responseCode < 500;
  return ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "EDNS", "ECONNRESET"].includes(code ?? "");
}

/** Lança o erro: é quem chama que decide se uma falha chega ao utilizador. */
async function entregar(mensagem: nodemailer.SendMailOptions) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await transporter.sendMail({ from: remetente(), ...mensagem });
    } catch (erro) {
      if (tentativa >= TENTATIVAS || !falhaTemporaria(erro)) throw erro;
      await esperar(PAUSA_ENTRE_TENTATIVAS_MS);
    }
  }
}

/** Para emails que não podem travar o pedido do utilizador: uma falha só fica registada. */
async function enviar(descricao: string, to: string, assunto: string, conteudo: ConteudoEmail) {
  if (!emailConfigurado()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`⚠️ SMTP not configured, skipping ${descricao} to`, to);
    }
    return false;
  }

  try {
    await entregar({ to, subject: assunto, ...montarEmail(conteudo) });
    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ ${descricao} sent to ${to}`);
    }
    return true;
  } catch (erro) {
    console.error(`❌ Failed to send ${descricao} to ${to}:`, erro);
    return false;
  }
}

/** Avisa no arranque, em vez de só se descobrir o problema quando um utilizador não recebe nada. */
export async function verificarEmail() {
  if (!emailConfigurado()) {
    console.warn("⚠️ SMTP não configurado: os emails não serão enviados.");
    return;
  }
  try {
    await transporter.verify();
  } catch (erro) {
    console.error("❌ O servidor SMTP não aceitou a ligação:", erro);
  }
}

export function sendWelcomeEmail(to: string, nome: string) {
  return enviar("welcome email", to, `Bem-vindo à ${MARCA}!`, {
    titulo: `Bem-vindo à ${MARCA}, ${nome}!`,
    resumo: "A sua conta foi criada. Veja as oportunidades à sua espera.",
    paragrafos: [
      `A sua conta foi criada com sucesso na plataforma ${MARCA}.`,
      "Agora já pode aceder a um universo de oportunidades internacionais, incluindo:",
    ],
    lista: [
      "Bolsas de estudo no exterior",
      "Programas de intercâmbio",
      "Trabalhos e estágios no exterior",
      "Cursos preparatórios para bolsas de estudos",
      "Comunidade global para networking e interação",
      "Inteligência artificial que rastreia oportunidades em tempo real",
    ],
    botao: { texto: "Explorar oportunidades", href: `${env.FRONTEND_URL}/bolsas` },
    nota: `A ${MARCA} foi criada para conectar estudantes e profissionais africanos às melhores oportunidades do mundo.`,
  });
}

export async function sendNewBolsaToAllUsers(titulo: string, descricao: string, link: string) {
  if (!emailConfigurado()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("⚠️ SMTP not configured, skipping bolsa notification");
    }
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { estado_conta: "ACTIVA" },
      select: { email: true },
    });
    if (users.length === 0) return;

    const conteudo = montarEmail({
      titulo,
      resumo: "Há uma nova oportunidade disponível na plataforma.",
      paragrafos: [textoSimples(descricao), "Não perca esta oportunidade! Candidate-se o quanto antes."],
      botao: { texto: "Ver bolsa", href: link },
    });

    // Um lote que falha não impede os seguintes, e os endereços continuam escondidos em Bcc.
    let enviados = 0;
    for (let inicio = 0; inicio < users.length; inicio += DESTINATARIOS_POR_LOTE) {
      const lote = users.slice(inicio, inicio + DESTINATARIOS_POR_LOTE).map((u) => u.email);
      try {
        await entregar({
          to: env.EMAIL_FROM || env.SMTP_USER,
          bcc: lote,
          subject: `Nova bolsa: ${titulo}`,
          ...conteudo,
        });
        enviados += lote.length;
      } catch (erro) {
        console.error(`❌ Failed to send bolsa notification batch of ${lote.length}:`, erro);
      }
      if (inicio + DESTINATARIOS_POR_LOTE < users.length) await esperar(PAUSA_ENTRE_LOTES_MS);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ New bolsa notification sent to ${enviados}/${users.length} users`);
    }
  } catch (erro) {
    console.error("❌ Failed to send bolsa notification:", erro);
  }
}

export function sendAnaliseConcluidaEmail(to: string, nome: string, tipoDocumento: string, status: string, feedback?: string) {
  const statusLabel = status === "CONCLUIDO" ? "concluída" : "rejeitada";
  const tipoLabel =
    tipoDocumento === "CV" ? "Currículo (CV)" :
    tipoDocumento === "CARTA_MOTIVACAO" ? "Carta de Motivação" :
    tipoDocumento === "CERTIFICADO" ? "Certificado" : tipoDocumento;

  return enviar("analise document email", to, `Análise de documento ${statusLabel} — ${MARCA}`, {
    titulo: `Análise de documento ${statusLabel}`,
    resumo: `A análise do seu documento ${tipoLabel} foi ${statusLabel}.`,
    saudacao: `Olá, ${nome}!`,
    paragrafos: [`A análise do seu documento ${tipoLabel} foi ${statusLabel}.`],
    destaque: feedback ? { titulo: "Feedback da equipa", texto: feedback } : undefined,
    botao: { texto: "Ver na plataforma", href: `${env.FRONTEND_URL}/analise-documento` },
    nota: `Equipa ${MARCA} — Criada por Ageu Zenguela`,
  });
}

export function sendMagicLinkEmail(to: string, link: string) {
  return enviar("magic link email", to, `O seu link de acesso — ${MARCA}`, {
    titulo: "O seu link de acesso",
    resumo: "Use este link para entrar. Expira em 10 minutos.",
    saudacao: "Olá!",
    paragrafos: [
      `Recebemos o seu pedido de acesso à plataforma ${MARCA}.`,
      "Clique no botão abaixo para entrar na sua conta:",
    ],
    botao: { texto: "Aceder à minha conta", href: link },
    nota: "Este link expira em 10 minutos. Se não foi você que pediu, ignore este email.",
  });
}

export function sendPasswordResetEmail(to: string, link: string) {
  return enviar("password reset email", to, `Recuperação de palavra-passe — ${MARCA}`, {
    titulo: "Recuperação de palavra-passe",
    resumo: "Defina uma nova palavra-passe. O link expira em 1 hora.",
    paragrafos: [
      "Recebemos um pedido de recuperação de palavra-passe para a sua conta.",
      "Clique no botão abaixo para definir uma nova palavra-passe:",
    ],
    botao: { texto: "Redefinir palavra-passe", href: link },
    nota: "Este link expira em 1 hora. Se não foi você que pediu, ignore este email.",
  });
}

/** Lança o erro de propósito: o diagnóstico existe para o mostrar. */
export async function sendTestEmail(to: string) {
  await entregar({
    to,
    subject: `Teste de email — ${MARCA}`,
    ...montarEmail({
      titulo: "Teste de email",
      resumo: "O serviço de email está a funcionar.",
      saudacao: "Olá!",
      paragrafos: [
        `Este é um email de teste enviado pelo servidor da ${MARCA}.`,
        "Se recebeu este email, o serviço está a funcionar correctamente.",
      ],
    }),
  });
}
