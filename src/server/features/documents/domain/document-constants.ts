export const PDF_MIME_TYPE = "application/pdf"

export function resolveMaxUploadFileSizeBytes() {
  const rawMaxSize = Number(process.env.MAX_UPLOAD_FILE_SIZE_MB ?? "20")
  const safeMaxSize = Number.isFinite(rawMaxSize) && rawMaxSize > 0 ? rawMaxSize : 20
  return Math.floor(safeMaxSize * 1024 * 1024)
}
