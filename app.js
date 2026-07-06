// ==========================================
// DEFAULT DATA CONFIGURATIONS
// ==========================================
const DEFAULT_MENU_ITEMS = [
  { id: "v1", name: "Vadapav", price: 20.0, category: "vadapav" },

  { id: "d1", name: "Special Tea (Chaha)", price: 10.0, category: "drinks" },

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
// STATE VARIABLES
// ==========================================
let menuItems = [];
let cart = [];
let salesHistory = [];
let settings = {};
let activeCategory = "all";
let searchQuery = "";
let historySearchQuery = "";
let historyMonthFilterQuery = "all";

// ==========================================
// DOM ELEMENT SELECTORS
// ==========================================
const DOM = {
  // Nav & Tabs
  navItems: document.querySelectorAll(".nav-item"),
  tabs: document.querySelectorAll(".tab-content"),
  pageTitle: document.getElementById("page-title"),
  sidebarTime: document.getElementById("sidebar-time"),
  sidebarDate: document.getElementById("sidebar-date"),
  headerTime: document.getElementById("header-time"),

  // POS Billing
  searchInput: document.getElementById("search-input"),
  categoryFilters: document.getElementById("category-filters"),
  productsGrid: document.getElementById("products-grid"),
  cartItems: document.getElementById("cart-items"),
  custName: document.getElementById("cust-name"),
  custPhone: document.getElementById("cust-phone"),
  summarySubtotal: document.getElementById("summary-subtotal"),
  cartDiscount: document.getElementById("cart-discount"),
  discountType: document.getElementById("discount-type"),
  gstDisplayRow: document.getElementById("gst-display-row"),
  taxLabel: document.getElementById("tax-label"),
  summaryTax: document.getElementById("summary-tax"),
  summaryTotal: document.getElementById("summary-total"),
  btnClearCart: document.getElementById("btn-clear-cart"),
  btnCheckout: document.getElementById("btn-checkout"),

  // History Tab
  metricRevenueTitle: document.getElementById("metric-revenue-title"),
  metricRevenue: document.getElementById("metric-revenue"),
  metricPaymentSplit: document.getElementById("metric-payment-split"),
  metricDineInRevenue: document.getElementById("metric-dinein-revenue"),
  metricDineInCount: document.getElementById("metric-dinein-count"),
  metricParcelRevenue: document.getElementById("metric-parcel-revenue"),
  metricParcelCount: document.getElementById("metric-parcel-count"),
  metricOrders: document.getElementById("metric-orders"),
  metricOrdersDesc: document.getElementById("metric-orders-desc"),
  salesHistoryTbody: document.getElementById("sales-history-tbody"),
  historySearch: document.getElementById("history-search"),
  historyTypeFilter: document.getElementById("history-type-filter"),
  historyMonthFilter: document.getElementById("history-month-filter"),
  btnExportSales: document.getElementById("btn-export-sales"),

  // Menu Tab
  menuItemForm: document.getElementById("menu-item-form"),
  formActionTitle: document.getElementById("form-action-title"),
  editItemId: document.getElementById("edit-item-id"),
  itemName: document.getElementById("item-name"),
  itemPrice: document.getElementById("item-price"),
  itemCategory: document.getElementById("item-category"),
  btnCancelEdit: document.getElementById("btn-cancel-edit"),
  btnSubmitItem: document.getElementById("btn-submit-item"),
  managerMenuList: document.getElementById("manager-menu-list"),

  // Settings Tab
  settingsForm: document.getElementById("settings-form"),
  settingShopName: document.getElementById("setting-shop-name"),
  settingShopTagline: document.getElementById("setting-shop-tagline"),
  settingShopAddress1: document.getElementById("setting-shop-address-1"),
  settingShopAddress2: document.getElementById("setting-shop-address-2"),
  settingShopPhone: document.getElementById("setting-shop-phone"),
  settingTaxPercent: document.getElementById("setting-tax-percent"),
  settingPaperWidth: document.getElementById("setting-paper-width"),
  settingReceiptFooter: document.getElementById("setting-receipt-footer"),
  btnResetMenu: document.getElementById("btn-reset-menu"),
  btnWipeData: document.getElementById("btn-wipe-data"),

  // Print receipt wrapper
  printReceiptContainer: document.getElementById("print-receipt-container"),

  // Mobile layouts
  cartContainer: document.getElementById("cart-container"),
  mobileCartBar: document.getElementById("mobile-cart-bar"),
  mobileCartCount: document.getElementById("mobile-cart-count"),
  mobileCartTotal: document.getElementById("mobile-cart-total"),
  btnTriggerMobileCart: document.getElementById("btn-trigger-mobile-cart"),
  btnCloseCart: document.getElementById("btn-close-cart"),

  // Login System elements
  loginOverlay: document.getElementById("login-overlay"),
  loginForm: document.getElementById("login-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginErrorMsg: document.getElementById("login-error-msg"),
  btnLogout: document.getElementById("btn-logout"),
  btnLogoutMobile: document.getElementById("btn-logout-mobile")
};

// ==========================================
// SESSION & AUTHENTICATION MANAGEMENT
// ==========================================
let sessionToken = localStorage.getItem("bv_session_token") || "";
let userRole = localStorage.getItem("bv_user_role") || "";
let userName = localStorage.getItem("bv_user_name") || "";

async function secureFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (sessionToken) {
    options.headers["Authorization"] = `Bearer ${sessionToken}`;
  }
  options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";

  try {
    const response = await fetch(url, options);
    if (response.status === 401) {
      handleLocalLogout();
    }
    return response;
  } catch (err) {
    console.error("Secure fetch error:", err);
    throw err;
  }
}

function handleLocalLogout() {
  sessionToken = "";
  userRole = "";
  userName = "";
  localStorage.removeItem("bv_session_token");
  localStorage.removeItem("bv_user_role");
  localStorage.removeItem("bv_user_name");

  // Show login screen
  if (DOM.loginOverlay) {
    DOM.loginOverlay.style.display = "flex";
  }
  // Clear inputs
  if (DOM.loginUsername) DOM.loginUsername.value = "";
  if (DOM.loginPassword) DOM.loginPassword.value = "";
  if (DOM.loginErrorMsg) DOM.loginErrorMsg.style.display = "none";
}

// ==========================================
// BACKEND DATABASE CONTROLLERS
// ==========================================
async function loadState() {
  try {
    // 1. Fetch menu items
    const resMenu = await secureFetch('/api/menu');
    if (resMenu && resMenu.ok) {
      menuItems = await resMenu.json();
    } else {
      menuItems = getLocalStorage("bv_menu_items", DEFAULT_MENU_ITEMS);
    }

    // 2. Fetch settings
    const resSettings = await secureFetch('/api/settings');
    if (resSettings && resSettings.ok) {
      settings = await resSettings.json();
    } else {
      settings = getLocalStorage("bv_settings", DEFAULT_SETTINGS);
    }

    // 3. Fetch sales history
    const resSales = await secureFetch('/api/sales');
    if (resSales && resSales.ok) {
      salesHistory = await resSales.json();
    } else {
      salesHistory = getLocalStorage("bv_sales_history", []);
    }
  } catch (err) {
    console.warn("Database API is offline. Loading cached offline values instead.", err);
    menuItems = getLocalStorage("bv_menu_items", DEFAULT_MENU_ITEMS);
    settings = getLocalStorage("bv_settings", DEFAULT_SETTINGS);
    salesHistory = getLocalStorage("bv_sales_history", []);
  }

  // Backup state to local storage cache for offline PWA operations
  saveState("bv_menu_items", menuItems);
  saveState("bv_settings", settings);
  saveState("bv_sales_history", salesHistory);

  // Sync state with UI fields
  syncSettingsToUI();

  // Re-render active views and components with the loaded data
  renderMenuGrid();
  renderCart();
  renderSalesHistory();
  renderManagerList();
}

function saveState(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getLocalStorage(key, defaultVal) {
  const data = localStorage.getItem(key);
  try {
    return data ? JSON.parse(data) : defaultVal;
  } catch (e) {
    console.error("Localstorage parsing error", e);
    return defaultVal;
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener("DOMContentLoaded", async () => {
  initTimeClock();
  initTabNavigation();
  initPOS();
  initMenuEditor();
  initSettings();
  initKeyboardShortcuts();
  initAuthListeners();

  if (sessionToken) {
    DOM.loginOverlay.style.display = "none";
    await loadState();
    applyRoleRestrictions();
  } else {
    DOM.loginOverlay.style.display = "flex";
  }
});

function applyRoleRestrictions() {
  const isCashier = userRole === "cashier";

  // Select all matching navigation buttons (desktop sidebar + mobile bottom navigation)
  const menuNavItems = Array.from(DOM.navItems).filter(el => el.getAttribute("data-tab") === "menu-tab");
  const settingsNavItems = Array.from(DOM.navItems).filter(el => el.getAttribute("data-tab") === "settings-tab");

  if (isCashier) {
    menuNavItems.forEach(el => el.style.display = "none");
    settingsNavItems.forEach(el => el.style.display = "none");

    // Switch view back to Billing just in case cashier was on hidden tabs
    switchTab("billing-tab");
  } else {
    menuNavItems.forEach(el => el.style.display = "flex");
    settingsNavItems.forEach(el => el.style.display = "flex");
  }
}

function initAuthListeners() {
  // Login Form Submission
  DOM.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    DOM.loginErrorMsg.style.display = "none";

    const username = DOM.loginUsername.value.trim();
    const password = DOM.loginPassword.value;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        sessionToken = data.token;
        userRole = data.user.role;
        userName = data.user.username;

        localStorage.setItem("bv_session_token", sessionToken);
        localStorage.setItem("bv_user_role", userRole);
        localStorage.setItem("bv_user_name", userName);

        // Hide overlay & Load state
        DOM.loginOverlay.style.display = "none";
        await loadState();
        applyRoleRestrictions();
      } else {
        DOM.loginErrorMsg.textContent = data.error || "Login failed. Please try again.";
        DOM.loginErrorMsg.style.display = "block";
      }
    } catch (err) {
      DOM.loginErrorMsg.textContent = "Server connection error. Please try again.";
      DOM.loginErrorMsg.style.display = "block";
      console.error(err);
    }
  });

  // Logout Listeners
  const logoutAction = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
    } catch (err) {
      console.error("Error communicating logout to server:", err);
    }
    handleLocalLogout();
  };

  if (DOM.btnLogout) DOM.btnLogout.addEventListener("click", logoutAction);
  if (DOM.btnLogoutMobile) DOM.btnLogoutMobile.addEventListener("click", logoutAction);
}

