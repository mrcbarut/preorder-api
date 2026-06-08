console.log('DATABASE_URL:', process.env.DATABASE_URL)
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()
const app = express()

app.use(cors())
app.use(express.json())

async function getPrisma() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
  await prisma.$connect()
  return prisma
}

// ✅ Ürün stok durumu getir
app.get('/api/preorder/status', async (req, res) => {
  const prisma = await getPrisma()
  try {
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
  } finally {
    await prisma.$disconnect()
  }
})

// ✅ Ön sipariş oluştur
app.post('/api/preorder', async (req, res) => {
  const prisma = await getPrisma()
  try {
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
  } finally {
    await prisma.$disconnect()
  }
})

// ✅ Tüm rezervasyonları getir
app.get('/api/reservations', async (req, res) => {
  const prisma = await getPrisma()
  try {
    const reservations = await prisma.reservation.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(reservations)
  } finally {
    await prisma.$disconnect()
  }
})

// ✅ Stok güncelle
app.post('/api/stock/update', async (req, res) => {
  const prisma = await getPrisma()
  try {
    const { productId } = req.body
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
  } finally {
    await prisma.$disconnect()
  }
})

// ✅ Rezervasyonları CSV olarak indir
app.get('/api/reservations/export', async (req, res) => {
  const prisma = await getPrisma()
  try {
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
  } finally {
    await prisma.$disconnect()
  }
})
// Admin paneli
app.get('/admin', (req, res) => {
  res.sendFile('/opt/render/project/src/src/admin.html')
})
// Ürünleri getir
app.get('/api/products', async (req, res) => {
  const prisma = await getPrisma()
  try {
    const products = await prisma.product.findMany({
      include: { reservations: true }
    })
    const result = products.map(p => ({
      id: p.id,
      shopifyId: p.shopifyId,
      name: p.name,
      originalPrice: p.originalPrice,
      preorderPrice: p.preorderPrice,
      maxPreorder: p.maxPreorder,
      totalReservations: p.reservations.length,
      remainingSlots: p.maxPreorder - p.reservations.length
    }))
    res.json(result)
  } finally {
    await prisma.$disconnect()
  }
})
app.listen(process.env.PORT, () => {
  console.log(`✅ API çalışıyor: http://localhost:${process.env.PORT}`)
  app.get('/admin', (req, res) => {
  const fs = require('fs')
  const path = require('path')
  const dir1 = fs.readdirSync('/opt/render/project/src')
  const dir2 = fs.readdirSync('/opt/render/project/src/src')
  res.json({ dir1, dir2 })
})
})
