import { z } from "zod"

import { loginWithEmailPasswordFromDb } from "@server/features/auth/application/auth-db-service"
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "@server/features/auth/presentation/auth-cookies"
import { AppError } from "@server/shared/errors/app-error"
import {
  errorResponse,
  successResponse,
  validationDetailsFromZod,
} from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { logger } from "@server/shared/observability/logger"
import { requireTrustedOriginForMutation } from "@server/shared/security/access-guard"
import { enforceRateLimit, getRequestClientFingerprint } from "@server/shared/security/rate-limit"

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = request.headers.get("user-agent") ?? undefined

  try {
    requireTrustedOriginForMutation(request)
    const json = await request.json().catch(() => null)
    const parseResult = loginSchema.safeParse(json)

    enforceRateLimit({
      bucket: "auth_login",
      key: getRequestClientFingerprint(request),
      maxRequests: 20,
      windowMs: 60_000,
    })

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_request",
        status: HTTP_STATUS.badRequest,
        message: "invalid login payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const result = await loginWithEmailPasswordFromDb(parseResult.data.email, parseResult.data.password, {
      ipAddress,
      userAgent,
    })

    if (!result) {
      logger.warn({ event: "login_failed", email: parseResult.data.email }, "login failed")
      throw new AppError({
        code: "invalid_credentials",
        status: HTTP_STATUS.unauthorized,
        message: "invalid email or password",
      })
    }

    const response = successResponse(
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      HTTP_STATUS.ok,
    )

    setAccessTokenCookie(response, result.accessToken)
    setRefreshTokenCookie(response, result.refreshToken)
    logger.info({ event: "login_success", userId: result.user.id }, "login success")
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
