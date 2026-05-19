'use server'

import { prisma } from '@/lib/prisma'

export async function ensureDbUser(input: {
  id: string
  email: string
  name?: string | null
}) {
  await prisma.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email,
      name: input.name ?? null,
    },
    update: {
      email: input.email,
    },
  })
}
