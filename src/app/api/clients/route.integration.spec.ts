import { beforeEach, describe, expect, it } from "vitest"

import { POST as loginPost } from "@app/api/auth/login/route"
import { resetAuthDatabaseForTests } from "@server/features/auth/infrastructure/auth-test-db-utils"

import { GET, POST } from "./route"

function extractCookieValue(setCookieHeader: string, cookieName: string) {
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;,\\s]+)`))
  return match?.[1] ?? ""
}

async function authCookieHeader() {
  const loginResponse = await loginPost(
    new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@test.local", password: "admin-password" }),
      headers: { "content-type": "application/json" },
    }),
  )

  const setCookieHeader = loginResponse.headers.get("set-cookie") ?? ""
  const accessToken =
    loginResponse.cookies.get("clientdocs_access_token")?.value ??
    extractCookieValue(setCookieHeader, "clientdocs_access_token")

  return `clientdocs_access_token=${accessToken}`
}

describe("/api/clients", () => {
  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "admin@test.local"
    process.env.ADMIN_PASSWORD = "admin-password"
    process.env.MANAGER_EMAIL = "manager@test.local"
    process.env.MANAGER_PASSWORD = "manager-password"
    process.env.JWT_SECRET = "test-secret"

    await resetAuthDatabaseForTests()
  })

  it("returns unauthorized when missing token", async () => {
    const response = await GET(new Request("http://localhost:3000/api/clients"))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("missing_access_token")
  })

  it("creates and lists clients", async () => {
    const cookieHeader = await authCookieHeader()

    const createResponse = await POST(
      new Request("http://localhost:3000/api/clients", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          fullName: "Ada Lovelace",
          phoneNumber: "+54 11 5555 3333",
          email: "ada@example.com",
          status: "ACTIVE",
        }),
      }),
    )

    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.ok).toBe(true)
    expect(createPayload.data.client.fullName).toBe("Ada Lovelace")

    const listResponse = await GET(
      new Request("http://localhost:3000/api/clients", {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
    )

    const listPayload = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(listPayload.ok).toBe(true)
    expect(Array.isArray(listPayload.data.clients)).toBe(true)
    expect(listPayload.data.clients[0].fullName).toBe("Ada Lovelace")
  })

  it("returns 400 for invalid create payload", async () => {
    const cookieHeader = await authCookieHeader()

    const response = await POST(
      new Request("http://localhost:3000/api/clients", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          fullName: "",
          status: "ACTIVE",
        }),
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("invalid_request")
  })
})
