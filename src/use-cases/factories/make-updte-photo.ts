import { PrismaUserRepository } from "@/repositories/prisma/prisma-user-repository"
import { UpdateProfileImage } from "../update-photo-profile"




export function makeUpdateProfileImageUserCase (){
    
    const usersRepository = new PrismaUserRepository()
    const UseCase = new UpdateProfileImage(usersRepository)

    return UseCase
}