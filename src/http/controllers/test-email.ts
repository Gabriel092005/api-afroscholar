import { FastifyReply, FastifyRequest } from "fastify";
import { transporter } from "@/lib/mail";
import { env } from "@/Env";
import { z } from "zod";

const testEmailSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function testEmail(req: FastifyRequest, res: FastifyReply) {
  try {
    const { email } = testEmailSchema.parse(req.body);

    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: email,
      subject: "Teste de Email — Afroscholars",
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Teste de Email</h1>
    </div>
    <div class="body">
      <h2>Olá!</h2>
      <p>Este é um email de teste enviado pelo servidor da Afroscholars.</p>
      <p>Se recebeu este email, o serviço de email está a funcionar correctamente.</p>
      <p style="margin-top: 24px; font-size: 13px; color: #666;">
        SMTP Host: ${env.SMTP_HOST}:${env.SMTP_PORT}<br/>
        SMTP User: ${env.SMTP_USER}<br/>
        Email From: ${env.EMAIL_FROM || env.SMTP_USER}
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

    return res.send({ success: true, message: `Email de teste enviado para ${email}` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({
      success: false,
      error: "Erro ao enviar email de teste",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
