import { z } from "zod"

import {
  deleteClientByPublicIdFromDb,
  getClientByPublicIdFromDb,
  updateClientByPublicIdFromDb,
} from "@server/features/clients/application/clients-service"
import { AppError } from "@server/shared/errors/app-error"
import {
  errorResponse,
  successResponse,
  validationDetailsFromZod,
} from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { requireAuthenticatedUser, requireTrustedOriginForMutation } from "@server/shared/security/access-guard"
import { parseDecimalAmountToCents } from "@server/shared/utils/amount-in-cents"

type RouteContext = {
  params: Promise<{
    clientPublicId: string
  }>
}

const updateClientSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    totalDebt: z.number().min(0).max(1_000_000_000).optional(),
    nationalId: z.string().max(40).optional(),
    phoneNumber: z.string().max(40).optional(),
    email: z.string().email().max(180).optional().or(z.literal("")),
    addressLine: z.string().max(240).optional(),
    notes: z.string().max(1600).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "at least one field is required",
    path: ["body"],
  })

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const client = await getClientByPublicIdFromDb(clientPublicId)

    if (!client) {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    const response = successResponse({ client }, HTTP_STATUS.ok)

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

export async function PATCH(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const json = await request.json().catch(() => null)
    const parseResult = updateClientSchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid client payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const client = await updateClientByPublicIdFromDb(clientPublicId, {
      ...parseResult.data,
      totalDebtInCents:
        parseResult.data.totalDebt === undefined
          ? undefined
          : parseDecimalAmountToCents(parseResult.data.totalDebt, "totalDebt", "invalid client payload"),
    })

    if (!client) {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    const response = successResponse({ client }, HTTP_STATUS.ok)

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
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const deleted = await deleteClientByPublicIdFromDb(clientPublicId)

    if (!deleted) {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
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
