const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');

// Initialize the app first
const app = express();
const port = process.env.PORT || 3001;

// THEN add middleware
app.use(express.json()); // Parse JSON bodies
app.use(cors({
    origin: 'http://localhost:3000', // CORS for frontend
}));

// Hardcoded product data
const products = [
    { id: 1, name: 'Lavender Scented Candle', price: 150, imageUrl: '/lavender.jpg' },
    { id: 2, name: 'Latte Candle', price: 350, imageUrl: '/latte.jpg' },
    { id: 3, name: 'Daisy Candle', price: 300, imageUrl: '/daisy.jpg' },
    { id: 4, name: 'Shimmers and Dried Flower Candle', price: 250, imageUrl: '/SHIMMERS.jpg' },
    { id: 5, name: 'Candle Bouquets', price: 80, imageUrl: '/bouquets.jpg' },
];

// In-memory cart
let cart = [];

// Endpoint to get products
app.get('/products', (req, res) => {
    res.json(products);
});

// Endpoint to get cart
app.get('/cart', (req, res) => {
    res.json(cart);
});

// Endpoint to add to cart
app.post('/cart', (req, res) => {
    const { productId, quantity } = req.body;
    const product = products.find(p => p.id === productId);
    if (product) {
        const cartItem = cart.find(item => item.product.id === productId);
        if (cartItem) {
            cartItem.quantity += quantity;
        } else {
            cart.push({ product, quantity });
        }
        res.status(200).json(cart);
    } else {
        res.status(404).json([]);
    }
});

// Endpoint to update cart
app.put('/cart', (req, res) => {
    const { productId, quantity } = req.body;
    const cartItem = cart.find(item => item.product.id === productId);
    if (cartItem) {
        cartItem.quantity = quantity;
        res.status(200).json(cart);
    } else {
        res.status(404).json({ message: 'Product not in cart' });
    }
});

// PostgreSQL connection setup
const pool = new Pool({
    user: 'postgres', // replace with your actual username
    host: 'localhost',    // or your actual host
    database: 'cozykeeps', // replace with your actual database name
    password: '706125', // replace with your actual password
    port: 5432,           // or your actual port
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log('Connected to PostgreSQL:', result.rows);
    });
});

// Razorpay instance
const razorpay = new Razorpay({
    key_id: 'rzp_test_2dkCRymlZGG5zf', // Your API key
    key_secret: '5zYVpRKlbAhEpnR7G5OEXysR',     // Your Razorpay secret key
});

// Configure your email transporter (use your Gmail and an App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cozykeeps9@gmail.com',
        pass: 'rlkxqnnhzwmkklux', // Gmail App Password, no spaces
    },
});

// Endpoint to save address
app.post('/address', (req, res) => {
    const { firstName, lastName, mobileNumber, flat, area, landmark, pincode, city, state, email } = req.body;

    const query = `
        INSERT INTO addresses (first_name, last_name, mobile_number, flat, area, landmark, pincode, city, state, email)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    pool.query(query, [firstName, lastName, mobileNumber, flat, area, landmark, pincode, city, state, email], (err, result) => {
        if (err) {
            console.error('Error saving address:', err);
            res.status(500).json({ message: err.message });
        } else {
            res.status(200).json({ message: 'Address saved successfully' });
        }
    });
});

// Endpoint to get the last saved address
app.get('/address', (req, res) => {
    pool.query('SELECT * FROM addresses ORDER BY id DESC LIMIT 1', (err, result) => {
        if (err) {
            console.error('Error fetching address:', err);
            res.status(500).json({ message: 'Error fetching address' });
        } else if (result.rows.length === 0) {
            res.status(404).json({ message: 'No address found' });
        } else {
            res.status(200).json(result.rows[0]);
        }
    });
});

// Endpoint to create a Razorpay order
app.post('/create-order', async (req, res) => {
    const { amount } = req.body; // amount in rupees
    console.log('Amount received from frontend:', amount); // Debug log

    const options = {
        amount: amount * 100, // Razorpay expects paise
        currency: "INR",
        receipt: "order_rcptid_" + Math.floor(Math.random() * 1000000),
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error('Error creating Razorpay order:', err);
        res.status(500).json({ message: 'Error creating order' });
    }
});

// Endpoint to send order confirmation email
app.post('/send-confirmation', async (req, res) => {
    const { customerEmail, orderDetails } = req.body;

    const mailOptions = {
        from: 'cozykeeps9@gmail.com',
        to: [customerEmail, 'cozykeeps9@gmail.com'], // send to customer and yourself
        subject: 'Order Confirmation - CozyKeeps',
        text: `Thank you for your order!\n\nOrder Details:\n${orderDetails}\n\nWe appreciate your business!`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Confirmation email sent' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send confirmation email' });
    }
});

// Basic route
app.get('/', (req, res) => {
    res.send('Welcome to the CozyKeeps Backend!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 