// ==========================================
// SYSTEM CLOCK
// ==========================================
function initTimeClock() {
  function updateTime() {
    const now = new Date();

    // Time
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    DOM.sidebarTime.textContent = `${hours}:${minutes} ${ampm}`;
    if (DOM.headerTime) {
      DOM.headerTime.textContent = `${hours}:${minutes} ${ampm}`;
    }

    // Date
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    DOM.sidebarDate.textContent = `${day}/${month}/${year}`;
  }

  updateTime();
  setInterval(updateTime, 1000 * 30); // update every 30s
}

// ==========================================
// TABS NAVIGATION
// ==========================================
function initTabNavigation() {
  DOM.navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTabId = item.dataset.tab;

      // Toggle nav buttons
      DOM.navItems.forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");

      // Toggle tabs
      DOM.tabs.forEach(tab => tab.classList.remove("active"));
      const activeTab = document.getElementById(targetTabId);
      activeTab.classList.add("active");

      // Update header title
      DOM.pageTitle.textContent = item.textContent.trim();

      // Refresh tab data
      if (targetTabId === "billing-tab") {
        renderMenuGrid();
      } else if (targetTabId === "history-tab") {
        renderSalesHistory();
      } else if (targetTabId === "menu-tab") {
        renderManagerList();
      }
    });
  });
}

