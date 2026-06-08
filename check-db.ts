import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw<any[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables:', result);
    
    const bolsasExist = await prisma.$queryRaw<any[]>`SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'bolsa'
    )`;
    console.log('Bolsa exists:', bolsasExist);
  } catch (e: any) {
    console.log('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();