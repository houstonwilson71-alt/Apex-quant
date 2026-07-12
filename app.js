import supabase from './supabase.js';

const ADMIN_ID = '603de7c0-cdfd-4d54-b644-a0da48fb8da9';

const authContainer = document.getElementById('auth-container');
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

let currentWithdrawalMethod = 'usdt';
let currentAdjustUserId = null;

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

function setAuthenticatedView(isAuthenticated) {
  if (authContainer) authContainer.classList.toggle('hidden', isAuthenticated);
  if (dashboardContainer) dashboardContainer.classList.toggle('hidden', !isAuthenticated);
}

function navigateTo(sectionId) {
  const sectionIds = ['home', 'trading-ai', 'deposit', 'withdraw', 'contact'];
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

  if (sectionId === 'deposit') loadDepositHistory();
  if (sectionId === 'withdraw') loadWithdrawalHistory();
  if (sectionId === 'home') loadRecentActivity();
}

window.navigateTo = navigateTo;

function toggleMobileMenu() {
  document.querySelector('.sidebar')?.classList.toggle('mobile-open');
}
window.toggleMobileMenu = toggleMobileMenu;

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
  switch (method) {
    case 'paypal':
      return safe.email || 'No PayPal email provided';
    case 'bank':
      return safe.iban ? `IBAN: ${safe.iban}` : 'No bank details provided';
    case 'usdt':
      return safe.address || 'No USDT address provided';
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

function showHistoryLoading(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-loading">${escapeHtml(message)}</div>`;
}

function showHistoryEmpty(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-empty">${escapeHtml(message)}</div>`;
}

function showHistoryError(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="history-state history-error">${escapeHtml(message)}</div>`;
}

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
    const days = getDaysRemaining(inv.end_date);
    return `<div class="investment-item">
      <span class="investment-tier">Tier ${inv.tier}</span>
      <span class="investment-amount">${formatCurrency(inv.amount)}</span>
      <span class="investment-roi">+${inv.roi_percentage}% ROI</span>
      <span class="investment-maturity">${formatDate(inv.end_date)}</span>
      <span class="investment-countdown ${days <= 3 ? 'soon' : ''}">${days} days left</span>
    </div>`;
  }).join('');
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
          <div class="history-amount">${item.type === 'deposit' ? '+' : item.type === 'withdrawal' ? '-' : '•'}${formatCurrency(item.amount)}</div>
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
                <td>${formatCurrency(deposit.amount)}</td>
                <td><span class="chain-badge ${escapeHtml((deposit.chain || 'bsc').toLowerCase())}">${escapeHtml((deposit.chain || 'bsc').toUpperCase())}</span></td>
                <td>${escapeHtml(getShortTxHash(deposit.transaction_hash))}</td>
                <td><span class="status-badge status-${getStatusClassName(deposit.status)}">${escapeHtml((deposit.status || 'pending').toUpperCase())}</span></td>
                <td>${formatDate(deposit.created_at)}</td>
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
                <td>${formatCurrency(withdrawal.amount)}</td>
                <td>${escapeHtml((withdrawal.method || 'usdt').toUpperCase())}</td>
                <td>${escapeHtml(getWithdrawalDetailsLabel(withdrawal.details, withdrawal.method))}</td>
                <td><span class="status-badge status-${getStatusClassName(withdrawal.status)}">${escapeHtml((withdrawal.status || 'pending').toUpperCase())}</span></td>
                <td>${formatDate(withdrawal.created_at)}</td>
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

function selectWithdrawalMethod(method) {
  currentWithdrawalMethod = method;
  document.querySelectorAll('.method-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.method === method));
  document.querySelectorAll('.method-details').forEach(div => div.style.display = 'none');
  const target = document.getElementById(`method-details-${method}`);
  if (target) target.style.display = 'block';
}
window.selectWithdrawalMethod = selectWithdrawalMethod;

function copyDepositAddress(network = 'bsc') {
  const addressEl = document.getElementById(`deposit-address-${network}`);
  if (!addressEl) return;
  navigator.clipboard.writeText(addressEl.textContent).then(() => {
    const copyBtn = addressEl.closest('.wallet-address-box')?.querySelector('.copy-btn');
    if (copyBtn) {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span>✓</span>';
      setTimeout(() => { copyBtn.innerHTML = original; }, 2000);
    }
  });
}
window.copyDepositAddress = copyDepositAddress;

function selectNetwork(network) {
  const selected = document.getElementById('selected-network');
  if (selected) selected.value = network;

  document.querySelectorAll('.network-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.network === network));
  const bsc = document.getElementById('network-bsc');
  const tron = document.getElementById('network-tron');
  if (bsc) bsc.style.display = network === 'bsc' ? 'block' : 'none';
  if (tron) tron.style.display = network === 'tron' ? 'block' : 'none';
}
window.selectNetwork = selectNetwork;

async function invest(tier) {
  const amountEl = document.getElementById(`amount-tier-${tier}`);
  const amount = Number(amountEl?.value || 0);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert('Please sign in to invest.');
    return;
  }

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  try {
    const { data, error } = await supabase.rpc('invest', {
      p_user_id: user.id,
      p_amount: amount,
      p_tier: tier
    });

    if (error) {
      alert('Investment failed: ' + error.message);
      return;
    }

    amountEl.value = '';
    await loadDashboard(user);
    await loadRecentActivity();
    alert('Investment submitted successfully.');
  } catch (err) {
    console.error('Invest error:', err);
    alert('Investment failed: ' + (err.message || 'Unknown error'));
  }
}
window.invest = invest;

async function handleDepositSubmit(e) {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showDepositMessage('Please log in to make a deposit.', 'error');
    return;
  }

  const amount = Number(document.getElementById('deposit-amount')?.value || 0);
  const txHash = document.getElementById('deposit-txhash')?.value.trim();
  const chain = document.getElementById('selected-network')?.value || 'bsc';

  if (!amount || amount <= 0) {
    showDepositMessage('Please enter a valid amount greater than 0.', 'error');
    return;
  }
  if (!txHash || txHash.length < 10) {
    showDepositMessage('Please enter a valid transaction hash.', 'error');
    return;
  }

  try {
    const { error } = await supabase.rpc('request_deposit', {
      amount,
      tx_hash: txHash,
      chain
    });

    if (error) {
      showDepositMessage('Deposit failed: ' + error.message, 'error');
      return;
    }

    showDepositMessage('Deposit submitted successfully! It will be reviewed by our team.', 'success');
    document.getElementById('deposit-form')?.reset();
    document.getElementById('selected-network').value = chain;
    await loadDepositHistory();
    await loadRecentActivity();
  } catch (err) {
    showDepositMessage('An error occurred: ' + err.message, 'error');
  }
}

function showDepositMessage(message, type) {
  const el = document.getElementById('deposit-message');
  if (!el) return;
  el.textContent = message;
  el.className = `transaction-message ${type}`;
}

async function handleWithdrawalSubmit(e) {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showWithdrawMessage('Please log in to make a withdrawal.', 'error');
    return;
  }

  const amount = Number(document.getElementById('withdraw-amount')?.value || 0);
  if (!amount || amount <= 0) {
    showWithdrawMessage('Please enter a valid amount greater than 0.', 'error');
    return;
  }

  const details = {};
  if (currentWithdrawalMethod === 'paypal') {
    details.email = document.getElementById('paypal-email')?.value.trim();
    if (!details.email) return showWithdrawMessage('Please enter your PayPal email.', 'error');
  }
  if (currentWithdrawalMethod === 'bank') {
    details.iban = document.getElementById('bank-iban')?.value.trim();
    details.bic = document.getElementById('bank-bic')?.value.trim();
    if (!details.iban || !details.bic) return showWithdrawMessage('Please enter your IBAN and BIC.', 'error');
  }
  if (currentWithdrawalMethod === 'usdt') {
    details.address = document.getElementById('usdt-address')?.value.trim();
    if (!details.address) return showWithdrawMessage('Please enter your USDT address.', 'error');
  }
  if (currentWithdrawalMethod === 'cashapp') {
    details.cashtag = document.getElementById('cashapp-cashtag')?.value.trim();
    if (!details.cashtag) return showWithdrawMessage('Please enter your CashApp cashtag.', 'error');
  }

  try {
    const { error } = await supabase.rpc('request_withdrawal', {
      amount,
      method: currentWithdrawalMethod,
      details_json: details
    });

    if (error) {
      showWithdrawMessage('Withdrawal failed: ' + error.message, 'error');
      return;
    }

    showWithdrawMessage('Withdrawal request submitted successfully.', 'success');
    document.getElementById('withdraw-form')?.reset();
    await loadWithdrawalHistory();
    await loadRecentActivity();
    await refreshBalanceDisplay();
  } catch (err) {
    showWithdrawMessage('An error occurred: ' + err.message, 'error');
  }
}

function showWithdrawMessage(message, type) {
  const el = document.getElementById('withdraw-message');
  if (!el) return;
  el.textContent = message;
  el.className = `transaction-message ${type}`;
}

function attachUserListeners() {
  document.getElementById('show-signup')?.addEventListener('click', () => showAuthForm('signup-form'));
  document.getElementById('show-login')?.addEventListener('click', () => showAuthForm('login-form'));
  document.getElementById('show-reset-password')?.addEventListener('click', () => showAuthForm('reset-password-form'));
  document.getElementById('back-to-login')?.addEventListener('click', () => showAuthForm('login-form'));

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

  document.getElementById('deposit-form')?.addEventListener('submit', handleDepositSubmit);
  document.getElementById('withdraw-form')?.addEventListener('submit', handleWithdrawalSubmit);
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
  await loadDepositHistory();
  await loadWithdrawalHistory();
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    setAuthenticatedView(true);
    await loadDashboard(session.user);
    await loadRecentActivity();
    await loadDepositHistory();
    await loadWithdrawalHistory();
  }

  if (event === 'SIGNED_OUT') {
    setAuthenticatedView(false);
  }
});

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
    document.getElementById('admin-auth-view').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    return;
  }

  const [{ data: users }, { data: deposits }, { data: withdrawals }, { data: investments }] = await Promise.all([
    supabase.rpc('get_all_users'),
    supabase.rpc('get_all_deposits'),
    supabase.rpc('get_all_withdrawals'),
    supabase.rpc('get_all_investments')
  ]);

  document.getElementById('admin-total-users').textContent = users?.length || 0;
  document.getElementById('admin-total-deposits').textContent = deposits?.length || 0;
  document.getElementById('admin-total-withdrawals').textContent = withdrawals?.length || 0;
  document.getElementById('admin-active-investments').textContent = (investments || []).filter(inv => inv.status === 'active').length;

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
                <button class="btn btn-secondary btn-freeze" data-user-id="${user.id}" data-status="${user.status || 'active'}" type="button">${user.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</button>
                <button class="btn btn-secondary btn-adjust" data-user-id="${user.id}" type="button">Adjust</button>
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
                <button class="btn btn-secondary btn-approve-deposit" data-id="${item.id}" type="button">Approve</button>
                <button class="btn btn-secondary btn-reject-deposit" data-id="${item.id}" type="button">Reject</button>
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
                <button class="btn btn-secondary btn-approve-withdrawal" data-id="${item.id}" type="button">Approve</button>
                <button class="btn btn-secondary btn-reject-withdrawal" data-id="${item.id}" type="button">Reject</button>
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

async function boot() {
  attachUserListeners();

  if (document.body.dataset.page === 'admin') {
    attachAdminListeners();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === ADMIN_ID) {
      document.getElementById('admin-auth-view').classList.add('hidden');
      document.getElementById('admin-dashboard').classList.remove('hidden');
      await loadAdminDashboard();
    }
    return;
  }

  await initUserDashboard();
}

boot();
