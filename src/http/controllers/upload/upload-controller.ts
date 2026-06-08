import { FastifyReply, FastifyRequest } from "fastify";
import { upload } from "@/utills/multer";

export const uploadFile = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req.raw as any, res.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = req.raw as any;
    const file = rawReq.file;
    if (!file) {
      return res.status(400).send({ error: "No file uploaded" });
    }

    return res.status(200).send({
      url: `/uploads/${file.filename}`,
      path: file.filename,
    });
  } catch (error: any) {
    return res.status(400).send({ error: "Upload failed", message: error.message || "Erro no upload" });
  }
};
