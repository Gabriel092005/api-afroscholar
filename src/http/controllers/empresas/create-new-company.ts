import { makeCadastrarEmpresaUseCase } from '@/repositories/prisma/make-cadastrarar-empresas';
import { upload } from '@/lib/upload';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';


export const empresaSchema = z.object({
  nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  sector: z.string().min(1, "O ramo de atividade é obrigatório"),
  nif: z.string().optional(),
  contacto: z.string().optional(),
  localizacao: z.string().optional(),
  website: z.string().optional(),
  cor_primaria: z.string().optional(),
  descricao: z.string().optional(),
  observacoes: z.string().optional(),
});


type EmpresaFormData = z.infer<typeof empresaSchema>;

export async function EmpresaController(req: FastifyRequest, res: FastifyReply) {
    try {
        await new Promise<void>((resolve, reject) => {
            upload.single("image")(req.raw as any, res.raw as any, (err: any) => {
                if (err) return reject(err);
                resolve();
            });
        });
        
        const rawReq = req.raw as any;
        const file = rawReq.file;
        const data: EmpresaFormData = empresaSchema.parse(rawReq.body);

        const cadastrarUseCase = makeCadastrarEmpresaUseCase();
        const userId = (req.user as any).sub;

        const empresa = await cadastrarUseCase.execute({
            ...data, 
            usuarioId: userId,
            logotipo: file ? file.filename : undefined,
        });

        return res.status(201).send(empresa);

    } catch (err: any) {
        if (err instanceof ZodError) {
            return res.status(400).send({ 
                message: "Erro de validação", 
                errors: err.flatten().fieldErrors 
            });
        }
        if (err.code === 'P2002') {
            return res.status(400).send({ message: "Este NIF já está cadastrado." });
        }
        return res.status(400).send({ message: err.message || "Erro interno" });
    }
}