// Enhanced Wallet JavaScript with Combined Balance System - No inline JS for CPC compliance

document.addEventListener('DOMContentLoaded', function () {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const walletBalanceSpan = document.getElementById('walletBalance');
    const winningsBalanceSpan = document.getElementById('winningsBalance');
    const totalBalanceSpan = document.getElementById('totalBalance');
    const availableWinningsSpan = document.getElementById('availableWinnings');
    const depositForm = document.getElementById('depositForm');
    const withdrawForm = document.getElementById('withdrawForm');
    const transactionsContainer = document.getElementById('transactionsContainer');
    const messageDiv = document.getElementById('message');
    const transactionCount = document.getElementById('transactionCount');

    // Global variables for current balances
    let currentWalletBalance = 0;
    let currentWinningsBalance = 0;
    let currentTotalBalance = 0;

    // Initialize page
    loadUserInfo();
    loadTransactions();
    setupTransactionToggle();
    checkWalletMaintenanceStatus();
    enhanceFormHandlersWithMaintenance();
    
    // Check maintenance status every 30 seconds
    setInterval(checkWalletMaintenanceStatus, 30000);

    // ENHANCED: Setup transaction history toggle
    function setupTransactionToggle() {
        const toggleBtn = document.getElementById('transactionsToggle');
        const collapsible = document.getElementById('transactionsCollapsible');
        const toggleIcon = toggleBtn?.querySelector('.toggle-icon');

        if (toggleBtn && collapsible) {
            toggleBtn.addEventListener('click', function() {
                const isExpanded = collapsible.classList.contains('expanded');

                if (isExpanded) {
                    // Collapse
                    collapsible.classList.remove('expanded');
                    toggleBtn.classList.add('collapsed');
                    toggleBtn.querySelector('span').textContent = 'View History';
                    if (toggleIcon) toggleIcon.classList.remove('rotated');
                } else {
                    // Expand
                    collapsible.classList.add('expanded');
                    toggleBtn.classList.remove('collapsed');
                    toggleBtn.querySelector('span').textContent = 'Hide History';
                    if (toggleIcon) toggleIcon.classList.add('rotated');
                }
            });
        }
    }

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });

                const result = await response.json();
                if (result.success) {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // ENHANCED: Deposit form handler 
    if (depositForm) {
        depositForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(depositForm);
            const amount = parseFloat(formData.get('amount'));

            if (!amount || amount <= 0) {
                showMessage('Please enter a valid amount', 'error');
                return;
            }

            if (amount > 10000) {
                showMessage('Maximum deposit amount is ₹10,000 per transaction', 'error');
                return;
            }

            try {
                // Show loading state
                const submitBtn = depositForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = '⏳ Processing...';
                submitBtn.disabled = true;

                const response = await fetch('/api/wallet/deposit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: amount })
                });

                const result = await response.json();

                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;

                if (result.success) {
                    showMessage(`✅ ${result.message} ₹${amount.toFixed(2)} has been added to your deposit balance.`, 'success');
                    depositForm.reset();
                    await loadUserInfo();
                    await loadTransactions();
                } else {
                    showMessage(`❌ ${result.error || 'Deposit failed'}`, 'error');
                }
            } catch (error) {
                showMessage('❌ Network error. Please try again.', 'error');

                // Reset button state on error
                const submitBtn = depositForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = '💰 Deposit Money';
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // ENHANCED: Withdraw form handler with new minimum ₹25 requirement and payout system
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(withdrawForm);
            const amount = parseFloat(formData.get('amount'));

            // ENHANCED validation with ₹25 minimum
            if (!amount || amount < 25) {
                showMessage('❌ Minimum withdrawal amount is ₹25', 'error');
                return;
            }

            if (amount > 50000) {
                showMessage('Maximum withdrawal amount is ₹50,000 per transaction', 'error');
                return;
            }

            // Check if user has enough winnings balance
            if (amount > currentWinningsBalance) {
                showMessage(`❌ Insufficient winnings balance!\n\nYou have ₹${currentWinningsBalance.toFixed(2)} available for withdrawal.\n\n💡 Note: You can only withdraw from winnings balance (not deposit balance).`, 'error');
                return;
            }

            if (currentWinningsBalance === 0) {
                showMessage('❌ No winnings available for withdrawal.\n\n💡 You need to win tournaments first, or ask admin to add winnings to your account.', 'error');
                return;
            }

            // Confirm withdrawal
            const confirmMessage = `Confirm Withdrawal Request:\n\nAmount: ₹${amount.toFixed(2)}\nFrom: Winnings Balance\n\n⚠️ This will create a payout request for admin approval.\nAre you sure you want to proceed?`;
            
            if (!confirm(confirmMessage)) {
                return;
            }

            try {
                // Show loading state
                const submitBtn = withdrawForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = '⏳ Processing...';
                submitBtn.disabled = true;

                const response = await fetch('/api/wallet/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: amount })
                });

                const result = await response.json();

                // Reset button state
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;

                if (result.success) {
                    showMessage(`✅ ${result.message}\n\n💰 ₹${amount.toFixed(2)} withdrawal request has been submitted.\n🕒 Admin will process your request soon.`, 'success');
                    withdrawForm.reset();
                    await loadUserInfo();
                    await loadTransactions();
                } else {
                    showMessage(`❌ ${result.error || 'Withdrawal failed'}`, 'error');
                }
            } catch (error) {
                console.error('Withdrawal error:', error);
                showMessage('❌ Network error. Please check your connection and try again.', 'error');

                // Reset button state on error
                const submitBtn = withdrawForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = '💸 Request Withdrawal';
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // ENHANCED: Load user info with total balance calculation
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user');
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Redirect to login if not authenticated
                    window.location.href = '/login';
                    return;
                }
                throw new Error('Failed to load user info');
            }

            const user = await response.json();

            // Update global variables
            currentWalletBalance = parseFloat(user.wallet_balance || 0);
            currentWinningsBalance = parseFloat(user.winnings_balance || 0);
            currentTotalBalance = currentWalletBalance + currentWinningsBalance;

            // Update display elements
            if (usernameDisplay) {
                usernameDisplay.textContent = `Welcome, ${user.username}`;
            }
            if (walletBalanceSpan) {
                walletBalanceSpan.textContent = currentWalletBalance.toFixed(2);
            }
            if (winningsBalanceSpan) {
                winningsBalanceSpan.textContent = currentWinningsBalance.toFixed(2);
            }
            if (totalBalanceSpan) {
                totalBalanceSpan.textContent = currentTotalBalance.toFixed(2);
            }
            if (availableWinningsSpan) {
                availableWinningsSpan.textContent = currentWinningsBalance.toFixed(2);
            }

            // Update withdraw form max value
            const withdrawAmountInput = document.getElementById('withdrawAmount');
            if (withdrawAmountInput) {
                withdrawAmountInput.max = currentWinningsBalance;
                withdrawAmountInput.placeholder = `Minimum ₹25, Max ₹${currentWinningsBalance.toFixed(2)}`;
            }

        } catch (error) {
            console.error('Error loading user info:', error);
            showMessage('Failed to load user information', 'error');
        }
    }

    // ENHANCED: Load transactions with better display
    async function loadTransactions() {
        try {
            const response = await fetch('/api/wallet/transactions');
            
            if (!response.ok) {
                throw new Error('Failed to load transactions');
            }

            const transactions = await response.json();

            // Update transaction count
            if (transactionCount) {
                transactionCount.textContent = `${transactions.length} transactions`;
            }

            if (transactionsContainer) {
                transactionsContainer.innerHTML = '';

                if (transactions.length === 0) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'transactions-empty';
                    emptyDiv.innerHTML = `
                        <h4>📝 No transactions yet</h4>
                        <p>Your transaction history will appear here once you make deposits or withdrawals.</p>
                    `;
                    transactionsContainer.appendChild(emptyDiv);
                } else {
                    // Create transactions list
                    const transactionsList = document.createElement('div');
                    transactionsList.className = 'transactions-list';

                    // Create header
                    const header = document.createElement('div');
                    header.className = 'transaction-item transaction-header';
                    header.innerHTML = `
                        <div><strong>Type</strong></div>
                        <div><strong>Amount</strong></div>
                        <div><strong>Balance</strong></div>
                        <div><strong>Date</strong></div>
                        <div><strong>Description</strong></div>
                    `;
                    transactionsList.appendChild(header);

                    // Create transaction items (show most recent first)
                    transactions.reverse().forEach(transaction => {
                        const item = createTransactionItem(transaction);
                        transactionsList.appendChild(item);
                    });

                    transactionsContainer.appendChild(transactionsList);
                }
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            showMessage('Failed to load transactions', 'error');
            
            if (transactionsContainer) {
                transactionsContainer.innerHTML = '<div class="transactions-empty"><p>❌ Failed to load transaction history</p></div>';
            }
        }
    }

    // ENHANCED: Create transaction item with better formatting
    function createTransactionItem(transaction) {
        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        const date = new Date(transaction.transaction_date);
        const formattedDate = date.toLocaleDateString('en-IN') + ' ' +
            date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        
        // Enhanced type styling with colors
        const typeClass = 'transaction-type-' + transaction.transaction_type;
        const amountPrefix = transaction.transaction_type === 'credit' ? '+' : '-';
        
        // Enhanced balance type display
        let balanceTypeDisplay = transaction.balance_type.toUpperCase();
        if (transaction.balance_type === 'combined') {
            balanceTypeDisplay = 'WALLET+WINNINGS';
        }
        
        // Enhanced description with icons
        let description = transaction.description;
        if (description.includes('deposit')) {
            description = '💰 ' + description;
        } else if (description.includes('withdrawal')) {
            description = '💸 ' + description;
        } else if (description.includes('Tournament registration')) {
            description = '🎮 ' + description;
        } else if (description.includes('winnings')) {
            description = '🏆 ' + description;
        }
        
        // Create colored content
        item.innerHTML = 
            '<div class="' + typeClass + '">' + transaction.transaction_type.toUpperCase() + '</div>' +
            '<div class="' + typeClass + '">' + amountPrefix + '₹' + parseFloat(transaction.amount).toFixed(2) + '</div>' +
            '<div>' + balanceTypeDisplay + '</div>' +
            '<div>' + formattedDate + '</div>' +
            '<div>' + description + '</div>';
        
        // Add mobile labels for responsive design
        const divs = item.querySelectorAll('div');
        if (divs.length >= 5) {
            divs[0].setAttribute('data-label', 'Type');
            divs[1].setAttribute('data-label', 'Amount');
            divs[2].setAttribute('data-label', 'Balance');
            divs[3].setAttribute('data-label', 'Date');
            divs[4].setAttribute('data-label', 'Description');
        }
        
        return item;
    }

    // ENHANCED: Show message with better styling
    function showMessage(message, type) {
        if (!messageDiv) return;

        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        // Auto-hide after 6 seconds for success, 8 seconds for errors
        const hideDelay = type === 'success' ? 6000 : 8000;
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, hideDelay);
    }

    // NEW: Quick amount helper functions
    window.setDepositAmount = function(amount) {
        const depositAmountInput = document.getElementById('depositAmount');
        if (depositAmountInput) {
            depositAmountInput.value = amount;
            depositAmountInput.focus();
        }
    };
    
    window.setWithdrawAmount = function(amount) {
        const withdrawAmountInput = document.getElementById('withdrawAmount');
        if (withdrawAmountInput) {
            // Check if amount is within limits
            if (amount > currentWinningsBalance) {
                alert(`You only have ₹${currentWinningsBalance.toFixed(2)} in winnings balance`);
                return;
            }
            withdrawAmountInput.value = amount;
            withdrawAmountInput.focus();
        }
    };
    
    window.setMaxWithdraw = function() {
        const withdrawAmountInput = document.getElementById('withdrawAmount');
        if (withdrawAmountInput && currentWinningsBalance >= 25) {
            withdrawAmountInput.value = currentWinningsBalance.toFixed(2);
            withdrawAmountInput.focus();
        } else if (currentWinningsBalance < 25) {
            alert('You need at least ₹25 in winnings balance to withdraw');
        }
    };

    // Auto-refresh user info every 30 seconds to keep balances updated
    setInterval(loadUserInfo, 30000);
});