// ==========================================
// POS BILLING ENGINE
// ==========================================
function initPOS() {
  renderMenuGrid();
  renderCart();

  // Search
  DOM.searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderMenuGrid(activeCategory, searchQuery);
  });

  // Category filter clicks
  DOM.categoryFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;

    // Active class toggle
    DOM.categoryFilters.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    activeCategory = btn.dataset.category;
    renderMenuGrid(activeCategory, searchQuery);
  });

  // Quantity/Delete event delegation inside cart
  DOM.cartItems.addEventListener("click", (e) => {
    const target = e.target;
    const cartItem = target.closest(".cart-item");
    if (!cartItem) return;

    const productId = cartItem.dataset.id;

    if (target.classList.contains("btn-qty-plus")) {
      changeQuantity(productId, 1);
    } else if (target.classList.contains("btn-qty-minus")) {
      changeQuantity(productId, -1);
    } else if (target.closest(".delete-item-btn")) {
      removeFromCart(productId);
    }
  });

  // Clear Cart
  DOM.btnClearCart.addEventListener("click", () => {
    if (cart.length === 0) return;
    if (confirm("Are you sure you want to clear the current order?")) {
      clearCart();
    }
  });

  // Calculate totals when discount inputs change
  DOM.cartDiscount.addEventListener("input", calculateCartTotals);
  DOM.discountType.addEventListener("change", calculateCartTotals);

  // Checkout Save & Print
  DOM.btnCheckout.addEventListener("click", triggerCheckout);

  // Mobile triggers
  DOM.btnTriggerMobileCart.addEventListener("click", () => {
    DOM.cartContainer.classList.add("open");
  });
  DOM.btnCloseCart.addEventListener("click", () => {
    DOM.cartContainer.classList.remove("open");
  });
}

function renderMenuGrid(category = "all", query = "") {
  DOM.productsGrid.innerHTML = "";

  const filtered = menuItems.filter(item => {
    const matchesCat = category === "all" || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    DOM.productsGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 1.1rem; font-weight: 500;">No items found</p>
        <span style="font-size: 0.85rem;">Try refining your search query or category filter</span>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("button");
    card.className = "product-card";
    card.setAttribute("id", `item-card-${item.id}`);
    card.innerHTML = `
      <div class="product-name">${item.name}</div>
      <div class="product-price">₹${item.price.toFixed(2)}</div>
      <div class="product-action-label">Add to order</div>
    `;
    card.addEventListener("click", () => addToCart(item.id));
    DOM.productsGrid.appendChild(card);
  });
}

function renderCart() {
  const itemsContainer = DOM.cartItems;

  // Empty state handling
  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="empty-cart-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <p>Order list is empty</p>
        <span>Add delicious Vadapavs to start</span>
      </div>
    `;
    calculateCartTotals();

    // Update mobile summary bar
    DOM.mobileCartCount.textContent = "0";
    DOM.mobileCartTotal.textContent = "₹0.00";
    DOM.mobileCartBar.classList.remove("visible");
    DOM.cartContainer.classList.remove("open");
    return;
  }

  itemsContainer.innerHTML = "";
  cart.forEach(cartItem => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.dataset.id = cartItem.product.id;
    el.innerHTML = `
      <div class="item-details">
        <div class="item-title">${cartItem.product.name}</div>
        <div class="item-subtotal">₹${(cartItem.product.price * cartItem.quantity).toFixed(2)}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn btn-qty-minus">-</button>
        <div class="qty-val">${cartItem.quantity}</div>
        <button class="qty-btn btn-qty-plus">+</button>
      </div>
      <button class="delete-item-btn" title="Remove Item">
        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;
    itemsContainer.appendChild(el);
  });

  const cartTotals = calculateCartTotals();

  // Update mobile summary bar
  let totalQty = 0;
  cart.forEach(ci => totalQty += ci.quantity);
  DOM.mobileCartCount.textContent = totalQty;
  DOM.mobileCartTotal.textContent = `₹${cartTotals.grandTotal.toFixed(2)}`;
  DOM.mobileCartBar.classList.add("visible");
}

function addToCart(productId) {
  const item = menuItems.find(p => p.id === productId);
  if (!item) return;

  const existing = cart.find(ci => ci.product.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product: item, quantity: 1 });
  }

  renderCart();
}

