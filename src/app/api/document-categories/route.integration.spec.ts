import { beforeEach, describe, expect, it } from "vitest"

import { POST as loginPost } from "@app/api/auth/login/route"
import { resetAuthDatabaseForTests } from "@server/features/auth/infrastructure/auth-test-db-utils"

import { GET, POST } from "./route"
import { DELETE as categoryDelete } from "./[categoryPublicId]/route"

function extractCookieValue(setCookieHeader: string, cookieName: string) {
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;,\\s]+)`))
  return match?.[1] ?? ""
}

async function authCookieHeader(email: string, password: string) {
  const loginResponse = await loginPost(
    new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "content-type": "application/json" },
    }),
  )

  const setCookieHeader = loginResponse.headers.get("set-cookie") ?? ""
  const accessToken =
    loginResponse.cookies.get("clientdocs_access_token")?.value ??
    extractCookieValue(setCookieHeader, "clientdocs_access_token")

  return `clientdocs_access_token=${accessToken}`
}

describe("/api/document-categories", () => {
  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "admin@test.local"
    process.env.ADMIN_PASSWORD = "admin-password"
    process.env.MANAGER_EMAIL = "manager@test.local"
    process.env.MANAGER_PASSWORD = "manager-password"
    process.env.JWT_SECRET = "test-secret"

    await resetAuthDatabaseForTests()
  })

  it("lists categories for authenticated user", async () => {
    const adminCookie = await authCookieHeader("admin@test.local", "admin-password")

    await POST(
      new Request("http://localhost:3000/api/document-categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ name: "CI" }),
      }),
    )

    const response = await GET(
      new Request("http://localhost:3000/api/document-categories", {
        method: "GET",
        headers: { cookie: adminCookie },
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.categories).toHaveLength(1)
  })

  it("allows admin to create category", async () => {
    const adminCookie = await authCookieHeader("admin@test.local", "admin-password")

    const response = await POST(
      new Request("http://localhost:3000/api/document-categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ name: "Contrato" }),
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.ok).toBe(true)
    expect(payload.data.category.name).toBe("Contrato")
  })

  it("rejects category creation for manager", async () => {
    const managerCookie = await authCookieHeader("manager@test.local", "manager-password")

    const response = await POST(
      new Request("http://localhost:3000/api/document-categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: managerCookie,
        },
        body: JSON.stringify({ name: "Contrato" }),
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("forbidden")
  })

  it("allows admin to delete empty category", async () => {
    const adminCookie = await authCookieHeader("admin@test.local", "admin-password")

    const createResponse = await POST(
      new Request("http://localhost:3000/api/document-categories", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ name: "Temporal" }),
      }),
    )

    const createPayload = await createResponse.json()
    const categoryPublicId = createPayload.data.category.publicId as string

    const deleteResponse = await categoryDelete(
      new Request(`http://localhost:3000/api/document-categories/${categoryPublicId}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }),
      { params: Promise.resolve({ categoryPublicId }) },
    )

    const deletePayload = await deleteResponse.json()

    expect(deleteResponse.status).toBe(200)
    expect(deletePayload.ok).toBe(true)
    expect(deletePayload.data.deleted).toBe(true)
  })
})
