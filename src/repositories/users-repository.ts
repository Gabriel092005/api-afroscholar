import { Prisma, User } from "@/generated/client";

interface UpdateUserRequest{
    nome:string|undefined
    email:string|undefined
    phone:string|undefined
    password?:string
    image_path?:string
}

export interface usersRepository{
  create(data: Prisma.UserCreateInput): Promise<User>
  findById(userId: string): Promise<User | null>
  updateProfilePicture(image_path:string|undefined, userId:string):Promise<void>
  update(userId: string, data:Prisma.UserUpdateInput): Promise<User>;
  findByEmail(email:string):Promise<User|null>
  count(): Promise<number>
}
