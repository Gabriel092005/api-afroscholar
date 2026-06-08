import { upload } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export async function salvarPerfilAcademico(request: FastifyRequest, reply: FastifyReply) {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "foto", maxCount: 1 },
      ])(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const fotoFile = files["foto"]?.[0];

    const bodySchema = z.object({
      nivelEnsino: z.string().min(1),
      instituicao: z.string().optional(),
      curso: z.string().optional(),
      nivel: z.string().optional(),
      anoConclusao: z.string().optional(),
      media: z.string().optional(),
      pais: z.string().optional(),
      genero: z.string().optional(),
      nacionalidade: z.string().optional(),
      cidade: z.string().optional(),
      whatsapp: z.string().optional(),
      provincia: z.string().optional(),
      municipio: z.string().optional(),
      idiomas: z.string().optional(),
      certificadosIdiomas: z.string().optional(),
      dataNascimento: z.string().optional(),
      motivacoes: z.string().optional(),
      experienciaProfissional: z.string().optional(),
      areaActuacao: z.string().optional(),
      cargoOcupado: z.string().optional(),
      historicoProfissional: z.string().optional(),
      atividadesExtracurriculares: z.string().optional(),
      descricaoAtividades: z.string().optional(),
      producaoCientifica: z.string().optional(),
      descricaoProducao: z.string().optional(),
      bolsaIntegral: z.string().optional(),
      bolsaParcial: z.string().optional(),
      custeiaPassagem: z.string().optional(),
      preferenciaDestino: z.string().optional(),
      mudarPais: z.string().optional(),
      qualquerContinente: z.string().optional(),
      documentos: z.string().optional(),
      areaInteresse: z.string().optional(),
      cursoDesejado: z.string().optional(),
      objetivosAcademicos: z.string().optional(),
      quandoPretendeIniciar: z.string().optional(),
    });

    const body = bodySchema.parse(rawReq.body);
    const usuarioId = request.user.sub;

    const perfil = await prisma.perfilAcademico.upsert({
      where: { usuarioId },
      update: {
        nivelEnsino: body.nivelEnsino,
        instituicao: body.instituicao,
        curso: body.curso,
        nivel: body.nivel,
        anoConclusao: body.anoConclusao,
        media: body.media,
        pais: body.pais,
        genero: body.genero,
        nacionalidade: body.nacionalidade,
        cidade: body.cidade,
        whatsapp: body.whatsapp,
        provincia: body.provincia,
        municipio: body.municipio,
        idiomas: body.idiomas,
        certificadosIdiomas: body.certificadosIdiomas,
        dataNascimento: body.dataNascimento,
        motivacoes: body.motivacoes,
        experienciaProfissional: body.experienciaProfissional,
        areaActuacao: body.areaActuacao,
        cargoOcupado: body.cargoOcupado,
        historicoProfissional: body.historicoProfissional,
        atividadesExtracurriculares: body.atividadesExtracurriculares,
        descricaoAtividades: body.descricaoAtividades,
        producaoCientifica: body.producaoCientifica,
        descricaoProducao: body.descricaoProducao,
        bolsaIntegral: body.bolsaIntegral,
        bolsaParcial: body.bolsaParcial,
        custeiaPassagem: body.custeiaPassagem,
        preferenciaDestino: body.preferenciaDestino,
        mudarPais: body.mudarPais,
        qualquerContinente: body.qualquerContinente,
        documentos: body.documentos,
        areaInteresse: body.areaInteresse,
        cursoDesejado: body.cursoDesejado,
        objetivosAcademicos: body.objetivosAcademicos,
        quandoPretendeIniciar: body.quandoPretendeIniciar,
        ...(fotoFile && { fotoUrl: fotoFile.filename }),
      },
      create: {
        usuarioId,
        nivelEnsino: body.nivelEnsino,
        instituicao: body.instituicao,
        curso: body.curso,
        nivel: body.nivel,
        anoConclusao: body.anoConclusao,
        media: body.media,
        pais: body.pais,
        genero: body.genero,
        nacionalidade: body.nacionalidade,
        cidade: body.cidade,
        whatsapp: body.whatsapp,
        provincia: body.provincia,
        municipio: body.municipio,
        idiomas: body.idiomas,
        certificadosIdiomas: body.certificadosIdiomas,
        dataNascimento: body.dataNascimento,
        motivacoes: body.motivacoes,
        experienciaProfissional: body.experienciaProfissional,
        areaActuacao: body.areaActuacao,
        cargoOcupado: body.cargoOcupado,
        historicoProfissional: body.historicoProfissional,
        atividadesExtracurriculares: body.atividadesExtracurriculares,
        descricaoAtividades: body.descricaoAtividades,
        producaoCientifica: body.producaoCientifica,
        descricaoProducao: body.descricaoProducao,
        bolsaIntegral: body.bolsaIntegral,
        bolsaParcial: body.bolsaParcial,
        custeiaPassagem: body.custeiaPassagem,
        preferenciaDestino: body.preferenciaDestino,
        mudarPais: body.mudarPais,
        qualquerContinente: body.qualquerContinente,
        documentos: body.documentos,
        areaInteresse: body.areaInteresse,
        cursoDesejado: body.cursoDesejado,
        objetivosAcademicos: body.objetivosAcademicos,
        quandoPretendeIniciar: body.quandoPretendeIniciar,
        fotoUrl: fotoFile?.filename,
      },
    });

    return reply.send(perfil);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation Error",
        issues: err.format(),
      });
    }
    console.error(err);
    return reply.status(500).send({ message: "Erro ao salvar perfil académico" });
  }
}
