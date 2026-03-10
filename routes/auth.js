const express = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const User = require('../models/User')
const { protect } = require('../middleware/authMiddleware')

const router = express.Router()

// Helper: generate JWT token
function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

// ── POST /api/auth/signup ─────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Validate
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' })
    }

    // Create user (password hashed automatically via model pre-save hook)
    const user = await User.create({ name, email, password })

    res.status(201).json({
      message: 'Account created successfully',
      token: generateToken(user._id),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Server error, please try again' })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields' })
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error, please try again' })
  }
})

// ── GET /api/auth/me ─────────────────────────────────────────
// Returns logged-in user's profile (requires token)
router.get('/me', protect, async (req, res) => {
  res.json({
    id:    req.user._id,
    name:  req.user.name,
    email: req.user.email,
  })
})

// ── GET /api/auth/google ──────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

// ── GET /api/auth/google/callback ─────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}?error=google_failed` }),
  (req, res) => {
    const token = generateToken(req.user._id)
    const user  = encodeURIComponent(JSON.stringify({
      id:    req.user._id,
      name:  req.user.name,
      email: req.user.email,
    }))
    res.redirect(`${process.env.CLIENT_URL}?token=${token}&user=${user}`)
  }
)

module.exports = router