function changeQuantity(productId, change) {
  const itemIndex = cart.findIndex(ci => ci.product.id === productId);
  if (itemIndex === -1) return;

  cart[itemIndex].quantity += change;

  if (cart[itemIndex].quantity <= 0) {
    cart.splice(itemIndex, 1);
  }

  renderCart();
}

function removeFromCart(productId) {
  const itemIndex = cart.findIndex(ci => ci.product.id === productId);
  if (itemIndex === -1) return;
  cart.splice(itemIndex, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  DOM.custName.value = "";
  DOM.custPhone.value = "";
  DOM.cartDiscount.value = "0";
  DOM.discountType.value = "percent";

  // Reset order type selector to Dine-In
  const dineInInput = document.querySelector('input[name="order-type"][value="Dine-In"]');
  if (dineInInput) dineInInput.checked = true;

  DOM.cartContainer.classList.remove("open");
  renderCart();
}

function calculateCartTotals() {
  let subtotal = 0;
  cart.forEach(ci => {
    subtotal += ci.product.price * ci.quantity;
  });

  // Calculate discount
  let discountVal = parseFloat(DOM.cartDiscount.value) || 0;
  if (discountVal < 0) discountVal = 0;

  let discountAmt = 0;
  if (DOM.discountType.value === "percent") {
    if (discountVal > 100) discountVal = 100;
    discountAmt = subtotal * (discountVal / 100);
  } else {
    discountAmt = Math.min(discountVal, subtotal);
  }

  // Calculate Tax (GST)
  const gstRate = parseFloat(settings.taxPercent) || 0;
  const taxableAmount = subtotal - discountAmt;
  const taxAmt = taxableAmount * (gstRate / 100);

  const grandTotal = taxableAmount + taxAmt;

  // Render
  DOM.summarySubtotal.textContent = `₹${subtotal.toFixed(2)}`;
  DOM.summaryTax.textContent = `₹${taxAmt.toFixed(2)}`;
  DOM.summaryTotal.textContent = `₹${grandTotal.toFixed(2)}`;

  // GST Visibility toggle
  if (gstRate > 0) {
    DOM.gstDisplayRow.style.display = "flex";
    DOM.taxLabel.textContent = `GST (${gstRate}%)`;
  } else {
    DOM.gstDisplayRow.style.display = "none";
  }

  return {
    subtotal,
    discountVal,
    discountType: DOM.discountType.value,
    discountAmt,
    taxPercent: gstRate,
    taxAmt,
    grandTotal
  };
}

async function triggerCheckout() {
  if (cart.length === 0) {
    alert("Please add items to the cart before checking out.");
    return;
  }

  const totals = calculateCartTotals();
  const paymentMode = document.querySelector('input[name="payment-method"]:checked').value;
  const orderType = document.querySelector('input[name="order-type"]:checked').value;

  const orderData = {
    timestamp: new Date().toISOString(),
    orderType,
    customerName: DOM.custName.value.trim() || "Walk-in Customer",
    customerPhone: DOM.custPhone.value.trim() || "N/A",
    items: cart.map(ci => ({
      id: ci.product.id,
      name: ci.product.name,
      price: ci.product.price,
      quantity: ci.quantity,
      subtotal: ci.product.price * ci.quantity
    })),
    subtotal: totals.subtotal,
    discountAmt: totals.discountAmt,
    taxPercent: totals.taxPercent,
    taxAmt: totals.taxAmt,
    grandTotal: totals.grandTotal,
    paymentMode
  };

  try {
    const response = await secureFetch('/api/sales', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });

    if (response.ok) {
      const result = await response.json();
      const order = {
        ...orderData,
        invoiceNo: result.invoiceNo // Invoice number generated by the database!
      };

      // Push order & save
      salesHistory.unshift(order);
      saveState("bv_sales_history", salesHistory);

      // Print Ticket
      printReceipt(order);

      // Clear cart
      clearCart();
    } else {
      alert("Failed to save transaction to database.");
    }
  } catch (err) {
    alert("Connection error. Transaction was not saved to database.");
    console.error(err);
  }
}

