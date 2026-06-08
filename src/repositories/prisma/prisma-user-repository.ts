import { Prisma, User } from "@/generated/client";
import { usersRepository } from "../users-repository";
import prisma from "@/lib/prisma";

  export class PrismaUserRepository implements usersRepository {
  async updateProfilePicture(image_path: string | undefined, userId:string){
          await prisma.user.update({
          where: { id: (userId)},
          data: {image_path : image_path},
    })
  }
    async findById(userId: string){
        const user = await prisma.user.findUnique({
          where:{
            id:userId
          }
        })

        return user
    }
    async findByEmail(email: string){
        const user = await prisma.user.findUnique({
          where:{
            email
          }
        })
        return user
    }
    async create(data: Prisma.UserCreateInput){
      const user = await prisma.user.create({
        data
      })
      return user
    }

    async count(): Promise<number> {
      return prisma.user.count()
    }

    async update(
  id: string,
  data: Prisma.UserUpdateInput
) {
    const user = await prisma.user.update({
    where: { id },
    data,
  });

  return user
}

  }
