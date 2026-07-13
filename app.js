import supabase from './supabase.js';

const ADMIN_ID = '603de7c0-cdfd-4d54-b644-a0da48fb8da9';

// DOM Elements
const landingPage = document.getElementById('landing-page');
const authModal = document.getElementById('auth-modal');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetPasswordForm = document.getElementById('reset-password-form');
const userEmailSpan = document.getElementById('user-email');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const balanceValue = document.getElementById('balance-value');
const profitValue = document.getElementById('profit-value');
const roiValue = document.getElementById('roi-value');
const depositBalance = document.getElementById('deposit-balance');
const withdrawBalance = document.getElementById('withdraw-balance');
const activeInvestmentsContainer = document.getElementById('active-investments');
const errorMessages = document.querySelectorAll('.error-message');
const successMessages = document.querySelectorAll('.success-message');

// State
let currentWithdrawalMethod = 'usdt';
let currentWithdrawNetwork = 'bep20';
let currentAdjustUserId = null;
let countdownInterval = null;
let notificationPanelVisible = false;
let combinedHistory = [];
let currentHistoryFilter = 'all';
let currentHistoryPage = 1;
const HISTORY_PAGE_SIZE = 10;

// ========== UTILITY FUNCTIONS ==========

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.remove('show');
  }
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}

function hideAllMessages() {
  errorMessages.forEach(el => el.classList.remove('show'));
  successMessages.forEach(el => el.classList.remove('show'));
}

function showAuthForm(formId) {
  hideAllMessages();
  document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
  const target = document.getElementById(formId);
  if (target) target.classList.add('active');
}

function showAuthModal(formType = 'login') {
  authModal.classList.remove('hidden');
  if (formType === 'login') showAuthForm('login-form');
  else if (formType === 'signup') showAuthForm('signup-form');
  else if (formType === 'reset') showAuthForm('reset-password-form');
}

window.showAuthModal = showAuthModal;

function closeAuthModal() {
  authModal.classList.add('hidden');
  hideAllMessages();
}

window.closeAuthModal = closeAuthModal;

// Close modal when clicking outside
authModal?.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuthModal();
});

// ========== VIEW MANAGEMENT ==========

function setAuthenticatedView(isAuthenticated) {
  if (landingPage) landingPage.classList.toggle('hidden', isAuthenticated);
  if (authModal) authModal.classList.add('hidden');
  if (dashboardContainer) dashboardContainer.classList.toggle('hidden', !isAuthenticated);
}

function navigateTo(sectionId) {
  const sectionIds = ['home', 'trading-ai', 'deposit', 'withdraw', 'history', 'contact'];
  sectionIds.forEach(id => {
    const section = document.getElementById(`section-${id}`);
    if (section) section.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');

  const activeNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelector('.sidebar')?.classList.remove('mobile-open');

  // Load data for specific sections
  if (sectionId === 'deposit') loadDepositHistory();
  if (sectionId === 'withdraw') loadWithdrawalHistory();
  if (sectionId === 'history') loadCombinedHistory();
  if (sectionId === 'home') {
    loadRecentActivity();
    startCountdownTimers();
  }
  
  // Refresh countdown timers when navigating to trading-ai
  if (sectionId === 'trading-ai') {
    startCountdownTimers();
  }
}

window.navigateTo = navigateTo;

function toggleMobileMenu() {
  document.querySelector('.sidebar')?.classList.toggle('mobile-open');
}
window.toggleMobileMenu = toggleMobileMenu;

// ========== NOTIFICATION PANEL ==========

function toggleNotificationPanel() {
  notificationPanelVisible = !notificationPanelVisible;
  const panel = document.getElementById('notification-panel');
  if (panel) {
    panel.classList.toggle('show', notificationPanelVisible);
  }
}

window.toggleNotificationPanel = toggleNotificationPanel;

async function loadNotifications() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: notifications } = await supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');

    if (notifications && notifications.length > 0) {
      if (badge) badge.style.display = 'block';
      if (list) {
        list.innerHTML = notifications.map(n => `
          <div class="notification-item">
            <div class="notification-type">${escapeHtml(n.type || 'System')}</div>
            <div class="notification-subject">${escapeHtml(n.subject || 'Notification')}</div>
            <div class="notification-time">${formatDate(n.sent_at)}</div>
          </div>
        `).join('');
      }
    } else {
      if (badge) badge.style.display = 'none';
      if (list) list.innerHTML = '<div class="notification-empty">No notifications yet</div>';
    }
  } catch (err) {
    console.error('loadNotifications error:', err);
  }
}

window.loadNotifications = loadNotifications;

// ========== FORMATTING FUNCTIONS ==========

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusClassName(status = 'pending') {
  const normalized = String(status || 'pending').toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'active') return 'active';
  if (normalized === 'completed') return 'completed';
  return 'pending';
}

function getShortTxHash(value) {
  const hash = String(value || '').trim();
  return hash ? `${hash.slice(0, 10)}...` : 'N/A';
}

function parseWithdrawalDetails(details) {
  if (!details) return {};
  if (typeof details === 'string') {
    try { return JSON.parse(details); } catch { return {}; }
  }
  return details;
}