// ==========================================
// THERMAL RECEIPT PRINTER LAYOUT
// ==========================================
function printReceipt(order) {
  // Dynamically inject print page size to prevent empty whitespace/margins on receipt printers
  const paperWidth = settings.paperWidth || "58mm";

  // Calculate dynamic receipt height in mm to ensure preview fits content exactly
  const baseHeight = 105; // base height in mm (logo + headers + dividers + totals + footer)
  const itemHeight = paperWidth === "80mm" ? 8 : 9.5; // average height per item row
  const hasCustomName = order.customerName && order.customerName !== "Walk-in Customer";
  const hasPhone = order.customerPhone && order.customerPhone !== "N/A";
  const customerHeight = (hasCustomName || hasPhone) ? 12 : 0;
  const totalHeightMm = baseHeight + (order.items.length * itemHeight) + customerHeight;

  let printStyleEl = document.getElementById("dynamic-print-page-style");
  if (!printStyleEl) {
    printStyleEl = document.createElement("style");
    printStyleEl.id = "dynamic-print-page-style";
    document.head.appendChild(printStyleEl);
  }
  printStyleEl.innerHTML = `
    @page {
      size: ${paperWidth} ${totalHeightMm}mm;
      margin: 0 !important;
    }
    @media print {
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      #print-receipt-container {
        padding: 2mm 3mm !important;
        margin: 0 !important;
        width: ${paperWidth} !important;
        max-width: ${paperWidth} !important;
        box-sizing: border-box !important;
      }
    }
  `;

  const paperWidthClass = settings.paperWidth === "80mm" ? "receipt-width-80mm" : "receipt-width-58mm";
  DOM.printReceiptContainer.className = paperWidthClass;

  const formattedDate = new Date(order.timestamp).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: true
  });

  // Create receipt inner content with Serial Numbers
  let itemsHtml = "";
  order.items.forEach((item, index) => {
    itemsHtml += `
      <tr>
        <td class="receipt-col-sr" style="text-align: left; font-size: 11px;">${index + 1}</td>
        <td class="receipt-col-qty" style="text-align: center; font-size: 11px;">${item.quantity}</td>
        <td class="receipt-col-desc" style="text-align: left; font-size: 11px;">${item.name}</td>
        <td class="receipt-col-price" style="text-align: right; font-size: 11px;">${item.subtotal.toFixed(2)}</td>
      </tr>
    `;
  });

  let taxHtml = "";
  if (order.taxPercent > 0) {
    taxHtml = `
      <div class="receipt-summary-row">
        <span>GST (${order.taxPercent}%):</span>
        <span>₹${order.taxAmt.toFixed(2)}</span>
      </div>
    `;
  }

  let discountHtml = "";
  if (order.discountAmt > 0) {
    discountHtml = `
      <div class="receipt-summary-row">
        <span>Discount:</span>
        <span>-₹${order.discountAmt.toFixed(2)}</span>
      </div>
    `;
  }

  // Check customer info: only show if they filled a custom name or phone
  let customerHtml = "";
  if (hasCustomName || hasPhone) {
    customerHtml = `
      <div class="receipt-customer-info">
        Customer: ${order.customerName}<br>
        ${hasPhone ? `Phone: ${order.customerPhone}` : ""}
      </div>
      <div class="receipt-divider"></div>
    `;
  }

  DOM.printReceiptContainer.innerHTML = `
    <div class="receipt-header">
      <!-- Shop Logo Image -->
      <img src="logo.png" alt="Logo" class="receipt-logo-img" style="width: 80px; height: auto; display: block; margin: 0 auto 8px auto;">
      
      <div class="receipt-shop-title">${settings.shopName}</div>
      <div class="receipt-shop-tagline" style="font-weight: bold; margin-bottom: 2px;">Very Very Tasty Tasty</div>
      <div class="receipt-shop-address">
        ${settings.address1}<br>
        ${settings.address2}
      </div>
      <div class="receipt-shop-phone">Mob: ${settings.phone}</div>
    </div>
    
    <div class="receipt-divider"></div>
    
    <div class="receipt-meta-row">
      <span>Bill No: ${order.invoiceNo}</span>
      <span>${formattedDate}</span>
    </div>
    
    <div class="receipt-divider"></div>

    ${customerHtml}
    
    <table class="receipt-table">
      <thead>
        <tr>
          <th class="receipt-col-sr" style="text-align: left; width: 10%;">Sr</th>
          <th class="receipt-col-qty" style="text-align: center; width: 15%;">Qty</th>
          <th class="receipt-col-desc" style="text-align: left; width: 50%;">Item</th>
          <th class="receipt-col-price" style="text-align: right; width: 25%;">Amt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="receipt-divider"></div>
    
    <div class="receipt-summary">
      <div class="receipt-summary-row">
        <span>Subtotal:</span>
        <span>₹${order.subtotal.toFixed(2)}</span>
      </div>
      ${discountHtml}
      ${taxHtml}
      <div class="receipt-summary-row">
        <span>Payment Mode:</span>
        <span>${order.paymentMode}</span>
      </div>
      <div class="receipt-summary-row receipt-summary-total">
        <span>NET TOTAL:</span>
        <span>₹${order.grandTotal.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="receipt-divider"></div>
    
    <div class="receipt-footer">
      ${settings.receiptFooter}
    </div>
  `;

  // Wait for logo to load before printing (ensures image renders on thermal ticket)
  const logoImg = DOM.printReceiptContainer.querySelector(".receipt-logo-img");
  if (logoImg) {
    if (logoImg.complete) {
      window.print();
    } else {
      logoImg.onload = () => window.print();
      logoImg.onerror = () => window.print();
    }
  } else {
    window.print();
  }
}

// ==========================================
// SALES HISTORY PANEL
// ==========================================
// ==========================================
// SALES HISTORY PANEL
// ==========================================
function matchesPeriodFilter(timestamp, filterValue) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return false;

  const today = new Date();

  if (filterValue === "all") {
    return true;
  }

  if (filterValue === "today") {
    return d.toDateString() === today.toDateString();
  }

  if (filterValue === "this-month") {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }

  if (filterValue === "last-month") {
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  }

  // Custom month filter like "2026-07"
  const [yearStr, monthStr] = filterValue.split("-");
  const targetYear = parseInt(yearStr, 10);
  const targetMonth = parseInt(monthStr, 10) - 1;
  return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
}

function populateMonthFilter() {
  const select = DOM.historyMonthFilter;
  if (!select) return;

  // Clear all options except standard ones
  select.innerHTML = `
    <option value="today">Today</option>
    <option value="this-month">This Month</option>
    <option value="last-month">Last Month</option>
    <option value="all">All Time</option>
  `;

  // Get unique months from history
  const months = new Set();
  salesHistory.forEach(order => {
    const d = new Date(order.timestamp);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.add(`${year}-${month}`);
    }
  });

  const sortedMonths = Array.from(months).sort().reverse(); // descending order (newest first)
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthYM = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  sortedMonths.forEach(ym => {
    if (ym === currentYM || ym === lastMonthYM) return; // Skip as they are already represented by "This Month" and "Last Month"
    const [year, monthStr] = ym.split("-");
    const monthIndex = parseInt(monthStr, 10) - 1;
    const label = `${monthNames[monthIndex]} ${year}`;

    const opt = document.createElement("option");
    opt.value = ym;
    opt.textContent = label;
    select.appendChild(opt);
  });

  // Keep the selected value
  select.value = historyMonthFilterQuery;
}

