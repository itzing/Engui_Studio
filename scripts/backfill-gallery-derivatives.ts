import { PrismaClient } from '@prisma/client';
import { backfillGalleryDerivatives } from '../src/lib/galleryDerivatives';

const prisma = new PrismaClient();

async function main() {
  const workspaceId = process.argv[2]
    || (await prisma.galleryAsset.findFirst({
      orderBy: { addedToGalleryAt: 'desc' },
      select: { workspaceId: true },
    }))?.workspaceId;

  if (!workspaceId) {
    throw new Error('No workspaceId provided and no gallery assets found');
  }

  const result = await backfillGalleryDerivatives(workspaceId, 100);
  console.log(JSON.stringify({ workspaceId, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
