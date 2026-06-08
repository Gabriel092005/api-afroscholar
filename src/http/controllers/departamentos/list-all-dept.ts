
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeListDepartamentoUseCase } from '@/use-cases/factories/make-list-dept'

export async function ListDept(request: FastifyRequest, reply: FastifyReply) {
  const createBodySchema = z.object({
    empresaId: z.string().uuid(),
  })
  const { empresaId } = createBodySchema.parse(request.query)

  const createUseCase = makeListDepartamentoUseCase()
  const { departamentos }= await createUseCase.execute({ empresaId })

  return reply.status(201).send({
   departamentos
  })
}