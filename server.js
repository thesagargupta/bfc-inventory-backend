const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory tracking of last submission dates per branch
const submissionTracker = new Map();

// Helper to get YYYY-MM-DD string
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// Endpoint to send email and track submission
app.post('/send-email', async (req, res) => {
  const { csv, branch } = req.body;

  if (!csv || !branch) {
    return res.status(400).json({ error: 'CSV and branch are required' });
  }

  try {
    // Setup transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred email provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Compose email
    const mailOptions = {
      from: `"Inventory App" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Food Inventory - ${branch}`,
      text: 'Please find attached the latest food inventory.',
      attachments: [
        {
          filename: 'food_inventory.csv',
          content: csv,
        },
      ],
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    // Save submission date for the branch
    const today = getTodayDateString();
    submissionTracker.set(branch, today);

    res.status(200).json({ message: 'Email sent and submission recorded' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Endpoint to fetch last submission date for a branch
app.get('/last-submission/:branch', (req, res) => {
  const { branch } = req.params;
  if (!branch) return res.status(400).json({ error: 'Branch is required' });

  const lastDate = submissionTracker.get(branch) || null;
  res.status(200).json({ branch, date: lastDate });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
