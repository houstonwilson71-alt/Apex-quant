import supabase from './supabase.js';

// =====================================================
// DOM Elements
// =====================================================
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetPasswordForm = document.getElementById('reset-password-form');
const userEmailSpan = document.getElementById('user-email');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const errorMessages = document.querySelectorAll('.error-message');
const successMessages = document.querySelectorAll('.success-message');

// Dashboard elements
const balanceValue = document.getElementById('balance-value');
const profitValue = document.getElementById('profit-value');
const roiValue = document.getElementById('roi-value');
const activeInvestmentsContainer = document.getElementById('active-investments');

// Balance display elements for deposit/withdraw sections
const depositBalance = document.getElementById('deposit-balance');
const withdrawBalance = document.getElementById('withdraw-balance');

// Current withdrawal method
let currentWithdrawalMethod = 'usdt';

// =====================================================
// Authentication Functions
// =====================================================

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.classList.remove('show');
    }
}

function showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
    }
}

function hideSuccess(elementId) {
    const successEl = document.getElementById(elementId);
    if (successEl) {
        successEl.classList.remove('show');
    }
}

function hideAllMessages() {
    errorMessages.forEach(el => el.classList.remove('show'));
    successMessages.forEach(el => el.classList.remove('show'));
}

function showAuthForm(formId) {
    hideAllMessages();
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
}

// =====================================================
// Navigation Functions
// =====================================================

/**
 * Navigate to a specific dashboard section
 * Shows the target section and hides all others, highlights active sidebar link
 * @param {string} sectionId - The section ID to navigate to (home, trading-ai, deposit, withdraw, contact)
 */
function navigateTo(sectionId) {
    // Map section IDs to their corresponding elements
    const sectionIds = ['home', 'trading-ai', 'deposit', 'withdraw', 'contact'];
    
    // Hide all sections
    sectionIds.forEach(id => {
        const section = document.getElementById(`section-${id}`);
        if (section) {
            section.classList.remove('active');
        }
    });
    
    // Remove active class from all nav items (sidebar and mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show the target section
    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Highlight the active nav item (both sidebar and mobile nav)
    const activeNavItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    const activeMobileNavItem = document.querySelector(`.mobile-nav-item[data-section="${sectionId}"]`);
    if (activeMobileNavItem) {
        activeMobileNavItem.classList.add('active');
    }
    
    // Close mobile menu if open
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    
    // Refresh data when navigating to specific sections
    if (sectionId === 'deposit' || sectionId === 'deposit-section' || sectionId === 'withdraw' || sectionId === 'withdrawal-section') {
        refreshBalanceDisplay();
    }
    if (sectionId === 'deposit' || sectionId === 'deposit-section') {
        loadDepositHistory();
    }
    if (sectionId === 'withdraw' || sectionId === 'withdrawal-section') {
        loadWithdrawalHistory();
    }
    if (sectionId === 'home') {
        loadRecentActivity();
    }
}

// Make navigateTo globally available for onclick handlers
window.navigateTo = navigateTo;

/**
 * Toggle mobile menu visibility
 */
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('mobile-open');
}

// Make toggleMobileMenu globally available
window.toggleMobileMenu = toggleMobileMenu;

/**
 * Refresh balance display in deposit and withdraw sections
 */
async function refreshBalanceDisplay() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();
    
    const balance = profile?.balance || 0;
    const formattedBalance = formatCurrency(balance);
    
    if (depositBalance) depositBalance.textContent = formattedBalance;
    if (withdrawBalance) withdrawBalance.textContent = formattedBalance;
}

/**
 * Select withdrawal method
 * @param {string} method - Withdrawal method (paypal, bank, usdt, cashapp)
 */
function selectWithdrawalMethod(method) {
    currentWithdrawalMethod = method;
    
    // Update button states
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === method) {
            btn.classList.add('active');
        }
    });
    
    // Hide all method details
    document.querySelectorAll('.method-details').forEach(details => {
        details.style.display = 'none';
    });
    
    // Show selected method details
    const selectedDetails = document.getElementById(`method-details-${method}`);
    if (selectedDetails) {
        selectedDetails.style.display = 'block';
    }
}

