const express = require('express')
const https   = require('https')
const { protect } = require('../middleware/authMiddleware')
const Order   = require('../models/Order')
const { blastEmails } = require('../services/emailBlaster')

const router = express.Router()

// ── Helper: verify with Paystack ──────────────────────────────
function verifyWithPaystack(reference) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      port:     443,
      path:     `/transaction/verify/${reference}`,
      method:   'GET',
      headers:  { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Invalid Paystack response')) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ── POST /api/payment/initialize ──────────────────────────────
// Called before Paystack popup opens — returns amount + email for Paystack
router.post('/initialize', protect, async (req, res) => {
  try {
    const { orderId } = req.body
    const order = await Order.findOne({ _id: orderId, user: req.user._id })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== 'pending') return res.status(400).json({ message: 'Order already paid' })

    res.json({
      email:     req.user.email,
      amount:    order.amount * 100,  // Paystack uses kobo (multiply by 100)
      orderId:   order._id,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    })
  } catch (error) {
    res.status(500).json({ message: 'Error initializing payment' })
  }
})

// ── POST /api/payment/verify ──────────────────────────────────
// Called after Paystack confirms payment on frontend
router.post('/verify', protect, async (req, res) => {
  try {
    const { reference, orderId } = req.body
    if (!reference) return res.status(400).json({ message: 'Payment reference required' })

    // Verify with Paystack
    const result = await verifyWithPaystack(reference)

    if (!result.status || result.data?.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful' })
    }

    // Update order to paid
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: 'paid', paystackReference: reference },
      { new: true }
    )
    if (!order) return res.status(404).json({ message: 'Order not found' })

    res.json({ message: 'Payment verified! Starting blast...', order })

    // Trigger email blast in background (don't await — let it run async)
    blastEmails(orderId).catch(err =>
      console.error('Blast error for order', orderId, err.message)
    )

  } catch (error) {
    console.error('Payment verify error:', error)
    res.status(500).json({ message: 'Server error verifying payment' })
  }
})

// ── POST /api/payment/webhook ─────────────────────────────────
// Paystack calls this automatically when payment succeeds
// Extra safety net in case frontend verify call fails
router.post('/webhook', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  const hash   = require('crypto')
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')

  // Verify it's actually from Paystack
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Unauthorized')
  }

  const event = req.body
  if (event.event === 'charge.success') {
    const reference = event.data.reference
    const order = await Order.findOne({ paystackReference: reference })
    if (order && order.status === 'pending') {
      await Order.findByIdAndUpdate(order._id, { status: 'paid' })
      blastEmails(order._id).catch(console.error)
    }
  }

  res.sendStatus(200)
})

// ── POST /api/payment/verify-by-reference ────────────────────
// Manual verify using just the reference — finds order automatically
router.post('/verify-by-reference', protect, async (req, res) => {
  try {
    const { reference } = req.body
    if (!reference) return res.status(400).json({ message: 'Reference required' })

    // Verify with Paystack
    const result = await verifyWithPaystack(reference)
    console.log('Manual verify result:', result.data?.status, reference)

    if (!result.status || result.data?.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful on Paystack' })
    }

    // Find order by reference OR find latest pending order for this user
    let order = await Order.findOne({ paystackReference: reference })
    if (!order) {
      // Find the most recent pending order for this user
      order = await Order.findOne({ user: req.user._id, status: 'pending' })
        .sort({ createdAt: -1 })
    }
    if (!order) return res.status(404).json({ message: 'No pending order found' })

    await Order.findByIdAndUpdate(order._id, {
      status: 'paid',
      paystackReference: reference
    })

    res.json({ message: 'Payment verified!', orderId: order._id })

    blastEmails(order._id).catch(err =>
      console.error('Blast error:', err.message)
    )
  } catch (error) {
    console.error('Manual verify error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router