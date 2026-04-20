import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ClientEditorForm } from "@app/features/clients/ui/client-editor-form"
import { getClientByPublicIdFromDb } from "@server/features/clients/application/clients-service"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

type EditClientPageProps = {
  params: Promise<{
    clientPublicId: string
  }>
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { clientPublicId } = await params
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)

  const client = await getClientByPublicIdFromDb(clientPublicId)

  if (!client) {
    redirect("/clients")
  }

  return (
    <ClientEditorForm
      mode="edit"
      clientPublicId={client.publicId}
      initialValues={{
        fullName: client.fullName,
        nationalId: client.nationalId ?? "",
        phoneNumber: client.phoneNumber ?? "",
        email: client.email ?? "",
        addressLine: client.addressLine ?? "",
        notes: client.notes ?? "",
      }}
      labels={{
        createTitle: dictionary.clients.createTitle,
        editTitle: dictionary.clients.editTitle,
        createDescription: dictionary.clients.createDescription,
        editDescription: dictionary.clients.editDescription,
        fullNameLabel: dictionary.clients.fullNameLabel,
        nationalIdLabel: dictionary.clients.nationalIdLabel,
        phoneLabel: dictionary.clients.phoneLabel,
        emailLabel: dictionary.clients.emailLabel,
        addressLabel: dictionary.clients.addressLabel,
        notesLabel: dictionary.clients.notesLabel,
        createButton: dictionary.clients.createButton,
        saveButton: dictionary.clients.saveButton,
        cancelEditButton: dictionary.clients.cancelEditButton,
        loading: dictionary.clients.loading,
        validationTitle: dictionary.clients.validationTitle,
        validationFullName: dictionary.clients.validationFullName,
        createSuccessTitle: dictionary.clients.createSuccessTitle,
        createSuccessDescription: dictionary.clients.createSuccessDescription,
        updateSuccessTitle: dictionary.clients.updateSuccessTitle,
        updateSuccessDescription: dictionary.clients.updateSuccessDescription,
        saveErrorTitle: dictionary.clients.saveErrorTitle,
        saveErrorDescription: dictionary.clients.saveErrorDescription,
      }}
    />
  )
}
