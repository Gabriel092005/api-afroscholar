import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateDepartamentoUseCase } from '@/use-cases/factories/make-create-departamento-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
  const createBodySchema = z.object({
    nome: z.string(),
    empresaId: z.string().uuid(),
  })

  const { nome, empresaId } = createBodySchema.parse(request.body)

  const createUseCase = makeCreateDepartamentoUseCase()
  await createUseCase.execute({ nome, empresaId })

  return reply.status(201).send()
}