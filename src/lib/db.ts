import { PrismaClient } from "@prisma/client";

// ponytail: single shared client; if hot-reload duplicates connections, globalThis guard covers it.
const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? new PrismaClient();
if (!g.__prisma) g.__prisma = prisma;
