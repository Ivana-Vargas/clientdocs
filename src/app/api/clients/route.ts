import { z } from "zod"

import {
  createClientInDb,
  listClientsFromDb,
} from "@server/features/clients/application/clients-service"
import { CLIENT_STATUSES } from "@server/features/clients/domain/client-status"
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

const statusSchema = z.enum(CLIENT_STATUSES)

const createClientSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  totalDebt: z.number().min(0).max(1_000_000_000).default(0),
  nationalId: z.string().max(40).optional(),
  phoneNumber: z.string().max(40).optional(),
  email: z.string().email().max(180).optional().or(z.literal("")),
  addressLine: z.string().max(240).optional(),
  notes: z.string().max(1600).optional(),
})

export async function GET(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")

    const url = new URL(request.url)
    const statusParam = url.searchParams.get("status")
    const statusResult = statusParam ? statusSchema.safeParse(statusParam) : null

    if (statusResult && !statusResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid status filter",
        details: [
          {
            field: "status",
            message: "invalid status",
          },
        ],
      })
    }

    const status = statusResult?.success ? statusResult.data : undefined
    const clients = await listClientsFromDb(status)
    const response = successResponse({ clients }, HTTP_STATUS.ok)

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
    const json = await request.json().catch(() => null)
    const parseResult = createClientSchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid client payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const client = await createClientInDb(
      {
        ...parseResult.data,
        totalDebtInCents: parseDecimalAmountToCents(
          parseResult.data.totalDebt,
          "totalDebt",
          "invalid client payload",
        ),
      },
      user.id,
    )
    const response = successResponse({ client }, HTTP_STATUS.created)

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
