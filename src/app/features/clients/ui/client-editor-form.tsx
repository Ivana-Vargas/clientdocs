"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { ApiClientError, apiRequest } from "@app/shared/lib/api-client"
import { useToast } from "@app/shared/ui/toast-provider"

type ClientFormLabels = {
  createTitle: string
  editTitle: string
  createDescription: string
  editDescription: string
  fullNameLabel: string
  nationalIdLabel: string
  phoneLabel: string
  emailLabel: string
  addressLabel: string
  notesLabel: string
  createButton: string
  saveButton: string
  cancelEditButton: string
  loading: string
  validationTitle: string
  validationFullName: string
  createSuccessTitle: string
  createSuccessDescription: string
  updateSuccessTitle: string
  updateSuccessDescription: string
  saveErrorTitle: string
  saveErrorDescription: string
}

type ClientEditorFormProps = {
  mode: "create" | "edit"
  labels: ClientFormLabels
  clientPublicId?: string
  initialValues?: {
    fullName: string
    nationalId: string
    phoneNumber: string
    email: string
    addressLine: string
    notes: string
  }
}

export function ClientEditorForm({
  mode,
  labels,
  clientPublicId,
  initialValues,
}: ClientEditorFormProps) {
  const router = useRouter()
  const { showToast } = useToast()

  const [fullName, setFullName] = useState(initialValues?.fullName ?? "")
  const [nationalId, setNationalId] = useState(initialValues?.nationalId ?? "")
  const [phoneNumber, setPhoneNumber] = useState(initialValues?.phoneNumber ?? "")
  const [email, setEmail] = useState(initialValues?.email ?? "")
  const [addressLine, setAddressLine] = useState(initialValues?.addressLine ?? "")
  const [notes, setNotes] = useState(initialValues?.notes ?? "")
  const [fullNameError, setFullNameError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isCreateMode = mode === "create"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (fullName.trim().length === 0) {
      setFullNameError(true)
      showToast({
        title: labels.validationTitle,
        description: labels.validationFullName,
        variant: "error",
      })
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        fullName,
        nationalId,
        phoneNumber,
        email,
        addressLine,
        notes,
      }

      if (isCreateMode) {
        await apiRequest("/api/clients", {
          method: "POST",
          body: payload,
        })

        showToast({
          title: labels.createSuccessTitle,
          description: labels.createSuccessDescription,
          variant: "success",
        })
      } else {
        await apiRequest(`/api/clients/${clientPublicId}`, {
          method: "PATCH",
          body: payload,
        })

        showToast({
          title: labels.updateSuccessTitle,
          description: labels.updateSuccessDescription,
          variant: "success",
        })
      }

      router.push("/clients")
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.details?.some((detail) => detail.field === "fullName")) {
        setFullNameError(true)
      }

      showToast({
        title: labels.saveErrorTitle,
        description: labels.saveErrorDescription,
        variant: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="private-page clients-editor-page">
      <section className="clients-editor-modal" role="dialog" aria-modal="true">
        <header className="clients-editor-modal__header">
          <h1>{isCreateMode ? labels.createTitle : labels.editTitle}</h1>
          <p>{isCreateMode ? labels.createDescription : labels.editDescription}</p>
        </header>

        <form className="clients-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="fullName">{labels.fullNameLabel}</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value)
              if (fullNameError) {
                setFullNameError(false)
              }
            }}
            className={fullNameError ? "input--error" : undefined}
            aria-invalid={fullNameError ? "true" : "false"}
            maxLength={120}
          />

          <label htmlFor="nationalId">{labels.nationalIdLabel}</label>
          <input
            id="nationalId"
            type="text"
            value={nationalId}
            onChange={(event) => setNationalId(event.target.value)}
            maxLength={40}
          />

          <label htmlFor="phoneNumber">{labels.phoneLabel}</label>
          <input
            id="phoneNumber"
            type="text"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            maxLength={40}
          />

          <label htmlFor="email">{labels.emailLabel}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={180}
          />

          <label htmlFor="addressLine">{labels.addressLabel}</label>
          <input
            id="addressLine"
            type="text"
            value={addressLine}
            onChange={(event) => setAddressLine(event.target.value)}
            maxLength={240}
          />

          <label htmlFor="notes">{labels.notesLabel}</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1600}
            rows={5}
          />

          <div className="clients-form__actions">
            <button type="submit" className="clients-primary-button" disabled={isSaving}>
              {isSaving ? labels.loading : isCreateMode ? labels.createButton : labels.saveButton}
            </button>
            <button
              type="button"
              className="clients-secondary-button"
              onClick={() => router.push("/clients")}
            >
              {labels.cancelEditButton}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
