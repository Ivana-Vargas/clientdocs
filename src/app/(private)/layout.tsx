import type { ReactNode } from "react"

import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

import { LanguageSwitcher } from "@app/shared/ui/language-switcher"
import { LogoutButton } from "@app/shared/ui/logout-button"
import { getUserFromAccessToken } from "@server/features/auth/application/auth-db-service"
import { getAccessTokenCookieName } from "@server/features/auth/presentation/auth-cookies"
import { getDictionary } from "@shared/localization/dictionary"
import { LOCALE_COOKIE_NAME, resolveLocale } from "@shared/localization/config"

type PrivateLayoutProps = {
  children: ReactNode
}

export default async function PrivateLayout({ children }: PrivateLayoutProps) {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  const dictionary = getDictionary(locale)
  const accessToken = cookieStore.get(getAccessTokenCookieName())?.value

  if (!accessToken) {
    redirect("/login")
  }

  const user = getUserFromAccessToken(accessToken)

  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <header className="session-bar">
        <Link href="/dashboard" className="session-bar__brand">
          {dictionary.common.brand}
        </Link>
        <div className="session-bar__actions">
          <LanguageSwitcher
            locale={locale}
            label={dictionary.common.language}
            englishLabel={dictionary.common.english}
            spanishLabel={dictionary.common.spanish}
            updatedMessage={dictionary.common.languageUpdated}
            errorMessage={dictionary.common.languageError}
          />
          <LogoutButton
            label={dictionary.session.logout}
            successMessage={dictionary.session.logoutSuccess}
            errorMessage={dictionary.session.logoutError}
          />
        </div>
      </header>
      {children}
    </>
  )
}
