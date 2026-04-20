import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getClientByPublicIdFromDb } from "@server/features/clients/application/clients-service"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

type ClientDetailPageProps = {
  params: Promise<{
    clientPublicId: string
  }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { clientPublicId } = await params
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const client = await getClientByPublicIdFromDb(clientPublicId)

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

        <article className="clients-detail-card">
          <h2>{dictionary.clients.documentsViewTitle}</h2>
          <p className="clients-detail-card__count">0 {dictionary.clients.documentsCountLabel}</p>
          <p>{dictionary.clients.documentsViewDescription}</p>
        </article>

        <article className="clients-detail-card">
          <h2>{dictionary.clients.paymentsViewTitle}</h2>
          <p className="clients-detail-card__count">0 {dictionary.clients.paymentsCountLabel}</p>
          <p>{dictionary.clients.paymentsViewDescription}</p>
        </article>
      </section>
    </main>
  )
}
