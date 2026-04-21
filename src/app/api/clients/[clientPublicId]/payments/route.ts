import { z } from "zod"

import {
  createPaymentForClientPublicIdInDb,
  listPaymentsByClientPublicIdFromDb,
} from "@server/features/payments/application/payments-service"
import { PAYMENT_METHODS } from "@server/features/payments/domain/payment-method"
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

const createPaymentSchema = z.object({
  amount: z.number().positive().max(1_000_000_000),
  method: z.enum(PAYMENT_METHODS),
  referenceNote: z.string().max(300).optional(),
  paidAt: z.string().optional(),
})

function parsePaidAt(rawPaidAt: string | undefined) {
  if (!rawPaidAt) {
    return new Date()
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawPaidAt)) {
    const [rawYear, rawMonth, rawDay] = rawPaidAt.split("-")
    const year = Number(rawYear)
    const month = Number(rawMonth)
    const day = Number(rawDay)

    return new Date(year, month - 1, day, 12, 0, 0, 0)
  }

  const parsed = new Date(rawPaidAt)

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError({
      code: "invalid_request",
      status: HTTP_STATUS.badRequest,
      message: "invalid payment payload",
      details: [
        {
          field: "paidAt",
          message: "invalid payment date",
        },
      ],
    })
  }

  return parsed
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const result = await listPaymentsByClientPublicIdFromDb(clientPublicId)

    if (!result) {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    const response = successResponse(result, HTTP_STATUS.ok)

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
    requireTrustedOriginForMutation(request)
    const user = requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId } = await context.params
    const json = await request.json().catch(() => null)
    const parseResult = createPaymentSchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid payment payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const payment = await createPaymentForClientPublicIdInDb(
      clientPublicId,
      {
        amountInCents: parseDecimalAmountToCents(
          parseResult.data.amount,
          "amount",
          "invalid payment payload",
        ),
        method: parseResult.data.method,
        referenceNote: parseResult.data.referenceNote,
        paidAt: parsePaidAt(parseResult.data.paidAt),
      },
      user.id,
    )

    if (payment.status === "client_not_found") {
      throw new AppError({
        code: "client_not_found",
        status: HTTP_STATUS.notFound,
        message: "client not found",
      })
    }

    if (payment.status === "payment_exceeds_debt") {
      throw new AppError({
        code: "payment_exceeds_debt",
        status: HTTP_STATUS.badRequest,
        message: "payment exceeds remaining debt",
        details: [
          {
            field: "amount",
            message: "payment exceeds remaining debt",
          },
        ],
      })
    }

    const response = successResponse({ payment: payment.payment }, HTTP_STATUS.created)

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
