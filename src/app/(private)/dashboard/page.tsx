import Link from "next/link"
import { cookies } from "next/headers"

import { prismaClient } from "@database/db-client/prisma-client"
import { getUserFromAccessToken } from "@server/features/auth/application/auth-db-service"
import { getAccessTokenCookieName } from "@server/features/auth/presentation/auth-cookies"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const token = cookieStore.get(getAccessTokenCookieName())?.value ?? ""
  const user = getUserFromAccessToken(token)
  const clientsCount = await prismaClient.client.count()
  const documentsCount = 0
  const paymentsCount = 0
  const welcomeMessage =
    user?.role === "manager" ? dictionary.dashboard.welcomeManager : dictionary.dashboard.welcomeAdmin

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
        <article className="private-card">
          <h2>{dictionary.dashboard.documentsTitle}</h2>
          <p>{dictionary.dashboard.documentsDescription}</p>
          <strong className="private-card__metric">
            {documentsCount} {dictionary.dashboard.documentsCountLabel}
          </strong>
        </article>
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