function getWithdrawalDetailsLabel(details, method) {
  const safe = parseWithdrawalDetails(details);
  const network = safe.network ? ` (${safe.network.toUpperCase()})` : '';
  switch (method) {
    case 'paypal':
      return safe.email || 'No PayPal email provided';
    case 'bank':
      return safe.iban ? `IBAN: ${safe.iban}` : 'No bank details provided';
    case 'usdt':
      return (safe.address || 'No USDT address provided') + network;
    case 'cashapp':
      return safe.cashtag || 'No CashApp tag provided';
    default:
      return 'N/A';
  }
}

function getDaysRemaining(endDate) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getTimeRemaining(endDate) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, total: diff };
}

function showHistoryLoading(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-loading">${escapeHtml(message)}</div>`;
}

function showHistoryEmpty(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-empty"><span class="history-empty-icon">📭</span><p>${escapeHtml(message)}</p></div>`;
}

function showHistoryError(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-error">${escapeHtml(message)}</div>`;
}

// ========== COUNTDOWN TIMER ==========

function startCountdownTimers() {
  // Clear existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Update every minute
  countdownInterval = setInterval(() => {
    updateCountdownDisplays();
  }, 60000);
  
  // Initial update
  updateCountdownDisplays();
}

function updateCountdownDisplays() {
  const countdownElements = document.querySelectorAll('.countdown-timer');
  
  countdownElements.forEach(container => {
    const investmentItem = container.closest('.investment-item');
    if (!investmentItem) return;
    
    const endDate = investmentItem.dataset.endDate;
    if (!endDate) return;
    
    const time = getTimeRemaining(endDate);
    const daysEl = container.querySelector('.countdown-days');
    const hoursEl = container.querySelector('.countdown-hours');
    const minutesEl = container.querySelector('.countdown-minutes');
    const progressBar = investmentItem.querySelector('.countdown-progress-bar');
    const statusEl = investmentItem.querySelector('.countdown-status');
    
    if (daysEl) daysEl.textContent = time.days;
    if (hoursEl) hoursEl.textContent = time.hours.toString().padStart(2, '0');
    if (minutesEl) minutesEl.textContent = time.minutes.toString().padStart(2, '0');
    
    // Update progress bar
    if (progressBar) {
      const startDate = new Date(investmentItem.dataset.startDate);
      const totalDuration = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
      const elapsed = Date.now() - startDate.getTime();
      const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      
      progressBar.style.width = `${100 - progress}%`;
      
      // Change color based on time remaining
      progressBar.classList.remove('blue', 'orange', 'green');
      if (time.days >= 7) progressBar.classList.add('blue');
      else if (time.days >= 3) progressBar.classList.add('orange');
      else progressBar.classList.add('green');
    }
    
    // Update status
    if (statusEl) {
      if (time.total <= 0) {
        statusEl.textContent = 'Processing...';
        statusEl.classList.add('processing');
      } else {
        statusEl.textContent = `${time.days}d ${time.hours}h ${time.minutes}m remaining`;
        statusEl.classList.remove('processing');
      }
    }
  });
}

// ========== BALANCE & DASHBOARD ==========

async function refreshBalanceDisplay() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    const formattedBalance = formatCurrency(profile?.balance || 0);
    if (depositBalance) depositBalance.textContent = formattedBalance;
    if (withdrawBalance) withdrawBalance.textContent = formattedBalance;
  } catch (err) {
    console.error('refreshBalanceDisplay error:', err);
  }
}

async function loadDashboard(user) {
  if (!user) return;
  try {
    userEmailSpan.textContent = user.email;
    sidebarUserEmail.textContent = user.email;

    const [{ data: profile, error: profileError }, { data: completedInvestments }, { data: activeInv }, { data: allInvestments }] = await Promise.all([
      supabase.from('profiles').select('balance').eq('id', user.id).single(),
      supabase.from('investments').select('profit').eq('user_id', user.id).eq('status', 'completed'),
      supabase.from('investments').select('*').eq('user_id', user.id).eq('status', 'active').order('end_date', { ascending: true }),
      supabase.from('investments').select('amount, status').eq('user_id', user.id)
    ]);

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('profileError', profileError);
    }

    const totalProfit = (completedInvestments || []).reduce((sum, inv) => sum + Number(inv.profit || 0), 0);
    const totalInvested = (allInvestments || []).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const overallROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const balance = Number(profile?.balance || 0);

    balanceValue.textContent = formatCurrency(balance);
    profitValue.textContent = formatCurrency(totalProfit);
    roiValue.textContent = `${overallROI.toFixed(1)}%`;

    if (depositBalance) depositBalance.textContent = formatCurrency(balance);
    if (withdrawBalance) withdrawBalance.textContent = formatCurrency(balance);

    renderActiveInvestments(activeInv || []);
  } catch (err) {
    console.error('loadDashboard error:', err);
  }
}