// Make selectWithdrawalMethod globally available
window.selectWithdrawalMethod = selectWithdrawalMethod;

/**
 * Copy deposit address to clipboard
 * Supports dual-chain (BSC and TRC-20)
 * @param {string} network - The network ('bsc' or 'tron')
 */
function copyDepositAddress(network = 'bsc') {
    const addressEl = document.getElementById(`deposit-address-${network}`);
    if (!addressEl) return;
    
    const address = addressEl.textContent;
    navigator.clipboard.writeText(address).then(() => {
        // Find the copy button associated with this address
        const addressContainer = addressEl.closest('.wallet-address-box');
        const copyBtn = addressContainer?.querySelector('.copy-btn');
        if (copyBtn) {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span>✓</span>';
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
            }, 2000);
        }
    });
}

// Make copyDepositAddress globally available
window.copyDepositAddress = copyDepositAddress;

/**
 * Select network for deposit (BSC or TRC-20)
 * @param {string} network - The network to select ('bsc' or 'tron')
 */
function selectNetwork(network) {
    // Update hidden input
    const selectedNetworkInput = document.getElementById('selected-network');
    if (selectedNetworkInput) {
        selectedNetworkInput.value = network;
    }
    
    // Update tab styles
    document.querySelectorAll('.network-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.network === network) {
            tab.classList.add('active');
        }
    });
    
    // Show/hide network info
    document.getElementById('network-bsc').style.display = network === 'bsc' ? 'block' : 'none';
    document.getElementById('network-tron').style.display = network === 'tron' ? 'block' : 'none';
}

// Make selectNetwork globally available
window.selectNetwork = selectNetwork;

// Form navigation event listeners
document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('signup-form');
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('login-form');
});

document.getElementById('show-reset-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('reset-password-form');
});

document.getElementById('back-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthForm('login-form');
});

// =====================================================
// Sign Up Handler
// =====================================================
signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    // Client-side validation
    if (!email || !password) {
        showError('signup-error', 'Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showError('signup-error', 'Password must be at least 6 characters');
        return;
    }

    if (password !== confirmPassword) {
        showError('signup-error', 'Passwords do not match');
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        showError('signup-error', error.message);
    } else {
        showSuccess('signup-success', 'Account created! Check your email to confirm your account.');
        signupForm.reset();
    }
});

// =====================================================
// Login Handler
// =====================================================
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showError('login-error', 'Please fill in all fields');
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showError('login-error', error.message);
    }
    // Success is handled by onAuthStateChange
});

// =====================================================
// Reset Password Handler
// =====================================================
resetPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAllMessages();

    const email = document.getElementById('reset-email').value.trim();

    if (!email) {
        showError('reset-error', 'Please enter your email address');
        return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/?reset=true'
    });

    if (error) {
        showError('reset-error', error.message);
    } else {
        showSuccess('reset-success', 'Password reset email sent! Check your inbox.');
        resetPasswordForm.reset();
    }
});

// =====================================================
// Logout Handler
// =====================================================
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout error:', error.message);
    }
    // Success is handled by onAuthStateChange
});

// =====================================================
// Dashboard Functions
// =====================================================

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

/**
 * Format a date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Calculate days remaining until a date
 * @param {string} endDate - ISO date string for the end date
 * @returns {number} Number of days remaining
 */
function getDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * Load dashboard data for the authenticated user
 * Fetches balance, profit, and active investments
 * @param {Object} user - Supabase user object
 */
