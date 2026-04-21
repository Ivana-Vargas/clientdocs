import { deleteCurrentClientDocumentByPublicIdFromDb } from "@server/features/documents/application/documents-service"
import { AppError } from "@server/shared/errors/app-error"
import { errorResponse, successResponse } from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { requireAuthenticatedUser, requireUserRole } from "@server/shared/security/access-guard"

type RouteContext = {
  params: Promise<{
    clientPublicId: string
    documentPublicId: string
  }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    requireUserRole(user, ["admin", "manager"])

    const { clientPublicId, documentPublicId } = await context.params
    const result = await deleteCurrentClientDocumentByPublicIdFromDb({
      clientPublicId,
      documentPublicId,
    })

    if (result.status === "document_not_found") {
      throw new AppError({
        code: "document_not_found",
        status: HTTP_STATUS.notFound,
        message: "document not found",
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
