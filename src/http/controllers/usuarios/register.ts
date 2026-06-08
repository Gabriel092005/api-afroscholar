import { FastifyRequest, FastifyReply } from "fastify"
import { z } from "zod"
import { UserAreadyExistsError } from "@/repositories/errors/user-already-exists-error"
import { upload } from "@/utills/multer"
import { makeRegisterUsersUseCase } from "@/use-cases/factories/make-register"
import { sendWelcomeEmail } from "@/lib/mail"

export async function registerController(request: FastifyRequest, reply: FastifyReply) {
  try {

    await new Promise<void>((resolve, reject) => {
      upload.single("image")(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err)
        resolve()
      })
    })

    const rawReq = request.raw as any
    const file = rawReq.file

    const registerBodySchema = z.object({
      nome: z.string(),
      email: z.string().email(),
      phone: z.string(),
      password: z.string().min(6),
    })

    const body = rawReq.body || request.body || {}
    const { nome, email, phone, password } = registerBodySchema.parse(body)

    const registerUseCase = makeRegisterUsersUseCase()

    const { user } = await registerUseCase.Execute({
      nome,
      email,
      phone,
      palavraPasse: password,
      image_path: file ? file.filename : undefined,
    })

    sendWelcomeEmail(email, nome).catch((err) =>
      console.error("⚠️ Failed to send welcome email:", err?.message)
    );

    const token = await reply.jwtSign(
      { role: user.role },
      {
        sub: String(user.id),
        expiresIn: '2d'
      }
    )

    const refreshToken = await reply.jwtSign(
      { role: user.role },
      {
        sub: String(user.id),
        expiresIn: '7d',
      }
    )

    return reply
      .setCookie('refreshToken', refreshToken, {
        path: '/',
        secure: true, // true em produção (HTTPS)
        httpOnly: true,
        sameSite: 'none'
      })
      .status(201) // 201 Created é o ideal para registro
      .send({
        token,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          image_path: user.image_path,
          estado_conta: user.estado_conta,
          phone: user.phone,
          created_at: user.created_at,
          last_active_at: user.last_active_at,
        },
      })

  } catch (err) {
    if (err instanceof UserAreadyExistsError) {
      return reply.status(409).send({ message: err.message })
    }

    if (err instanceof z.ZodError) {
      return reply.status(400).send({ message: "Erro de validação", issues: err.format() })
    }

    console.error(err)
    return reply.status(500).send({ message: "Erro interno no servidor" })
  }
}
