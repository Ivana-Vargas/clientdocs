import { logoutRefreshTokenFromDb } from "@server/features/auth/application/auth-db-service"
import {
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenCookieName,
} from "@server/features/auth/presentation/auth-cookies"
import { errorResponse, successResponse } from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { requireTrustedOriginForMutation } from "@server/shared/security/access-guard"
import { getCookieValue } from "@server/shared/security/cookie-utils"

export async function POST(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    const cookieHeader = request.headers.get("cookie") ?? ""
    const refreshToken = getCookieValue(cookieHeader, getRefreshTokenCookieName())

    if (refreshToken) {
      await logoutRefreshTokenFromDb(refreshToken)
    }

    const response = successResponse({ success: true }, HTTP_STATUS.ok)
    clearAccessTokenCookie(response)
    clearRefreshTokenCookie(response)
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
