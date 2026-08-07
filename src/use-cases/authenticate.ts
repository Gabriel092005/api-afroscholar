import { User } from "@/generated/client";
import { invalidCredentialsError } from "@/repositories/errors/invalid-credentials";
import { UserSuspendedError } from "@/repositories/errors/user-suspend";
import { usersRepository } from "@/repositories/users-repository";
import bcrypt from "bcryptjs";

interface AuthenticateUseCaseRequest {
  email: string;
  password: string;
}

interface AuthenticateUseCaseResponse {
  user: User;
}

export class AuthenticateUseCase {
  constructor(private usersRespository: usersRepository) {}

  async execute({
    email,
    password,
  }: AuthenticateUseCaseRequest): Promise<AuthenticateUseCaseResponse> {

    const user = await this.usersRespository.findByEmail(email.trim().toLowerCase());

    if (!user) {
      throw new invalidCredentialsError();
    }

    if (user.estado_conta === 'INACTIVA') {
       throw new UserSuspendedError();
    }

    const doesPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!doesPasswordMatch) {
      throw new invalidCredentialsError();
    }

    return {
      user,
    };
  }
}
