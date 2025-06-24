const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/send-email', async (req, res) => {
  const { csv } = req.body;

  if (!csv) return res.status(400).json({ error: 'CSV data missing' });

  try {
    // Setup transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or 'outlook', 'yahoo', etc.
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Compose email
    const mailOptions = {
      from: `"Inventory App" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: 'Food Inventory CSV',
      text: 'Please find attached the latest food inventory.',
      attachments: [
        {
          filename: 'food_inventory.csv',
          content: csv,
        },
      ],
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
