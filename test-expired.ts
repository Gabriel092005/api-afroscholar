// import { prisma } from "@/lib/prisma"
// import { PrismaCarteira } from "@/repositories/prisma/prisma-carteira-repository"

// async function main() {
//   const repo = new PrismaCarteira()

//   console.log("Antes da atualização:")
//   const antes = await prisma.historicoRecargas.findMany({ where: { carteiraId: 3 } })
//   console.log(antes)

//   // 👉 Simular data futura (um mês depois da validade)
//   const dataFutura = new Date("2025-12-19T00:00:00.000Z")

//   await repo.deleteExpiredPackages(3, dataFutura)

//   console.log("Depois da atualização:")
//   const depois = await prisma.historicoRecargas.findMany({ where: { carteiraId: 3 } })
//   console.log(depois)
// }

// main()
