import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()
const app = express()
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

app.use(cors())
app.use(express.json())

// ✅ Ürün stok durumu getir
app.get('/api/preorder/status', async (req, res) => {
  const { productId } = req.query

  const product = await prisma.product.findFirst({
    where: { shopifyId: String(productId) }
  })

  const reservations = await prisma.reservation.count({
    where: { productId: product?.id ?? 0 }
  })

  res.json({
    totalReservations: reservations,
    remainingSlots: (product?.maxPreorder ?? 20) - reservations,
    preorderPrice: product?.preorderPrice
  })
})

// ✅ Ön sipariş oluştur
app.post('/api/preorder', async (req, res) => {
  const { productId, productName, email, quantity, originalPrice, preorderPrice } = req.body

  let product = await prisma.product.findFirst({
    where: { shopifyId: String(productId) }
  })

  if (!product) {
    product = await prisma.product.create({
      data: {
        shopifyId: String(productId),
        name: productName,
        originalPrice,
        preorderPrice,
      }
    })
  }

  await prisma.reservation.create({
    data: {
      productId: product.id,
      email,
      quantity: Number(quantity)
    }
  })

  res.json({ success: true })
})

// ✅ Tüm rezervasyonları getir
app.get('/api/reservations', async (req, res) => {
  try {
    await prisma.$connect()
    const reservations = await prisma.reservation.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(reservations)
  } catch (error) {
    await prisma.$disconnect()
    await prisma.$connect()
    const reservations = await prisma.reservation.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(reservations)
  }
})

// ✅ Stok güncelle ve bildirim gönder
app.post('/api/stock/update', async (req, res) => {
  const { productId, stock } = req.body

  const product = await prisma.product.findFirst({
    where: { shopifyId: String(productId) },
    include: { reservations: true }
  })

  if (!product) {
    return res.status(404).json({ error: 'Ürün bulunamadı' })
  }

  const emails = product.reservations.map(r => r.email)

  res.json({
    success: true,
    notifiedEmails: emails,
    message: `${emails.length} müşteri bilgilendirildi`
  })
})

// ✅ Rezervasyonları CSV olarak indir
app.get('/api/reservations/export', async (req, res) => {
  const reservations = await prisma.reservation.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' }
  })

  const csv = [
    'ID,Ürün,Email,Adet,Tarih',
    ...reservations.map(r =>
      `${r.id},"${r.product.name}",${r.email},${r.quantity},${r.createdAt}`
    )
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=rezervasyonlar.csv')
  res.send(csv)
})

app.listen(process.env.PORT, () => {
  console.log(`✅ API çalışıyor: http://localhost:${process.env.PORT}`)
})