async function loadDashboard(user) {
    if (!user) return;

    try {
        // Update user email in both header and sidebar
        userEmailSpan.textContent = user.email;
        if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;

        // Fetch user's profile for balance
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
        }

        // Fetch completed investments for total profit
        const { data: completedInvestments, error: completedError } = await supabase
            .from('investments')
            .select('profit')
            .eq('user_id', user.id)
            .eq('status', 'completed');

        // Fetch active investments
        const { data: activeInv, error: activeError } = await supabase
            .from('investments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('end_date', { ascending: true });

        // Calculate totals
        const balance = profile?.balance || 0;
        const totalProfit = completedInvestments?.reduce((sum, inv) => sum + inv.profit, 0) || 0;
        
        // Calculate overall ROI (total profit / total invested * 100)
        const { data: allInvestments } = await supabase
            .from('investments')
            .select('amount, status')
            .eq('user_id', user.id);
        
        const totalInvested = allInvestments?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
        const overallROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

        // Update UI
        balanceValue.textContent = formatCurrency(balance);
        profitValue.textContent = formatCurrency(totalProfit);
        roiValue.textContent = overallROI.toFixed(1) + '%';

        // Update balance displays in deposit/withdraw sections
        const formattedBalance = formatCurrency(balance);
        if (depositBalance) depositBalance.textContent = formattedBalance;
        if (withdrawBalance) withdrawBalance.textContent = formattedBalance;

        // Update active investments list
        renderActiveInvestments(activeInv || []);

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

/**
 * Render active investments list
 * @param {Array} investments - Array of investment objects
 */
function renderActiveInvestments(investments) {
    if (!investments || investments.length === 0) {
        activeInvestmentsContainer.innerHTML = `
            <p class="no-investments">No active investments yet. Choose a tier above to start earning!</p>
        `;
        return;
    }

    const html = `
        <h3>Your Active Investments</h3>
        ${investments.map(inv => {
            const daysRemaining = getDaysRemaining(inv.end_date);
            const isSoon = daysRemaining <= 3;
            
            return `
                <div class="investment-item">
                    <span class="investment-tier">Tier ${inv.tier}</span>
                    <span class="investment-amount">${formatCurrency(inv.amount)}</span>
                    <span class="investment-roi">+${inv.roi_percentage}% ROI</span>
                    <span class="investment-maturity">${formatDate(inv.end_date)}</span>
                    <span class="investment-countdown ${isSoon ? 'soon' : ''}">${daysRemaining} days left</span>
                </div>
            `;
        }).join('')}
    `;

    activeInvestmentsContainer.innerHTML = html;
}

// =====================================================
// Deposit Function (USDT) - Dual Chain Support
// =====================================================

/**
 * Handle deposit form submission
 * Submits a USDT deposit request with transaction hash and chain info
 */
document.getElementById('deposit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showDepositMessage('Please log in to make a deposit.', 'error');
        return;
    }
    
    const amountInput = document.getElementById('deposit-amount');
    const txHashInput = document.getElementById('deposit-txhash');
    const selectedNetworkInput = document.getElementById('selected-network');
    const amount = parseFloat(amountInput.value);
    const txHash = txHashInput.value.trim();
    const chain = selectedNetworkInput?.value || 'bsc';
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
        showDepositMessage('Please enter a valid amount greater than 0.', 'error');
        return;
    }
    
    // Validate transaction hash
    if (!txHash || txHash.length < 10) {
        showDepositMessage('Please enter a valid transaction hash.', 'error');
        return;
    }
    
    try {
        // Call the request_deposit RPC function with chain parameter
        const { data, error } = await supabase.rpc('request_deposit', {
            amount: amount,
            tx_hash: txHash,
            chain: chain
        });
        
        if (error) {
            showDepositMessage(`Deposit failed: ${error.message}`, 'error');
        } else {
            showDepositMessage('Deposit submitted successfully! It will be reviewed by our team.', 'success');
            amountInput.value = '';
            txHashInput.value = '';
            
            // Refresh deposit history
            await loadDepositHistory();
            await refreshBalanceDisplay();
        }
    } catch (err) {
        showDepositMessage(`An error occurred: ${err.message}`, 'error');
    }
});

/**
 * Show deposit message with appropriate styling
 * @param {string} message - The message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showDepositMessage(message, type) {
    const messageEl = document.getElementById('deposit-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `transaction-message ${type}`;
    }
}

/**
 * Load user's deposit history with chain information
 */