// ====================
// WALLET MAINTENANCE
// ====================

// Check wallet maintenance status on page load
async function checkWalletMaintenanceStatus() {
    try {
        const response = await fetch('/api/wallet/maintenance-status');
        const result = await response.json();
        
        if (result.success && result.status) {
            const status = result.status;
            
            // Show maintenance banners if needed
            if (status.maintenance_mode) {
                showMaintenanceBanner('full', status.maintenance_message);
                disableWalletForms();
            } else {
                // Check individual operations
                if (status.deposit_disabled) {
                    showMaintenanceBanner('deposit', status.deposit_message);
                    disableDepositForm();
                }
                
                if (status.withdrawal_disabled) {
                    showMaintenanceBanner('withdrawal', status.withdrawal_message);
                    disableWithdrawalForm();
                }
            }
        }
    } catch (error) {
        console.error('Failed to check maintenance status:', error);
    }
}

// Show maintenance banner
function showMaintenanceBanner(type, message) {
    const container = document.querySelector('.wallet-actions') || document.querySelector('.main-content');
    
    if (!container) return;
    
    // Remove existing maintenance banners
    const existingBanners = container.querySelectorAll('.maintenance-banner');
    existingBanners.forEach(banner => banner.remove());
    
    // Create maintenance banner
    const banner = document.createElement('div');
    banner.className = 'maintenance-banner maintenance-' + type;
    banner.innerHTML = `
        <div class="maintenance-content">
            <div class="maintenance-icon">🔧</div>
            <div class="maintenance-text">
                <h4>Maintenance Mode</h4>
                <p>${message}</p>
            </div>
        </div>
    `;
    
    // Insert banner at the top
    container.insertBefore(banner, container.firstChild);
}

