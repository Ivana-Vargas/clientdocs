import Link from "next/link"
import { cookies } from "next/headers"

import { DashboardDocumentsCard } from "@app/features/documents/ui/dashboard-documents-card"
import { prismaClient } from "@database/db-client/prisma-client"
import { getUserFromAccessToken, getUserRoleByIdFromDb } from "@server/features/auth/application/auth-db-service"
import { getAccessTokenCookieName } from "@server/features/auth/presentation/auth-cookies"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const token = cookieStore.get(getAccessTokenCookieName())?.value ?? ""
  const tokenUser = getUserFromAccessToken(token)
  const userRole = tokenUser ? await getUserRoleByIdFromDb(tokenUser.id) : null
  const clientsCount = await prismaClient.client.count()
  const documentsCount = await prismaClient.clientDocument.count({ where: { isCurrent: true } })
  const paymentsCount = await prismaClient.payment.count()
  const categories = await prismaClient.documentCategory.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    select: {
      publicId: true,
      name: true,
    },
  })
  const typedCategories = categories as Array<{ publicId: string; name: string }>
  const welcomeMessage =
    userRole === "manager" ? dictionary.dashboard.welcomeManager : dictionary.dashboard.welcomeAdmin

  return (
    <main className="private-page">
      <header className="private-page__header">
        <h1>{dictionary.dashboard.title}</h1>
        <p>{welcomeMessage}</p>
      </header>

      <section className="private-card-grid">
        <article className="private-card private-card--interactive">
          <h2>{dictionary.dashboard.clientsTitle}</h2>
          <p>{dictionary.dashboard.clientsDescription}</p>
          <strong className="private-card__metric">
            {clientsCount} {dictionary.dashboard.clientsCountLabel}
          </strong>
          <Link href="/clients" className="private-card__button">
            {dictionary.dashboard.clientsCta}
          </Link>
        </article>
        <DashboardDocumentsCard
          documentsCount={documentsCount}
          canManageCategories={userRole === "admin"}
          initialCategories={typedCategories.map((category) => ({
            publicId: category.publicId,
            name: category.name,
          }))}
          labels={{
            title: dictionary.dashboard.documentsTitle,
            description: dictionary.dashboard.documentsDescription,
            documentsCountLabel: dictionary.dashboard.documentsCountLabel,
            categoryActionsTitle: dictionary.documents.categoryActionsTitle,
            categoryViewButton: dictionary.documents.categoryViewButton,
            categoryCreateButton: dictionary.documents.categoryCreateButton,
            categoryNameLabel: dictionary.documents.categoryNameLabel,
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
            closeLabel: dictionary.common.close,
            saveLabel: dictionary.common.save,
          }}
        />
        <article className="private-card">
          <h2>{dictionary.dashboard.paymentsTitle}</h2>
          <p>{dictionary.dashboard.paymentsDescription}</p>
          <strong className="private-card__metric">
            {paymentsCount} {dictionary.dashboard.paymentsCountLabel}
          </strong>
        </article>
      </section>
    </main>
  )
}
