import { beforeEach, describe, expect, it } from "vitest"

import { POST as loginPost } from "@app/api/auth/login/route"
import { POST as categoriesPost } from "@app/api/document-categories/route"
import { POST as clientsPost } from "@app/api/clients/route"
import { DELETE as documentDelete } from "@app/api/clients/[clientPublicId]/documents/[documentPublicId]/route"
import { GET as documentFileGet } from "@app/api/clients/[clientPublicId]/documents/[documentPublicId]/file/route"
import { resetAuthDatabaseForTests } from "@server/features/auth/infrastructure/auth-test-db-utils"

import { GET, POST } from "./route"

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

async function createClient(cookieHeader: string) {
  const response = await clientsPost(
    new Request("http://localhost:3000/api/clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({ fullName: "Doc Client", totalDebt: 0 }),
    }),
  )

  const payload = await response.json()
  return payload.data.client.publicId as string
}

async function createCategory(cookieHeader: string) {
  const response = await categoriesPost(
    new Request("http://localhost:3000/api/document-categories", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({ name: "Contrato" }),
    }),
  )

  const payload = await response.json()
  return payload.data.category.publicId as string
}

function buildPdfFile(name = "test.pdf") {
  return new File(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"], name, {
    type: "application/pdf",
  })
}

describe("/api/clients/[clientPublicId]/documents", () => {
  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "admin@test.local"
    process.env.ADMIN_PASSWORD = "admin-password"
    process.env.MANAGER_EMAIL = "manager@test.local"
    process.env.MANAGER_PASSWORD = "manager-password"
    process.env.JWT_SECRET = "test-secret"

    await resetAuthDatabaseForTests()
  })

  it("uploads and lists current client documents", async () => {
    const adminCookie = await authCookieHeader("admin@test.local", "admin-password")
    const managerCookie = await authCookieHeader("manager@test.local", "manager-password")
    const clientPublicId = await createClient(adminCookie)
    const categoryPublicId = await createCategory(adminCookie)

    const formData = new FormData()
    formData.set("categoryPublicId", categoryPublicId)
    formData.set("file", buildPdfFile())

    const uploadResponse = await POST(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents`, {
        method: "POST",
        headers: { cookie: managerCookie },
        body: formData,
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const uploadPayload = await uploadResponse.json()

    expect(uploadResponse.status).toBe(201)
    expect(uploadPayload.ok).toBe(true)

    const listResponse = await GET(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents`, {
        method: "GET",
        headers: { cookie: managerCookie },
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const listPayload = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(listPayload.ok).toBe(true)
    expect(listPayload.data.documents).toHaveLength(1)

    const documentPublicId = listPayload.data.documents[0].publicId as string

    const fileResponse = await documentFileGet(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents/${documentPublicId}/file`, {
        method: "GET",
        headers: { cookie: managerCookie },
      }),
      {
        params: Promise.resolve({
          clientPublicId,
          documentPublicId,
        }),
      },
    )

    expect(fileResponse.status).toBe(200)
    expect(fileResponse.headers.get("content-type")).toContain("application/pdf")

    const deleteResponse = await documentDelete(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents/${documentPublicId}`, {
        method: "DELETE",
        headers: { cookie: managerCookie },
      }),
      {
        params: Promise.resolve({
          clientPublicId,
          documentPublicId,
        }),
      },
    )

    expect(deleteResponse.status).toBe(200)

    const listAfterDeleteResponse = await GET(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents`, {
        method: "GET",
        headers: { cookie: managerCookie },
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const listAfterDeletePayload = await listAfterDeleteResponse.json()

    expect(listAfterDeleteResponse.status).toBe(200)
    expect(listAfterDeletePayload.data.documents).toHaveLength(0)
  })

  it("rejects non-pdf uploads", async () => {
    const adminCookie = await authCookieHeader("admin@test.local", "admin-password")
    const managerCookie = await authCookieHeader("manager@test.local", "manager-password")
    const clientPublicId = await createClient(adminCookie)
    const categoryPublicId = await createCategory(adminCookie)

    const formData = new FormData()
    formData.set("categoryPublicId", categoryPublicId)
    formData.set("file", new File(["plain text"], "bad.txt", { type: "text/plain" }))

    const response = await POST(
      new Request(`http://localhost:3000/api/clients/${clientPublicId}/documents`, {
        method: "POST",
        headers: { cookie: managerCookie },
        body: formData,
      }),
      { params: Promise.resolve({ clientPublicId }) },
    )

    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe("invalid_file_type")
  })
})