function renderSalesHistory() {
  const tbody = DOM.salesHistoryTbody;
  tbody.innerHTML = "";

  populateMonthFilter();

  // Hook up search filter
  DOM.historySearch.oninput = (e) => {
    historySearchQuery = e.target.value.toLowerCase();
    renderSalesHistoryList(historySearchQuery, DOM.historyTypeFilter.value, historyMonthFilterQuery);
  };

  // Hook up type filter
  DOM.historyTypeFilter.onchange = (e) => {
    renderSalesHistoryList(historySearchQuery, e.target.value, historyMonthFilterQuery);
  };

  // Hook up month filter
  DOM.historyMonthFilter.onchange = (e) => {
    historyMonthFilterQuery = e.target.value;
    calculateAnalytics(historyMonthFilterQuery);
    renderSalesHistoryList(historySearchQuery, DOM.historyTypeFilter.value, historyMonthFilterQuery);
  };

  // Export button
  DOM.btnExportSales.onclick = exportSalesCSV;

  calculateAnalytics(historyMonthFilterQuery);
  renderSalesHistoryList(historySearchQuery, DOM.historyTypeFilter.value, historyMonthFilterQuery);
}

function renderSalesHistoryList(query = "", typeFilter = "all", monthFilter = historyMonthFilterQuery) {
  const tbody = DOM.salesHistoryTbody;
  tbody.innerHTML = "";

  if (!query && DOM.historySearch) query = DOM.historySearch.value.toLowerCase();
  if (typeFilter === "all" && DOM.historyTypeFilter) typeFilter = DOM.historyTypeFilter.value;
  if (monthFilter === "all" && DOM.historyMonthFilter) monthFilter = DOM.historyMonthFilter.value;

  const filteredOrders = salesHistory.filter(order => {
    const matchesInv = order.invoiceNo.toLowerCase().includes(query);
    const matchesPhone = order.customerPhone.toLowerCase().includes(query);
    const matchesName = order.customerName.toLowerCase().includes(query);
    const matchesSearch = matchesInv || matchesPhone || matchesName;

    const matchesType = typeFilter === "all" || order.orderType === typeFilter;
    const matchesDate = matchesPeriodFilter(order.timestamp, monthFilter);

    return matchesSearch && matchesType && matchesDate;
  });

  if (filteredOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          No invoices are created yet.
        </td>
      </tr>
    `;
    return;
  }

  filteredOrders.forEach(order => {
    const row = document.createElement("tr");

    const formattedDate = new Date(order.timestamp).toLocaleString("en-IN", {
      dateStyle: "short",
      timeStyle: "short",
      hour12: true
    });

    // items summary
    const summaryList = order.items.map(it => `${it.name} x${it.quantity}`).join(", ");

    let paymentBadgeColor = "var(--text-muted)";
    if (order.paymentMode === "Cash") paymentBadgeColor = "var(--success-color)";
    else if (order.paymentMode === "UPI") paymentBadgeColor = "var(--accent-color)";
    else if (order.paymentMode === "Card") paymentBadgeColor = "var(--primary-color)";

    row.innerHTML = `
      <td data-label="Invoice No"><strong>${order.invoiceNo}</strong></td>
      <td data-label="Date & Time">${formattedDate}</td>
      <td data-label="Order Type">
        <span class="badge" style="background-color: ${order.orderType === "Takeaway" ? "rgba(255, 145, 0, 0.12)" : "rgba(16, 185, 129, 0.12)"}; color: ${order.orderType === "Takeaway" ? "#ff9100" : "var(--success-color)"}; border: 1px solid ${order.orderType === "Takeaway" ? "rgba(255, 145, 0, 0.25)" : "rgba(16, 185, 129, 0.25)"}; font-size: 0.75rem; display: inline-block;">
          ${order.orderType === "Takeaway" ? "Parcel" : "Dine-In"}
        </span>
      </td>
      <td data-label="Customer">
        <div style="text-align: right;">
          <div style="font-weight: 500;">${order.customerName}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${order.customerPhone}</div>
        </div>
      </td>
      <td data-label="Items Summary" class="td-items-summary" title="${summaryList}">
        ${summaryList}
      </td>
      <td data-label="Payment Mode">
        <span class="badge" style="background-color:rgba(255,255,255,0.03); color:${paymentBadgeColor}; border: 1px solid rgba(255,255,255,0.05); display: inline-block;">
          ${order.paymentMode}
        </span>
      </td>
      <td data-label="Amount"><strong>₹${order.grandTotal.toFixed(2)}</strong></td>
      <td>
        <button class="btn-icon btn-reprint" data-inv="${order.invoiceNo}" style="width: 100%; justify-content: center; padding: 0.5rem;">
          <svg class="reprint-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:14px; height:14px; margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Re-Print
        </button>
      </td>
    `;

    // reprint hook
    row.querySelector(".btn-reprint").addEventListener("click", () => {
      printReceipt(order);
    });

    tbody.appendChild(row);
  });
}

function calculateAnalytics(filterValue = historyMonthFilterQuery) {
  let periodRevenue = 0;
  let periodOrdersCount = 0;
  let upiTotal = 0;
  let cashTotal = 0;

  let dineInRevenue = 0;
  let dineInCount = 0;
  let parcelRevenue = 0;
  let parcelCount = 0;

  salesHistory.forEach(order => {
    if (matchesPeriodFilter(order.timestamp, filterValue)) {
      periodRevenue += order.grandTotal;
      periodOrdersCount += 1;

      if (order.paymentMode === "UPI") {
        upiTotal += order.grandTotal;
      } else if (order.paymentMode === "Cash") {
        cashTotal += order.grandTotal;
      }

      if (order.orderType === "Takeaway") {
        parcelRevenue += order.grandTotal;
        parcelCount += 1;
      } else {
        dineInRevenue += order.grandTotal;
        dineInCount += 1;
      }
    }
  });

  // Determine dynamic metric card descriptions
  let title = "Total Revenue";
  let ordersDesc = "Processed in selected period";

  if (filterValue === "today") {
    title = "Today's Revenue";
    ordersDesc = "Processed today";
  } else if (filterValue === "this-month") {
    title = "This Month's Revenue";
    ordersDesc = "Processed this month";
  } else if (filterValue === "last-month") {
    title = "Last Month's Revenue";
    ordersDesc = "Processed last month";
  } else if (filterValue === "all") {
    title = "All Time Revenue";
    ordersDesc = "Processed all time";
  } else {
    // format like '2026-07' -> 'July 2026'
    const [year, monthStr] = filterValue.split("-");
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = parseInt(monthStr, 10) - 1;
    title = `${monthNames[monthIndex]} ${year} Revenue`;
    ordersDesc = `Processed in ${monthNames[monthIndex]} ${year}`;
  }

  DOM.metricRevenueTitle.textContent = title;
  DOM.metricRevenue.textContent = `₹${periodRevenue.toFixed(2)}`;
  DOM.metricPaymentSplit.textContent = `Cash: ₹${cashTotal.toFixed(2)} | UPI: ₹${upiTotal.toFixed(2)}`;
  DOM.metricDineInRevenue.textContent = `₹${dineInRevenue.toFixed(2)}`;
  DOM.metricDineInCount.textContent = `${dineInCount} order${dineInCount !== 1 ? 's' : ''}`;
  DOM.metricParcelRevenue.textContent = `₹${parcelRevenue.toFixed(2)}`;
  DOM.metricParcelCount.textContent = `${parcelCount} order${parcelCount !== 1 ? 's' : ''}`;
  DOM.metricOrders.textContent = periodOrdersCount.toString();
  DOM.metricOrdersDesc.textContent = ordersDesc;
}

function exportSalesCSV() {
  if (salesHistory.length === 0) {
    alert("No sales data available to export.");
    return;
  }

  let csv = "Invoice No,Date,Order Type,Customer Name,Phone,Payment Mode,Subtotal,Discount,Tax Amount,Grand Total\n";

  salesHistory.forEach(order => {
    csv += `"${order.invoiceNo}","${new Date(order.timestamp).toLocaleString()}","${order.orderType || "Dine-In"}","${order.customerName}","${order.customerPhone}","${order.paymentMode}",${order.subtotal},${order.discountAmt},${order.taxAmt},${order.grandTotal}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `Bhagwati_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// MENU CONFIGURATION PANEL
// ==========================================
function initMenuEditor() {
  renderManagerList();

  DOM.menuItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = DOM.editItemId.value;
    const name = DOM.itemName.value.trim();
    const price = parseFloat(DOM.itemPrice.value);
    const category = DOM.itemCategory.value;

    try {
      if (id) {
        // Edit mode
        const idx = menuItems.findIndex(i => i.id === id);
        if (idx !== -1) {
          menuItems[idx] = { id, name, price, category };

          await secureFetch(`/api/menu/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, price, category })
          });
        }
      } else {
        // Add mode
        const newId = `custom-${Date.now().toString().slice(-6)}`;
        const newItem = { id: newId, name, price, category };
        menuItems.push(newItem);

        await secureFetch('/api/menu', {
          method: 'POST',
          body: JSON.stringify(newItem)
        });
      }

      saveState("bv_menu_items", menuItems);
      resetMenuForm();
      renderManagerList();
      renderMenuGrid();
    } catch (err) {
      alert("Error saving item to database.");
      console.error(err);
    }
  });

  DOM.btnCancelEdit.addEventListener("click", resetMenuForm);
}

