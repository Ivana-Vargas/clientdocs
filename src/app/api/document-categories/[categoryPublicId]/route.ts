import { z } from "zod"

import {
  deleteDocumentCategoryByPublicIdFromDb,
  updateDocumentCategoryByPublicIdFromDb,
} from "@server/features/documents/application/documents-service"
import { AppError } from "@server/shared/errors/app-error"
import { errorResponse, successResponse } from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import {
  requireAuthenticatedUser,
  requireTrustedOriginForMutation,
  requireUserRole,
} from "@server/shared/security/access-guard"

type RouteContext = {
  params: Promise<{
    categoryPublicId: string
  }>
}

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
})

export async function PATCH(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    requireUserRole(user, ["admin"])

    const { categoryPublicId } = await context.params
    const json = await request.json().catch(() => null)
    const parseResult = updateCategorySchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid category payload",
      })
    }

    const result = await updateDocumentCategoryByPublicIdFromDb({
      categoryPublicId,
      name: parseResult.data.name,
    })

    if (result.status === "category_not_found") {
      throw new AppError({
        code: "category_not_found",
        status: HTTP_STATUS.notFound,
        message: "document category not found",
      })
    }

    const response = successResponse({ category: result.category }, HTTP_STATUS.ok)

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

export async function DELETE(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    requireUserRole(user, ["admin"])

    const { categoryPublicId } = await context.params
    const result = await deleteDocumentCategoryByPublicIdFromDb(categoryPublicId)

    if (result.status === "category_not_found") {
      throw new AppError({
        code: "category_not_found",
        status: HTTP_STATUS.notFound,
        message: "document category not found",
      })
    }

    if (result.status === "category_has_documents") {
      throw new AppError({
        code: "category_has_documents",
        status: HTTP_STATUS.badRequest,
        message: "cannot delete category with documents",
      })
    }

    const response = successResponse({ deleted: true }, HTTP_STATUS.ok)

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
