import { getUserFromAccessToken } from "@server/features/auth/application/auth-db-service"
import type { AuthRole } from "@server/features/auth/domain/auth-role"
import { getAccessTokenCookieName } from "@server/features/auth/presentation/auth-cookies"
import { AppError } from "@server/shared/errors/app-error"
import { HTTP_STATUS } from "@server/shared/errors/http-status"

import { getCookieValue } from "./cookie-utils"

export function requireAuthenticatedUser(cookieHeader: string) {
  const accessToken = getCookieValue(cookieHeader, getAccessTokenCookieName())

  if (!accessToken) {
    throw new AppError({
      code: "missing_access_token",
      status: HTTP_STATUS.unauthorized,
      message: "missing access token",
    })
  }

  const user = getUserFromAccessToken(accessToken)

  if (!user) {
    throw new AppError({
      code: "invalid_access_token",
      status: HTTP_STATUS.unauthorized,
      message: "invalid or expired access token",
    })
  }

  return user
}

export function requireUserRole(user: { role: AuthRole }, allowedRoles: AuthRole[]) {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError({
      code: "forbidden",
      status: HTTP_STATUS.forbidden,
      message: "insufficient permissions",
    })
  }
}

function resolveSourceOrigin(request: Request) {
  const originHeader = request.headers.get("origin")

  if (originHeader) {
    try {
      return new URL(originHeader).origin
    } catch {
      throw new AppError({
        code: "invalid_origin",
        status: HTTP_STATUS.forbidden,
        message: "invalid origin header",
      })
    }
  }

  const refererHeader = request.headers.get("referer")

  if (refererHeader) {
    try {
      return new URL(refererHeader).origin
    } catch {
      throw new AppError({
        code: "invalid_origin",
        status: HTTP_STATUS.forbidden,
        message: "invalid referer header",
      })
    }
  }

  return null
}

function resolveExpectedOrigin(request: Request) {
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host")

  if (!hostHeader) {
    return null
  }

  const protocolHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const requestProtocol = new URL(request.url).protocol.replace(":", "")
  const protocol = protocolHeader || requestProtocol || "https"

  return `${protocol}://${hostHeader}`
}

export function requireTrustedOriginForMutation(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return
  }

  const sourceOrigin = resolveSourceOrigin(request)

  if (!sourceOrigin) {
    return
  }

  const expectedOrigin = resolveExpectedOrigin(request)

  if (!expectedOrigin) {
    return
  }

  if (sourceOrigin !== expectedOrigin) {
    throw new AppError({
      code: "invalid_origin",
      status: HTTP_STATUS.forbidden,
      message: "origin mismatch",
    })
  }
}
