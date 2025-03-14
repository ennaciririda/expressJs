import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


async function main() {
  const post = await prisma.post.findMany()
  // delete all posts
    await prisma.post.deleteMany()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })