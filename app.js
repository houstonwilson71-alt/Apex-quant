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
const errorMessages = document.querySelectorAll('.error-message');
const successMessages = document.querySelectorAll('.success-message');

// Dashboard elements
const balanceValue = document.getElementById('balance-value');
const profitValue = document.getElementById('profit-value');
const roiValue = document.getElementById('roi-value');
const activeInvestmentsContainer = document.getElementById('active-investments');

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
// Auth State Change Listener
// =====================================================
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        // User is logged in
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        userEmailSpan.textContent = session.user.email;
        
        // Load dashboard data
        await loadDashboard(session.user);
    } else {
        // User is logged out
        authContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
        
        // Reset dashboard values
        balanceValue.textContent = '$0.00';
        profitValue.textContent = '$0.00';
        roiValue.textContent = '0%';
        activeInvestmentsContainer.innerHTML = `
            <p class="no-investments">No active investments yet. Choose a tier above to start earning!</p>
        `;
        
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
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        userEmailSpan.textContent = session.user.email;
        await loadDashboard(session.user);
    }
}

// Start the app
checkSession();
