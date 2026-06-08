import { PrismaUserRepository } from "@/repositories/prisma/prisma-user-repository";
import { RegisterUseCase } from "../register";


export function makeRegisterUsersUseCase()
{
     const usersRepository  = new PrismaUserRepository()
     const usecase = new RegisterUseCase(usersRepository)
     return usecase
}