import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ClientDocumentsPanel } from "@app/features/documents/ui/client-documents-panel"
import { ClientPaymentsPanel } from "@app/features/payments/ui/client-payments-panel"
import { getUserFromAccessToken, getUserRoleByIdFromDb } from "@server/features/auth/application/auth-db-service"
import { getAccessTokenCookieName } from "@server/features/auth/presentation/auth-cookies"
import { getClientByPublicIdFromDb } from "@server/features/clients/application/clients-service"
import {
  listCurrentClientDocumentsFromDb,
  listDocumentCategoriesFromDb,
} from "@server/features/documents/application/documents-service"
import { listPaymentsByClientPublicIdFromDb } from "@server/features/payments/application/payments-service"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

type ClientDetailPageProps = {
  params: Promise<{
    clientPublicId: string
  }>
}

function formatAmountInCents(amountInCents: number, locale: "es" | "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BOB",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(amountInCents / 100)
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { clientPublicId } = await params
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const accessToken = cookieStore.get(getAccessTokenCookieName())?.value ?? ""
  const tokenUser = getUserFromAccessToken(accessToken)
  const userRole = tokenUser ? await getUserRoleByIdFromDb(tokenUser.id) : null
  const client = await getClientByPublicIdFromDb(clientPublicId)
  const categories = await listDocumentCategoriesFromDb()
  const documents = (await listCurrentClientDocumentsFromDb(clientPublicId)) ?? []
  const documentCountByCategory = documents.reduce<Record<string, number>>((accumulator, document) => {
    accumulator[document.categoryPublicId] = (accumulator[document.categoryPublicId] ?? 0) + 1
    return accumulator
  }, {})
  const paymentsResult = await listPaymentsByClientPublicIdFromDb(clientPublicId)
  const payments = paymentsResult?.payments ?? []
  const totalPaidInCents = paymentsResult?.totalPaidInCents ?? 0
  const outstandingInCents = Math.max((client?.totalDebtInCents ?? 0) - totalPaidInCents, 0)

  if (!client) {
    redirect("/clients")
  }

  return (
    <main className="private-page clients-detail-page">
      <header className="private-page__header clients-detail-page__header">
        <div>
          <h1>{client.fullName}</h1>
          <p>{dictionary.clients.detailDescription}</p>
        </div>
        <div className="clients-detail-page__actions">
          <Link href="/clients" className="clients-primary-link clients-detail-page__back-button">
            {dictionary.clients.backToList}
          </Link>
        </div>
      </header>

      <section className="clients-detail-grid">
        <article className="clients-detail-card">
          <h2>{dictionary.clients.profileTitle}</h2>
          <dl className="clients-detail-fields">
            <div>
              <dt>{dictionary.clients.fullNameLabel}</dt>
              <dd>{client.fullName}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.totalDebtLabel}</dt>
              <dd>{formatAmountInCents(client.totalDebtInCents, locale)}</dd>
            </div>
            <div>
              <dt>{dictionary.payments.totalPaidLabel}</dt>
              <dd>{formatAmountInCents(totalPaidInCents, locale)}</dd>
            </div>
            <div>
              <dt>{dictionary.payments.outstandingLabel}</dt>
              <dd>{formatAmountInCents(outstandingInCents, locale)}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.nationalIdLabel}</dt>
              <dd>{client.nationalId ?? "-"}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.phoneLabel}</dt>
              <dd>{client.phoneNumber ?? "-"}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.emailLabel}</dt>
              <dd>{client.email ?? "-"}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.addressLabel}</dt>
              <dd>{client.addressLine ?? "-"}</dd>
            </div>
            <div>
              <dt>{dictionary.clients.notesLabel}</dt>
              <dd>{client.notes ?? "-"}</dd>
            </div>
          </dl>
        </article>

        <ClientDocumentsPanel
          documentsPageHref={`/clients/${client.publicId}/documents`}
          canManageCategories={userRole === "admin"}
          initialCategories={categories}
          initialCategorySummaries={categories.map((category) => ({
            categoryPublicId: category.publicId,
            documentsCount: documentCountByCategory[category.publicId] ?? 0,
          }))}
          documentsCount={documents.length}
          labels={{
            title: dictionary.clients.documentsViewTitle,
            countLabelSingular: dictionary.clients.documentsCountSingular,
            countLabelPlural: dictionary.clients.documentsCountPlural,
            description: dictionary.clients.documentsViewDescription,
            categoryActionsTitle: dictionary.documents.categoryActionsTitle,
            categoryViewButton: dictionary.documents.categoryViewButton,
            categoryNameLabel: dictionary.documents.categoryNameLabel,
            categoryCreateButton: dictionary.documents.categoryCreateButton,
            categoryCreateSuccessTitle: dictionary.documents.categoryCreateSuccessTitle,
            categoryCreateSuccessDescription: dictionary.documents.categoryCreateSuccessDescription,
            categoryCreateErrorTitle: dictionary.documents.categoryCreateErrorTitle,
            categoryCreateErrorDescription: dictionary.documents.categoryCreateErrorDescription,
            categoriesListTitle: dictionary.documents.categoriesListTitle,
            categoriesListEmpty: dictionary.documents.categoriesListEmpty,
            categoryDeleteButton: dictionary.documents.categoryDeleteButton,
            categoryDeleteModalTitle: dictionary.documents.categoryDeleteModalTitle,
            categoryDeleteModalDescription: dictionary.documents.categoryDeleteModalDescription,
            categoryDeleteConfirmButton: dictionary.documents.categoryDeleteConfirmButton,
            categoryDeleteCancelButton: dictionary.documents.categoryDeleteCancelButton,
            categoryDeleteSuccessTitle: dictionary.documents.categoryDeleteSuccessTitle,
            categoryDeleteSuccessDescription: dictionary.documents.categoryDeleteSuccessDescription,
            categoryDeleteErrorTitle: dictionary.documents.categoryDeleteErrorTitle,
            categoryDeleteErrorDescription: dictionary.documents.categoryDeleteErrorDescription,
            categoryDeleteHasDocumentsTitle: dictionary.documents.categoryDeleteHasDocumentsTitle,
            categoryDeleteHasDocumentsDescription: dictionary.documents.categoryDeleteHasDocumentsDescription,
            categoriesStatusTitle: dictionary.documents.categoriesStatusTitle,
            categoryPendingLabel: dictionary.documents.categoryPendingLabel,
            categoryUploadedSingularLabel: dictionary.documents.categoryUploadedSingularLabel,
            categoryUploadedPluralLabel: dictionary.documents.categoryUploadedPluralLabel,
            emptyList: dictionary.documents.emptyList,
            viewDocumentsButton: dictionary.documents.viewDocumentsButton,
            closeLabel: dictionary.common.close,
            saveLabel: dictionary.common.save,
          }}
        />
        <ClientPaymentsPanel
          locale={locale}
          clientPublicId={client.publicId}
          payments={payments}
          totalPaidInCents={totalPaidInCents}
          labels={{
            title: dictionary.clients.paymentsViewTitle,
            paymentsCountLabel: dictionary.clients.paymentsCountLabel,
            totalPaidLabel: dictionary.payments.totalPaidLabel,
            description: dictionary.clients.paymentsViewDescription,
            registerPaymentButton: dictionary.payments.registerPaymentButton,
            emptyList: dictionary.payments.emptyList,
            methodCash: dictionary.payments.methodCash,
            methodBankTransfer: dictionary.payments.methodBankTransfer,
            methodCard: dictionary.payments.methodCard,
            methodOther: dictionary.payments.methodOther,
            detailsTitle: dictionary.payments.detailsTitle,
            detailsAmountLabel: dictionary.payments.detailsAmountLabel,
            detailsDateLabel: dictionary.payments.detailsDateLabel,
            detailsMethodLabel: dictionary.payments.detailsMethodLabel,
            detailsReferenceLabel: dictionary.payments.detailsReferenceLabel,
            detailsReferenceEmpty: dictionary.payments.detailsReferenceEmpty,
            closeLabel: dictionary.common.close,
          }}
        />
      </section>
    </main>
  )
}
