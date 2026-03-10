const express = require('express')
const fs      = require('fs')
const path2   = require('path')
const multer  = require('multer')
const path    = require('path')
const { protect } = require('../middleware/authMiddleware')
const Order = require('../models/Order')
const User  = require('../models/User')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, unique)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx']
    const ext = path.extname(file.originalname).toLowerCase()
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF, DOC, DOCX files allowed'))
  },
})

// ── POST /api/orders ──────────────────────────────────────────
router.post('/', protect, upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'coverLetter', maxCount: 1 },
]), async (req, res) => {
  try {
    const { companiesCount, amount, role, location, industries, useProfileCv, useProfileCl } = req.body

    if (!companiesCount || !amount || !role || !location) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    // Get user profile to snapshot CV info
    const user = await User.findById(req.user._id)

    // Determine which CV to use — new upload or saved profile CV
    let cvFile         = req.files?.cv?.[0]?.filename        || null
    let coverLetterFile= req.files?.coverLetter?.[0]?.filename || null

    if (!cvFile && useProfileCv === 'true') {
      if (!user.cvFilePath) return res.status(400).json({ message: 'No CV found. Please upload your CV in Settings.' })
      cvFile = user.cvFilePath
    }
    if (!coverLetterFile && useProfileCl === 'true') {
      coverLetterFile = user.clFilePath || null
    }

    if (!cvFile) return res.status(400).json({ message: 'CV is required to create a blast' })

    const order = await Order.create({
      user:           req.user._id,
      companiesCount: Number(companiesCount),
      amount:         Number(amount),
      role,
      location,
      industries:     industries ? JSON.parse(industries) : [],
      cvFile,
      coverLetterFile,
      status:         'pending',
    })

    res.status(201).json({ message: 'Order created', order })
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ message: 'Server error creating order' })
  }
})

// ── GET /api/orders/stats ─────────────────────────────────────
// Must be before /:id to avoid conflict
router.get('/stats', protect, async (req, res) => {
  try {
    const orders      = await Order.find({ user: req.user._id })
    const totalCVsSent = orders.reduce((sum, o) => sum + (o.emailsSent || 0), 0)
    const totalBlasts  = orders.length
    const totalSpent   = orders
      .filter(o => o.status !== 'pending')
      .reduce((sum, o) => sum + o.amount, 0)
    res.json({ totalCVsSent, totalBlasts, totalSpent })
  } catch {
    res.status(500).json({ message: 'Server error fetching stats' })
  }
})

// ── GET /api/orders ───────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json(orders)
  } catch {
    res.status(500).json({ message: 'Server error fetching orders' })
  }
})

// ── GET /api/orders/:id ───────────────────────────────────────
// ── GET /api/orders/company-count ────────────────────────────
router.get('/company-count', protect, (req, res) => {
  try {
    const csvPath = require('path').join(__dirname, '../data/companies.csv')
    const lines = require('fs').readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim())
    const count = lines.length - 1
    console.log('Company count:', count, 'at path:', csvPath)
    res.json({ count })
  } catch (err) {
    console.error('Company count error:', err.message)
    res.json({ count: 1223 })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json(order)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router