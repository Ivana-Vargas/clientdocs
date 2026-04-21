import crypto from "node:crypto"

import type { Prisma } from "@prisma/client"
import { prismaClient } from "@database/db-client/prisma-client"
import { deleteStoredPdf, savePdfToConfiguredStorage } from "@server/shared/storage/document-storage"

type DocumentCategoryRecord = {
  id: string
  publicId: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ClientDocumentRecord = {
  id: string
  publicId: string
  clientPublicId: string
  categoryPublicId: string
  categoryName: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  checksumSha256: string
  storageProvider: "LOCAL" | "S3"
  version: number
  isCurrent: boolean
  uploadedAt: string
}

type UploadClientDocumentInput = {
  clientPublicId: string
  categoryPublicId: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  contentBuffer: Buffer
  uploadedByUserId: string
}

type UploadClientDocumentResult =
  | {
      status: "uploaded"
      document: ClientDocumentRecord
    }
  | {
      status: "client_not_found"
    }
  | {
      status: "category_not_found"
    }

type DeleteDocumentCategoryResult =
  | {
      status: "deleted"
    }
  | {
      status: "category_not_found"
    }
  | {
      status: "category_has_documents"
    }

type UpdateDocumentCategoryResult =
  | {
      status: "updated"
      category: DocumentCategoryRecord
    }
  | {
      status: "category_not_found"
    }

type DeleteClientDocumentResult =
  | {
      status: "deleted"
    }
  | {
      status: "document_not_found"
    }

function toCategoryRecord(category: {
  id: string
  publicId: string
  name: string
  slug: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): DocumentCategoryRecord {
  return {
    id: category.id,
    publicId: category.publicId,
    name: category.name,
    slug: category.slug,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

function toClientDocumentRecord(document: {
  id: string
  publicId: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  checksumSha256: string
  storageProvider: "LOCAL" | "S3"
  version: number
  isCurrent: boolean
  uploadedAt: Date
  client: {
    publicId: string
  }
  category: {
    publicId: string
    name: string
  }
}): ClientDocumentRecord {
  return {
    id: document.id,
    publicId: document.publicId,
    clientPublicId: document.client.publicId,
    categoryPublicId: document.category.publicId,
    categoryName: document.category.name,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSizeBytes: document.fileSizeBytes,
    checksumSha256: document.checksumSha256,
    storageProvider: document.storageProvider,
    version: document.version,
    isCurrent: document.isCurrent,
    uploadedAt: document.uploadedAt.toISOString(),
  }
}

function slugifyCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

async function resolveUniqueCategorySlug(baseName: string, ignoreCategoryId?: string) {
  const baseSlug = slugifyCategoryName(baseName) || "category"
  let candidate = baseSlug
  let suffix = 1

  for (;;) {
    const existing = await prismaClient.documentCategory.findUnique({ where: { slug: candidate } })

    if (!existing || existing.id === ignoreCategoryId) {
      return candidate
    }

    suffix += 1
    candidate = `${baseSlug}-${suffix}`
  }
}

export async function listDocumentCategoriesFromDb() {
  const categories = await prismaClient.documentCategory.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
  })

  return categories.map(toCategoryRecord)
}

export async function createDocumentCategoryInDb(input: { name: string; createdByUserId: string }) {
  const normalizedName = input.name.trim()
  const slug = await resolveUniqueCategorySlug(normalizedName)

  const category = await prismaClient.documentCategory.create({
    data: {
      name: normalizedName,
      slug,
      isActive: true,
      createdByUserId: input.createdByUserId,
    },
  })

  return toCategoryRecord(category)
}

export async function deleteDocumentCategoryByPublicIdFromDb(categoryPublicId: string): Promise<DeleteDocumentCategoryResult> {
  const category = await prismaClient.documentCategory.findUnique({
    where: { publicId: categoryPublicId },
    select: { id: true },
  })

  if (!category) {
    return { status: "category_not_found" }
  }

  const relatedDocumentsCount = await prismaClient.clientDocument.count({
    where: { categoryId: category.id },
  })

  if (relatedDocumentsCount > 0) {
    return { status: "category_has_documents" }
  }

  await prismaClient.documentCategory.delete({
    where: { id: category.id },
  })

  return { status: "deleted" }
}

export async function updateDocumentCategoryByPublicIdFromDb(input: {
  categoryPublicId: string
  name: string
}): Promise<UpdateDocumentCategoryResult> {
  const category = await prismaClient.documentCategory.findUnique({
    where: { publicId: input.categoryPublicId },
    select: { id: true },
  })

  if (!category) {
    return { status: "category_not_found" }
  }

  const normalizedName = input.name.trim()
  const slug = await resolveUniqueCategorySlug(normalizedName, category.id)

  const updatedCategory = await prismaClient.documentCategory.update({
    where: { id: category.id },
    data: {
      name: normalizedName,
      slug,
    },
  })

  return {
    status: "updated",
    category: toCategoryRecord(updatedCategory),
  }
}

export async function listCurrentClientDocumentsFromDb(clientPublicId: string) {
  const client = await prismaClient.client.findUnique({
    where: { publicId: clientPublicId },
    select: { id: true },
  })

  if (!client) {
    return null
  }

  const documents = await prismaClient.clientDocument.findMany({
    where: {
      clientId: client.id,
      isCurrent: true,
      category: { isActive: true },
    },
    include: {
      client: { select: { publicId: true } },
      category: { select: { publicId: true, name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { version: "desc" }],
  })

  return documents.map(toClientDocumentRecord)
}

export async function uploadClientDocumentFromDb(input: UploadClientDocumentInput): Promise<UploadClientDocumentResult> {
  const client = await prismaClient.client.findUnique({
    where: { publicId: input.clientPublicId },
    select: { id: true, publicId: true },
  })

  if (!client) {
    return { status: "client_not_found" }
  }

  const category = await prismaClient.documentCategory.findUnique({
    where: { publicId: input.categoryPublicId },
    select: { id: true, publicId: true, name: true, slug: true, isActive: true },
  })

  if (!category || !category.isActive) {
    return { status: "category_not_found" }
  }

  const storedFile = await savePdfToConfiguredStorage({
    clientPublicId: client.publicId,
    categorySlug: category.slug,
    originalFileName: input.originalFileName,
    buffer: input.contentBuffer,
  })

  const checksumSha256 = crypto.createHash("sha256").update(input.contentBuffer).digest("hex")

  const document = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.clientDocument.findFirst({
      where: {
        clientId: client.id,
        categoryId: category.id,
      },
      orderBy: [{ version: "desc" }],
      select: { version: true },
    })

    const nextVersion = (current?.version ?? 0) + 1

    return tx.clientDocument.create({
      data: {
        clientId: client.id,
        categoryId: category.id,
        originalFileName: input.originalFileName,
        storageProvider: storedFile.storageProvider,
        storageKey: storedFile.storageKey,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        checksumSha256,
        version: nextVersion,
        isCurrent: true,
        uploadedByUserId: input.uploadedByUserId,
      },
      include: {
        client: { select: { publicId: true } },
        category: { select: { publicId: true, name: true } },
      },
    })
  })

  return {
    status: "uploaded",
    document: toClientDocumentRecord(document),
  }
}

export async function getCurrentClientDocumentByPublicIdFromDb(clientPublicId: string, documentPublicId: string) {
  const document = await prismaClient.clientDocument.findFirst({
    where: {
      publicId: documentPublicId,
      isCurrent: true,
      client: { publicId: clientPublicId },
    },
    include: {
      client: { select: { publicId: true } },
      category: { select: { publicId: true, name: true } },
    },
  })

  if (!document) {
    return null
  }

  return toClientDocumentRecord(document)
}

export async function getCurrentClientDocumentFileAccessFromDb(clientPublicId: string, documentPublicId: string) {
  const document = await prismaClient.clientDocument.findFirst({
    where: {
      publicId: documentPublicId,
      isCurrent: true,
      client: { publicId: clientPublicId },
    },
    select: {
      originalFileName: true,
      mimeType: true,
      storageProvider: true,
      storageKey: true,
    },
  })

  if (!document) {
    return null
  }

  return document
}

export async function deleteCurrentClientDocumentByPublicIdFromDb(input: {
  clientPublicId: string
  documentPublicId: string
}): Promise<DeleteClientDocumentResult> {
  const document = await prismaClient.clientDocument.findFirst({
    where: {
      publicId: input.documentPublicId,
      isCurrent: true,
      client: { publicId: input.clientPublicId },
    },
    select: {
      id: true,
      storageProvider: true,
      storageKey: true,
    },
  })

  if (!document) {
    return { status: "document_not_found" }
  }

  await prismaClient.clientDocument.delete({
    where: { id: document.id },
  })

  await deleteStoredPdf(document.storageProvider, document.storageKey)

  return { status: "deleted" }
}
