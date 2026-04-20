"use client"

import Link from "next/link"
import { useState } from "react"

import { apiRequest } from "@app/shared/lib/api-client"
import { useToast } from "@app/shared/ui/toast-provider"

type ClientListItem = {
  id: string
  publicId: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  updatedAt: string
}

type ClientsListLabels = {
  title: string
  description: string
  addButton: string
  tableTitle: string
  tableEmpty: string
  columnPhone: string
  columnEmail: string
  columnUpdatedAt: string
  editButton: string
  deleteButton: string
  registeredCountSingular: string
  registeredCountPlural: string
  deleteModalTitle: string
  deleteModalDescription: string
  deleteTypeLabel: string
  deleteTypePlaceholder: string
  confirmDeleteButton: string
  cancelDeleteButton: string
  deleteConfirm: string
  deleteSuccessTitle: string
  deleteSuccessDescription: string
  deleteErrorTitle: string
  deleteErrorDescription: string
}

type ClientsListProps = {
  locale: "es" | "en"
  initialClients: ClientListItem[]
  labels: ClientsListLabels
}

function formatUpdatedAt(dateIso: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateIso))
}

export function ClientsList({ locale, initialClients, labels }: ClientsListProps) {
  const { showToast } = useToast()
  const [clients, setClients] = useState(initialClients)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ClientListItem | null>(null)
  const [deleteVerificationText, setDeleteVerificationText] = useState("")

  const deleteKeyword = locale === "es" ? "ELIMINAR" : "DELETE"

  const registeredLabel =
    clients.length === 1 ? labels.registeredCountSingular : labels.registeredCountPlural

  async function handleDelete(client: ClientListItem) {
    try {
      setDeletingId(client.publicId)
      await apiRequest(`/api/clients/${client.publicId}`, {
        method: "DELETE",
      })

      setClients((current) => current.filter((item) => item.publicId !== client.publicId))
      showToast({
        title: labels.deleteSuccessTitle,
        description: labels.deleteSuccessDescription,
        variant: "success",
      })
    } catch {
      showToast({
        title: labels.deleteErrorTitle,
        description: labels.deleteErrorDescription,
        variant: "error",
      })
    } finally {
      setDeletingId(null)
    }
  }

  function openDeleteModal(client: ClientListItem) {
    setDeleteCandidate(client)
    setDeleteVerificationText("")
  }

  function closeDeleteModal() {
    setDeleteCandidate(null)
    setDeleteVerificationText("")
  }

  return (
    <main className="private-page clients-list-page">
      <header className="private-page__header clients-list-page__header">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.description}</p>
        </div>
        <Link href="/clients/new" className="clients-primary-link">
          {labels.addButton}
        </Link>
      </header>

      <p className="clients-count">
        {clients.length} {registeredLabel}
      </p>

      {clients.length === 0 ? (
        <article className="private-card">
          <h2>{labels.tableTitle}</h2>
          <p>{labels.tableEmpty}</p>
        </article>
      ) : (
        <section className="clients-list" aria-label={labels.tableTitle}>
          {clients.map((client) => (
            <article key={client.publicId} className="clients-row">
              <Link href={`/clients/${client.publicId}`} className="clients-row__main-link">
                <h2>{client.fullName}</h2>
                <p className="clients-row__meta">
                  {labels.columnPhone}: {client.phoneNumber ?? "-"}
                </p>
                <p className="clients-row__meta">
                  {labels.columnEmail}: {client.email ?? "-"}
                </p>
                <p className="clients-row__meta">
                  {labels.columnUpdatedAt}: {formatUpdatedAt(client.updatedAt, locale)}
                </p>
              </Link>

              <div className="clients-row__actions">
                <Link href={`/clients/${client.publicId}/edit`} className="clients-secondary-link">
                  {labels.editButton}
                </Link>
                <button
                  type="button"
                  className="clients-danger-button"
                  onClick={() => openDeleteModal(client)}
                  disabled={deletingId === client.publicId}
                >
                  {labels.deleteButton}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {deleteCandidate ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-client-modal-title">
          <div className="modal-card clients-delete-modal">
            <h2 id="delete-client-modal-title">{labels.deleteModalTitle}</h2>
            <p>
              {labels.deleteModalDescription} <strong>{deleteCandidate.fullName}</strong>.
            </p>
            <p>{labels.deleteConfirm}</p>

            <label htmlFor="delete-verification-input">{labels.deleteTypeLabel}</label>
            <input
              id="delete-verification-input"
              type="text"
              value={deleteVerificationText}
              onChange={(event) => setDeleteVerificationText(event.target.value)}
              placeholder={labels.deleteTypePlaceholder}
              autoComplete="off"
              className="clients-delete-modal__input"
            />

            <div className="clients-delete-modal__actions">
              <button type="button" className="clients-secondary-button" onClick={closeDeleteModal}>
                {labels.cancelDeleteButton}
              </button>
              <button
                type="button"
                className="clients-danger-button"
                disabled={deleteVerificationText.trim() !== deleteKeyword || deletingId === deleteCandidate.publicId}
                onClick={async () => {
                  await handleDelete(deleteCandidate)
                  closeDeleteModal()
                }}
              >
                {labels.confirmDeleteButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
