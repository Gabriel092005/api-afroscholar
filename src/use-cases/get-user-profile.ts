import { User } from "@/generated/client"
import { resourceNotFoundError } from "@/repositories/errors/resource-not-found"
import { usersRepository } from "@/repositories/users-repository"

interface GetUserProfileUseCaseRequest {
  userId: string
}

interface GetUserProfileUseCaseResponse {
  user: Omit<User, "password">
}

export class GetUserProfileUseCase {
  constructor(private usersRepository: usersRepository) {}

  async execute({
    userId,
  }: GetUserProfileUseCaseRequest): Promise<GetUserProfileUseCaseResponse> {

    const user = await this.usersRepository.findById(userId)

    if (!user) {
      throw new resourceNotFoundError()
    }

    const { password, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
    }
  }
}
