import { makeUpdateProfileImageUserCase } from "@/use-cases/factories/make-updte-photo";
import { upload } from "@/utills/multer";
import { FastifyReply, FastifyRequest } from "fastify";

export async function updateProfileImage(req: FastifyRequest, reply: FastifyReply) {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.single("image")(req.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = req.raw as any;
    const file = rawReq.file;

    if (!file) {
      return reply.status(400).send({ message: "Nenhuma imagem foi enviada." });
    }

    const userId = req.user.sub;
    const imageUrl = file.filename;

    const useCase = makeUpdateProfileImageUserCase();
    await useCase.execute({ image: imageUrl, userId });

    return reply.status(200).send({
      message: "Imagem de perfil atualizada com sucesso!",
      image_path: imageUrl,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erro ao atualizar imagem de perfil" });
  }
}