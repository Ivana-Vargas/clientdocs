import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

type SavePdfParams = {
  clientPublicId: string
  categorySlug: string
  originalFileName: string
  buffer: Buffer
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
  const extension = path.extname(params.originalFileName).toLowerCase() || ".pdf"
  const safeClient = sanitizePathSegment(params.clientPublicId)
  const safeCategory = sanitizePathSegment(params.categorySlug)
  const randomSuffix = crypto.randomBytes(6).toString("hex")
  const fileName = `${Date.now()}-${randomSuffix}${extension}`
  const relativeStorageKey = path.posix.join(safeClient, safeCategory, fileName)
  const absolutePath = path.join(buildStorageRoot(), ...relativeStorageKey.split("/"))

  ensureDirectoryExists(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, params.buffer)

  return relativeStorageKey
}

export function readLocalStoredPdf(storageKey: string) {
  const normalizedKey = storageKey.replace(/\\/g, "/")
  const absolutePath = path.join(buildStorageRoot(), ...normalizedKey.split("/"))

  return {
    absolutePath,
    createReadStream: () => fs.createReadStream(absolutePath),
    stat: () => fs.statSync(absolutePath),
  }
}

export function deleteLocalStoredPdf(storageKey: string) {
  const normalizedKey = storageKey.replace(/\\/g, "/")
  const absolutePath = path.join(buildStorageRoot(), ...normalizedKey.split("/"))

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath)
  }
}
