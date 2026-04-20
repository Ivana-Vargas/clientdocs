import { cookies } from "next/headers"

import { ClientEditorForm } from "@app/features/clients/ui/client-editor-form"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

export default async function NewClientPage() {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)

  return (
    <ClientEditorForm
      mode="create"
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
