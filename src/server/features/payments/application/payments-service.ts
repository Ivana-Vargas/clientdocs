import { prismaClient } from "@database/db-client/prisma-client"
import type { Prisma } from "@prisma/client"

import type { PaymentMethod } from "@server/features/payments/domain/payment-method"

type PaymentRecord = {
  id: string
  publicId: string
  clientPublicId: string
  amountInCents: number
  currency: string
  method: PaymentMethod
  referenceNote: string | null
  paidAt: string
  createdAt: string
}

export type CreatePaymentInput = {
  amountInCents: number
  method: PaymentMethod
  referenceNote?: string
  paidAt: Date
}

export type CreatePaymentResult =
  | {
      status: "created"
      payment: PaymentRecord
    }
  | {
      status: "client_not_found"
    }
  | {
      status: "payment_exceeds_debt"
      totalDebtInCents: number
      totalPaidInCents: number
      requestedAmountInCents: number
    }

function normalizeReferenceNote(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function toPaymentRecord(payment: {
  id: string
  publicId: string
  client: {
    publicId: string
  }
  amountInCents: number
  currency: string
  method: PaymentMethod
  referenceNote: string | null
  paidAt: Date
  createdAt: Date
}): PaymentRecord {
  return {
    id: payment.id,
    publicId: payment.publicId,
    clientPublicId: payment.client.publicId,
    amountInCents: payment.amountInCents,
    currency: payment.currency,
    method: payment.method,
    referenceNote: payment.referenceNote,
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  }
}

export async function listPaymentsByClientPublicIdFromDb(clientPublicId: string) {
  const client = await prismaClient.client.findUnique({
    where: { publicId: clientPublicId },
    select: {
      id: true,
      publicId: true,
      payments: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        include: {
          client: {
            select: { publicId: true },
          },
        },
      },
    },
  })

  if (!client) {
    return null
  }

  const payments = client.payments.map(toPaymentRecord)
  const totalPaidInCents = payments.reduce(
    (total: number, payment: PaymentRecord) => total + payment.amountInCents,
    0,
  )

  return {
    clientPublicId: client.publicId,
    totalPaidInCents,
    payments,
  }
}

export async function createPaymentForClientPublicIdInDb(
  clientPublicId: string,
  input: CreatePaymentInput,
  createdByUserId: string,
) {
  return prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
    const client = await tx.client.findUnique({
      where: { publicId: clientPublicId },
      select: {
        id: true,
        totalDebtInCents: true,
      },
    })

    if (!client) {
      return {
        status: "client_not_found",
      } satisfies CreatePaymentResult
    }

    const aggregate = await tx.payment.aggregate({
      where: { clientId: client.id },
      _sum: { amountInCents: true },
    })

    const totalPaidInCents = aggregate._sum.amountInCents ?? 0

    if (totalPaidInCents + input.amountInCents > client.totalDebtInCents) {
      return {
        status: "payment_exceeds_debt",
        totalDebtInCents: client.totalDebtInCents,
        totalPaidInCents,
        requestedAmountInCents: input.amountInCents,
      } satisfies CreatePaymentResult
    }

    const payment = await tx.payment.create({
      data: {
        clientId: client.id,
        amountInCents: input.amountInCents,
        currency: "BOB",
        method: input.method,
        referenceNote: normalizeReferenceNote(input.referenceNote),
        paidAt: input.paidAt,
        createdByUserId,
      },
      include: {
        client: {
          select: { publicId: true },
        },
      },
    })

    return {
      status: "created",
      payment: toPaymentRecord(payment),
    } satisfies CreatePaymentResult
  })
}

export async function countPaymentsFromDb() {
  return prismaClient.payment.count()
}
