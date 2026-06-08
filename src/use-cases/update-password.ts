// import { resourceNotFoundError } from "@/repositories/errors/resource-not-found";
// import { usersRepository } from "@/repositories/users-repository";
// import { compare, hash } from "bcryptjs";

// interface ChangePasswordRequest {
//   userId: string;
//   currentPassword: string;
//   newPassword: string;
// }

// export class ChangePasswordUseCase {
//   constructor(private usersRepository: usersRepository) {}

//   async execute({ userId, currentPassword, newPassword }: ChangePasswordRequest) {
//     const user = await this.usersRepository.findById(userId);

//     if (!user) throw new resourceNotFoundError()

//     const passwordMatch = await compare(currentPassword, user.palavraPasse);

//     if (!passwordMatch) throw new Error("INVALID_PASSWORD");

//     const newPasswordHash = await hash(newPassword, 6);

//     await this.usersRepository.update(userId, {
//      password : newPasswordHash,
//     });

//     return { message: "Password updated" };
//   }
// }