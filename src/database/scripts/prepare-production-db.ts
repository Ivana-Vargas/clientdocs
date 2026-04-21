import { prismaClient } from "@database/db-client/prisma-client"

function parseBooleanEnv(name: string, defaultValue = false) {
  const value = process.env[name]

  if (!value) {
    return defaultValue
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function assertSafeToRun() {
  const allowInProduction = parseBooleanEnv("ALLOW_PRODUCTION_DB_CLEANUP", false)

  if (process.env.NODE_ENV === "production" && !allowInProduction) {
    throw new Error("refusing cleanup in production without ALLOW_PRODUCTION_DB_CLEANUP=true")
  }
}

async function run() {
  assertSafeToRun()

  const fullReset = parseBooleanEnv("FULL_DB_CLEAN", false)
  const clearSessions = parseBooleanEnv("CLEAR_AUTH_SESSIONS", true)

  if (fullReset) {
    const [sessions, documents, payments, categories, clients] = await Promise.all([
      prismaClient.authSession.deleteMany(),
      prismaClient.clientDocument.deleteMany(),
      prismaClient.payment.deleteMany(),
      prismaClient.documentCategory.deleteMany(),
      prismaClient.client.deleteMany(),
    ])

    console.log(
      `full cleanup completed: sessions=${sessions.count}, documents=${documents.count}, payments=${payments.count}, categories=${categories.count}, clients=${clients.count}`,
    )

    return
  }

  if (clearSessions) {
    const sessions = await prismaClient.authSession.deleteMany()
    console.log(`session cleanup completed: sessions=${sessions.count}`)
    return
  }

  console.log("nothing to clean: set CLEAR_AUTH_SESSIONS=true or FULL_DB_CLEAN=true")
}

run()
  .then(async () => {
    await prismaClient.$disconnect()
  })
  .catch(async (error) => {
    await prismaClient.$disconnect()
    console.error("production db preparation failed", error)
    process.exit(1)
  })
