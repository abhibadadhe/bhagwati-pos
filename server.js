const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ==========================================
// DEFAULT DATA CONFIGURATIONS FOR SEEDING
// ==========================================
const DEFAULT_MENU_ITEMS = [
  { id: "v1", name: "Vadapav", price: 20.0, category: "vadapav" },
  { id: "d1", name: "Special Tea (Chaha)", price: 10.0, category: "drinks" }
];

const DEFAULT_SETTINGS = {
  shopName: "Bhagwati Vadapav",
  tagline: "Very Very Tasty Tasty",
  address1: "Bus Stand Road, Sinnar",
  address2: "Sinnar, Nashik (422103)",
  phone: "+91 9876543210",
  taxPercent: 0,
  paperWidth: "58mm",
  receiptFooter: "Thank you! Visit Again!"
};

// ==========================================
// DATABASE CONNECTOR SETUP
// ==========================================
let dbType = 'sqlite';
let sqliteDb = null;
let pgClient = null;

const pgUrl = process.env.DATABASE_URL;

if (pgUrl) {
  dbType = 'postgres';
  console.log("Connecting to PostgreSQL Database...");
  pgClient = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false } // Required for hosting platforms like Render/Heroku/Neon
  });
  pgClient.connect().then(() => {
    console.log("PostgreSQL Connected successfully.");
    initializeDatabase();
  }).catch(err => {
    console.error("PostgreSQL Connection Error, falling back to SQLite:", err);
    dbType = 'sqlite';
    connectSqlite();
  });
} else {
  connectSqlite();
}

