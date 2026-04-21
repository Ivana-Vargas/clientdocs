"use client"

import { useMemo, useState, type FormEvent } from "react"

import { ApiClientError, apiRequest } from "@app/shared/lib/api-client"
import { useToast } from "@app/shared/ui/toast-provider"

type CategoryItem = {
  publicId: string
  name: string
}

type DashboardDocumentsCardLabels = {
  title: string
  description: string
  documentsCountLabel: string
  categoryActionsTitle: string
  categoryViewButton: string
  categoryCreateButton: string
  categoryNameLabel: string
  categoryCreateSuccessTitle: string
  categoryCreateSuccessDescription: string
  categoryCreateErrorTitle: string
  categoryCreateErrorDescription: string
  categoriesListTitle: string
  categoriesListEmpty: string
  categoryDeleteButton: string
  categoryDeleteModalTitle: string
  categoryDeleteModalDescription: string
  categoryDeleteConfirmButton: string
  categoryDeleteCancelButton: string
  categoryDeleteSuccessTitle: string
  categoryDeleteSuccessDescription: string
  categoryDeleteErrorTitle: string
  categoryDeleteErrorDescription: string
  categoryDeleteHasDocumentsTitle: string
  categoryDeleteHasDocumentsDescription: string
  closeLabel: string
  saveLabel: string
}

type DashboardDocumentsCardProps = {
  documentsCount: number
  canManageCategories: boolean
  initialCategories: CategoryItem[]
  labels: DashboardDocumentsCardLabels
}

