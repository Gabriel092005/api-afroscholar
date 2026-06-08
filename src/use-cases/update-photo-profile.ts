import { usersRepository } from "@/repositories/users-repository";

interface UpdateProfileRequest{
     userId:string
     image:string
}


export class UpdateProfileImage {
     constructor ( private usersReepository:usersRepository){}
      async execute({image,userId}:UpdateProfileRequest){
         if (!image) {
            throw new Error('Nenhuma imagem foi enviada')
           }

          await this.usersReepository.updateProfilePicture(image,userId )

      }
}