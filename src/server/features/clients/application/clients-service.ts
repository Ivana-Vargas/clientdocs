import { prismaClient } from "@database/db-client/prisma-client"

import type { ClientStatus } from "../domain/client-status"

type ClientRecord = {
  id: string
  publicId: string
  fullName: string
  nationalId: string | null
  phoneNumber: string | null
  email: string | null
  addressLine: string | null
  notes: string | null
  status: ClientStatus
  createdAt: string
  updatedAt: string
}

export type CreateClientInput = {
  fullName: string
  nationalId?: string
  phoneNumber?: string
  email?: string
  addressLine?: string
  notes?: string
}

export type UpdateClientInput = {
  fullName?: string
  nationalId?: string
  phoneNumber?: string
  email?: string
  addressLine?: string
  notes?: string
}

function normalizeRequiredText(value: string) {
  return value.trim()
}

function normalizeOptionalText(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function toClientRecord(client: {
  id: string
  publicId: string
  fullName: string
  nationalId: string | null
  phoneNumber: string | null
  email: string | null
  addressLine: string | null
  notes: string | null
  status: ClientStatus
  createdAt: Date
  updatedAt: Date
}): ClientRecord {
  return {
    id: client.id,
    publicId: client.publicId,
    fullName: client.fullName,
    nationalId: client.nationalId,
    phoneNumber: client.phoneNumber,
    email: client.email,
    addressLine: client.addressLine,
    notes: client.notes,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }
}

export async function listClientsFromDb(status?: ClientStatus) {
  const clients = await prismaClient.client.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })

  return clients.map(toClientRecord)
}

export async function createClientInDb(input: CreateClientInput, createdByUserId: string) {
  const client = await prismaClient.client.create({
    data: {
      fullName: normalizeRequiredText(input.fullName),
      nationalId: normalizeOptionalText(input.nationalId),
      phoneNumber: normalizeOptionalText(input.phoneNumber),
      email: normalizeOptionalText(input.email),
      addressLine: normalizeOptionalText(input.addressLine),
      notes: normalizeOptionalText(input.notes),
      status: "ACTIVE",
      createdByUserId,
    },
  })

  return toClientRecord(client)
}

export async function getClientByPublicIdFromDb(clientPublicId: string) {
  const client = await prismaClient.client.findUnique({
    where: { publicId: clientPublicId },
  })

  if (!client) {
    return null
  }

  return toClientRecord(client)
}

export async function updateClientByPublicIdFromDb(clientPublicId: string, input: UpdateClientInput) {
  const existingClient = await prismaClient.client.findUnique({
    where: { publicId: clientPublicId },
    select: { id: true },
  })

  if (!existingClient) {
    return null
  }

  const client = await prismaClient.client.update({
    where: { publicId: clientPublicId },
    data: {
      fullName: input.fullName === undefined ? undefined : normalizeRequiredText(input.fullName),
      nationalId: normalizeOptionalText(input.nationalId),
      phoneNumber: normalizeOptionalText(input.phoneNumber),
      email: normalizeOptionalText(input.email),
      addressLine: normalizeOptionalText(input.addressLine),
      notes: normalizeOptionalText(input.notes),
    },
  })

  return toClientRecord(client)
}

export async function deleteClientByPublicIdFromDb(clientPublicId: string) {
  const existingClient = await prismaClient.client.findUnique({
    where: { publicId: clientPublicId },
    select: { id: true },
  })

  if (!existingClient) {
    return false
  }

  await prismaClient.client.delete({
    where: { publicId: clientPublicId },
  })

  return true
}
