const express = require('express')
const multer  = require('multer')
const path    = require('path')
const { protect } = require('../middleware/authMiddleware')
const User = require('../models/User')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = `${req.user._id}-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, unique)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx']
    const ext = path.extname(file.originalname).toLowerCase()
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF, DOC, DOCX allowed'))
  },
})

// ── GET /api/profile ──────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password')
    res.json(user)
  } catch {
    res.status(500).json({ message: 'Error fetching profile' })
  }
})

// ── PUT /api/profile ──────────────────────────────────────────
router.put('/', protect, async (req, res) => {
  try {
    const { name, phone, linkedinUrl, role, location, industries, intro } = req.body
    const user = await User.findById(req.user._id)

    if (name)        user.name        = name
    if (phone !== undefined) user.phone = phone
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl
    if (role)        user.role        = role
    if (location)    user.location    = location
    if (industries)  user.industries  = JSON.parse(industries)
    if (intro !== undefined) user.intro = intro

    // Profile is complete when these essentials are filled
    user.profileComplete = !!(user.role && user.location && user.cvFilePath && user.intro)

    await user.save()
    const updated = await User.findById(req.user._id).select('-password')
    res.json({ message: 'Profile updated', user: updated })
  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({ message: 'Error updating profile' })
  }
})

// ── POST /api/profile/upload-cv ───────────────────────────────
router.post('/upload-cv', protect, upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
    const user = await User.findById(req.user._id)
    user.cvFilePath     = req.file.filename
    user.cvOriginalName = req.file.originalname
    user.profileComplete = !!(user.role && user.location && req.file.filename && user.intro)
    await user.save()
    res.json({
      message:        'CV uploaded successfully',
      cvFilePath:     req.file.filename,
      cvOriginalName: req.file.originalname,
    })
  } catch {
    res.status(500).json({ message: 'Error uploading CV' })
  }
})

// ── POST /api/profile/upload-cl ───────────────────────────────
router.post('/upload-cl', protect, upload.single('coverLetter'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
    const user = await User.findById(req.user._id)
    user.clFilePath     = req.file.filename
    user.clOriginalName = req.file.originalname
    await user.save()
    res.json({
      message:        'Cover letter uploaded successfully',
      clFilePath:     req.file.filename,
      clOriginalName: req.file.originalname,
    })
  } catch {
    res.status(500).json({ message: 'Error uploading cover letter' })
  }
})

module.exports = router
