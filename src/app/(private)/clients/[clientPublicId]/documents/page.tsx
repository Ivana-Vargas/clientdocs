import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ClientDocumentsWorkspace } from "@app/features/documents/ui/client-documents-workspace"
import { getClientByPublicIdFromDb } from "@server/features/clients/application/clients-service"
import {
  listCurrentClientDocumentsFromDb,
  listDocumentCategoriesFromDb,
} from "@server/features/documents/application/documents-service"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

type ClientDocumentsPageProps = {
  params: Promise<{
    clientPublicId: string
  }>
}

export default async function ClientDocumentsPage({ params }: ClientDocumentsPageProps) {
  const { clientPublicId } = await params
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)

  const client = await getClientByPublicIdFromDb(clientPublicId)

  if (!client) {
    redirect("/clients")
  }

  const categories = await listDocumentCategoriesFromDb()
  const documents = (await listCurrentClientDocumentsFromDb(clientPublicId)) ?? []

  return (
    <ClientDocumentsWorkspace
      clientPublicId={clientPublicId}
      categories={categories.map((category) => ({
        publicId: category.publicId,
        name: category.name,
      }))}
      initialDocuments={documents.map((document) => ({
        publicId: document.publicId,
        categoryPublicId: document.categoryPublicId,
        originalFileName: document.originalFileName,
        fileSizeBytes: document.fileSizeBytes,
        version: document.version,
        uploadedAt: document.uploadedAt,
      }))}
      locale={locale}
      labels={{
        title: dictionary.documents.workspaceTitle,
        subtitle: dictionary.documents.workspaceSubtitle,
        backButton: dictionary.documents.workspaceBackButton,
        pendingStatus: dictionary.documents.workspacePendingStatus,
        uploadedStatus: dictionary.documents.workspaceUploadedStatus,
        pendingHint: dictionary.documents.workspacePendingHint,
        uploadedAtLabel: dictionary.documents.workspaceUploadedAtLabel,
        fileLabel: dictionary.documents.workspaceFileLabel,
        versionLabel: dictionary.documents.workspaceVersionLabel,
        uploadButton: dictionary.documents.uploadButton,
        addMoreButton: dictionary.documents.workspaceUpdateButton,
        viewButton: dictionary.documents.viewButton,
        deleteButton: dictionary.documents.documentDeleteButton,
        deleteModalTitle: dictionary.documents.documentDeleteModalTitle,
        deleteModalDescription: dictionary.documents.documentDeleteModalDescription,
        deleteModalConfirmButton: dictionary.documents.documentDeleteConfirmButton,
        deleteModalCancelButton: dictionary.documents.documentDeleteCancelButton,
        deleteSuccessTitle: dictionary.documents.documentDeleteSuccessTitle,
        deleteSuccessDescription: dictionary.documents.documentDeleteSuccessDescription,
        deleteErrorTitle: dictionary.documents.documentDeleteErrorTitle,
        deleteErrorDescription: dictionary.documents.documentDeleteErrorDescription,
        uploadSuccessTitle: dictionary.documents.uploadSuccessTitle,
        uploadSuccessDescription: dictionary.documents.uploadSuccessDescription,
        uploadErrorTitle: dictionary.documents.uploadErrorTitle,
        uploadErrorDescription: dictionary.documents.uploadErrorDescription,
      }}
    />
  )
}