function renderActiveInvestments(investments) {
  if (!activeInvestmentsContainer) return;

  if (!investments.length) {
    activeInvestmentsContainer.innerHTML = '<p class="no-investments">No active investments yet. Choose a tier above to start earning!</p>';
    return;
  }

  activeInvestmentsContainer.innerHTML = investments.map(inv => {
    const time = getTimeRemaining(inv.end_date);
    const progressClass = time.days >= 7 ? 'blue' : time.days >= 3 ? 'orange' : 'green';
    const startDate = inv.start_date || new Date().toISOString();
    
    return `
      <div class="investment-item" data-end-date="${inv.end_date}" data-start-date="${startDate}">
        <div class="investment-info">
          <h4>Tier ${inv.tier}</h4>
          <div class="investment-meta">
            <span>${formatCurrency(inv.amount)}</span>
            <span>+${inv.roi_percentage}% ROI</span>
            <span>Maturity: ${formatDate(inv.end_date)}</span>
          </div>
          <div class="countdown-container">
            <div class="countdown-label">Time Remaining</div>
            <div class="countdown-timer">
              <div class="countdown-unit">
                <div class="countdown-value countdown-days">${time.days}</div>
                <div class="countdown-unit-label">Days</div>
              </div>
              <span class="countdown-separator">:</span>
              <div class="countdown-unit">
                <div class="countdown-value">${time.hours.toString().padStart(2, '0')}</div>
                <div class="countdown-unit-label">Hours</div>
              </div>
              <span class="countdown-separator">:</span>
              <div class="countdown-unit">
                <div class="countdown-value">${time.minutes.toString().padStart(2, '0')}</div>
                <div class="countdown-unit-label">Min</div>
              </div>
            </div>
            <div class="countdown-progress">
              <div class="countdown-progress-bar ${progressClass}" style="width: ${100 - ((14 - time.days) / 14 * 100)}%"></div>
            </div>
            <div class="countdown-status">${time.days}d ${time.hours}h remaining</div>
          </div>
        </div>
        <span class="status-badge status-active">Active</span>
      </div>
    `;
  }).join('');
  
  // Start countdown timers
  startCountdownTimers();
}

