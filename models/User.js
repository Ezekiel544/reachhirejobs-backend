const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: [true, 'Name is required'], trim: true },
  email:    { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
  password: { type: String, required: [true, 'Password is required'], minlength: 8 },
  googleId: { type: String, default: null },

  // ── Profile ───────────────────────────────────────────────
  phone:          { type: String,  default: '' },
  linkedinUrl:    { type: String,  default: '' },
  role:           { type: String,  default: '' },
  location:       { type: String,  default: '' },
  industries:     { type: [String], default: [] },
  intro:          { type: String,  default: '' }, // email body companies will read
  cvFilePath:     { type: String,  default: '' },
  cvOriginalName: { type: String,  default: '' },
  clFilePath:     { type: String,  default: '' },
  clOriginalName: { type: String,  default: '' },
  profileComplete:{ type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
})

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  if (this.googleId) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('User', userSchema)
