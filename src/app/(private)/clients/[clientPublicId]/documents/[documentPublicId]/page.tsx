import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ClientDocumentViewer } from "@app/features/documents/ui/client-document-viewer"
import { getClientByPublicIdFromDb } from "@server/features/clients/application/clients-service"
import { getCurrentClientDocumentByPublicIdFromDb } from "@server/features/documents/application/documents-service"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"
import { getDictionary } from "@shared/localization/dictionary"

type ClientDocumentViewerPageProps = {
  params: Promise<{
    clientPublicId: string
    documentPublicId: string
  }>
}

export default async function ClientDocumentViewerPage({ params }: ClientDocumentViewerPageProps) {
  const { clientPublicId, documentPublicId } = await params
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)

  const [client, document] = await Promise.all([
    getClientByPublicIdFromDb(clientPublicId),
    getCurrentClientDocumentByPublicIdFromDb(clientPublicId, documentPublicId),
  ])

  if (!client) {
    redirect("/clients")
  }

  if (!document) {
    redirect(`/clients/${clientPublicId}/documents`)
  }

  return (
    <ClientDocumentViewer
      clientPublicId={clientPublicId}
      documentPublicId={documentPublicId}
      documentName={document.originalFileName}
      categoryName={document.categoryName}
      uploadedAt={document.uploadedAt}
      locale={locale}
      labels={{
        title: dictionary.documents.detailsTitle,
        subtitle: client.fullName,
        backButton: dictionary.documents.viewerBackButton,
        categoryLabel: dictionary.documents.categoryColumn,
        uploadedAtLabel: dictionary.documents.updatedColumn,
        previousPageButton: dictionary.documents.viewerPreviousPageButton,
        nextPageButton: dictionary.documents.viewerNextPageButton,
        fitWidthButton: dictionary.documents.viewerFitWidthButton,
        pageInputLabel: dictionary.documents.viewerPageInputLabel,
        loadingLabel: dictionary.documents.viewerLoadingLabel,
        loadErrorLabel: dictionary.documents.viewerLoadErrorLabel,
      }}
    />
  )
}