async function loadDepositHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const container = document.getElementById('deposit-history');
  if (!container) return;
  
  const { data: deposits, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    container.innerHTML = '<p style="color:red;">Error loading deposits.</p>';
    console.error('Deposit fetch error:', error);
    return;
  }
  
  if (!deposits || deposits.length === 0) {
    container.innerHTML = '<p>No deposit transactions yet.</p>';
    return;
  }
  
  let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px;">';
  html += '<thead><tr><th>Amount</th><th>Network</th><th>TX Hash</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  deposits.forEach(d => {
    const statusColor = d.status === 'approved' ? '#00cc66' : d.status === 'rejected' ? '#ff4444' : '#ffaa00';
    html += `<tr>
      <td>$${d.amount}</td>
      <td>${d.chain?.toUpperCase() || 'N/A'}</td>
      <td>${d.transaction_hash ? d.transaction_hash.substring(0,10)+'...' : 'N/A'}</td>
      <td style="color:${statusColor};font-weight:bold;">${d.status.toUpperCase()}</td>
      <td>${new Date(d.created_at).toLocaleDateString()}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Make loadDepositHistory globally available
window.loadDepositHistory = loadDepositHistory;

// =====================================================
// Withdraw Function
// =====================================================

/**
 * Handle withdraw form submission
 * Submits a withdrawal request with selected method and details
 */
document.getElementById('withdraw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showWithdrawMessage('Please log in to make a withdrawal.', 'error');
        return;
    }
    
    const amountInput = document.getElementById('withdraw-amount');
    const amount = parseFloat(amountInput.value);
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
        showWithdrawMessage('Please enter a valid amount greater than 0.', 'error');
        return;
    }
    
    // Get method-specific details
    let details = {};
    switch(currentWithdrawalMethod) {
        case 'paypal':
            details.email = document.getElementById('paypal-email')?.value.trim();
            if (!details.email) {
                showWithdrawMessage('Please enter your PayPal email.', 'error');
                return;
            }
            break;
        case 'bank':
            details.iban = document.getElementById('bank-iban')?.value.trim();
            details.bic = document.getElementById('bank-bic')?.value.trim();
            if (!details.iban || !details.bic) {
                showWithdrawMessage('Please enter IBAN and BIC/Swift codes.', 'error');
                return;
            }
            break;
        case 'usdt':
            details.address = document.getElementById('usdt-address')?.value.trim();
            if (!details.address || details.address.length < 10) {
                showWithdrawMessage('Please enter a valid USDT address.', 'error');
                return;
            }
            break;
        case 'cashapp':
            details.cashtag = document.getElementById('cashapp-cashtag')?.value.trim();
            if (!details.cashtag) {
                showWithdrawMessage('Please enter your CashApp $Cashtag.', 'error');
                return;
            }
            break;
    }
    
    // Get current balance for client-side validation
    const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();
    
    const currentBalance = profile?.balance || 0;
    
    if (amount > currentBalance) {
        showWithdrawMessage(`Insufficient balance. Available: ${formatCurrency(currentBalance)}`, 'error');
        return;
    }
    
    try {
        // Call the request_withdrawal RPC function
        const { data, error } = await supabase.rpc('request_withdrawal', {
            amount: amount,
            method: currentWithdrawalMethod,
            details_json: details
        });
        
        if (error) {
            showWithdrawMessage(`Withdrawal failed: ${error.message}`, 'error');
        } else {
            showWithdrawMessage('Withdrawal request submitted! It will be processed shortly.', 'success');
            amountInput.value = '';
            
            // Refresh withdrawal history and balance
            await loadWithdrawalHistory();
            await refreshBalanceDisplay();
            await loadDashboard(user);
        }
    } catch (err) {
        showWithdrawMessage(`An error occurred: ${err.message}`, 'error');
    }
});

/**
 * Show withdrawal message with appropriate styling
 * @param {string} message - The message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showWithdrawMessage(message, type) {
    const messageEl = document.getElementById('withdraw-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `transaction-message ${type}`;
    }
}

/**
 * Load user's withdrawal history
 */
async function loadWithdrawalHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const container = document.getElementById('withdrawal-history');
  if (!container) return;
  
  const { data: withdrawals, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    container.innerHTML = '<p style="color:red;">Error loading withdrawals.</p>';
    console.error('Withdrawal fetch error:', error);
    return;
  }
  
  if (!withdrawals || withdrawals.length === 0) {
    container.innerHTML = '<p>No withdrawal transactions yet.</p>';
    return;
  }
  
  let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px;">';
  html += '<thead><tr><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  withdrawals.forEach(w => {
    const statusColor = w.status === 'approved' ? '#00cc66' : w.status === 'rejected' ? '#ff4444' : '#ffaa00';
    html += `<tr>
      <td>$${w.amount}</td>
      <td>${w.method || 'N/A'}</td>
      <td style="color:${statusColor};font-weight:bold;">${w.status.toUpperCase()}</td>
      <td>${new Date(w.created_at).toLocaleDateString()}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Make loadWithdrawalHistory globally available
