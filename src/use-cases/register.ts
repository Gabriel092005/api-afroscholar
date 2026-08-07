import { User } from "@/generated/client";
import { UserAreadyExistsError } from "@/repositories/errors/user-already-exists-error";
import { usersRepository } from "@/repositories/users-repository";
import bcrypt from "bcryptjs"

interface  RegisterUseCaseRequest{
    nome:string;
    phone:string
    email:string
    image_path:string|undefined
    palavraPasse:string
}
interface RegisterUseCaseResponse{
    user:User
}
    export class RegisterUseCase {
    constructor( private usersRepository : usersRepository ) { }
 async Execute({
    nome,
    image_path,
    email,
    palavraPasse,
    phone,
    } : RegisterUseCaseRequest)

 : Promise<RegisterUseCaseResponse>
{
     const normalizedEmail = email.trim().toLowerCase()
     const userWithSameEmail = await this.usersRepository.findByEmail(normalizedEmail)

  if(userWithSameEmail){
    throw new UserAreadyExistsError()
  }
const hashedPassword = await bcrypt.hash(palavraPasse, 8)

    const userCount = await this.usersRepository.count()
    const role = userCount === 0 ? "ADMIN" : undefined

    const user = await this.usersRepository.create({
     email: normalizedEmail,
     nome,
     password: hashedPassword,
     image_path,
     ...(role ? { role: role as any } : {}),
    })

   return { user }
  }

}
