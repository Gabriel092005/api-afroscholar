import { Prisma } from "@/generated/client";
import { UserAreadyExistsError } from "@/repositories/errors/user-already-exists-error";
import { usersRepository } from "@/repositories/users-repository";

interface UpdateProfileRequest {
  userId: string;
  nome?: string;
  email?: string;
  phone?: string;
  image_path?: string | null;
}



export class UpdateProfileUseCase {
  constructor(private usersRepository: usersRepository) {}

  async execute(data: UpdateProfileRequest) {

    if (data.email) {
      const emailAlreadyUsed =
        await this.usersRepository.findByEmail(data.email);

      if (emailAlreadyUsed && emailAlreadyUsed.id !== data.userId) {
        throw new UserAreadyExistsError();
      }
    }

    const updateData: Prisma.UsuarioUpdateInput = {};

    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.image_path !== undefined)
      updateData.image_path = data.image_path;

    
    const user = await this.usersRepository.update(
        data.userId,
        updateData
    );
    return { user };
  }
}