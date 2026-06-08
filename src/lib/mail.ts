import nodemailer from "nodemailer";
import { env } from "@/Env";
import prisma from "@/lib/prisma";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(to: string, nome: string) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("⚠️ SMTP not configured, skipping email to", to);
    }
    return;
  }

  const benefits = [
    "🎓 Bolsas de estudo no exterior",
    "✈️ Programas de intercâmbio",
    "💼 Trabalhos e estágios no exterior",
    "📚 Cursos preparatórios para bolsas de estudos",
    "🌍 Comunidade global para networking e interação",
    "🤖 Inteligência artificial que rastreia oportunidades em tempo real",
  ];

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject: "Bem-vindo à Afroscholars!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #059669; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; }
    .body h2 { margin-top: 0; font-size: 20px; color: #059669; }
    .body p { line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; padding: 12px 28px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    ul { padding-left: 20px; }
    ul li { margin-bottom: 6px; font-size: 14px; color: #444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo à Afroscholars, ${nome}!</h1>
    </div>
    <div class="body">
      <p>A sua conta foi criada com sucesso na plataforma Afroscholars.</p>
      <p>Agora você já pode acessar um universo de oportunidades internacionais, incluindo:</p>
      <ul>
        ${benefits.map((b) => `<li>${b}</li>`).join("\n        ")}
      </ul>
      <p>Comece hoje a sua jornada!</p>
      <a href="${env.FRONTEND_URL}/bolsas" class="btn">Explorar Oportunidades</a>
      <p>Explore oportunidades que podem transformar o seu futuro acadêmico e profissional.</p>
      <p style="margin-top: 16px; font-style: italic; color: #666;">
        A Afroscholars foi criada para conectar estudantes e profissionais africanos às melhores oportunidades do mundo.
      </p>
      <p><strong>Desejamos muito sucesso na sua trajetória!</strong></p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Afroscholars — Transformando o potencial angolano em sucesso global.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Welcome email sent to ${to}`);
    }
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${to}:`, error);
  }
}

export async function sendNewBolsaToAllUsers(titulo: string, descricao: string, link: string) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("⚠️ SMTP not configured, skipping bolsa notification");
    }
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { estado_conta: "ACTIVA" },
      select: { email: true },
    });

    if (users.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("⚠️ No active users to notify");
      }
      return;
    }

    const emails = users.map((u) => u.email);

    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      bcc: emails,
      subject: `Nova Bolsa: ${titulo}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #059669; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; }
    .body h2 { margin-top: 0; font-size: 20px; color: #059669; }
    .body p { line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; padding: 12px 28px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Nova Oportunidade</h1>
    </div>
    <div class="body">
      <h2>${titulo}</h2>
      <p>${descricao}</p>
      <a href="${link}" class="btn">Ver Bolsa</a>
      <p style="margin-top: 24px; font-size: 13px; color: #666;">
        Não perca esta oportunidade! Candidate-se o quanto antes.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Afroscholars — Transformando o potencial angolano em sucesso global.</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ New bolsa notification sent to ${emails.length} users`);
    }
  } catch (error) {
    console.error(`❌ Failed to send bolsa notification:`, error);
  }
}

export async function sendAnaliseConcluidaEmail(to: string, nome: string, tipoDocumento: string, status: string, feedback?: string) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("⚠️ SMTP not configured, skipping analise email to", to);
    }
    return;
  }

  const statusLabel = status === "CONCLUIDO" ? "Concluída" : "Rejeitada";
  const tipoLabel = tipoDocumento === "CV" ? "Currículo (CV)" :
    tipoDocumento === "CARTA_MOTIVACAO" ? "Carta de Motivação" :
    tipoDocumento === "CERTIFICADO" ? "Certificado" : tipoDocumento;

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject: `Análise de Documento ${statusLabel} — Afroscholars`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #059669; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; }
    .body h2 { margin-top: 0; font-size: 20px; color: #059669; }
    .body p { line-height: 1.6; font-size: 15px; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .feedback { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Análise de Documento ${statusLabel}</h1>
    </div>
    <div class="body">
      <h2>Olá, ${nome}!</h2>
      <p>A análise do seu documento <strong>${tipoLabel}</strong> foi <strong>${statusLabel.toLowerCase()}</strong>.</p>
      ${feedback ? `<div class="feedback"><strong>Feedback da equipa:</strong><p>${feedback}</p></div>` : ""}
      <p>Faça login na plataforma para mais detalhes.</p>
      <p style="margin-top: 24px; font-size: 13px; color: #666;">
        Equipa Afroscholars — Criada por Ageu Zenguela
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Afroscholars</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Analise document email sent to ${to}`);
    }
  } catch (error) {
    console.error(`❌ Failed to send analise document email to ${to}:`, error);
  }
}

export async function sendMagicLinkEmail(to: string, link: string) {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("⚠️ SMTP not configured, skipping magic link email to", to);
    }
    return;
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to,
      subject: "Seu link de acesso — Afroscholars",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #059669; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; }
    .body h2 { margin-top: 0; font-size: 20px; color: #059669; }
    .body p { line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; padding: 14px 32px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .note { font-size: 12px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔗 Afroscholars</h1>
    </div>
    <div class="body">
      <h2>Olá!</h2>
      <p>Recebemos o seu pedido de acesso à plataforma <strong>Afroscholars</strong>.</p>
      <p>Clique no botão abaixo para entrar na sua conta:</p>
      <a href="${link}" class="btn">Acessar minha conta</a>
      <p class="note">Este link expira em 10 minutos. Se não foi você que pediu, ignore este email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Afroscholars</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Magic link email sent to ${to}`);
    }
  } catch (error) {
    console.error(`❌ Failed to send magic link email to ${to}:`, error);
  }
}
