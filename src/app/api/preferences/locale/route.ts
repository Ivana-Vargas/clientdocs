import { z } from "zod"

import { AppError } from "@server/shared/errors/app-error"
import {
  errorResponse,
  successResponse,
  validationDetailsFromZod,
} from "@server/shared/errors/api-response"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { logHttpRequestResult } from "@server/shared/observability/http-console-logger"
import { requireTrustedOriginForMutation } from "@server/shared/security/access-guard"
import {
  LOCALE_COOKIE_NAME,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "@shared/localization/config"

const localeSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
})

export async function POST(request: Request) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname

  try {
    requireTrustedOriginForMutation(request)
    const json = await request.json().catch(() => null)
    const parseResult = localeSchema.safeParse(json)

    if (!parseResult.success) {
      throw new AppError({
        code: "invalid_locale",
        status: HTTP_STATUS.badRequest,
        message: "invalid locale payload",
        details: validationDetailsFromZod(parseResult.error.flatten().fieldErrors),
      })
    }

    const locale = resolveLocale(parseResult.data.locale)
    const response = successResponse({ locale }, HTTP_STATUS.ok)

    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

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