// Disable all wallet forms
function disableWalletForms() {
    disableDepositForm();
    disableWithdrawalForm();
}

// Disable deposit form
function disableDepositForm() {
    const depositForm = document.getElementById('depositForm');
    const depositCard = depositForm ? depositForm.closest('.action-card') : null;
    
    if (depositForm) {
        const inputs = depositForm.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        const submitBtn = depositForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '🔧 Maintenance Mode';
            submitBtn.className = 'btn btn-disabled';
        }
    }
    
    if (depositCard) {
        depositCard.classList.add('maintenance-disabled');
    }
    
    // Disable quick amount buttons
    const quickDepositBtns = document.querySelectorAll('.quick-amounts button[onclick*="setDepositAmount"]');
    quickDepositBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
    });
}

// Disable withdrawal form
function disableWithdrawalForm() {
    const withdrawForm = document.getElementById('withdrawForm');
    const withdrawCard = withdrawForm ? withdrawForm.closest('.action-card') : null;
    
    if (withdrawForm) {
        const inputs = withdrawForm.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        const submitBtn = withdrawForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '🔧 Maintenance Mode';
            submitBtn.className = 'btn btn-disabled';
        }
    }
    
    if (withdrawCard) {
        withdrawCard.classList.add('maintenance-disabled');
    }
    
    // Disable quick amount buttons
    const quickWithdrawBtns = document.querySelectorAll('.quick-amounts button[onclick*="setWithdrawAmount"], .quick-amounts button[onclick*="setMaxWithdraw"]');
    quickWithdrawBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
    });
}

