const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

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
          id VARCHAR(100) PRIMARY KEY,
          invoice_no VARCHAR(100) NOT NULL,
          created_by VARCHAR(100) NOT NULL,
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

      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(100) PRIMARY KEY,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL
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
          invoice_no TEXT NOT NULL,
          created_by TEXT NOT NULL,
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

      await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL
        )
      `);
    }

    // Migration: Migrate sales_history schema if created_by is missing
    let hasCreatedBy = false;
    try {
      if (dbType === 'postgres') {
        const checkCol = await dbQuery(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'sales_history' AND column_name = 'created_by'
        `);
        hasCreatedBy = checkCol.length > 0;
      } else {
        const tableInfo = await dbQuery("PRAGMA table_info(sales_history)");
        hasCreatedBy = tableInfo.some(col => col.name === 'created_by');
      }
    } catch (e) {
      console.log("Error checking for created_by column:", e);
    }

    if (!hasCreatedBy) {
      // Check if table exists
      let tableExists = false;
      try {
        if (dbType === 'postgres') {
          const checkTable = await dbQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'sales_history'
          `);
          tableExists = checkTable.length > 0;
        } else {
          const checkTable = await dbQuery(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='sales_history'
          `);
          tableExists = checkTable.length > 0;
        }
      } catch (e) {
        console.log("Error checking if table exists:", e);
      }

      if (tableExists) {
        console.log("Migrating sales_history schema: adding id PK and created_by columns...");
        
        // Rename the old table
        await dbRun("ALTER TABLE sales_history RENAME TO sales_history_old");
        
        // Create the new table
        if (dbType === 'postgres') {
          await dbRun(`
            CREATE TABLE sales_history (
              id VARCHAR(100) PRIMARY KEY,
              invoice_no VARCHAR(100) NOT NULL,
              created_by VARCHAR(100) NOT NULL,
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
        } else {
          await dbRun(`
            CREATE TABLE sales_history (
              id TEXT PRIMARY KEY,
              invoice_no TEXT NOT NULL,
              created_by TEXT NOT NULL,
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
        }
        
        // Copy data over
        await dbRun(`
          INSERT INTO sales_history (
            id, invoice_no, created_by, timestamp, customer_name, customer_phone,
            order_type, payment_mode, subtotal, discount_amt, tax_amt, grand_total, items
          )
          SELECT 
            invoice_no, invoice_no, 'admin', timestamp, customer_name, customer_phone,
            order_type, payment_mode, subtotal, discount_amt, tax_amt, grand_total, items
          FROM sales_history_old
        `);
        
        // Drop the old table
        await dbRun("DROP TABLE sales_history_old");
        console.log("sales_history schema migrated successfully.");
      }
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

    // Seed default users if empty
    const usersCount = await dbQuery("SELECT COUNT(*) as count FROM users");
    if (usersCount[0].count == 0) {
      console.log("Seeding default user accounts (admin/cashier)...");
      await dbRun("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [
        "admin", hashPassword("admin123"), "admin"
      ]);
      await dbRun("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [
        "cashier", hashPassword("cashier123"), "cashier"
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

const activeSessions = new Map(); // token -> { username, role }

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No token provided" });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Access Denied: Invalid or expired session" });
  }

  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Access Denied: Manager/Admin privileges required" });
  }
}

// AUTH API ENDPOINTS
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const rows = await dbQuery("SELECT * FROM users WHERE username = ?", [username.toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = rows[0];
    const incomingHash = hashPassword(password);
    if (incomingHash !== user.password_hash) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = generateToken();
    activeSessions.set(token, { username: user.username, role: user.role });

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// USER MANAGEMENT ENDPOINTS
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery("SELECT username, role FROM users ORDER BY username ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Missing required user fields" });
    }
    const normalizedUsername = username.toLowerCase().trim();
    
    // Check if username already exists
    const checkUser = await dbQuery("SELECT COUNT(*) as count FROM users WHERE username = ?", [normalizedUsername]);
    if (checkUser[0].count > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const passwordHash = hashPassword(password);
    await dbRun("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [
      normalizedUsername, passwordHash, role
    ]);
    res.status(201).json({ success: true, user: { username: normalizedUsername, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const normalizedUsername = username.toLowerCase().trim();

    // Protect default admin or current logged-in admin from being deleted
    if (normalizedUsername === req.user.username.toLowerCase()) {
      return res.status(400).json({ error: "You cannot delete your own logged-in account" });
    }
    if (normalizedUsername === 'admin') {
      return res.status(400).json({ error: "The primary 'admin' account cannot be deleted" });
    }

    await dbRun("DELETE FROM users WHERE username = ?", [normalizedUsername]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MENU ENDPOINTS
app.get('/api/menu', authenticateToken, async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM menu_items ORDER BY created_at ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', authenticateToken, requireAdmin, async (req, res) => {
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

app.put('/api/menu/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/menu/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("DELETE FROM menu_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES ENDPOINTS
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      rows = await dbQuery("SELECT * FROM sales_history ORDER BY timestamp DESC");
    } else {
      rows = await dbQuery("SELECT * FROM sales_history WHERE created_by = ? ORDER BY timestamp DESC", [req.user.username]);
    }
    const parsedRows = rows.map(row => ({
      ...row,
      invoiceNo: row.invoice_no,
      createdBy: row.created_by,
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

app.post('/api/sales', authenticateToken, async (req, res) => {
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
    
    // Generate globally unique invoice number using date prefix and daily sequence
    const dateObj = new Date(timestamp);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const invoiceNo = `${datePrefix}-${String(dailySequence).padStart(3, '0')}`;

    // Generate unique PK transaction ID for concurrency safety
    const saleId = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdBy = req.user.username;

    await dbRun(
      `INSERT INTO sales_history (
        id, invoice_no, created_by, timestamp, customer_name, customer_phone, order_type, 
        payment_mode, subtotal, discount_amt, tax_amt, grand_total, items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId, invoiceNo, createdBy, timestamp, customerName || "Walk-in Customer", customerPhone || "N/A", 
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
app.get('/api/settings', authenticateToken, async (req, res) => {
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

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
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
app.post('/api/menu/reset', authenticateToken, requireAdmin, async (req, res) => {
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

app.post('/api/reset-all', authenticateToken, requireAdmin, async (req, res) => {
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