function renderManagerList() {
  const container = DOM.managerMenuList;
  container.innerHTML = "";

  // Sort custom menu items to the top (newest first) of the editor manager list view
  const itemsForManager = [...menuItems].sort((a, b) => {
    const aIsCustom = String(a.id).startsWith("custom-");
    const bIsCustom = String(b.id).startsWith("custom-");

    if (aIsCustom && !bIsCustom) return -1;
    if (!aIsCustom && bIsCustom) return 1;

    if (aIsCustom && bIsCustom) {
      const aTime = parseInt(a.id.replace("custom-", "")) || 0;
      const bTime = parseInt(b.id.replace("custom-", "")) || 0;
      return bTime - aTime;
    }

    return 0;
  });

  itemsForManager.forEach(item => {
    const el = document.createElement("div");
    el.className = "manager-item";
    el.innerHTML = `
      <div class="manager-item-info">
        <h4>${item.name}</h4>
        <span>Category: ${item.category.toUpperCase()} | Price: ₹${item.price.toFixed(2)}</span>
      </div>
      <div class="manager-actions">
        <button class="btn-edit" data-id="${item.id}">Edit</button>
        <button class="btn-delete" data-id="${item.id}">Delete</button>
      </div>
    `;

    // Action events
    el.querySelector(".btn-edit").addEventListener("click", () => editMenuItem(item.id));
    el.querySelector(".btn-delete").addEventListener("click", () => deleteMenuItem(item.id));

    container.appendChild(el);
  });
}

