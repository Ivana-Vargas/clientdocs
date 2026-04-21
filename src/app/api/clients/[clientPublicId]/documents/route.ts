import { z } from "zod"

import {
  listCurrentClientDocumentsFromDb,
  uploadClientDocumentFromDb,
} from "@server/features/documents/application/documents-service"
import { PDF_MIME_TYPE, resolveMaxUploadFileSizeBytes } from "@server/features/documents/domain/document-constants"
import { AppError } from "@server/shared/errors/app-error"
import { errorResponse, successResponse } from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { requireAuthenticatedUser, requireUserRole } from "@server/shared/security/access-guard"

type RouteContext = {
  params: Promise<{
    clientPublicId: string
  }>
}

export const runtime = "nodejs"

const uploadPayloadSchema = z.object({
  categoryPublicId: z.string().trim().min(1),
})

function validateUploadFile(file: File) {
  const maxFileSize = resolveMaxUploadFileSizeBytes()

  if (file.type !== PDF_MIME_TYPE) {
    throw new AppError({
      code: "invalid_file_type",
      status: HTTP_STATUS.badRequest,
      message: "only pdf files are allowed",
    })
  }

  if (file.size > maxFileSize) {
    throw new AppError({
      code: "file_too_large",
      status: HTTP_STATUS.badRequest,
      message: "file is larger than allowed limit",
    })
  }
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const documents = await listCurrentClientDocumentsFromDb(clientPublicId)

    if (!documents) {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    const response = successResponse({ documents }, HTTP_STATUS.ok)

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

export async function POST(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    requireUserRole(user, ["admin", "manager"])

    const { clientPublicId } = await context.params
    const formData = await request.formData()
    const rawCategoryPublicId = formData.get("categoryPublicId")
    const fileField = formData.get("file")

    const payloadResult = uploadPayloadSchema.safeParse({
      categoryPublicId: typeof rawCategoryPublicId === "string" ? rawCategoryPublicId : "",
    })

    if (!payloadResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid document upload payload",
      })
    }

    if (!(fileField instanceof File)) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "missing file",
      })
    }

    validateUploadFile(fileField)

    const uploadResult = await uploadClientDocumentFromDb({
      clientPublicId,
      categoryPublicId: payloadResult.data.categoryPublicId,
      originalFileName: fileField.name,
      mimeType: fileField.type,
      fileSizeBytes: fileField.size,
      contentBuffer: Buffer.from(await fileField.arrayBuffer()),
      uploadedByUserId: user.id,
    })

    if (uploadResult.status === "client_not_found") {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    if (uploadResult.status === "category_not_found") {
      throw new AppError({
        code: "category_not_found",
        status: HTTP_STATUS.notFound,
        message: "document category not found",
      })
    }

    const response = successResponse({ document: uploadResult.document }, HTTP_STATUS.created)

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
