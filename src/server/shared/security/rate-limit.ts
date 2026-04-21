import { AppError } from "@server/shared/errors/app-error"
import { HTTP_STATUS } from "@server/shared/errors/http-status"

type RateLimitInput = {
  bucket: string
  key: string
  maxRequests: number
  windowMs: number
}

type RateLimitBucketEntry = {
  count: number
  resetAt: number
}

const rateLimitState = new Map<string, RateLimitBucketEntry>()

function shouldSkipRateLimit() {
  return process.env.NODE_ENV === "test"
}

function pruneExpiredEntries(now: number) {
  if (rateLimitState.size < 4000) {
    return
  }

  for (const [stateKey, entry] of rateLimitState.entries()) {
    if (entry.resetAt <= now) {
      rateLimitState.delete(stateKey)
    }
  }
}

export function getRequestClientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim()
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    firstForwardedIp ||
    "unknown"
  const userAgent = request.headers.get("user-agent") ?? "unknown"

  return `${ip}:${userAgent}`
}

export function enforceRateLimit(input: RateLimitInput) {
  if (shouldSkipRateLimit()) {
    return
  }

  const now = Date.now()
  pruneExpiredEntries(now)

  const stateKey = `${input.bucket}:${input.key}`
  const existing = rateLimitState.get(stateKey)

  if (!existing || existing.resetAt <= now) {
    rateLimitState.set(stateKey, {
      count: 1,
      resetAt: now + input.windowMs,
    })
    return
  }

  if (existing.count >= input.maxRequests) {
    throw new AppError({
      code: "rate_limited",
      status: HTTP_STATUS.tooManyRequests,
      message: "too many requests, try again later",
    })
  }

  existing.count += 1
}
