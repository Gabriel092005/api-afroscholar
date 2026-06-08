import { upload } from "@/lib/upload";
import { CreateNovidadeInscricaoUseCase } from "@/use-cases/create-novidade-inscricao-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export async function inscreverNovidadeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };

    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "comprovativo", maxCount: 1 },
        { name: "docFile", maxCount: 10 },
      ])(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const comprovativoFile = files["comprovativo"]?.[0];
    const docFiles = files["docFile"] || [];
    const docNomes = rawReq.body.docNome
      ? (Array.isArray(rawReq.body.docNome) ? rawReq.body.docNome : [rawReq.body.docNome])
      : [];

    const bodySchema = z.object({
      nome: z.string().min(1),
      email: z.string().email(),
      telefone: z.string().optional(),
      observacao: z.string().optional(),
      metodoPagamento: z.string().optional(),
      referenciaPagamento: z.string().optional(),
      valorPago: z.string().optional(),
    });

    const body = bodySchema.parse(rawReq.body);

    const documentos = docFiles.map((f, i) => ({
      file: f.filename,
      nome: docNomes[i] || `Documento ${i + 1}`,
    }));

    const useCase = new CreateNovidadeInscricaoUseCase();
    const { inscricao } = await useCase.execute({
      novidadeId: id,
      usuarioId: request.user.sub,
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      observacao: body.observacao,
      metodoPagamento: body.metodoPagamento,
      referenciaPagamento: body.referenciaPagamento,
      comprovativoUrl: comprovativoFile ? comprovativoFile.filename : undefined,
      valorPago: body.valorPago ? parseFloat(body.valorPago) : undefined,
      documentos,
    });

    return reply.status(201).send({
      id: inscricao.id,
      message: "Inscrição realizada com sucesso",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation Error",
        issues: err.format(),
      });
    }
    console.error(err);
    return reply.status(500).send({
      message: "Erro interno ao realizar inscrição",
    });
  }
}
