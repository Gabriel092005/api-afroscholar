import { PrismaClient } from "@/generated/client"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"

const prisma = new PrismaClient()
async function main() {
  console.log("🌱 Seeding database...")
  await prisma.aulaOnlineParticipante.deleteMany()
  await prisma.aulaOnline.deleteMany()
  await prisma.cursoUsuario.deleteMany()
  await prisma.cursoPagamento.deleteMany()
  await prisma.aula.deleteMany()
  await prisma.curso.deleteMany()
  await prisma.bolsaInscricao.deleteMany()
  await prisma.bolsa.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.user.deleteMany()

  // ─── Users ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("123456", 6)

  const admin = await prisma.user.create({
    data: {
      nome: "Administrador",
      email: "admin@schoolar.com",
      phone: "+244 900 000 000",
      password: passwordHash,
      role: "ADMIN",
      estado_conta: "ACTIVA",
    },
  })

  const gestor = await prisma.user.create({
    data: {
      nome: "Maria Gestora",
      email: "gestor@schoolar.com",
      phone: "+244 900 000 001",
      password: passwordHash,
      role: "GESTOR",
      estado_conta: "ACTIVA",
    },
  })

  const users = []
  const nomes = ["João Silva", "Ana Paula", "Carlos Eduardo", "Marta Fernandes", "Pedro Lukamba"]
  for (let i = 0; i < nomes.length; i++) {
    const user = await prisma.user.create({
      data: {
        nome: nomes[i],
        email: `user${i + 1}@schoolar.com`,
        phone: `+244 900 000 01${i}`,
        password: passwordHash,
        role: "USUARIO",
        estado_conta: "ACTIVA",
      },
    })
    users.push(user)
  }

  console.log(`  ✓ ${1 + 1 + users.length} users created`)

  // ─── Bolsas ───────────────────────────────────────────
  const bolsasData = [
    {
      titulo: "Bolsa de Mérito Académico 2026",
      subtitulo: "Para estudantes com excelente desempenho académico",
      categoria: "Mérito",
      instituicao: "Universidade de Coimbra",
      pais: "Portugal",
      nivel: "MESTRADO",
      requisitos: "Média mínima de 16 valores, carta de motivação, 2 cartas de recomendação",
      valor: 15000,
      moeda: "EUR",
      precoOriginal: 25000,
      idioma: "Português",
      tags: ["Mérito", "Europa", "Tutoria"],
      descricao: "Bolsa integral para mestrado na Universidade de Coimbra. Inclui propinas, alojamento e seguro de saúde.",
      prazo: new Date("2026-09-30"),
      numeroVagas: 5,
      status: "PUBLICADA",
      modalidade: "Presencial",
    },
    {
      titulo: "Fulbright Scholarship Program",
      subtitulo: "Estude nos EUA com a bolsa Fullbright",
      categoria: "Internacional",
      instituicao: "Fulbright Commission",
      pais: "Estados Unidos",
      nivel: "DOUTORAMENTO",
      requisitos: "IELTS 7.0+, GMAT/GRE, proposta de pesquisa, 3 cartas de recomendação",
      valor: 50000,
      moeda: "USD",
      idioma: "Inglês",
      tags: ["Internacional", "EUA", "Pesquisa"],
      descricao: "Bolsa completa para doutoramento em universidades americanas. Cobre propinas, passagem aérea e custos de vida.",
      prazo: new Date("2026-08-15"),
      numeroVagas: 3,
      status: "PUBLICADA",
      modalidade: "Presencial",
    },
    {
      titulo: "Bolsa Santander Universidades",
      subtitulo: "Apoio à mobilidade internacional",
      categoria: "Mobilidade",
      instituicao: "Santander",
      pais: "Espanha",
      nivel: "GRADUACAO",
      requisitos: "Matriculado em universidade parceira, média mínima 14 valores",
      valor: 8000,
      moeda: "EUR",
      tags: ["Mobilidade", "Espanha", "Graduação"],
      descricao: "Bolsa de mobilidade para estudantes de graduação realizarem intercâmbio em universidades espanholas.",
      prazo: new Date("2026-10-01"),
      numeroVagas: 10,
      status: "PUBLICADA",
      modalidade: "Presencial",
    },
    {
      titulo: "MEXT Scholarship",
      subtitulo: "Bolsas do governo japonês para pesquisa",
      categoria: "Governamental",
      instituicao: "MEXT - Japan",
      pais: "Japão",
      nivel: "POSDOC",
      requisitos: "Menos de 35 anos, domínio do inglês ou japonês, projeto de pesquisa",
      valor: 20000,
      moeda: "USD",
      idioma: "Inglês/Japonês",
      tags: ["Japão", "Pesquisa", "Governamental"],
      descricao: "Bolsa do governo japonês para pesquisa pós-doutoral nas melhores universidades do Japão.",
      prazo: new Date("2026-11-20"),
      numeroVagas: 8,
      status: "PUBLICADA",
      modalidade: "Presencial",
    },
    {
      titulo: "Bolsa Mérito Angola",
      subtitulo: "Apoio a estudantes angolanos de excelência",
      categoria: "Nacional",
      instituicao: "Ministério do Ensino Superior",
      pais: "Angola",
      nivel: "GRADUACAO",
      requisitos: "Ser angolano, média mínima 15 valores, frequência universitária",
      valor: 5000,
      moeda: "USD",
      idioma: "Português",
      tags: ["Angola", "Nacional", "Graduação"],
      descricao: "Bolsa nacional para estudantes angolanos com alto rendimento académico.",
      prazo: new Date("2026-12-15"),
      numeroVagas: 20,
      status: "PUBLICADA",
      modalidade: "Presencial",
    },
  ]

  const bolsas = []
  for (const data of bolsasData) {
    const bolsa = await prisma.bolsa.create({ data })
    bolsas.push(bolsa)
  }

  console.log(`  ✓ ${bolsas.length} bolsas created`)

  // ─── Inscrições em Bolsas ────────────────────────────
  // Algumas bolsas com 5+ inscrições serão consideradas "destaques"
  const inscricoesData = [
    // Bolsa 0 - "Bolsa de Mérito Académico 2026" → 5 inscrições ★ DESTAQUE
    { usuarioId: users[0].id, bolsaId: bolsas[0].id, status: "APROVADA" as const },
    { usuarioId: users[1].id, bolsaId: bolsas[0].id, status: "APROVADA" as const },
    { usuarioId: users[2].id, bolsaId: bolsas[0].id, status: "PENDENTE" as const },
    { usuarioId: users[3].id, bolsaId: bolsas[0].id, status: "APROVADA" as const },
    { usuarioId: users[4].id, bolsaId: bolsas[0].id, status: "PENDENTE" as const },

    // Bolsa 1 - "Fulbright Scholarship Program" → 5 inscrições ★ DESTAQUE
    { usuarioId: users[0].id, bolsaId: bolsas[1].id, status: "APROVADA" as const },
    { usuarioId: users[1].id, bolsaId: bolsas[1].id, status: "PENDENTE" as const },
    { usuarioId: users[2].id, bolsaId: bolsas[1].id, status: "APROVADA" as const },
    { usuarioId: users[3].id, bolsaId: bolsas[1].id, status: "PENDENTE" as const },
    { usuarioId: users[4].id, bolsaId: bolsas[1].id, status: "PENDENTE" as const },

    // Bolsa 2 - "Bolsa Santander Universidades" → 2 inscrições
    { usuarioId: users[0].id, bolsaId: bolsas[2].id, status: "REJEITADA" as const },
    { usuarioId: users[2].id, bolsaId: bolsas[2].id, status: "REJEITADA" as const },

    // Bolsa 3 - "MEXT Scholarship" → 3 inscrições
    { usuarioId: users[0].id, bolsaId: bolsas[3].id, status: "PENDENTE" as const },
    { usuarioId: users[1].id, bolsaId: bolsas[3].id, status: "APROVADA" as const },
    { usuarioId: users[3].id, bolsaId: bolsas[3].id, status: "APROVADA" as const },

    // Bolsa 4 - "Bolsa Mérito Angola" → 3 inscrições
    { usuarioId: users[0].id, bolsaId: bolsas[4].id, status: "PENDENTE" as const },
    { usuarioId: users[1].id, bolsaId: bolsas[4].id, status: "APROVADA" as const },
    { usuarioId: users[2].id, bolsaId: bolsas[4].id, status: "PENDENTE" as const },
  ]

  for (const data of inscricoesData) {
    await prisma.bolsaInscricao.create({ data })
  }

  console.log(`  ✓ ${inscricoesData.length} inscricoes created`)

  // ─── Cursos ──────────────────────────────────────────
  const cursosData = [
    {
      titulo: "Preparação IELTS - Academic",
      subtitulo: "Domine o exame de inglês acadêmico e conquiste sua bolsa",
      categoria: "Idiomas",
      nivel: "Intermédio",
      duracao: "24h 30min",
      quantAulas: 36,
      estudantes: 2840,
      rating: 4.8,
      preco: 250,
      precoOriginal: 400,
      idioma: "Português/Inglês",
      tags: ["IELTS", "Inglês", "Exame"],
      descricao: "Curso completo de preparação para o exame IELTS Academic. Inclui Listening, Reading, Writing e Speaking com simulados reais e feedback personalizado.",
      capaUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800",
      status: "PUBLICADO",
    },
    {
      titulo: "Matemática para Exames de Admissão",
      subtitulo: "Prepare-se para os exames de acesso às melhores universidades",
      categoria: "Matemática",
      nivel: "Iniciante",
      duracao: "18h 45min",
      quantAulas: 28,
      estudantes: 4520,
      rating: 4.9,
      preco: 180,
      precoOriginal: 300,
      idioma: "Português",
      tags: ["Matemática", "Admissão", "Universidade"],
      descricao: "Curso intensivo de matemática para exames de admissão universitária. Abrange álgebra, geometria, trigonometria e funções.",
      capaUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800",
      status: "PUBLICADO",
    },
    {
      titulo: "Redação Acadêmica - Personal Statement",
      subtitulo: "Aprenda a escrever uma carta de motivação irresistível",
      categoria: "Escrita",
      nivel: "Iniciante",
      duracao: "12h 20min",
      quantAulas: 18,
      estudantes: 3810,
      rating: 4.7,
      preco: 150,
      idioma: "Português",
      tags: ["Redação", "Personal Statement", "Candidatura"],
      descricao: "Curso prático de redação de personal statements, cartas de motivação e ensaios acadêmicos para candidaturas a bolsas e universidades.",
      capaUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800",
      status: "PUBLICADO",
    },
    {
      titulo: "Finanças Pessoais & Bolsas",
      subtitulo: "Planeie financeiramente os seus estudos no exterior",
      categoria: "Finanças",
      nivel: "Iniciante",
      duracao: "8h 30min",
      quantAulas: 14,
      estudantes: 2150,
      rating: 4.6,
      preco: 120,
      precoOriginal: 200,
      idioma: "Português",
      tags: ["Finanças", "Planeamento", "Bolsa"],
      descricao: "Aprenda a planear o orçamento para estudar fora, gerir bolsas de estudo e fazer investimentos inteligentes durante a sua jornada acadêmica internacional.",
      capaUrl: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800",
      status: "PUBLICADO",
    },
    {
      titulo: "Inglês para Negócios",
      subtitulo: "Comunique profissionalmente em inglês",
      categoria: "Idiomas",
      nivel: "Avançado",
      duracao: "20h 15min",
      quantAulas: 30,
      estudantes: 1670,
      rating: 4.5,
      preco: 200,
      precoOriginal: 350,
      idioma: "Inglês",
      tags: ["Inglês", "Negócios", "Profissional"],
      descricao: "Curso avançado de inglês para negócios. Apresentações, negociações, reuniões e escrita profissional.",
      capaUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800",
      status: "PUBLICADO",
    },
  ]

  const cursos = []
  for (const data of cursosData) {
    const curso = await prisma.curso.create({ data })
    cursos.push(curso)
  }

  console.log(`  ✓ ${cursos.length} cursos created`)

  // ─── Aulas ────────────────────────────────────────────
  const aulasData: Array<{
    cursoId: string
    titulo: string
    tipo: "VIDEO" | "PDF" | "QUIZ"
    duracao: string
    ordem: number
    gratuito: boolean
    videoUrl?: string
    pdfUrl?: string
  }> = [
    // ─── Curso 1: IELTS ────────────────────────
    { cursoId: cursos[0].id, titulo: "Introdução ao IELTS Academic", tipo: "VIDEO", duracao: "15:30", ordem: 1, gratuito: true, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Listening Section - Estratégias", tipo: "VIDEO", duracao: "22:45", ordem: 2, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Reading Section - Técnicas de Skimming", tipo: "VIDEO", duracao: "25:10", ordem: 3, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Writing Task 1 - Gráficos", tipo: "VIDEO", duracao: "30:00", ordem: 4, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Writing Task 2 - Ensaios", tipo: "VIDEO", duracao: "28:15", ordem: 5, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Speaking Section - Simulado", tipo: "VIDEO", duracao: "35:00", ordem: 6, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[0].id, titulo: "Grammar for IELTS", tipo: "PDF", duracao: "PDF", ordem: 7, gratuito: false, pdfUrl: "/materiais/ielts-grammar.pdf" },
    { cursoId: cursos[0].id, titulo: "Simulado Completo #1", tipo: "QUIZ", duracao: "60 min", ordem: 8, gratuito: false },
    { cursoId: cursos[0].id, titulo: "Dicas Finais e Revisão", tipo: "VIDEO", duracao: "12:00", ordem: 9, gratuito: true, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },

    // ─── Curso 2: Matemática ────────────────────
    { cursoId: cursos[1].id, titulo: "Fundamentos de Álgebra", tipo: "VIDEO", duracao: "20:00", ordem: 1, gratuito: true, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[1].id, titulo: "Equações do 1º e 2º Grau", tipo: "VIDEO", duracao: "25:30", ordem: 2, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[1].id, titulo: "Geometria Plana", tipo: "VIDEO", duracao: "22:15", ordem: 3, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[1].id, titulo: "Trigonométria Básica", tipo: "VIDEO", duracao: "18:45", ordem: 4, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[1].id, titulo: "Funções e Gráficos", tipo: "VIDEO", duracao: "24:00", ordem: 5, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[1].id, titulo: "Exercícios Resolvidos", tipo: "PDF", duracao: "PDF", ordem: 6, gratuito: true, pdfUrl: "/materiais/matematica-exercicios.pdf" },
    { cursoId: cursos[1].id, titulo: "Simulado de Admissão", tipo: "QUIZ", duracao: "90 min", ordem: 7, gratuito: false },

    // ─── Curso 3: Personal Statement ────────────
    { cursoId: cursos[2].id, titulo: "O que é um Personal Statement?", tipo: "VIDEO", duracao: "10:00", ordem: 1, gratuito: true, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[2].id, titulo: "Estrutura do Texto", tipo: "VIDEO", duracao: "15:30", ordem: 2, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[2].id, titulo: "Como Contar a Sua História", tipo: "VIDEO", duracao: "18:20", ordem: 3, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[2].id, titulo: "Exemplos Reais Comentados", tipo: "VIDEO", duracao: "22:00", ordem: 4, gratuito: false, videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
    { cursoId: cursos[2].id, titulo: "Template de Personal Statement", tipo: "PDF", duracao: "PDF", ordem: 5, gratuito: true, pdfUrl: "/materiais/personal-statement-template.pdf" },
    { cursoId: cursos[2].id, titulo: "Revisão Final Checklist", tipo: "PDF", duracao: "PDF", ordem: 6, gratuito: false, pdfUrl: "/materiais/checklist.pdf" },
  ]

  for (const data of aulasData) {
    await prisma.aula.create({ data })
  }

  console.log(`  ✓ ${aulasData.length} aulas created`)

  // ─── Aulas Online ───────────────────────────────
  const aulasOnlineData = [
    {
      titulo: "Introdução ao IELTS - Sessão ao Vivo",
      descricao: "Sessão interativa ao vivo com dicas e estratégias para o exame IELTS.",
      data: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      duracao: 60,
      roomId: crypto.randomUUID(),
      status: "AGENDADA" as const,
      hostId: gestor.id,
    },
    {
      titulo: "Dúvidas sobre Candidaturas a Bolsas",
      descricao: "Tire todas as suas dúvidas sobre o processo de candidatura a bolsas de estudo.",
      data: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      duracao: 45,
      roomId: crypto.randomUUID(),
      status: "AGENDADA" as const,
      hostId: admin.id,
    },
    {
      titulo: "Workshop: Personal Statement",
      descricao: "Aprenda a escrever um personal statement impactante com exemplos reais.",
      data: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      duracao: 90,
      roomId: crypto.randomUUID(),
      status: "AGENDADA" as const,
      hostId: gestor.id,
    },
    {
      titulo: "Matemática para Exames - Aula Aberta",
      descricao: "Aula gratuita ao vivo sobre os principais tópicos de matemática para exames de admissão.",
      data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      duracao: 60,
      roomId: crypto.randomUUID(),
      status: "FINALIZADA" as const,
      hostId: gestor.id,
    },
    {
      titulo: "Orientação Vocacional Online",
      descricao: "Sessão de mentoria em grupo sobre escolha de carreira e curso superior.",
      data: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      duracao: 50,
      roomId: crypto.randomUUID(),
      status: "AGENDADA" as const,
      hostId: admin.id,
    },
    {
      titulo: "Conversa com Ex-Aluno: Estudar nos EUA",
      descricao: "Bate-papo ao vivo com um ex-aluno que conquistou bolsa para estudar nos Estados Unidos.",
      data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      duracao: 75,
      roomId: crypto.randomUUID(),
      status: "FINALIZADA" as const,
      hostId: admin.id,
    },
  ]

  for (const data of aulasOnlineData) {
    const aula = await prisma.aulaOnline.create({ data })

    if (aula.status === "FINALIZADA") {
      for (const user of users) {
        try {
          await prisma.aulaOnlineParticipante.create({
            data: { aulaId: aula.id, usuarioId: user.id },
          })
        } catch {}
      }
    }
  }

  console.log(`  ✓ ${aulasOnlineData.length} aulas online created`)

  // ─── CursoUsuario (compras) ──────────────────────
  const comprasData = [
    { usuarioId: users[0].id, cursoId: cursos[0].id },
    { usuarioId: users[0].id, cursoId: cursos[2].id },
    { usuarioId: users[1].id, cursoId: cursos[0].id },
    { usuarioId: users[2].id, cursoId: cursos[1].id },
    { usuarioId: users[3].id, cursoId: cursos[3].id },
  ]

  for (const data of comprasData) {
    await prisma.cursoUsuario.create({ data })
  }

  console.log(`  ✓ ${comprasData.length} compras created`)

  // ─── Pagamentos ──────────────────────────────────
  const pagamentosData = [
    { cursoId: cursos[0].id, usuarioId: users[0].id, valor: 250, metodo: "Multicaixa", referencia: "REF-001", status: "APROVADO" as const },
    { cursoId: cursos[2].id, usuarioId: users[0].id, valor: 150, metodo: "Transferência", referencia: "REF-002", status: "APROVADO" as const },
    { cursoId: cursos[0].id, usuarioId: users[1].id, valor: 250, metodo: "Multicaixa", referencia: "REF-003", status: "PENDENTE" as const },
    { cursoId: cursos[1].id, usuarioId: users[2].id, valor: 180, metodo: "Express", referencia: "REF-004", status: "APROVADO" as const },
    { cursoId: cursos[4].id, usuarioId: users[4].id, valor: 200, metodo: "Multicaixa", referencia: "REF-005", status: "PENDENTE" as const },
  ]

  for (const data of pagamentosData) {
    await prisma.cursoPagamento.create({ data })
  }

  console.log(`  ✓ ${pagamentosData.length} pagamentos created`)

  console.log("\n✅ Seed completed successfully!")
  console.log("\n📧 Login credentials:")
  console.log("   Admin:  admin@schoolar.com / 123456")
  console.log("   Gestor: gestor@schoolar.com / 123456")
  console.log("   Users:  user1@schoolar.com / 123456")
  console.log("           user2@schoolar.com / 123456")
  console.log("           (etc.)")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
