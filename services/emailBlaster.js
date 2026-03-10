// services/emailBlaster.js
// Sends CV blast emails to companies on behalf of the user

const nodemailer = require('nodemailer')
const path       = require('path')
const fs         = require('fs')
const Order      = require('../models/Order')
const User       = require('../models/User')

// ── Load company emails from CSV ──────────────────────────────
function loadCompanies() {
  try {
    const csvPath = path.join(__dirname, '../data/companies.csv')
    const raw     = fs.readFileSync(csvPath, 'utf-8')
    const lines   = raw.trim().split('\n').slice(1) // skip header
    return lines.map(line => {
      const [company, email, country, industry] = line.split(',').map(s => s?.trim().replace(/"/g, ''))
      return { company, email, country, industry }
    }).filter(c => c.email && c.email.includes('@'))
  } catch (err) {
    console.error('Failed to load companies CSV:', err.message)
    return []
  }
}

// ── Filter companies by user preferences ─────────────────────
function filterCompanies(companies, location, industries, count) {
  let filtered = [...companies]

  // Filter by location
  if (location === 'Nigeria Only') {
    filtered = filtered.filter(c => c.country?.toLowerCase().includes('nigeria'))
  } else if (location === 'Global Remote Only') {
    filtered = filtered.filter(c =>
      c.country?.toLowerCase().includes('global') ||
      c.country?.toLowerCase().includes('remote')
    )
  } else if (location === 'Pan-African (All Countries)') {
    filtered = filtered.filter(c => !c.country?.toLowerCase().includes('global'))
  }
  // 'All (Africa + Remote)' — no filter needed

  // Filter by industries if selected
  if (industries && industries.length > 0) {
    const cleaned = industries.map(i => i.replace(/[^a-zA-Z]/g, '').toLowerCase())
    const industryFiltered = filtered.filter(c => {
      const ci = c.industry?.toLowerCase() || ''
      return cleaned.some(ind => ci.includes(ind.slice(0, 5)))
    })
    // Only apply industry filter if it returns enough results
    if (industryFiltered.length >= Math.min(count, 50)) {
      filtered = industryFiltered
    }
  }

  // Shuffle for variety
  filtered = filtered.sort(() => Math.random() - 0.5)

  return filtered.slice(0, count)
}

// ── Build email transporter ───────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

// ── Build email HTML body ─────────────────────────────────────
function buildEmailBody(user, company, order) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; max-width: 600px; line-height: 1.7;">
      <p>Dear Hiring Team at ${company.company},</p>

      <p>${user.intro}</p>

      <p>I am particularly interested in opportunities at <strong>${company.company}</strong> 
      and would love to contribute my skills as a <strong>${order.role}</strong>.</p>

      <p>Please find my CV${user.clFilePath ? ' and cover letter' : ''} attached to this email.</p>

      <p>I would welcome the opportunity to discuss how I can add value to your team. 
      Please feel free to reach out to me directly.</p>

      <p>
        Best regards,<br/>
        <strong>${user.name}</strong><br/>
        📧 ${user.email}<br/>
        ${user.phone    ? `📞 ${user.phone}<br/>`    : ''}
        ${user.linkedinUrl ? `🔗 <a href="${user.linkedinUrl}">${user.linkedinUrl}</a><br/>` : ''}
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #999;">
        This application was sent via ReachHire — Africa's CV Blast Platform.<br/>
        To unsubscribe from future applications, reply with "unsubscribe".
      </p>
    </div>
  `
}

// ── Main blast function ───────────────────────────────────────
async function blastEmails(orderId) {
  const order = await Order.findById(orderId).populate('user')
  if (!order) throw new Error('Order not found')

  const user = await User.findById(order.user._id || order.user)
  if (!user) throw new Error('User not found')

  // Update status to sending
  order.status = 'sending'
  await order.save()

  const companies = loadCompanies()
  const targets   = filterCompanies(companies, order.location, order.industries, order.companiesCount)

  const transporter = createTransporter()

  // Build attachments
  const attachments = []
  if (user.cvFilePath) {
    const cvPath = path.join(__dirname, '../uploads', user.cvFilePath)
    if (fs.existsSync(cvPath)) {
      attachments.push({
        filename: user.cvOriginalName || 'CV.pdf',
        path:     cvPath,
      })
    }
  }
  if (user.clFilePath) {
    const clPath = path.join(__dirname, '../uploads', user.clFilePath)
    if (fs.existsSync(clPath)) {
      attachments.push({
        filename: user.clOriginalName || 'CoverLetter.pdf',
        path:     clPath,
      })
    }
  }

  let sent = 0

  for (const company of targets) {
    try {
      await transporter.sendMail({
        from:     `"${user.name}" <${process.env.EMAIL_USER}>`,
        replyTo:  `"${user.name}" <${user.email}>`,
        to:       company.email,
        subject:  `Application for ${order.role} Position — ${user.name}`,
        html:     buildEmailBody(user, company, order),
        attachments,
      })

      sent++

      // Update emailsSent count every 10 emails
      if (sent % 10 === 0) {
        await Order.findByIdAndUpdate(orderId, { emailsSent: sent })
      }

      // Small delay between emails to avoid spam filters (200ms)
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      // Log failed email but continue blasting
      console.error(`Failed to send to ${company.email}:`, err.message)
    }
  }

  // Mark order as complete
  await Order.findByIdAndUpdate(orderId, {
    status:     'sent',
    emailsSent: sent,
  })

  console.log(`✅ Blast complete — ${sent} emails sent for order ${orderId}`)
  return sent
}

module.exports = { blastEmails }
