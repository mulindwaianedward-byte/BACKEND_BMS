require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve your frontend files (index.html, style.css, app.js)
app.use(express.static(path.join(__dirname)));

// API routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/stock',        require('./routes/stock'));
app.use('/api/raw-materials',require('./routes/rawMaterials'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/suppliers',    require('./routes/suppliers'));
app.use('/api/orders',       require('./routes/orders'));
app.use('/api/expenses',     require('./routes/expenses'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/settings',     require('./routes/settings'));

// Fallback: serve index.html for any non-API route
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ BMS running on http://localhost:${PORT}`));
