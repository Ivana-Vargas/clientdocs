import { NextResponse } from "next/server"

import type { ApiErrorDetail } from "@shared/types/api-response"

import { AppError } from "./app-error"
import { HTTP_STATUS } from "./http-status"

export function successResponse<T>(data: T, status: number = HTTP_STATUS.ok) {
  return NextResponse.json(
    {
      ok: true,
      status,
      data,
    },
    { status },
  )
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        status: error.status,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    )
  }

  return NextResponse.json(
    {
      ok: false,
      status: HTTP_STATUS.internalServerError,
      error: {
        code: "internal_server_error",
        message: "an unexpected error occurred",
      },
    },
    { status: HTTP_STATUS.internalServerError },
  )
}

export function validationDetailsFromZod(
  fieldErrors: Record<string, string[] | undefined>,
): ApiErrorDetail[] {
  return Object.entries(fieldErrors).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => ({ field, message })),
  )
}