window.loadWithdrawalHistory = loadWithdrawalHistory;

// =====================================================
// Contact Form Handler
// =====================================================

/**
 * Handle contact support form submission
 * Shows success alert (UI only, no backend)
 */
document.getElementById('contact-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form values
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const message = document.getElementById('contact-message').value;
    
    // Show success alert (UI only)
    alert(`Thank you, ${name}! Your message has been sent. We'll get back to you at ${email} soon.`);
    
    // Reset the form
    document.getElementById('contact-form').reset();
});

// =====================================================
// Investment Function (Global)
// =====================================================

/**
 * Make an investment in a specific tier
 * This function is exposed globally for onclick handlers
 * @param {number} tier - Investment tier (1-4)
 */
async function invest(tier) {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
        alert('Please log in to make an investment.');
        return;
    }

    // Get amount from input
    const amountInput = document.getElementById(`amount-tier-${tier}`);
    const amount = parseFloat(amountInput?.value);

    // Validate amount
    if (!amount || isNaN(amount)) {
        alert('Please enter a valid amount.');
        return;
    }

    // Tier validation
    const tierRanges = {
        1: { min: 100, max: 499 },
        2: { min: 500, max: 3999 },
        3: { min: 4000, max: 9999 },
        4: { min: 10000, max: null }
    };

    const range = tierRanges[tier];
    if (!range) {
        alert('Invalid tier selected.');
        return;
    }

    if (amount < range.min) {
        alert(`Minimum investment for Tier ${tier} is $${range.min}.`);
        return;
    }

    if (range.max && amount > range.max) {
        alert(`Maximum investment for Tier ${tier} is $${range.max}.`);
        return;
    }

    // Call the invest RPC function
    const { data, error } = await supabase.rpc('invest', {
        p_user_id: user.id,
        p_amount: amount,
        p_tier: tier
    });

    if (error) {
        alert(`Investment failed: ${error.message}`);
        console.error('Investment error:', error);
    } else {
        alert(`Investment successful! Your ${tierRanges[tier].min <= amount ? 'Tier ' + tier : ''} investment of ${formatCurrency(amount)} has been placed.`);
        amountInput.value = '';
        // Refresh dashboard
        await loadDashboard(user);
    }
}

// Make invest function globally available
window.invest = invest;

// =====================================================
// Recent Activity Loader
// =====================================================

/**
 * Load recent activity for the home dashboard
 */