function connectSqlite() {
  dbType = 'sqlite';
  const dbPath = path.join(__dirname, 'database.sqlite');
  console.log(`Connecting to SQLite Database at: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("SQLite Connection Error:", err);
    } else {
      console.log("SQLite Connected successfully.");
      initializeDatabase();
    }
  });
}

// Helper query function to make code uniform between databases
function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      // Convert SQLite parameter placeholders (?) to Postgres ($1, $2, etc.)
      let pgSql = sql;
      let counter = 1;
      while (pgSql.includes('?')) {
        pgSql = pgSql.replace('?', `$${counter++}`);
      }
      pgClient.query(pgSql, params, (err, res) => {
        if (err) reject(err);
        else resolve(res.rows);
      });
    } else {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      let pgSql = sql;
      let counter = 1;
      while (pgSql.includes('?')) {
        pgSql = pgSql.replace('?', `$${counter++}`);
      }
      pgClient.query(pgSql, params, (err, res) => {
        if (err) reject(err);
        else resolve({ lastID: null, changes: res.rowCount });
      });
    } else {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

// ==========================================
// DATABASE SCHEMA INITIALIZATION & MIGRATIONS
// ==========================================
async function initializeDatabase() {
  try {
    console.log("Initializing database tables...");
    
    if (dbType === 'postgres') {
      // Create tables in Postgres
      await dbRun(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          category VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sales_history (
          invoice_no VARCHAR(100) PRIMARY KEY,
          timestamp VARCHAR(100) NOT NULL,
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(100) NOT NULL,
          order_type VARCHAR(100) NOT NULL,
          payment_mode VARCHAR(100) NOT NULL,
          subtotal DOUBLE PRECISION NOT NULL,
          discount_amt DOUBLE PRECISION NOT NULL,
          tax_amt DOUBLE PRECISION NOT NULL,
          grand_total DOUBLE PRECISION NOT NULL,
          items TEXT NOT NULL
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    } else {
      // Create tables in SQLite
      await dbRun(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          category TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sales_history (
          id TEXT PRIMARY KEY,
          invoice_no TEXT,
          timestamp TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          order_type TEXT NOT NULL,
          payment_mode TEXT NOT NULL,
          subtotal REAL NOT NULL,
          discount_amt REAL NOT NULL,
          tax_amt REAL NOT NULL,
          grand_total REAL NOT NULL,
          items TEXT NOT NULL
        )
      `);

      // SQLite tables structure verification and potential migration for id as primary key
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sales_history_v2 (
          invoice_no TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          order_type TEXT NOT NULL,
          payment_mode TEXT NOT NULL,
          subtotal REAL NOT NULL,
          discount_amt REAL NOT NULL,
          tax_amt REAL NOT NULL,
          grand_total REAL NOT NULL,
          items TEXT NOT NULL
        )
      `);

      // We use sales_history_v2 as the final name, but let's drop any old table
      await dbRun(`DROP TABLE IF EXISTS sales_history`);
      await dbRun(`ALTER TABLE sales_history_v2 RENAME TO sales_history`).catch(() => {});

      await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    }

    console.log("Tables initialized successfully. Checking seed data...");
    
    // Seed menu items if empty
    const menuCount = await dbQuery("SELECT COUNT(*) as count FROM menu_items");
    if (menuCount[0].count == 0) {
      console.log("Seeding default menu items...");
      for (const item of DEFAULT_MENU_ITEMS) {
        await dbRun("INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)", [
          item.id, item.name, item.price, item.category
        ]);
      }
    }

    // Seed settings if empty
    const settingsCount = await dbQuery("SELECT COUNT(*) as count FROM settings WHERE key = 'config'");
    if (settingsCount[0].count == 0) {
      console.log("Seeding default settings...");
      await dbRun("INSERT INTO settings (key, value) VALUES ('config', ?)", [
        JSON.stringify(DEFAULT_SETTINGS)
      ]);
    }
    
    console.log("Database verification complete.");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// MENU ENDPOINTS
app.get('/api/menu', async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM menu_items ORDER BY created_at ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', async (req, res) => {
  try {
    const { id, name, price, category } = req.body;
    if (!id || !name || price === undefined || !category) {
      return res.status(400).json({ error: "Missing required menu item fields" });
    }
    await dbRun("INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)", [
      id, name, parseFloat(price), category
    ]);
    res.status(201).json({ success: true, item: { id, name, price, category } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ error: "Missing required menu item fields" });
    }
    await dbRun("UPDATE menu_items SET name = ?, price = ?, category = ? WHERE id = ?", [
      name, parseFloat(price), category, id
    ]);
    res.json({ success: true, item: { id, name, price, category } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("DELETE FROM menu_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES ENDPOINTS
app.get('/api/sales', async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM sales_history ORDER BY timestamp DESC");
    const parsedRows = rows.map(row => ({
      ...row,
      invoiceNo: row.invoice_no,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      orderType: row.order_type,
      paymentMode: row.payment_mode,
      discountAmt: row.discount_amt,
      taxAmt: row.tax_amt,
      grandTotal: row.grand_total,
      items: JSON.parse(row.items)
    }));
    res.json(parsedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { timestamp, customerName, customerPhone, orderType, paymentMode, subtotal, discountAmt, taxAmt, grandTotal, items } = req.body;
    if (!timestamp || !items) {
      return res.status(400).json({ error: "Missing required invoice fields" });
    }

    // Determine today's date bounds for calculating order sequence
    const dateStart = new Date(timestamp);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(timestamp);
    dateEnd.setHours(23, 59, 59, 999);

    const todayOrders = await dbQuery(
      "SELECT COUNT(*) as count FROM sales_history WHERE timestamp >= ? AND timestamp <= ?",
      [dateStart.toISOString(), dateEnd.toISOString()]
    );
    
    const dailySequence = parseInt(todayOrders[0].count, 10) + 1;
    const invoiceNo = String(dailySequence);

    await dbRun(
      `INSERT INTO sales_history (
        invoice_no, timestamp, customer_name, customer_phone, order_type, 
        payment_mode, subtotal, discount_amt, tax_amt, grand_total, items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo, timestamp, customerName || "Walk-in Customer", customerPhone || "N/A", 
        orderType || "Takeaway", paymentMode || "Cash", parseFloat(subtotal), 
        parseFloat(discountAmt || 0), parseFloat(taxAmt || 0), parseFloat(grandTotal), 
        JSON.stringify(items)
      ]
    );
    res.status(201).json({ success: true, invoiceNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SETTINGS ENDPOINTS
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await dbQuery("SELECT value FROM settings WHERE key = 'config'");
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].value));
    } else {
      res.json(DEFAULT_SETTINGS);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settingsData = req.body;
    
    // Check if configuration exists
    const checkExist = await dbQuery("SELECT COUNT(*) as count FROM settings WHERE key = 'config'");
    if (checkExist[0].count > 0) {
      await dbRun("UPDATE settings SET value = ? WHERE key = 'config'", [JSON.stringify(settingsData)]);
    } else {
      await dbRun("INSERT INTO settings (key, value) VALUES ('config', ?)", [JSON.stringify(settingsData)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// RESET ENDPOINTS
app.post('/api/menu/reset', async (req, res) => {
  try {
    await dbRun("DELETE FROM menu_items");
    for (const item of DEFAULT_MENU_ITEMS) {
      await dbRun("INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)", [
        item.id, item.name, item.price, item.category
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-all', async (req, res) => {
  try {
    await dbRun("DELETE FROM menu_items");
    for (const item of DEFAULT_MENU_ITEMS) {
      await dbRun("INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)", [
        item.id, item.name, item.price, item.category
      ]);
    }
    await dbRun("DELETE FROM sales_history");
    await dbRun("DELETE FROM settings");
    await dbRun("INSERT INTO settings (key, value) VALUES ('config', ?)", [
      JSON.stringify(DEFAULT_SETTINGS)
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==========================================
// SERVING PWA STATIC WORKSPACE FILES
// ==========================================
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`Bhagwati Vadapav POS Server running on: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
