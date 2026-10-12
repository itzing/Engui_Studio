import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { installWorkspaceGuard } from '@/lib/workspaces/prismaGuard';

const shared = globalThis as typeof globalThis & { enguiPrisma?: PrismaClient; enguiAuditPrisma?: PrismaClient };
const sourceUrl = process.env.ENGUI_DATABASE_URL || 'file:' + path.resolve(process.cwd(), 'prisma/db/database.db');
const datasourceUrl = sourceUrl + (sourceUrl.includes('?') ? '&' : '?') + 'connection_limit=1&socket_timeout=30';
const options = {
  log: ['error'] as const,
  datasourceUrl,
  transactionOptions: { maxWait: 30000, timeout: 30000 },
};
const audit = shared.enguiAuditPrisma ??= new PrismaClient({ ...options, log: ['error'] });
if (!shared.enguiPrisma) {
  shared.enguiPrisma = new PrismaClient({ ...options, log: ['error'] });
  installWorkspaceGuard(shared.enguiPrisma, audit);
}
export const prisma = shared.enguiPrisma;
