// src/lib/prisma.ts - FOR PRISMA 6.x

import { PrismaClient } from "@/generated/client"


// SIMPLE initialization - this works for Prisma 6
export const prisma = new PrismaClient({
//   log: process.env.NODE_ENV === 'dev' ? ['query'] : []
})

export default prisma