// Enable all wallet forms (when maintenance is disabled)
function enableWalletForms() {
    enableDepositForm();
    enableWithdrawalForm();
    
    // Remove maintenance banners
    const banners = document.querySelectorAll('.maintenance-banner');
    banners.forEach(banner => banner.remove());
}

// Enable deposit form
function enableDepositForm() {
    const depositForm = document.getElementById('depositForm');
    const depositCard = depositForm ? depositForm.closest('.action-card') : null;
    
    if (depositForm) {
        const inputs = depositForm.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = false;
        });
        
        const submitBtn = depositForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '💰 Deposit Money';
            submitBtn.className = 'btn btn-primary';
        }
    }
    
    if (depositCard) {
        depositCard.classList.remove('maintenance-disabled');
    }
    
    // Enable quick amount buttons
    const quickDepositBtns = document.querySelectorAll('.quick-amounts button[onclick*="setDepositAmount"]');
    quickDepositBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
    });
}

// Enable withdrawal form
function enableWithdrawalForm() {
    const withdrawForm = document.getElementById('withdrawForm');
    const withdrawCard = withdrawForm ? withdrawForm.closest('.action-card') : null;
    
    if (withdrawForm) {
        const inputs = withdrawForm.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = false;
        });
        
        const submitBtn = withdrawForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = '💸 Request Withdrawal';
            submitBtn.className = 'btn btn-secondary';
        }
    }
    
    if (withdrawCard) {
        withdrawCard.classList.remove('maintenance-disabled');
    }
    
    // Enable quick amount buttons
    const quickWithdrawBtns = document.querySelectorAll('.quick-amounts button[onclick*="setWithdrawAmount"], .quick-amounts button[onclick*="setMaxWithdraw"]');
    quickWithdrawBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
    });
}

// Override existing form submission handlers to check maintenance
function enhanceFormHandlersWithMaintenance() {
    const depositForm = document.getElementById('depositForm');
    const withdrawForm = document.getElementById('withdrawForm');
    
    if (depositForm) {
        const originalSubmitHandler = depositForm.onsubmit;
        depositForm.addEventListener('submit', async function(e) {
            // Check maintenance status before allowing submission
            try {
                const response = await fetch('/api/wallet/maintenance-status');
                const result = await response.json();
                
                if (result.success && result.status) {
                    if (result.status.maintenance_mode || result.status.deposit_disabled) {
                        e.preventDefault();
                        showMessage('Deposit is currently unavailable due to maintenance.', 'error');
                        return false;
                    }
                }
            } catch (error) {
                console.log('Could not check maintenance status, proceeding...');
            }
        });
    }
    
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async function(e) {
            // Check maintenance status before allowing submission
            try {
                const response = await fetch('/api/wallet/maintenance-status');
                const result = await response.json();
                
                if (result.success && result.status) {
                    if (result.status.maintenance_mode || result.status.withdrawal_disabled) {
                        e.preventDefault();
                        showMessage('Withdrawal is currently unavailable due to maintenance.', 'error');
                        return false;
                    }
                }
            } catch (error) {
                console.log('Could not check maintenance status, proceeding...');
            }
        });
    }
}

