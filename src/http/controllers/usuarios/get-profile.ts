// src/http/controllers/users/get-profile.ts

import { resourceNotFoundError } from "@/repositories/errors/resource-not-found"
import { makeGetUserProfileUseCase } from "@/use-cases/factories/make-getProfile"
import { FastifyRequest, FastifyReply } from "fastify"

export async function getProfile(
  request: FastifyRequest,
  reply: FastifyReply
) {


  const userId = request.user.sub

  try {
    const useCase = makeGetUserProfileUseCase()

    const { user } = await useCase.execute({
      userId
    })

    return reply.status(200).send({
      user,
    })
  } catch (err) {
    if (err instanceof resourceNotFoundError) {
      return reply.status(404).send({
        err
      })
    }

    throw err
  }
}