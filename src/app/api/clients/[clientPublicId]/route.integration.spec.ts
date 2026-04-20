import { beforeEach, describe, expect, it } from "vitest"

import { POST as loginPost } from "@app/api/auth/login/route"
import { POST as clientsPost } from "@app/api/clients/route"
import { resetAuthDatabaseForTests } from "@server/features/auth/infrastructure/auth-test-db-utils"

import { DELETE, GET, PATCH } from "./route"

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

async function createClient(cookieHeader: string) {
  const response = await clientsPost(
    new Request("http://localhost:3000/api/clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        fullName: "Grace Hopper",
        phoneNumber: "+54 11 1234 5678",
        status: "ACTIVE",
      }),
    }),
  )

  const payload = await response.json()
  return payload.data.client.publicId as string
}

describe("/api/clients/[clientPublicId]", () => {
  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "admin@test.local"
    process.env.ADMIN_PASSWORD = "admin-password"
    process.env.MANAGER_EMAIL = "manager@test.local"
    process.env.MANAGER_PASSWORD = "manager-password"
    process.env.JWT_SECRET = "test-secret"

    await resetAuthDatabaseForTests()
  })

  it("returns client by public id", async () => {
    const cookieHeader = await authCookieHeader()
    const clientPublicId = await createClient(cookieHeader)

    const response = await GET(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}`, {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.client.publicId).toBe(clientPublicId)
  })

  it("updates client by public id", async () => {
    const cookieHeader = await authCookieHeader()
    const clientPublicId = await createClient(cookieHeader)

    const response = await PATCH(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          fullName: "Grace M. Hopper",
        }),
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.client.fullName).toBe("Grace M. Hopper")
    expect(payload.data.client.status).toBe("ACTIVE")
  })

  it("returns 404 when client does not exist", async () => {
    const cookieHeader = await authCookieHeader()

    const response = await GET(
      new Request("http://localhost:3000/api/clients/does-not-exist", {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ clientPublicId: "does-not-exist" }) },
    )

    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("client_not_found")
  })

  it("returns 400 for empty update body", async () => {
    const cookieHeader = await authCookieHeader()
    const clientPublicId = await createClient(cookieHeader)

    const response = await PATCH(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("invalid_request")
  })

  it("deletes client by public id", async () => {
    const cookieHeader = await authCookieHeader()
    const clientPublicId = await createClient(cookieHeader)

    const deleteResponse = await DELETE(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}`, {
        method: "DELETE",
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const deletePayload = await deleteResponse.json()

    expect(deleteResponse.status).toBe(200)
    expect(deletePayload.ok).toBe(true)
    expect(deletePayload.data.deleted).toBe(true)

    const getResponse = await GET(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}`, {
        method: "GET",
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    expect(getResponse.status).toBe(404)
  })
})
