import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()
const app = express()
const prisma = new PrismaClient()

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

  // Ürünü bul veya oluştur
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

  // Rezervasyon oluştur
  await prisma.reservation.create({
    data: {
      productId: product.id,
      email,
      quantity: Number(quantity)
    }
  })

  res.json({ success: true })
})

app.listen(process.env.PORT, () => {
  console.log(`✅ API çalışıyor: http://localhost:${process.env.PORT}`)
})