export function DashboardDocumentsCard({
  documentsCount,
  canManageCategories,
  initialCategories,
  labels,
}: DashboardDocumentsCardProps) {
  const { showToast } = useToast()
  const [categories, setCategories] = useState(initialCategories)
  const [categoryName, setCategoryName] = useState("")
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false)
  const [isViewCategoriesModalOpen, setIsViewCategoriesModalOpen] = useState(false)
  const [editingCategories, setEditingCategories] = useState<Record<string, string>>({})
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null)

  const sortedCategories = useMemo(
    () => [...categories].sort((first, second) => first.name.localeCompare(second.name)),
    [categories],
  )

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (categoryName.trim().length < 2) {
      return
    }

    try {
      setIsCreatingCategory(true)

      const response = await apiRequest<{ category: { publicId: string; name: string } }>(
        "/api/document-categories",
        {
          method: "POST",
          body: { name: categoryName },
        },
      )

      setCategories((current) => [...current, response.category])
      setCategoryName("")
      setIsCreateCategoryModalOpen(false)

      showToast({
        title: labels.categoryCreateSuccessTitle,
        description: labels.categoryCreateSuccessDescription,
        variant: "success",
      })
    } catch {
      showToast({
        title: labels.categoryCreateErrorTitle,
        description: labels.categoryCreateErrorDescription,
        variant: "error",
      })
    } finally {
      setIsCreatingCategory(false)
    }
  }

  async function handleDeleteCategory(category: CategoryItem) {
    try {
      await apiRequest<{ deleted: boolean }>(`/api/document-categories/${category.publicId}`, {
        method: "DELETE",
      })

      setCategories((current) => current.filter((item) => item.publicId !== category.publicId))

      showToast({
        title: labels.categoryDeleteSuccessTitle,
        description: labels.categoryDeleteSuccessDescription,
        variant: "success",
      })
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "category_has_documents") {
        showToast({
          title: labels.categoryDeleteHasDocumentsTitle,
          description: labels.categoryDeleteHasDocumentsDescription,
          variant: "error",
        })
      } else {
        showToast({
          title: labels.categoryDeleteErrorTitle,
          description: labels.categoryDeleteErrorDescription,
          variant: "error",
        })
      }
    }
  }

  async function handleUpdateCategory(category: CategoryItem) {
    const nextName = editingCategories[category.publicId]?.trim() ?? ""

    if (nextName.length < 2 || nextName === category.name) {
      return
    }

    try {
      const response = await apiRequest<{ category: { publicId: string; name: string } }>(
        `/api/document-categories/${category.publicId}`,
        {
          method: "PATCH",
          body: { name: nextName },
        },
      )

      setCategories((current) =>
        current.map((item) =>
          item.publicId === category.publicId ? { ...item, name: response.category.name } : item,
        ),
      )
    } catch {
      showToast({
        title: labels.categoryCreateErrorTitle,
        description: labels.categoryCreateErrorDescription,
        variant: "error",
      })
    }
  }

  return (
    <article className="private-card private-card--documents">
      <h2>{labels.title}</h2>
      <p>{labels.description}</p>
      <strong className="private-card__metric">
        {documentsCount} {labels.documentsCountLabel}
      </strong>

      <div className="documents-dashboard-card__summary-wrap">
        <h3>{labels.categoriesListTitle}</h3>
        {sortedCategories.length === 0 ? (
          <p className="documents-panel__hint">{labels.categoriesListEmpty}</p>
        ) : (
          <ul className="documents-panel__summary-list">
            {sortedCategories.map((category) => (
              <li key={category.publicId}>
                <strong>{category.name}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManageCategories ? (
        <div className="documents-panel__category-actions documents-dashboard-card__actions">
          <h3>{labels.categoryActionsTitle}</h3>
          <div className="documents-panel__inline-actions documents-panel__inline-actions--equal">
            <button
              type="button"
              className="clients-secondary-button"
              onClick={() => {
                setIsViewCategoriesModalOpen(true)
                setEditingCategories(
                  Object.fromEntries(sortedCategories.map((category) => [category.publicId, category.name])),
                )
              }}
            >
              {labels.categoryViewButton}
            </button>
            <button
              type="button"
              className="clients-primary-button"
              onClick={() => setIsCreateCategoryModalOpen(true)}
            >
              {labels.categoryCreateButton}
            </button>
          </div>
        </div>
      ) : null}

      {canManageCategories && isCreateCategoryModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-category-create-title">
          <div className="modal-card clients-delete-modal">
            <h2 id="dashboard-category-create-title">{labels.categoryCreateButton}</h2>

            <form onSubmit={handleCreateCategory} className="documents-panel__modal-form">
              <label htmlFor="dashboard-document-category-name">{labels.categoryNameLabel}</label>
              <input
                id="dashboard-document-category-name"
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                maxLength={80}
                autoFocus
              />

              <div className="clients-delete-modal__actions documents-panel__create-actions">
                <button type="submit" className="clients-primary-button" disabled={isCreatingCategory}>
                  {labels.categoryCreateButton}
                </button>
                <button
                  type="button"
                  className="clients-secondary-button"
                  onClick={() => setIsCreateCategoryModalOpen(false)}
                >
                  {labels.categoryDeleteCancelButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageCategories && isViewCategoriesModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-categories-view-title">
          <div className="modal-card documents-categories-modal">
            <h2 id="dashboard-categories-view-title">{labels.categoriesListTitle}</h2>

            {sortedCategories.length === 0 ? (
              <p className="documents-panel__hint">{labels.categoriesListEmpty}</p>
            ) : (
              <ul className="documents-panel__category-list">
                {sortedCategories.map((category) => (
                  <li key={category.publicId}>
                    <input
                      type="text"
                      value={editingCategories[category.publicId] ?? category.name}
                      onChange={(event) =>
                        setEditingCategories((current) => ({
                          ...current,
                          [category.publicId]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="clients-secondary-button documents-panel__category-save"
                      onClick={() => void handleUpdateCategory(category)}
                    >
                      <span className="documents-panel__btn-text">{labels.saveLabel}</span>
                      <span className="documents-panel__btn-icon" aria-hidden="true">
                        ✓
                      </span>
                    </button>
                    <button
                      type="button"
                      className="clients-danger-button documents-panel__category-delete"
                      onClick={() => setCategoryToDelete(category)}
                    >
                      <span className="documents-panel__btn-text">{labels.categoryDeleteButton}</span>
                      <span className="documents-panel__btn-icon" aria-hidden="true">
                        🗑
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="documents-preview-modal__actions">
              <button
                type="button"
                className="clients-primary-button"
                onClick={() => setIsViewCategoriesModalOpen(false)}
              >
                {labels.closeLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {categoryToDelete ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-category-delete-title">
          <div className="modal-card clients-delete-modal">
            <h2 id="dashboard-category-delete-title">{labels.categoryDeleteModalTitle}</h2>
            <p>
              {labels.categoryDeleteModalDescription} <strong>{categoryToDelete.name}</strong>.
            </p>

            <div className="clients-delete-modal__actions">
              <button
                type="button"
                className="clients-secondary-button"
                onClick={() => setCategoryToDelete(null)}
              >
                {labels.categoryDeleteCancelButton}
              </button>
              <button
                type="button"
                className="clients-danger-button"
                onClick={async () => {
                  await handleDeleteCategory(categoryToDelete)
                  setCategoryToDelete(null)
                }}
              >
                {labels.categoryDeleteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
