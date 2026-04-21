import { z } from "zod"

import {
  createDocumentCategoryInDb,
  listDocumentCategoriesFromDb,
} from "@server/features/documents/application/documents-service"
import { AppError } from "@server/shared/errors/app-error"
import { errorResponse, successResponse, validationDetailsFromZod } from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import {
  requireAuthenticatedUser,
  requireTrustedOriginForMutation,
  requireUserRole,
} from "@server/shared/security/access-guard"

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
})

export async function GET(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const categories = await listDocumentCategoriesFromDb()
    const response = successResponse({ categories }, HTTP_STATUS.ok)

    logHttpRequestResult({
      method: request.method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })

    return response
  } catch (error) {
    const response = errorResponse(error)

    logHttpRequestResult({
      method: request.method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })

    return response
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    requireUserRole(user, ["admin"])

    const json = await request.json().catch(() => null)
    const parseResult = createCategorySchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid category payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const category = await createDocumentCategoryInDb({
      name: parseResult.data.name,
      createdByUserId: user.id,
    })

    const response = successResponse({ category }, HTTP_STATUS.created)

    logHttpRequestResult({
      method: request.method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })

    return response
  } catch (error) {
    const response = errorResponse(error)

    logHttpRequestResult({
      method: request.method,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })

    return response
  }
}
