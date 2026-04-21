import crypto from "node:crypto"

import bcrypt from "bcryptjs"

import type { AuthRole } from "@server/features/auth/domain/auth-role"
import {
  issueTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from "@server/features/auth/infrastructure/jwt-token-service"
import { prismaClient } from "@database/db-client/prisma-client"

type RequestMetadata = {
  ipAddress?: string
  userAgent?: string
}

function normalizeRole(role: "ADMIN" | "MANAGER"): AuthRole {
  return role === "ADMIN" ? "admin" : "manager"
}

function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function loginWithEmailPasswordFromDb(
  email: string,
  password: string,
  metadata?: RequestMetadata,
) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prismaClient.user.findUnique({ where: { email: normalizedEmail } })

  if (!user || !user.isActive) {
    return null
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatches) {
    return null
  }

  const authUser = {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role),
    passwordHash: user.passwordHash,
  }

  const tokenPair = issueTokenPair(authUser)

  await prismaClient.$transaction([
    prismaClient.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(tokenPair.refreshToken),
        jwtJti: tokenPair.refreshJti,
        expiresAt: tokenPair.refreshExpiresAt,
        isRevoked: false,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    }),
    prismaClient.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ])

  return {
    user: {
      id: user.id,
      email: user.email,
      role: normalizeRole(user.role),
    },
    ...tokenPair,
  }
}

export async function refreshAccessTokenFromDb(refreshToken: string, metadata?: RequestMetadata) {
  let payload

  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    return null
  }

  if (payload.type !== "refresh") {
    return null
  }

  const currentSession = await prismaClient.authSession.findUnique({ where: { jwtJti: payload.jti } })

  if (!currentSession || currentSession.isRevoked || currentSession.expiresAt.getTime() <= Date.now()) {
    return null
  }

  if (currentSession.refreshTokenHash !== hashRefreshToken(refreshToken)) {
    return null
  }

  const user = await prismaClient.user.findUnique({ where: { id: currentSession.userId } })

  if (!user || !user.isActive) {
    return null
  }

  const authUser = {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role),
    passwordHash: user.passwordHash,
  }

  const tokenPair = issueTokenPair(authUser)

  await prismaClient.$transaction([
    prismaClient.authSession.update({
      where: { jwtJti: payload.jti },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    }),
    prismaClient.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(tokenPair.refreshToken),
        jwtJti: tokenPair.refreshJti,
        expiresAt: tokenPair.refreshExpiresAt,
        isRevoked: false,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    }),
  ])

  return {
    user: {
      id: user.id,
      email: user.email,
      role: normalizeRole(user.role),
    },
    ...tokenPair,
  }
}

export async function logoutRefreshTokenFromDb(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken)

    if (payload.type !== "refresh") {
      return
    }

    const currentSession = await prismaClient.authSession.findUnique({ where: { jwtJti: payload.jti } })

    if (!currentSession) {
      return
    }

    if (currentSession.refreshTokenHash !== hashRefreshToken(refreshToken)) {
      return
    }

    await prismaClient.authSession.update({
      where: { jwtJti: payload.jti },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    })
  } catch {
    return
  }
}

export function getUserFromAccessToken(accessToken: string) {
  try {
    const payload = verifyAccessToken(accessToken)

    if (payload.type !== "access") {
      return null
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthRole,
    }
  } catch {
    return null
  }
}

export async function getUserRoleByIdFromDb(userId: string): Promise<AuthRole | null> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return null
  }

  return normalizeRole(user.role)
}
