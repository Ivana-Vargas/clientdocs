import fs from "node:fs"
import { Readable } from "node:stream"

import { getCurrentClientDocumentFileAccessFromDb } from "@server/features/documents/application/documents-service"
import { readLocalStoredPdf } from "@server/shared/storage/document-storage"
import { errorResponse } from "@server/shared/errors/api-response"
import { AppError } from "@server/shared/errors/app-error"
import { HTTP_STATUS } from "@server/shared/errors/http-status"
import { requireAuthenticatedUser } from "@server/shared/security/access-guard"

type RouteContext = {
  params: Promise<{
    clientPublicId: string
    documentPublicId: string
  }>
}

export const runtime = "nodejs"

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)

  if (!match) {
    return null
  }

  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : fileSize - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start < 0 || end >= fileSize) {
    return null
  }

  return { start, end }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    requireAuthenticatedUser(request.headers.get("cookie") ?? "")
    const { clientPublicId, documentPublicId } = await context.params

    const document = await getCurrentClientDocumentFileAccessFromDb(clientPublicId, documentPublicId)

    if (!document) {
      throw new AppError({
        code: "document_not_found",
        status: HTTP_STATUS.notFound,
        message: "document not found",
      })
    }

    if (document.storageProvider !== "LOCAL") {
      throw new AppError({
        code: "storage_provider_not_supported",
        status: HTTP_STATUS.badRequest,
        message: "unsupported storage provider",
      })
    }

    const localFile = readLocalStoredPdf(document.storageKey)
    const stats = localFile.stat()
    const rangeHeader = request.headers.get("range")

    if (rangeHeader) {
      const parsedRange = parseRangeHeader(rangeHeader, stats.size)

      if (!parsedRange) {
        return new Response(null, {
          status: 416,
          headers: {
            "content-range": `bytes */${stats.size}`,
          },
        })
      }

      const stream = fs.createReadStream(localFile.absolutePath, {
        start: parsedRange.start,
        end: parsedRange.end,
      })

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "content-type": document.mimeType,
          "content-length": String(parsedRange.end - parsedRange.start + 1),
          "content-range": `bytes ${parsedRange.start}-${parsedRange.end}/${stats.size}`,
          "accept-ranges": "bytes",
          "content-disposition": `inline; filename=\"${document.originalFileName}\"`,
          "cache-control": "private, max-age=300",
        },
      })
    }

    const stream = localFile.createReadStream()

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: HTTP_STATUS.ok,
      headers: {
        "content-type": document.mimeType,
        "content-length": String(stats.size),
        "accept-ranges": "bytes",
        "content-disposition": `inline; filename=\"${document.originalFileName}\"`,
        "cache-control": "private, max-age=300",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
