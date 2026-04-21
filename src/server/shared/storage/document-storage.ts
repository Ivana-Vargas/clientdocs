import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

type SavePdfParams = {
  clientPublicId: string
  categorySlug: string
  originalFileName: string
  buffer: Buffer
}

function resolveSafeAbsolutePath(storageKey: string) {
  const normalizedKey = storageKey.replace(/\\/g, "/").trim()

  if (!normalizedKey || normalizedKey.startsWith("/") || normalizedKey.includes("..")) {
    throw new Error("invalid storage key")
  }

  const storageRoot = buildStorageRoot()
  const absolutePath = path.join(storageRoot, ...normalizedKey.split("/"))
  const normalizedAbsolutePath = path.normalize(absolutePath)
  const normalizedStorageRoot = path.normalize(storageRoot + path.sep)

  if (!normalizedAbsolutePath.startsWith(normalizedStorageRoot)) {
    throw new Error("unsafe storage path")
  }

  return normalizedAbsolutePath
}

function sanitizePathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildStorageRoot() {
  return path.join(process.cwd(), "uploads", "documents")
}

function ensureDirectoryExists(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

export function savePdfToLocalStorage(params: SavePdfParams) {
  const safeClient = sanitizePathSegment(params.clientPublicId)
  const safeCategory = sanitizePathSegment(params.categorySlug)
  const randomSuffix = crypto.randomBytes(6).toString("hex")
  const fileName = `${Date.now()}-${randomSuffix}.pdf`
  const relativeStorageKey = path.posix.join(safeClient, safeCategory, fileName)
  const absolutePath = resolveSafeAbsolutePath(relativeStorageKey)

  ensureDirectoryExists(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, params.buffer)

  return relativeStorageKey
}

export function readLocalStoredPdf(storageKey: string) {
  const absolutePath = resolveSafeAbsolutePath(storageKey)

  return {
    absolutePath,
    createReadStream: () => fs.createReadStream(absolutePath),
    stat: () => fs.statSync(absolutePath),
  }
}

export function deleteLocalStoredPdf(storageKey: string) {
  const absolutePath = resolveSafeAbsolutePath(storageKey)

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath)
  }
}
