import { FastifyReply, FastifyRequest } from "fastify";
import { sendTestEmail } from "@/lib/mail";
import { z } from "zod";

const testEmailSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function testEmail(req: FastifyRequest, res: FastifyReply) {
  try {
    const { email } = testEmailSchema.parse(req.body);

    await sendTestEmail(email);

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