function editMenuItem(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item) return;

  DOM.editItemId.value = item.id;
  DOM.itemName.value = item.name;
  DOM.itemPrice.value = item.price;
  DOM.itemCategory.value = item.category;

  DOM.formActionTitle.textContent = "Edit Menu Item";
  DOM.btnCancelEdit.style.display = "block";
  DOM.btnSubmitItem.textContent = "Update Menu Item";
}

async function deleteMenuItem(id) {
  if (confirm("Are you sure you want to delete this menu item?")) {
    try {
      menuItems = menuItems.filter(i => i.id !== id);
      await secureFetch(`/api/menu/${id}`, { method: 'DELETE' });
      saveState("bv_menu_items", menuItems);
      renderManagerList();
      renderMenuGrid();

      // Also remove from cart if present
      const inCart = cart.findIndex(ci => ci.product.id === id);
      if (inCart !== -1) {
        cart.splice(inCart, 1);
        renderCart();
      }
    } catch (err) {
      alert("Error deleting menu item from database.");
      console.error(err);
    }
  }
}

function resetMenuForm() {
  DOM.editItemId.value = "";
  DOM.menuItemForm.reset();
  DOM.formActionTitle.textContent = "Add New Menu Item";
  DOM.btnCancelEdit.style.display = "none";
  DOM.btnSubmitItem.textContent = "Save Menu Item";
}

// ==========================================
// SYSTEM SETTINGS PANEL
// ==========================================
function initSettings() {
  DOM.settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    settings.shopName = DOM.settingShopName.value.trim();
    settings.tagline = DOM.settingShopTagline.value.trim();
    settings.address1 = DOM.settingShopAddress1.value.trim();
    settings.address2 = DOM.settingShopAddress2.value.trim();
    settings.phone = DOM.settingShopPhone.value.trim();
    settings.taxPercent = parseFloat(DOM.settingTaxPercent.value) || 0;
    settings.paperWidth = DOM.settingPaperWidth.value;
    settings.receiptFooter = DOM.settingReceiptFooter.value.trim();

    try {
      await secureFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });

      saveState("bv_settings", settings);

      // Reflect changes immediately
      syncSettingsToUI();
      calculateCartTotals();

      alert("Settings saved successfully!");
    } catch (err) {
      alert("Error saving settings to database.");
      console.error(err);
    }
  });

  DOM.btnResetMenu.addEventListener("click", async () => {
    if (confirm("Reset current menu to standard default values? All custom additions will be lost!")) {
      try {
        await secureFetch('/api/menu/reset', { method: 'POST' });
        menuItems = [...DEFAULT_MENU_ITEMS];
        saveState("bv_menu_items", menuItems);
        renderManagerList();
        renderMenuGrid();
        alert("Menu reset done!");
      } catch (err) {
        alert("Error resetting menu in database.");
        console.error(err);
      }
    }
  });

  DOM.btnWipeData.addEventListener("click", async () => {
    if (confirm("CRITICAL WARNING: This will permanently wipe all sales history, custom settings, and custom menus. Proceed?")) {
      try {
        await secureFetch('/api/reset-all', { method: 'POST' });
        localStorage.clear();
        await loadState();
        cart = [];
        renderCart();
        renderMenuGrid();
        renderManagerList();
        alert("All system databases wiped and reset to factory defaults.");
      } catch (err) {
        alert("Error performing factory data wipe.");
        console.error(err);
      }
    }
  });
}

function syncSettingsToUI() {
  DOM.settingShopName.value = settings.shopName || "";
  DOM.settingShopTagline.value = settings.tagline || "";
  DOM.settingShopAddress1.value = settings.address1 || "";
  DOM.settingShopAddress2.value = settings.address2 || "";
  DOM.settingShopPhone.value = settings.phone || "";
  DOM.settingTaxPercent.value = settings.taxPercent !== undefined ? settings.taxPercent : 0;
  DOM.settingPaperWidth.value = settings.paperWidth || "58mm";
  DOM.settingReceiptFooter.value = settings.receiptFooter || "";

  // Update screen brand info dynamically
  document.querySelector(".brand-info h2").textContent = settings.shopName.split(" ")[0] || "Bhagwati";
  document.querySelector(".brand-info span").textContent = (settings.shopName.split(" ").slice(1).join(" ") || "Vadapav") + " POS";
}

// ==========================================
// HOTKEY SHORTCUTS
// ==========================================
function initKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    // Checkout: F8
    if (e.key === "F8") {
      e.preventDefault();
      triggerCheckout();
    }

    // Clear Cart: F9
    if (e.key === "F9") {
      e.preventDefault();
      if (cart.length > 0 && confirm("Clear current cart order?")) {
        clearCart();
      }
    }

    // Focus search box: ESC
    if (e.key === "Escape") {
      DOM.searchInput.value = "";
      searchQuery = "";
      renderMenuGrid(activeCategory, searchQuery);
      DOM.searchInput.focus();
    }
  });
}
