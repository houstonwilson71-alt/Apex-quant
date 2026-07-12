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

function navigateTo(sectionId) {
    const sectionIds = ['home', 'trading-ai', 'deposit', 'withdraw', 'contact'];
    
    sectionIds.forEach(id => {
        const section = document.getElementById(`section-${id}`);
        if (section) section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(item => item.classList.remove('active'));
    
    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) targetSection.classList.add('active');
    
    const activeNavItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');
    const activeMobileNavItem = document.querySelector(`.mobile-nav-item[data-section="${sectionId}"]`);
    if (activeMobileNavItem) activeMobileNavItem.classList.add('active');
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    
    if (sectionId === 'deposit') {
        refreshBalanceDisplay();
        loadDepositHistory();
    }
    if (sectionId === 'withdraw') {
        refreshBalanceDisplay();
        loadWithdrawalHistory();
    }
    if (sectionId === 'home') {
        loadRecentActivity();
    }
}

window.navigateTo = navigateTo;

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('mobile-open');
}

window.toggleMobileMenu = toggleMobileMenu;

async function refreshBalanceDisplay() {
    try {
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
    } catch (err) {
        console.error('refreshBalanceDisplay error:', err);
    }
}

function selectWithdrawalMethod(method) {
    currentWithdrawalMethod = method;
    
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === method) btn.classList.add('active');
    });
    
    document.querySelectorAll('.method-details').forEach(details => {
        details.style.display = 'none';
    });
    
    const selectedDetails = document.getElementById(`method-details-${method}`);
    if (selectedDetails) selectedDetails.style.display = 'block';
}

window.selectWithdrawalMethod = selectWithdrawalMethod;

function copyDepositAddress(network = 'bsc') {
    const addressEl = document.getElementById(`deposit-address-${network}`);
    if (!addressEl) return;
    
    const address = addressEl.textContent;
    navigator.clipboard.writeText(address).then(() => {
        const addressContainer = addressEl.closest('.wallet-address-box');
        const copyBtn = addressContainer?.querySelector('.copy-btn');
        if (copyBtn) {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span>✓</span>';
            setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
        }
    });
}

window.copyDepositAddress = copyDepositAddress;

function selectNetwork(network) {
    const selectedNetworkInput = document.getElementById('selected-network');
    if (selectedNetworkInput) selectedNetworkInput.value = network;
    
    document.querySelectorAll('.network-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.network === network) tab.classList.add('active');
    });
    
    document.getElementById('network-bsc').style.display = network === 'bsc' ? 'block' : 'none';
    document.getElementById('network-tron').style.display = network === 'tron' ? 'block' : 'none';
}

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

    const { data, error } = await supabase.auth.signUp({ email, password });

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showError('login-error', error.message);
    }
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
});

// =====================================================
// Dashboard Functions
// =====================================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

