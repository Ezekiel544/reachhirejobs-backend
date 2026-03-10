require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const session   = require('express-session')
const passport  = require('./config/passport')
const path      = require('path')
const fs        = require('fs')
const connectDB = require('./config/db')

connectDB()

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth',    require('./routes/auth'))
app.use('/api/profile', require('./routes/profile'))
app.use('/api/orders',  require('./routes/orders'))
app.use('/api/payment', require('./routes/payment'))

app.get('/', (req, res) => res.json({ message: '✅ ReachHire API is running' }))
app.use((req, res) => res.status(404).json({ message: 'Route not found' }))
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || 'Server error' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