async function loadRecentActivity() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
        // Get recent deposits
        const { data: deposits } = await supabase
            .from('deposits')
            .select('amount, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        // Get recent withdrawals
        const { data: withdrawals } = await supabase
            .from('withdrawals')
            .select('amount, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        // Get recent investments
        const { data: investments } = await supabase
            .from('investments')
            .select('amount, tier, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        // Combine and sort by date
        const activities = [
            ...(deposits || []).map(d => ({
                type: 'deposit',
                amount: d.amount,
                status: d.status,
                date: new Date(d.created_at)
            })),
            ...(withdrawals || []).map(w => ({
                type: 'withdrawal',
                amount: w.amount,
                status: w.status,
                date: new Date(w.created_at)
            })),
            ...(investments || []).map(i => ({
                type: 'investment',
                amount: i.amount,
                tier: i.tier,
                status: i.status,
                date: new Date(i.created_at)
            }))
        ].sort((a, b) => b.date - a.date).slice(0, 10);
        
        const container = document.getElementById('recent-activity-list');
        if (!container) return;
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent activity</p>';
            return;
        }
        
        container.innerHTML = activities.map(activity => {
            let icon = '';
            let typeLabel = '';
            let color = '';
            
            switch(activity.type) {
                case 'deposit':
                    icon = '↓';
                    typeLabel = 'Deposit';
                    color = '#2ed573';
                    break;
                case 'withdrawal':
                    icon = '↑';
                    typeLabel = 'Withdrawal';
                    color = '#ff4757';
                    break;
                case 'investment':
                    icon = '🤖';
                    typeLabel = `Tier ${activity.tier}`;
                    color = '#6366f1';
                    break;
            }
            
            return `
                <div class="history-item">
                    <div class="history-info">
                        <span style="color: ${color}; font-weight: 600;">${icon}</span>
                        <span style="color: rgba(255,255,255,0.9); margin-left: 8px;">${typeLabel}</span>
                        <span style="color: rgba(255,255,255,0.6); margin-left: 8px;">$${parseFloat(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <span style="color: rgba(255,255,255,0.4); margin-left: auto;">${activity.date.toLocaleDateString()}</span>
                    </div>
                    <span class="status-badge status-${activity.status}">${activity.status}</span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Make loadRecentActivity globally available
window.loadRecentActivity = loadRecentActivity;

// =====================================================
// Auth State Change Listener
// =====================================================
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        // Check if user is frozen
        const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', session.user.id)
            .single();
        
        if (profile?.status === 'frozen') {
            // User is frozen - show error and sign out
            const errorEl = document.getElementById('login-error');
            if (errorEl) {
                errorEl.textContent = 'Your account has been frozen. Please contact support.';
                errorEl.classList.add('show');
            }
            await supabase.auth.signOut();
            return;
        }
        
        // User is logged in and active
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        userEmailSpan.textContent = session.user.email;
        if (sidebarUserEmail) sidebarUserEmail.textContent = session.user.email;
        
        // Load dashboard data
        await loadDashboard(session.user);
        
        // Navigate to Home section by default
        navigateTo('home');
    } else {
        // User is logged out
        authContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
        
        // Reset dashboard values
        balanceValue.textContent = '$0.00';
        profitValue.textContent = '$0.00';
        roiValue.textContent = '0%';
        if (depositBalance) depositBalance.textContent = '$0.00';
        if (withdrawBalance) withdrawBalance.textContent = '$0.00';
        if (activeInvestmentsContainer) {
            activeInvestmentsContainer.innerHTML = `
                <p class="no-investments">No active investments yet. Choose a tier above to start earning!</p>
            `;
        }
        
        // Check if we were on reset password form and redirect to login
        const activeForm = document.querySelector('.auth-form.active');
        if (activeForm?.id !== 'login-form' && activeForm?.id !== 'reset-password-form') {
            showAuthForm('login-form');
        }
    }
});

// =====================================================
// Initialize App
// =====================================================
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        // Check if user is frozen
        const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', session.user.id)
            .single();
        
        if (profile?.status === 'frozen') {
            // User is frozen - sign out
            await supabase.auth.signOut();
            return;
        }
        
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        userEmailSpan.textContent = session.user.email;
        if (sidebarUserEmail) sidebarUserEmail.textContent = session.user.email;
        await loadDashboard(session.user);
        // Navigate to Home section by default
        navigateTo('home');
    }
}

// =====================================================
// Contact Form - Formspree Integration
// =====================================================

/**
 * Handle Formspree contact form submission
 * Shows success/error messages based on submission result
 */
document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
    const form = e.target;
    const successEl = document.getElementById('contact-form-success');
    const errorEl = document.getElementById('contact-form-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Hide previous messages
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    
    // Show loading state
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            // Success
            if (successEl) {
                successEl.style.display = 'block';
            }
            form.reset();
        } else {
            // Error from Formspree
            if (errorEl) {
                errorEl.style.display = 'block';
            }
        }
    } catch (error) {
        // Network error
        if (errorEl) {
            errorEl.style.display = 'block';
        }
    } finally {
        // Restore button state
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});

// Start the app
checkSession();
