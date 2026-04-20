import { cookies } from "next/headers"

import { ClientsList } from "@app/features/clients/ui/clients-list"
import { listClientsFromDb } from "@server/features/clients/application/clients-service"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

export default async function ClientsPage() {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const clients = await listClientsFromDb()

  return (
    <ClientsList
      locale={locale}
      initialClients={clients}
      labels={{
        title: dictionary.clients.title,
        description: dictionary.clients.description,
        addButton: dictionary.clients.addButton,
        tableTitle: dictionary.clients.tableTitle,
        tableEmpty: dictionary.clients.tableEmpty,
        columnPhone: dictionary.clients.columnPhone,
        columnEmail: dictionary.clients.columnEmail,
        columnUpdatedAt: dictionary.clients.columnUpdatedAt,
        editButton: dictionary.clients.editButton,
        deleteButton: dictionary.clients.deleteButton,
        registeredCountSingular: dictionary.clients.registeredCountSingular,
        registeredCountPlural: dictionary.clients.registeredCountPlural,
        deleteModalTitle: dictionary.clients.deleteModalTitle,
        deleteModalDescription: dictionary.clients.deleteModalDescription,
        deleteTypeLabel: dictionary.clients.deleteTypeLabel,
        deleteTypePlaceholder: dictionary.clients.deleteTypePlaceholder,
        confirmDeleteButton: dictionary.clients.confirmDeleteButton,
        cancelDeleteButton: dictionary.clients.cancelDeleteButton,
        deleteConfirm: dictionary.clients.deleteConfirm,
        deleteSuccessTitle: dictionary.clients.deleteSuccessTitle,
        deleteSuccessDescription: dictionary.clients.deleteSuccessDescription,
        deleteErrorTitle: dictionary.clients.deleteErrorTitle,
        deleteErrorDescription: dictionary.clients.deleteErrorDescription,
      }}
    />
  )
}