async function loadRecentActivity() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  showHistoryLoading(container, 'Loading recent activity...');

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      showHistoryEmpty(container, 'Please sign in to view recent activity.');
      return;
    }

    const [{ data: deposits }, { data: withdrawals }, { data: investments }] = await Promise.all([
      supabase.from('deposits').select('id, amount, status, created_at, transaction_hash, chain').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('withdrawals').select('id, amount, status, created_at, method').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('investments').select('amount, status, roi_percentage, end_date, tier').eq('user_id', user.id).order('start_date', { ascending: false }).limit(3)
    ]);

    const activity = [
      ...(deposits || []).map(item => ({ type: 'deposit', amount: item.amount, status: item.status, created_at: item.created_at, label: `Deposit • ${item.chain?.toUpperCase() || 'BSC'}` })),
      ...(withdrawals || []).map(item => ({ type: 'withdrawal', amount: item.amount, status: item.status, created_at: item.created_at, label: `Withdrawal • ${item.method?.toUpperCase() || 'USDT'}` })),
      ...(investments || []).map(item => ({ type: 'investment', amount: item.amount, status: item.status, created_at: item.end_date, label: `Investment • Tier ${item.tier}` }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    if (!activity.length) {
      showHistoryEmpty(container, 'No recent activity yet.');
      return;
    }

    container.innerHTML = activity.map(item => `
      <div class="history-item">
        <div>
          <div class="history-amount" style="color: ${item.type === 'deposit' ? 'var(--profit-green)' : item.type === 'withdrawal' ? 'var(--danger-red)' : 'var(--accent-gold)'}">${item.type === 'deposit' ? '+' : item.type === 'withdrawal' ? '-' : '•'}${formatCurrency(item.amount)}</div>
          <div class="history-date">${formatDate(item.created_at)}</div>
          <div class="history-method">${escapeHtml(item.label)}</div>
        </div>
        <span class="status-badge status-${getStatusClassName(item.status)}">${escapeHtml(item.status || 'pending')}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadRecentActivity error:', err);
    showHistoryError(container, 'Unable to load recent activity: ' + (err.message || 'Unknown error'));
  }
}

// ========== COMBINED HISTORY ==========

async function loadCombinedHistory() {
  const container = document.getElementById('combined-history-list');
  if (!container) return;

  showHistoryLoading(container, 'Loading transaction history...');

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      showHistoryEmpty(container, 'Please sign in to view transaction history.');
      return;
    }

    const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    combinedHistory = [
      ...(deposits || []).map(d => ({
        id: d.id,
        type: 'deposit',
        amount: d.amount,
        status: d.status,
        created_at: d.created_at,
        method: d.chain || 'bsc',
        txHash: d.transaction_hash,
        details: d
      })),
      ...(withdrawals || []).map(w => ({
        id: w.id,
        type: 'withdrawal',
        amount: w.amount,
        status: w.status,
        created_at: w.created_at,
        method: w.method,
        details: w.details,
        txHash: null
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderCombinedHistory();
  } catch (err) {
    console.error('loadCombinedHistory error:', err);
    showHistoryError(container, 'Error loading history: ' + (err.message || 'Unknown error'));
  }
}

function filterHistory(filter) {
  currentHistoryFilter = filter;
  currentHistoryPage = 1;
  
  // Update tab active state
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  
  renderCombinedHistory();
}

window.filterHistory = filterHistory;

function renderCombinedHistory() {
  const container = document.getElementById('combined-history-list');
  const pagination = document.getElementById('history-pagination');
  if (!container) return;

  const filtered = currentHistoryFilter === 'all' 
    ? combinedHistory 
    : combinedHistory.filter(h => h.type === currentHistoryFilter);

  if (!filtered.length) {
    showHistoryEmpty(container, currentHistoryFilter === 'all' 
      ? 'No transactions yet. Make your first deposit to get started!' 
      : `No ${currentHistoryFilter === 'deposit' ? 'deposits' : 'withdrawals'} yet.`);
    if (pagination) pagination.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filtered.length / HISTORY_PAGE_SIZE);
  const start = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const end = start + HISTORY_PAGE_SIZE;
  const pageItems = filtered.slice(start, end);

  container.innerHTML = `
    <div class="table-responsive">
      <table class="transaction-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Network/Method</th>
            <th>TX Hash</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.map(item => `
            <tr>
              <td>
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.25rem;">${item.type === 'deposit' ? '↓' : '↑'}</span>
                  <span style="text-transform: capitalize;">${item.type}</span>
                </span>
              </td>
              <td style="color: ${item.type === 'deposit' ? 'var(--profit-green)' : 'var(--danger-red)'}; font-weight: 600;">
                ${item.type === 'deposit' ? '+' : '-'}${formatCurrency(item.amount)}
              </td>
              <td>
                ${item.type === 'deposit' 
                  ? `<span class="chain-badge chain-${(item.method || 'bsc').toLowerCase()}">${(item.method || 'BSC').toUpperCase()}</span>`
                  : `<span style="text-transform: capitalize;">${item.method || 'USDT'}</span>`
                }
              </td>
              <td>${item.txHash ? escapeHtml(getShortTxHash(item.txHash)) : '-'}</td>
              <td><span class="status-badge status-${getStatusClassName(item.status)}">${escapeHtml((item.status || 'pending').toUpperCase())}</span></td>
              <td>${formatDateTime(item.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Render pagination
  if (pagination) {
    if (totalPages > 1) {
      pagination.innerHTML = `
        <button class="btn btn-secondary btn-sm" ${currentHistoryPage === 1 ? 'disabled' : ''} onclick="goToHistoryPage(${currentHistoryPage - 1})">Previous</button>
        <span style="padding: 0 16px; color: var(--text-muted);">Page ${currentHistoryPage} of ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" ${currentHistoryPage === totalPages ? 'disabled' : ''} onclick="goToHistoryPage(${currentHistoryPage + 1})">Next</button>
      `;
    } else {
      pagination.innerHTML = '';
    }
  }
}

function goToHistoryPage(page) {
  currentHistoryPage = page;
  renderCombinedHistory();
}

window.goToHistoryPage = goToHistoryPage;

// ========== DEPOSIT FUNCTIONS ==========

async function loadDepositHistory() {
  const container = document.getElementById('deposit-history');
  if (!container) return;

  showHistoryLoading(container, 'Loading your deposit history...');

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      showHistoryError(container, 'Authentication error: ' + userError.message);
      return;
    }

    if (!user) {
      showHistoryEmpty(container, 'Please sign in to view your deposit history.');
      return;
    }

    const { data: deposits, error } = await supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      showHistoryError(container, 'Error: ' + error.message);
      return;
    }

    if (!deposits || deposits.length === 0) {
      showHistoryEmpty(container, 'No deposit transactions yet.');
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="transaction-table">
          <thead><tr><th>Amount</th><th>Network</th><th>TX Hash</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${deposits.map(deposit => `
              <tr>
                <td style="color: var(--profit-green); font-weight: 600;">+${formatCurrency(deposit.amount)}</td>
                <td><span class="chain-badge chain-${escapeHtml((deposit.chain || 'bsc').toLowerCase())}">${escapeHtml((deposit.chain || 'BSC').toUpperCase())}</span></td>
                <td>${escapeHtml(getShortTxHash(deposit.transaction_hash))}</td>
                <td><span class="status-badge status-${getStatusClassName(deposit.status)}">${escapeHtml((deposit.status || 'pending').toUpperCase())}</span></td>
                <td>${formatDateTime(deposit.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('loadDepositHistory error:', err);
    showHistoryError(container, 'Unexpected error loading deposits: ' + (err.message || 'Unknown error'));
  }
}

window.loadDepositHistory = loadDepositHistory;

async function loadWithdrawalHistory() {
  const container = document.getElementById('withdrawal-history');
  if (!container) return;

  showHistoryLoading(container, 'Loading your withdrawal history...');

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      showHistoryError(container, 'Authentication error: ' + userError.message);
      return;
    }

    if (!user) {
      showHistoryEmpty(container, 'Please sign in to view your withdrawal history.');
      return;
    }

    const { data: withdrawals, error } = await supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      showHistoryError(container, 'Error: ' + error.message);
      return;
    }

    if (!withdrawals || withdrawals.length === 0) {
      showHistoryEmpty(container, 'No withdrawal transactions yet.');
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="transaction-table">
          <thead><tr><th>Amount</th><th>Method</th><th>Details</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${withdrawals.map(withdrawal => `
              <tr>
                <td style="color: var(--danger-red); font-weight: 600;">-${formatCurrency(withdrawal.amount)}</td>
                <td style="text-transform: capitalize;">${escapeHtml(withdrawal.method || 'usdt')}</td>
                <td>${escapeHtml(getWithdrawalDetailsLabel(withdrawal.details, withdrawal.method))}</td>
                <td><span class="status-badge status-${getStatusClassName(withdrawal.status)}">${escapeHtml((withdrawal.status || 'pending').toUpperCase())}</span></td>
                <td>${formatDateTime(withdrawal.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('loadWithdrawalHistory error:', err);
    showHistoryError(container, 'Unexpected error loading withdrawals: ' + (err.message || 'Unknown error'));
  }
}

window.loadWithdrawalHistory = loadWithdrawalHistory;

// ========== NETWORK & METHOD SELECTION ==========

function selectWithdrawalMethod(method) {
  currentWithdrawalMethod = method;
  
  document.querySelectorAll('.method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  
  document.querySelectorAll('.method-details').forEach(detail => {
    detail.style.display = 'none';
  });
  
  const detailEl = document.getElementById(`method-details-${method}`);
  if (detailEl) detailEl.style.display = 'block';
  
  // Show/hide network sub-option for USDT
  const networkOption = document.getElementById('usdt-network-option');
  if (networkOption) {
    networkOption.classList.toggle('show', method === 'usdt');
  }
}

window.selectWithdrawalMethod = selectWithdrawalMethod;

function selectWithdrawNetwork(network) {
  currentWithdrawNetwork = network;
  
  document.querySelectorAll('#usdt-network-option .network-sub-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.network === network);
  });
  
  // Update placeholder text
  const addressLabel = document.getElementById('usdt-address-label');
  const addressInput = document.getElementById('usdt-address');
  
  if (addressLabel) {
    addressLabel.textContent = network === 'trc20' ? 'USDT (TRC-20) Address' : 'USDT (BEP-20) Address';
  }
  
  if (addressInput) {
    addressInput.placeholder = network === 'trc20' ? 'Tron (TRC-20) wallet address' : '0x...';
  }
}

window.selectWithdrawNetwork = selectWithdrawNetwork;

function selectNetwork(network = 'bsc') {
  document.getElementById('selected-network').value = network;
  
  document.querySelectorAll('.network-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.network === network);
  });
  
  document.querySelectorAll('.network-info').forEach(info => {
    info.classList.toggle('active', info.id === `network-${network}`);
  });
}

window.selectNetwork = selectNetwork;

function copyDepositAddress(network = 'bsc') {
  const address = network === 'bsc' 
    ? '0xbe438a2c7fe9bb534a8b8d06c96e42e9b6620812'
    : 'TEmM5aKQTcwQSdnZMGXMeEJMHB6Ko7noqJ';
  
  navigator.clipboard.writeText(address).then(() => {
    // Could add a toast notification here
    alert('Address copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

window.copyDepositAddress = copyDepositAddress;

// ========== INVESTMENT FUNCTION ==========

async function invest(tier) {
  const amountInput = document.getElementById(`amount-tier-${tier}`);
  if (!amountInput) return;
  
  const amount = Number(amountInput.value);
  
  // Tier validation
  const tierLimits = {
    1: { min: 100, max: 499 },
    2: { min: 500, max: 3999 },
    3: { min: 4000, max: 9999 },
    4: { min: 10000, max: Infinity }
  };
  
  const limits = tierLimits[tier];
  if (!limits || amount < limits.min || amount > limits.max) {
    alert(`Please enter a valid amount for Tier ${tier} ($${limits.min}${limits.max === Infinity ? '+' : ' - $' + limits.max})`);
    return;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAuthModal('login');
      return;
    }
    
    // Check balance
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    if (Number(profile?.balance || 0) < amount) {
      alert('Insufficient balance. Please deposit more funds.');
      return;
    }
    
    const { error } = await supabase.rpc('create_investment', {
      p_user_id: user.id,
      p_tier: tier,
      p_amount: amount
    });
    
    if (error) {
      alert('Investment failed: ' + error.message);
      return;
    }
    
    alert('Investment successful! Your funds have been allocated to Tier ' + tier + '.');
    amountInput.value = '';
    
    // Refresh dashboard
    await loadDashboard(user);
    await loadRecentActivity();
    
  } catch (err) {
    console.error('Invest error:', err);
    alert('Investment failed: ' + (err.message || 'Unknown error'));
  }
}

window.invest = invest;

// ========== DEPOSIT SUBMIT ==========

async function handleDepositSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('deposit-message');
  msgEl.className = 'transaction-message';
  msgEl.textContent = '';
  
  const amount = Number(document.getElementById('deposit-amount').value);
  const txHash = document.getElementById('deposit-txhash').value.trim();
  const chain = document.getElementById('selected-network').value || 'bsc';
  
  if (!amount || amount <= 0) {
    showDepositMessage('Please enter a valid amount', 'error');
    return;
  }
  
  if (!txHash) {
    showDepositMessage('Please enter the transaction hash', 'error');
    return;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAuthModal('login');
      return;
    }
    
    const { error } = await supabase.rpc('submit_deposit', {
      p_user_id: user.id,
      p_amount: amount,
      p_transaction_hash: txHash,
      p_chain: chain
    });
    
    if (error) {
      showDepositMessage(error.message, 'error');
      return;
    }
    
    showDepositMessage('Deposit submitted successfully! It will be reviewed shortly.', 'success');
    e.target.reset();
    
    await loadDepositHistory();
    await loadDashboard(user);
    
  } catch (err) {
    console.error('handleDepositSubmit error:', err);
    showDepositMessage('Failed to submit deposit: ' + (err.message || 'Unknown error'), 'error');
  }
}

function showDepositMessage(message, type) {
  const msgEl = document.getElementById('deposit-message');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `transaction-message ${type}`;
  }
}

// ========== WITHDRAWAL SUBMIT ==========

async function handleWithdrawalSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('withdraw-message');
  msgEl.className = 'transaction-message';
  msgEl.textContent = '';
  
  const amount = Number(document.getElementById('withdraw-amount').value);
  
  if (!amount || amount <= 0) {
    showWithdrawMessage('Please enter a valid amount', 'error');
    return;
  }
  
  // Get method-specific details
  let details = {};
  
  switch (currentWithdrawalMethod) {
    case 'paypal':
      details.email = document.getElementById('paypal-email')?.value.trim();
      if (!details.email) {
        showWithdrawMessage('Please enter your PayPal email', 'error');
        return;
      }
      break;
    case 'bank':
      details.iban = document.getElementById('bank-iban')?.value.trim();
      details.bic = document.getElementById('bank-bic')?.value.trim();
      if (!details.iban) {
        showWithdrawMessage('Please enter your IBAN', 'error');
        return;
      }
      break;
    case 'usdt':
      details.address = document.getElementById('usdt-address')?.value.trim();
      details.network = currentWithdrawNetwork;
      if (!details.address) {
        showWithdrawMessage('Please enter your USDT wallet address', 'error');
        return;
      }
      break;
    case 'cashapp':
      details.cashtag = document.getElementById('cashapp-cashtag')?.value.trim();
      if (!details.cashtag) {
        showWithdrawMessage('Please enter your CashApp $Cashtag', 'error');
        return;
      }
      break;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAuthModal('login');
      return;
    }
    
    // Check balance
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    if (Number(profile?.balance || 0) < amount) {
      showWithdrawMessage('Insufficient balance', 'error');
      return;
    }
    
    const { error } = await supabase.rpc('request_withdrawal', {
      p_user_id: user.id,
      p_amount: amount,
      p_method: currentWithdrawalMethod,
      p_details: details
    });
    
    if (error) {
      showWithdrawMessage(error.message, 'error');
      return;
    }
    
    showWithdrawMessage('Withdrawal request submitted successfully!', 'success');
    e.target.reset();
    
    await loadWithdrawalHistory();
    await loadDashboard(user);
    
  } catch (err) {
    console.error('handleWithdrawalSubmit error:', err);
    showWithdrawMessage('Failed to submit withdrawal: ' + (err.message || 'Unknown error'), 'error');
  }
}

function showWithdrawMessage(message, type) {
  const msgEl = document.getElementById('withdraw-message');
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = `transaction-message ${type}`;
  }
}

// ========== EVENT LISTENERS ==========

function attachUserListeners() {
  // Auth form navigation
  document.getElementById('show-signup')?.addEventListener('click', () => showAuthForm('signup-form'));
  document.getElementById('show-login')?.addEventListener('click', () => showAuthForm('login-form'));
  document.getElementById('show-reset-password')?.addEventListener('click', () => showAuthForm('reset-password-form'));
  document.getElementById('back-to-login')?.addEventListener('click', () => showAuthForm('login-form'));
  
  // Signup form
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();
    
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm-password').value;
    
    if (!email || !password) return showError('signup-error', 'Please fill in all fields');
    if (password.length < 6) return showError('signup-error', 'Password must be at least 6 characters');
    if (password !== confirm) return showError('signup-error', 'Passwords do not match');
    
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return showError('signup-error', error.message);
    showSuccess('signup-success', 'Account created! Check your email to confirm your account.');
    signupForm.reset();
  });
  
  // Login form
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return showError('login-error', 'Please fill in all fields');
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return showError('login-error', error.message);
    
    const sessionUser = data?.user;
    if (sessionUser) {
      const { data: profile } = await supabase.from('profiles').select('status').eq('id', sessionUser.id).single();
      if (profile?.status === 'frozen') {
        await supabase.auth.signOut();
        return showError('login-error', 'This account has been frozen. Please contact support.');
      }
    }
  });
  
  // Reset password form
  resetPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();
    
    const email = document.getElementById('reset-email').value.trim();
    if (!email) return showError('reset-error', 'Please enter your email address');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?reset=true' });
    if (error) return showError('reset-error', error.message);
    showSuccess('reset-success', 'Password reset email sent! Check your inbox.');
    resetPasswordForm.reset();
  });
  
  // Form submissions
  document.getElementById('deposit-form')?.addEventListener('submit', handleDepositSubmit);
  document.getElementById('withdraw-form')?.addEventListener('submit', handleWithdrawalSubmit);
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
  });
}

async function initUserDashboard() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('getUser error:', error);
    setAuthenticatedView(false);
    return;
  }

  if (!user) {
    setAuthenticatedView(false);
    return;
  }

  const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single();
  if (profile?.status === 'frozen') {
    await supabase.auth.signOut();
    setAuthenticatedView(false);
    showError('login-error', 'This account has been frozen. Please contact support.');
    return;
  }

  setAuthenticatedView(true);
  await loadDashboard(user);
  await loadRecentActivity();
  await loadNotifications();
  startCountdownTimers();
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    setAuthenticatedView(true);
    await loadDashboard(session.user);
    await loadRecentActivity();
    await loadNotifications();
    startCountdownTimers();
  }

  if (event === 'SIGNED_OUT') {
    setAuthenticatedView(false);
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  }
});

// ========== ADMIN FUNCTIONS ==========

function attachAdminListeners() {
  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError('admin-auth-error', error.message);
      return;
    }

    const user = data?.user;
    if (user?.id !== ADMIN_ID) {
      document.getElementById('admin-auth-view').classList.add('hidden');
      document.getElementById('admin-denied').classList.remove('hidden');
      return;
    }

    document.getElementById('admin-auth-view').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    await loadAdminDashboard();
  });

  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-auth-view').classList.remove('hidden');
  });

  document.querySelectorAll('.nav-item[data-admin-section]').forEach(link => {
    link.addEventListener('click', async () => {
      const section = link.dataset.adminSection;
      document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
      document.querySelectorAll('.nav-item[data-admin-section]').forEach(item => item.classList.remove('active'));
      document.getElementById(`admin-${section}`)?.classList.add('active');
      link.classList.add('active');
    });
  });

  document.getElementById('confirm-adjustment')?.addEventListener('click', async () => {
    const amount = Number(document.getElementById('admin-adjust-amount').value || 0);
    const reason = document.getElementById('admin-adjust-reason').value.trim();
    if (!currentAdjustUserId || !amount || !reason) return;

    const { error } = await supabase.rpc('adjust_balance', {
      target_id: currentAdjustUserId,
      adj_amount: amount,
      reason
    });

    if (error) {
      alert('Adjust balance failed: ' + error.message);
      return;
    }

    document.getElementById('balance-adjustment-modal').classList.add('hidden');
    await loadAdminDashboard();
  });

  document.getElementById('cancel-adjustment')?.addEventListener('click', () => {
    document.getElementById('balance-adjustment-modal').classList.add('hidden');
  });
}

async function loadAdminDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== ADMIN_ID) {
    document.getElementById('admin-auth-view')?.classList.remove('hidden');
    document.getElementById('admin-dashboard')?.classList.add('hidden');
    return;
  }

  const [{ data: users }, { data: deposits }, { data: withdrawals }, { data: investments }] = await Promise.all([
    supabase.rpc('get_all_users'),
    supabase.rpc('get_all_deposits'),
    supabase.rpc('get_all_withdrawals'),
    supabase.rpc('get_all_investments')
  ]);

  const adminTotalUsers = document.getElementById('admin-total-users');
  const adminTotalDeposits = document.getElementById('admin-total-deposits');
  const adminTotalWithdrawals = document.getElementById('admin-total-withdrawals');
  const adminActiveInvestments = document.getElementById('admin-active-investments');

  if (adminTotalUsers) adminTotalUsers.textContent = users?.length || 0;
  if (adminTotalDeposits) adminTotalDeposits.textContent = deposits?.length || 0;
  if (adminTotalWithdrawals) adminTotalWithdrawals.textContent = withdrawals?.length || 0;
  if (adminActiveInvestments) adminActiveInvestments.textContent = (investments || []).filter(inv => inv.status === 'active').length;

  renderAdminUsers(users || []);
  renderAdminDeposits(deposits || []);
  renderAdminWithdrawals(withdrawals || []);
  renderAdminInvestments(investments || []);
}

function renderAdminUsers(users) {
  const container = document.getElementById('admin-users-table');
  if (!container) return;

  if (!users.length) {
    container.innerHTML = '<p class="empty-state">No users found.</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="transaction-table">
        <thead><tr><th>Email</th><th>Balance</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${escapeHtml(user.email || user.id)}</td>
              <td>${formatCurrency(user.balance || 0)}</td>
              <td><span class="status-badge status-${getStatusClassName(user.status)}">${escapeHtml(user.status || 'active')}</span></td>
              <td>${formatDate(user.created_at)}</td>
              <td>
                <button class="btn btn-secondary btn-sm btn-freeze" data-user-id="${user.id}" data-status="${user.status || 'active'}" type="button">${user.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</button>
                <button class="btn btn-secondary btn-sm btn-adjust" data-user-id="${user.id}" type="button">Adjust</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.btn-freeze').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.userId;
      const active = btn.dataset.status === 'frozen' ? 'unfreeze_user' : 'freeze_user';
      const { error } = await supabase.rpc(active, { target_id: targetId });
      if (error) {
        alert('Action failed: ' + error.message);
        return;
      }
      await loadAdminDashboard();
    });
  });

  container.querySelectorAll('.btn-adjust').forEach(btn => {
    btn.addEventListener('click', () => {
      currentAdjustUserId = btn.dataset.userId;
      document.getElementById('balance-adjustment-modal').classList.remove('hidden');
    });
  });
}

function renderAdminDeposits(deposits) {
  const container = document.getElementById('admin-deposits-table');
  if (!container) return;
  if (!deposits.length) {
    container.innerHTML = '<p class="empty-state">No deposits yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="transaction-table">
        <thead><tr><th>User</th><th>Amount</th><th>TX Hash</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${deposits.map(item => `
            <tr>
              <td>${escapeHtml(item.email || item.user_id)}</td>
              <td>${formatCurrency(item.amount)}</td>
              <td>${escapeHtml(getShortTxHash(item.transaction_hash))}</td>
              <td>${formatDate(item.created_at)}</td>
              <td><span class="status-badge status-${getStatusClassName(item.status)}">${escapeHtml(item.status || 'pending')}</span></td>
              <td>
                <button class="btn btn-secondary btn-sm btn-approve-deposit" data-id="${item.id}" type="button">Approve</button>
                <button class="btn btn-secondary btn-sm btn-reject-deposit" data-id="${item.id}" type="button">Reject</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.btn-approve-deposit').forEach(btn => btn.addEventListener('click', async () => {
    const { error } = await supabase.rpc('approve_deposit', { deposit_id: Number(btn.dataset.id) });
    if (error) alert('Approve failed: ' + error.message);
    else await loadAdminDashboard();
  }));

  container.querySelectorAll('.btn-reject-deposit').forEach(btn => btn.addEventListener('click', async () => {
    const { error } = await supabase.rpc('reject_deposit', { deposit_id: Number(btn.dataset.id) });
    if (error) alert('Reject failed: ' + error.message);
    else await loadAdminDashboard();
  }));
}

function renderAdminWithdrawals(withdrawals) {
  const container = document.getElementById('admin-withdrawals-table');
  if (!container) return;
  if (!withdrawals.length) {
    container.innerHTML = '<p class="empty-state">No withdrawals yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="transaction-table">
        <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Details</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${withdrawals.map(item => `
            <tr>
              <td>${escapeHtml(item.email || item.user_id)}</td>
              <td>${formatCurrency(item.amount)}</td>
              <td>${escapeHtml(item.method || 'usdt')}</td>
              <td>${escapeHtml(getWithdrawalDetailsLabel(item.details, item.method))}</td>
              <td>${formatDate(item.created_at)}</td>
              <td><span class="status-badge status-${getStatusClassName(item.status)}">${escapeHtml(item.status || 'pending')}</span></td>
              <td>
                <button class="btn btn-secondary btn-sm btn-approve-withdrawal" data-id="${item.id}" type="button">Approve</button>
                <button class="btn btn-secondary btn-sm btn-reject-withdrawal" data-id="${item.id}" type="button">Reject</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll('.btn-approve-withdrawal').forEach(btn => btn.addEventListener('click', async () => {
    const { error } = await supabase.rpc('approve_withdrawal', { withdrawal_id: Number(btn.dataset.id) });
    if (error) alert('Approve failed: ' + error.message);
    else await loadAdminDashboard();
  }));

  container.querySelectorAll('.btn-reject-withdrawal').forEach(btn => btn.addEventListener('click', async () => {
    const { error } = await supabase.rpc('reject_withdrawal', { withdrawal_id: Number(btn.dataset.id) });
    if (error) alert('Reject failed: ' + error.message);
    else await loadAdminDashboard();
  }));
}

function renderAdminInvestments(investments) {
  const container = document.getElementById('admin-investments-table');
  if (!container) return;
  if (!investments.length) {
    container.innerHTML = '<p class="empty-state">No investments found.</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="transaction-table">
        <thead><tr><th>User</th><th>Tier</th><th>Amount</th><th>ROI</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
        <tbody>
          ${investments.map(item => `
            <tr>
              <td>${escapeHtml(item.email || item.user_id)}</td>
              <td>${escapeHtml(item.tier)}</td>
              <td>${formatCurrency(item.amount)}</td>
              <td>${escapeHtml(item.roi_percentage)}%</td>
              <td>${formatDate(item.start_date)}</td>
              <td>${formatDate(item.end_date)}</td>
              <td><span class="status-badge status-${getStatusClassName(item.status)}">${escapeHtml(item.status || 'active')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ========== BOOT ==========

async function boot() {
  attachUserListeners();

  if (document.body.dataset.page === 'admin') {
    attachAdminListeners();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === ADMIN_ID) {
      document.getElementById('admin-auth-view')?.classList.add('hidden');
      document.getElementById('admin-dashboard')?.classList.remove('hidden');
      await loadAdminDashboard();
    }
    return;
  }

  await initUserDashboard();
}

boot();