async function loadDashboard(user) {
    if (!user) return;

    try {
        userEmailSpan.textContent = user.email;
        if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
        }

        const { data: completedInvestments } = await supabase
            .from('investments')
            .select('profit')
            .eq('user_id', user.id)
            .eq('status', 'completed');

        const { data: activeInv } = await supabase
            .from('investments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('end_date', { ascending: true });

        const balance = profile?.balance || 0;
        const totalProfit = completedInvestments?.reduce((sum, inv) => sum + inv.profit, 0) || 0;
        
        const { data: allInvestments } = await supabase
            .from('investments')
            .select('amount, status')
            .eq('user_id', user.id);
        
        const totalInvested = allInvestments?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
        const overallROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

        balanceValue.textContent = formatCurrency(balance);
        profitValue.textContent = formatCurrency(totalProfit);
        roiValue.textContent = overallROI.toFixed(1) + '%';

        const formattedBalance = formatCurrency(balance);
        if (depositBalance) depositBalance.textContent = formattedBalance;
        if (withdrawBalance) withdrawBalance.textContent = formattedBalance;

        renderActiveInvestments(activeInv || []);

    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

function renderActiveInvestments(investments) {
    if (!investments || investments.length === 0) {
        activeInvestmentsContainer.innerHTML = '<p class="no-investments">No active investments yet. Choose a tier above to start earning!</p>';
        return;
    }

    const html = '<h3>Your Active Investments</h3>' +
        investments.map(inv => {
            const daysRemaining = getDaysRemaining(inv.end_date);
            const isSoon = daysRemaining <= 3;
            return `<div class="investment-item">
                <span class="investment-tier">Tier ${inv.tier}</span>
                <span class="investment-amount">${formatCurrency(inv.amount)}</span>
                <span class="investment-roi">+${inv.roi_percentage}% ROI</span>
                <span class="investment-maturity">${formatDate(inv.end_date)}</span>
                <span class="investment-countdown ${isSoon ? 'soon' : ''}">${daysRemaining} days left</span>
            </div>`;
        }).join('');

    activeInvestmentsContainer.innerHTML = html;
}

// =====================================================
// Deposit Function (USDT) - Dual Chain Support
// =====================================================

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
    
    if (!amount || isNaN(amount) || amount <= 0) {
        showDepositMessage('Please enter a valid amount greater than 0.', 'error');
        return;
    }
    
    if (!txHash || txHash.length < 10) {
        showDepositMessage('Please enter a valid transaction hash.', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.rpc('request_deposit', {
            amount: amount,
            tx_hash: txHash,
            chain: chain
        });
        
        if (error) {
            showDepositMessage('Deposit failed: ' + error.message, 'error');
        } else {
            showDepositMessage('Deposit submitted successfully! It will be reviewed by our team.', 'success');
            amountInput.value = '';
            txHashInput.value = '';
            await loadDepositHistory();
            await refreshBalanceDisplay();
        }
    } catch (err) {
        showDepositMessage('An error occurred: ' + err.message, 'error');
    }
});

function showDepositMessage(message, type) {
    const messageEl = document.getElementById('deposit-message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = 'transaction-message ' + type;
    }
}

// =====================================================
// DEPOSIT HISTORY — FIXED WITH VISIBLE ERRORS
// =====================================================
async function loadDepositHistory() {
    const container = document.getElementById('deposit-history');
    if (!container) {
        console.error('loadDepositHistory: container #deposit-history not found');
        return;
    }

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
            container.innerHTML = '<p style="color:red;">Auth error: ' + userError.message + '</p>';
            return;
        }
        if (!user) {
            container.innerHTML = '<p style="color:orange;">Please log in to see your deposits.</p>';
            return;
        }

        const { data: deposits, error } = await supabase
            .from('deposits')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p style="color:red;">❌ Error: ' + error.message + ' (Code: ' + error.code + ')</p>';
            console.error('Deposit fetch error:', error);
            return;
        }

        if (!deposits || deposits.length === 0) {
            container.innerHTML = '<p style="color:#aaa;">No deposit transactions yet.</p>';
            return;
        }

        let html = '<table style="width:100%;border-collapse:collapse;margin-top:10px;color:#fff;">';
        html += '<thead><tr><th>Amount</th><th>Network</th><th>TX Hash</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        deposits.forEach(d => {
            const statusColor = d.status === 'approved' ? '#00cc66' : d.status === 'rejected' ? '#ff4444' : '#ffaa00';
            html += '<tr>' +
                '<td>$' + d.amount + '</td>' +
                '<td>' + (d.chain ? d.chain.toUpperCase() : 'N/A') + '</td>' +
                '<td>' + (d.transaction_hash ? d.transaction_hash.substring(0,10) + '...' : 'N/A') + '</td>' +
                '<td style="color:' + statusColor + ';font-weight:bold;">' + d.status.toUpperCase() + '</td>' +
                '<td>' + new Date(d.created_at).toLocaleDateString() + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<p style="color:red;">⚠️ Unexpected error: ' + err.message + '</p>';
        console.error('loadDepositHistory exception:', err);
    }
}

window.loadDepositHistory = loadDepositHistory;

// =====================================================
// Withdraw Function
// =====================================================

document.getElementById('withdraw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showWithdrawMessage('Please log in to make a withdrawal.', 'error');
        return;
    }
    
    const amountInput = document.getElementById('withdraw-amount');
    const amount = parseFloat(amountInput.value);
    
    if (!amount || isNaN(amount) || amount <= 0) {
        showWithdrawMessage('Please enter a valid amount greater than 0.', 'error');
        return;
    }
    
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
            details.bic = document.getElementById('bank-bic')?
