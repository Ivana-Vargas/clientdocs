"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { ApiClientError } from "@app/shared/lib/api-client"
import { useToast } from "@app/shared/ui/toast-provider"

type CategoryItem = {
  publicId: string
  name: string
}

type DocumentItem = {
  publicId: string
  categoryPublicId: string
  originalFileName: string
  fileSizeBytes: number
  version: number
  uploadedAt: string
}

type ClientDocumentsWorkspaceLabels = {
  title: string
  subtitle: string
  backButton: string
  pendingStatus: string
  uploadedStatus: string
  pendingHint: string
  uploadedAtLabel: string
  fileLabel: string
  versionLabel: string
  uploadButton: string
  addMoreButton: string
  viewButton: string
  deleteButton: string
  deleteModalTitle: string
  deleteModalDescription: string
  deleteModalConfirmButton: string
  deleteModalCancelButton: string
  deleteSuccessTitle: string
  deleteSuccessDescription: string
  deleteErrorTitle: string
  deleteErrorDescription: string
  uploadSuccessTitle: string
  uploadSuccessDescription: string
  uploadErrorTitle: string
  uploadErrorDescription: string
}

type ClientDocumentsWorkspaceProps = {
  clientPublicId: string
  categories: CategoryItem[]
  initialDocuments: DocumentItem[]
  locale: "es" | "en"
  labels: ClientDocumentsWorkspaceLabels
}

function toReadableSize(sizeInBytes: number, locale: "es" | "en") {
  const sizeInMb = sizeInBytes / (1024 * 1024)
  if (sizeInMb >= 1) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(sizeInMb)} MB`
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(sizeInBytes / 1024)} KB`
}

function toReadableDate(dateIso: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(dateIso))
}

export function ClientDocumentsWorkspace({
  clientPublicId,
  categories,
  initialDocuments,
  locale,
  labels,
}: ClientDocumentsWorkspaceProps) {
  const { showToast } = useToast()
  const [documents, setDocuments] = useState(initialDocuments)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null)

  const groupedDocuments = useMemo(() => {
    const grouped = new Map<string, DocumentItem[]>()

    for (const document of documents) {
      const list = grouped.get(document.categoryPublicId) ?? []
      list.push(document)
      grouped.set(document.categoryPublicId, list)
    }

    for (const list of grouped.values()) {
      list.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
    }

    return grouped
  }, [documents])

  async function handleUpload(categoryPublicId: string, files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    try {
      setUploadingCategory(categoryPublicId)

      const uploadedDocuments: DocumentItem[] = []

      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set("categoryPublicId", categoryPublicId)
        formData.set("file", file)

        const response = await fetch(`/api/clients/${clientPublicId}/documents`, {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        const payload = await response.json()

        if (!response.ok || !payload.ok) {
          throw new ApiClientError(
            payload?.status ?? response.status,
            payload?.error?.code ?? "upload_failed",
            payload?.error?.message ?? "upload failed",
            payload?.error?.details,
          )
        }

        uploadedDocuments.push(payload.data.document as DocumentItem)
      }

      setDocuments((current) => [...current, ...uploadedDocuments])

      showToast({
        title: labels.uploadSuccessTitle,
        description: labels.uploadSuccessDescription,
        variant: "success",
      })
    } catch {
      showToast({
        title: labels.uploadErrorTitle,
        description: labels.uploadErrorDescription,
        variant: "error",
      })
    } finally {
      setUploadingCategory(null)
    }
  }

  async function handleDeleteDocument() {
    if (!documentToDelete) {
      return
    }

    try {
      setDeletingDocumentId(documentToDelete.publicId)

      const response = await fetch(
        `/api/clients/${clientPublicId}/documents/${documentToDelete.publicId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      )

      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        throw new ApiClientError(
          payload?.status ?? response.status,
          payload?.error?.code ?? "delete_failed",
          payload?.error?.message ?? "delete failed",
          payload?.error?.details,
        )
      }

      setDocuments((current) =>
        current.filter((document) => document.publicId !== documentToDelete.publicId),
      )

      showToast({
        title: labels.deleteSuccessTitle,
        description: labels.deleteSuccessDescription,
        variant: "success",
      })
      setDocumentToDelete(null)
    } catch {
      showToast({
        title: labels.deleteErrorTitle,
        description: labels.deleteErrorDescription,
        variant: "error",
      })
    } finally {
      setDeletingDocumentId(null)
    }
  }

  return (
    <main className="private-page documents-workspace-page">
      <header className="private-page__header clients-list-page__header documents-workspace-page__header">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <Link href={`/clients/${clientPublicId}`} className="clients-secondary-link">
          {labels.backButton}
        </Link>
      </header>

      <section className="documents-workspace-grid">
        {categories.map((category) => {
          const categoryDocuments = groupedDocuments.get(category.publicId) ?? []
          const isUploading = uploadingCategory === category.publicId

          return (
            <article key={category.publicId} className="documents-workspace-card">
              <h2>{category.name}</h2>
              <p
                className={
                  categoryDocuments.length > 0
                    ? "documents-workspace-card__status documents-workspace-card__status--ok"
                    : "documents-workspace-card__status"
                }
              >
                {categoryDocuments.length > 0 ? labels.uploadedStatus : labels.pendingStatus}
              </p>

              {categoryDocuments.length === 0 ? (
                <p className="documents-workspace-card__hint">{labels.pendingHint}</p>
              ) : (
                <ul className="documents-workspace-card__docs-list">
                  {categoryDocuments.map((document) => (
                    <li key={document.publicId}>
                      <p>
                        {labels.fileLabel}: {document.originalFileName}
                      </p>
                      <p>
                        {labels.uploadedAtLabel}: {toReadableDate(document.uploadedAt, locale)}
                      </p>
                      <p>
                        {labels.versionLabel}: {document.version} - {toReadableSize(document.fileSizeBytes, locale)}
                      </p>
                      <div className="documents-workspace-card__doc-actions">
                        <Link
                          className="clients-secondary-link"
                          href={`/clients/${clientPublicId}/documents/${document.publicId}`}
                        >
                          {labels.viewButton}
                        </Link>
                        <button
                          type="button"
                          className="clients-danger-button"
                          onClick={() => setDocumentToDelete(document)}
                        >
                          {labels.deleteButton}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="documents-workspace-card__actions">
                <label className="clients-primary-button documents-workspace-card__upload-btn">
                  {isUploading
                    ? labels.uploadButton
                    : categoryDocuments.length > 0
                      ? labels.addMoreButton
                      : labels.uploadButton}
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={(event) => {
                      void handleUpload(category.publicId, event.target.files)
                      event.currentTarget.value = ""
                    }}
                    className="documents-workspace-card__file-input"
                  />
                </label>
              </div>
            </article>
          )
        })}
      </section>

      {documentToDelete ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="document-delete-title">
          <div className="modal-card clients-delete-modal">
            <h2 id="document-delete-title">{labels.deleteModalTitle}</h2>
            <p>
              {labels.deleteModalDescription} <strong>{documentToDelete.originalFileName}</strong>.
            </p>

            <div className="clients-delete-modal__actions">
              <button
                type="button"
                className="clients-secondary-button"
                onClick={() => setDocumentToDelete(null)}
              >
                {labels.deleteModalCancelButton}
              </button>
              <button
                type="button"
                className="clients-danger-button"
                onClick={() => void handleDeleteDocument()}
                disabled={deletingDocumentId === documentToDelete.publicId}
              >
                {labels.deleteModalConfirmButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
