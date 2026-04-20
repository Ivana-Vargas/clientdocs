import bcrypt from "bcryptjs"

import { prismaClient } from "@database/db-client/prisma-client"

async function upsertTestUser(input: {
  email: string
  password: string
  role: "ADMIN" | "MANAGER"
}) {
  const email = input.email.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(input.password, 10)

  await prismaClient.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: input.role,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      role: input.role,
      isActive: true,
    },
  })
}

export async function resetAuthDatabaseForTests() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() ?? "admin@test.local"
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? "admin-password"
  const managerEmail = process.env.MANAGER_EMAIL?.trim() ?? "manager@test.local"
  const managerPassword = process.env.MANAGER_PASSWORD?.trim() ?? "manager-password"

  await prismaClient.authSession.deleteMany()
  await prismaClient.client.deleteMany()
  await upsertTestUser({
    email: adminEmail,
    password: adminPassword,
    role: "ADMIN",
  })
  await upsertTestUser({
    email: managerEmail,
    password: managerPassword,
    role: "MANAGER",
  })
}
