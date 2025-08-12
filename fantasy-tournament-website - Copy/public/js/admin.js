// Enhanced Admin JavaScript with Ban System, Session Management, and Payout System

// Ban System Variables
let banModal = null;
let currentBanUserId = null;
let currentBanUsername = null;

// Tournament Management Variables
let currentManagedTournamentId = null;
let chatRefreshInterval = null;
let isCreatingTournament = false;

// NEW: Payout System Variables
let currentPayoutId = null;

// FIXED: Debounced message function to prevent spam
let messageTimeout = null;

window.showMessage = function (message, type) {
    // Clear any existing timeout
    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }

    const messageDiv = document.getElementById('message');
    if (!messageDiv) {
        alert(message);
        return;
    }

    // Clear existing message first
    messageDiv.style.display = 'none';

    // Small delay to prevent rapid fire messages
    messageTimeout = setTimeout(() => {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }, 50);
};

document.addEventListener('DOMContentLoaded', function () {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageDiv = document.getElementById('message');

    // Tab elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Container elements
    const usersContainer = document.getElementById('usersContainer');
    const adminTournamentsContainer = document.getElementById('adminTournamentsContainer');
    const adminTransactionsContainer = document.getElementById('adminTransactionsContainer');
    const payoutsContainer = document.getElementById('payoutsContainer'); // NEW

    // Form elements
    const createTournamentForm = document.getElementById('createTournamentForm');
    const updateWinningsForm = document.getElementById('updateWinningsForm');

    // Modal elements
    const winningsModal = document.getElementById('winningsModal');
    const closeModal = document.querySelector('.close');

    // Initialize page
    loadUserInfo();
    loadAnalytics();
    initializeBanModal();
    checkAdminSession();

    // Auto-refresh session every 5 minutes
    setInterval(checkAdminSession, 5 * 60 * 1000);

    // Auto-refresh payouts every 30 seconds if on payouts tab
    setInterval(function () {
        const payoutsTab = document.getElementById('payoutsTab');
        if (payoutsTab && payoutsTab.classList.contains('active')) {
            loadPayouts();
            loadAnalytics(); // Update badge count
        }
    }, 30000);

        // FIXED: Enhanced modal handling
        window.addEventListener('click', function(event) {
            const participantsModal = document.querySelector('.participants-modal');
            if (participantsModal && event.target === participantsModal.querySelector('.modal-overlay')) {
                closeParticipantsModal();
            }
        });
    
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const participantsModal = document.querySelector('.participants-modal');
                if (participantsModal) {
                    closeParticipantsModal();
                }
            }
        });
    

    // ADMIN SESSION MANAGEMENT
    async function checkAdminSession() {
        try {
            const response = await fetch('/api/admin/session-check');
            const result = await response.json();

            if (!result.authenticated || !result.isAdmin) {
                alert('Your admin session has expired. Please login again.');
                window.location.href = '/login';
                return false;
            }

            return true;
        } catch (error) {
            console.error('Session check failed:', error);
            return false;
        }
    }

    // Enhanced fetch wrapper for admin requests
    async function adminFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);

            if (response.status === 403) {
                const sessionValid = await checkAdminSession();
                if (!sessionValid) {
                    return null;
                }
                showMessage('Access denied. Please try again.', 'error');
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            console.error('Admin fetch error:', error);
            throw error;
        }
    }

    // TAB MANAGEMENT
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        // Hide all tabs
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all buttons
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        let selectedTab;
        switch (tabName) {
            case 'analytics':
                selectedTab = document.getElementById('analyticsTab');
                break;
            case 'users':
                selectedTab = document.getElementById('usersTab');
                break;
            case 'tournaments':
                selectedTab = document.getElementById('tournamentsTab');
                break;
            case 'transactions':
                selectedTab = document.getElementById('transactionsTab');
                break;
            case 'payouts': // NEW
                selectedTab = document.getElementById('payoutsTab');
                break;
            case 'create-tournament':
                selectedTab = document.getElementById('createTournamentTab');
                break;
            case 'manage-tournaments':
                selectedTab = document.getElementById('manageTournamentsTab');
                break;
        }

        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);

        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // Load data for the selected tab
        switch (tabName) {
            case 'analytics':
                loadAnalytics();
                break;
            case 'users':
                loadUsers();
                break;
            case 'tournaments':
                loadTournaments();
                break;
            case 'transactions':
                loadTransactions();
                break;
            case 'payouts': // NEW
                loadPayouts();
                break;
            case 'manage-tournaments':
                loadManageTournaments();
                break;
        }
    }

    // ANALYTICS FUNCTIONS 
    async function loadAnalytics() {
        try {
            console.log('📊 Loading analytics...');

            const response = await adminFetch('/api/admin/analytics');
            if (!response) {
                console.error('❌ No response from analytics API');
                return;
            }

            const analytics = await response.json();
            console.log('📈 Analytics data received:', analytics);

            // FIXED: Safely update metrics with fallbacks
            const updateElement = (id, value, fallback = 0) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value !== undefined && value !== null ? value : fallback;
                } else {
                    console.warn(`⚠️ Element with id '${id}' not found`);
                }
            };

            const updateNumericElement = (id, value, decimals = 0, fallback = 0) => {
                const element = document.getElementById(id);
                if (element) {
                    const numValue = parseFloat(value) || fallback;
                    element.textContent = decimals > 0 ? numValue.toFixed(decimals) : numValue.toString();
                } else {
                    console.warn(`⚠️ Element with id '${id}' not found`);
                }
            };

            // Update basic metrics with safety checks
            updateElement('totalUsers', analytics.totalUsers, 0);
            updateElement('totalTournaments', analytics.totalTournaments, 0);
            updateElement('activeTournaments', analytics.activeTournaments, 0);
            updateNumericElement('totalRevenue', analytics.totalRevenue, 2, 0);
            updateNumericElement('totalProfit', analytics.totalProfit, 2, 0);
            updateNumericElement('totalWithdrawals', analytics.totalWithdrawals, 2, 0);
            updateNumericElement('entryFees', analytics.entryFeesCollected, 2, 0);
            updateElement('recentUsers', analytics.recentUsers, 0);

            // FIXED: Update pending payouts with safety check
            const pendingPayouts = analytics.pendingPayouts || 0;
            updateElement('pendingPayouts', pendingPayouts, 0);

            // FIXED: Update payout badge with proper logic
            const payoutBadge = document.getElementById('payoutBadge');
            if (payoutBadge) {
                if (pendingPayouts > 0) {
                    payoutBadge.textContent = pendingPayouts.toString();
                    payoutBadge.style.display = 'flex';
                    payoutBadge.style.visibility = 'visible';
                } else {
                    payoutBadge.style.display = 'none';
                    payoutBadge.style.visibility = 'hidden';
                }
            }

            // FIXED: Popular tournament with safety checks
            const popularTournament = analytics.popularTournament || {
                name: 'No tournaments',
                current_participants: 0,
                max_participants: 0
            };

            const popularNameElement = document.getElementById('popularTournamentName');
            if (popularNameElement) {
                popularNameElement.textContent = popularTournament.name;
            }

            const popularStatsElement = document.getElementById('popularTournamentStats');
            if (popularStatsElement) {
                popularStatsElement.textContent =
                    `${popularTournament.current_participants || 0}/${popularTournament.max_participants || 0} participants`;
            }

            // FIXED: Recent activity with improved error handling
            try {
                const transactionTrends = analytics.transactionTrends || [];
                displayRecentActivity(transactionTrends);
            } catch (error) {
                console.error('⚠️ Error displaying recent activity:', error);
                displayRecentActivityError();
            }

            // FIXED: Tournament status with improved error handling  
            try {
                const tournamentStatus = analytics.tournamentStatus || [];
                displayTournamentStatus(tournamentStatus);
            } catch (error) {
                console.error('⚠️ Error displaying tournament status:', error);
                displayTournamentStatusError();
            }

            console.log('✅ Analytics loaded successfully');

        } catch (error) {
            console.error('❌ Error loading analytics:', error);
            showMessage('Failed to load analytics data. Please refresh the page.', 'error');

            // Show error state in analytics
            displayAnalyticsError();
        }
    }

    function displayRecentActivity(trends) {
        const container = document.getElementById('recentActivity');
        if (!container) {
            console.warn('⚠️ recentActivity container not found');
            return;
        }

        container.innerHTML = '';

        if (!trends || trends.length === 0) {
            container.innerHTML = '<p class="no-activity-message">No admin actions in the last 7 days</p>';
            return;
        }

        try {
            // Group by date with improved logic for Node 12.22
            const groupedByDate = {};
            trends.forEach(trend => {
                const date = trend.date;
                if (!groupedByDate[date]) {
                    groupedByDate[date] = { credit: 0, debit: 0 };
                }
                groupedByDate[date][trend.transaction_type] = trend.total_amount || 0;
            });

            // Display grouped data
            Object.keys(groupedByDate).sort().forEach(date => {
                const item = document.createElement('div');
                item.className = 'trend-item';

                const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString();
                const creditAmount = (groupedByDate[date].credit || 0).toFixed(2);
                const debitAmount = (groupedByDate[date].debit || 0).toFixed(2);

                item.innerHTML = `
                    <div>
                        <strong>${formattedDate}</strong>
                    </div>
                    <div>
                        <span class="credit-amount">+$${creditAmount} winnings awarded</span>
                        ${parseFloat(debitAmount) > 0 ? `| <span class="debit-amount">-$${debitAmount} deductions</span>` : ''}
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('⚠️ Error processing recent activity:', error);
            container.innerHTML = '<p class="error-message">Error loading recent activity</p>';
        }
    }

    function displayTournamentStatus(statusData) {
        const container = document.getElementById('tournamentStatusChart');
        if (!container) {
            console.warn('⚠️ tournamentStatusChart container not found');
            return;
        }

        container.innerHTML = '';

        if (!statusData || statusData.length === 0) {
            container.innerHTML = '<p class="no-status-message">No tournament status data available</p>';
            return;
        }

        try {
            statusData.forEach(status => {
                const item = document.createElement('div');
                item.className = 'trend-item';
                const statusClass = (status.status || 'default').toLowerCase();

                item.innerHTML = `
                    <div class="status-container">
                        <div class="status-indicator ${statusClass}"></div>
                        <strong>${status.status.charAt(0).toUpperCase() + status.status.slice(1)}</strong>
                    </div>
                    <div class="tournament-count ${statusClass}">
                        ${status.count || 0} tournaments
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('⚠️ Error processing tournament status:', error);
            container.innerHTML = '<p class="error-message">Error loading tournament status</p>';
        }
    }

    // NEW: Error state displays
    function displayRecentActivityError() {
        const container = document.getElementById('recentActivity');
        if (container) {
            container.innerHTML = '<p class="error-message">⚠️ Error loading recent activity</p>';
        }
    }

    function displayTournamentStatusError() {
        const container = document.getElementById('tournamentStatusChart');
        if (container) {
            container.innerHTML = '<p class="error-message">⚠️ Error loading tournament status</p>';
        }
    }

    function displayAnalyticsError() {
        // Reset all values to show error state
        const errorMessage = '⚠️ Error';
        const elements = [
            'totalUsers', 'totalTournaments', 'activeTournaments',
            'totalRevenue', 'totalProfit', 'totalWithdrawals',
            'entryFees', 'recentUsers', 'pendingPayouts'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = errorMessage;
            }
        });
    }

    // Make functions globally available
    window.loadPayouts = loadPayouts;
    window.openPayoutModal = openPayoutModal;
    window.closePayoutModal = closePayoutModal;
    window.processPayout = processPayout;

    // ====================================
    //  Load Payouts Function
    // ====================================
    async function loadPayouts() {
        try {
            console.log('Loading payout requests...');
            const response = await adminFetch('/api/admin/payout-requests');
            if (!response) return;

            const payouts = await response.json();
            console.log('Loaded payouts:', payouts);

            const payoutsContainer = document.getElementById('payoutsContainer');
            if (payoutsContainer) {
                payoutsContainer.innerHTML = '';

                if (payouts.length === 0) {
                    payoutsContainer.innerHTML = `
                    <div class="empty-state">
                        <h3>💸 No Payout Requests</h3>
                        <p>No withdrawal requests have been submitted yet.</p>
                        <small>Users can request withdrawals from their winnings balance.</small>
                    </div>
                `;
                    return;
                }

                const table = document.createElement('table');
                table.className = 'admin-table';

                const header = document.createElement('thead');
                header.innerHTML = `
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Requested</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            `;
                table.appendChild(header);

                const tbody = document.createElement('tbody');
                payouts.forEach(payout => {
                    const row = createPayoutRow(payout);
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);

                payoutsContainer.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading payouts:', error);
            showMessage('Failed to load payout requests', 'error');

            // Show error state in container
            const payoutsContainer = document.getElementById('payoutsContainer');
            if (payoutsContainer) {
                payoutsContainer.innerHTML = `
                <div class="error-state">
                    <h3>❌ Error Loading Payouts</h3>
                    <p>Failed to load payout requests. Please check:</p>
                    <ul>
                        <li>Database connection</li>
                        <li>payout_requests table exists</li>
                        <li>Server is running</li>
                    </ul>
                    <button onclick="loadPayouts()" class="btn btn-primary">Retry</button>
                </div>
            `;
            }
        }
    }

    // ====================================
    //  Create Payout Row Function
    // ====================================
    function createPayoutRow(payout) {
        const row = document.createElement('tr');
        const requestedDate = new Date(payout.requested_at).toLocaleDateString();

        const statusClass = payout.status === 'pending' ? 'status-pending' :
            payout.status === 'approved' ? 'status-approved' : 'status-rejected';

        const actionButtons = payout.status === 'pending' ?
            `<button class="btn btn-small btn-primary process-payout-btn"
                data-payout-id="${payout.id}"
                data-username="${payout.username}"
                data-amount="${payout.amount}"
                data-email="${payout.email}">
            Process
        </button>` :
            '<span style="color: #666; font-style: italic;">Processed</span>';

        row.innerHTML = `
        <td>${payout.id}</td>
        <td>${payout.username}<br><small>${payout.email}</small></td>
        <td>₹${parseFloat(payout.amount).toFixed(2)}</td>
        <td>${requestedDate}</td>
        <td><span class="payout-status ${statusClass}">${payout.status}</span></td>
        <td>${actionButtons}</td>
    `;

        // Add event listener for process button
        const processBtn = row.querySelector('.process-payout-btn');
        if (processBtn) {
            processBtn.addEventListener('click', function () {
                const payoutId = this.getAttribute('data-payout-id');
                const username = this.getAttribute('data-username');
                const amount = this.getAttribute('data-amount');
                const email = this.getAttribute('data-email');
                openPayoutModal(payoutId, username, amount, email);
            });
        }

        return row;
    }

    // ====================================
    //  Payout Modal Functions
    // ====================================
    function openPayoutModal(payoutId, username, amount, email) {
        const modal = document.getElementById('payoutModal');
        const payoutDetails = document.getElementById('payoutDetails');
        const payoutIdInput = document.getElementById('payoutId');

        if (payoutDetails) {
            payoutDetails.innerHTML = `
            <div class="payout-info">
                <p><strong>User:</strong> ${username}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Amount:</strong> ₹${parseFloat(amount).toFixed(2)}</p>
            </div>
        `;
        }

        if (payoutIdInput) {
            payoutIdInput.value = payoutId;
        }

        if (modal) {
            modal.style.display = 'block';
        }

        // Store current payout ID globally
        window.currentPayoutId = payoutId;
    }

    function closePayoutModal() {
        const modal = document.getElementById('payoutModal');
        if (modal) {
            modal.style.display = 'none';
        }
        window.currentPayoutId = null;
        const adminNotesField = document.getElementById('adminNotes');
        if (adminNotesField) {
            adminNotesField.value = '';
        }
    }

    // ====================================
    //  Process Payout Function
    // ====================================
    async function processPayout(action) {
        if (!window.currentPayoutId || !['approve', 'reject'].includes(action)) {
            alert('Invalid payout action');
            return;
        }

        const adminNotes = document.getElementById('adminNotes')?.value || '';

        // Confirm action
        const confirmMessage = action === 'approve'
            ? 'Are you sure you want to APPROVE this withdrawal request?'
            : 'Are you sure you want to REJECT this withdrawal request? The amount will be refunded to the user.';

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await fetch('/api/admin/process-payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    payoutId: window.currentPayoutId,
                    action: action,
                    adminNotes: adminNotes
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            if (result.success) {
                showMessage(`Payout request ${action}d successfully`, 'success');
                closePayoutModal();
                // Reload payouts list
                loadPayouts();
                // Update analytics
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to process payout', 'error');
            }

        } catch (error) {
            console.error('Error processing payout:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // TOURNAMENT FUNCTIONS
    async function loadTournaments() {
        try {
            const response = await adminFetch('/api/admin/tournaments');
            if (!response) return;

            const tournaments = await response.json();

            if (adminTournamentsContainer) {
                adminTournamentsContainer.innerHTML = '';

                if (tournaments.length === 0) {
                    adminTournamentsContainer.innerHTML = '<p>No tournaments found.</p>';
                    return;
                }

                const table = document.createElement('table');
                table.className = 'admin-table';

                const header = document.createElement('thead');
                header.innerHTML = `
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Entry Fee</th>
                        <th>Prize Pool</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th>Actions</th>
                    </tr>
                `;
                table.appendChild(header);

                const tbody = document.createElement('tbody');
                tournaments.forEach(tournament => {
                    const row = createTournamentRow(tournament);
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);

                adminTournamentsContainer.appendChild(table);
            }
        } catch (error) {
            console.error('Error loading tournaments:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    function createTournamentRow(tournament) {
        const row = document.createElement('tr');
        const startDate = new Date(tournament.start_date).toLocaleDateString();
    
        row.innerHTML = 
            '<td>' + tournament.id + '</td>' +
            '<td>' + tournament.name + '</td>' +
            '<td>₹' + tournament.entry_fee + '</td>' +
            '<td>₹' + tournament.prize_pool + '</td>' +
            '<td>' + tournament.current_participants + '/' + tournament.max_participants + '</td>' +
            '<td><span class="tournament-status status-' + tournament.status + '">' + tournament.status + '</span></td>' +
            '<td>' + startDate + '</td>' +
            '<td class="tournament-actions-cell">' +
                '<div class="tournament-actions-group">' +
                    '<button class="btn btn-small btn-primary view-participants-btn" ' +
                            'data-tournament-id="' + tournament.id + '" ' +
                            'data-tournament-name="' + tournament.name + '">' +
                        '👥 View Participants (' + tournament.current_participants + ')' +
                    '</button>' +
                    '<button class="btn btn-small btn-danger delete-tournament-btn" ' +
                            'data-tournament-id="' + tournament.id + '" ' +
                            'data-tournament-name="' + tournament.name + '">' +
                        '🗑️ Delete Tournament' +
                    '</button>' +
                '</div>' +
            '</td>';
    
        // FIXED: View participants button with enhanced functionality
        const viewBtn = row.querySelector('.view-participants-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', function() {
                const tournamentId = this.getAttribute('data-tournament-id');
                const tournamentName = this.getAttribute('data-tournament-name');
                console.log('FIXED: Opening enhanced participants view for:', tournamentName);
                viewTournamentParticipantsEnhanced(tournamentId, tournamentName);
            });
        }
    
        // Delete tournament button (unchanged)
        const deleteBtn = row.querySelector('.delete-tournament-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                const tournamentId = this.getAttribute('data-tournament-id');
                const tournamentName = this.getAttribute('data-tournament-name');
                confirmDeleteTournament(tournamentId, tournamentName);
            });
        }
    
        return row;
    }

    function confirmDeleteTournament(tournamentId, tournamentName) {
        const confirmMessage = `Are you sure you want to delete the tournament "${tournamentName}"?\n\nThis will permanently remove:\n• Tournament data\n• All registration records\n\nThis action cannot be undone.`;

        if (confirm(confirmMessage)) {
            deleteTournament(tournamentId, tournamentName);
        }
    }

    async function deleteTournament(tournamentId, tournamentName) {
        try {
            // Show loading state
            showMessage(`Deleting tournament "${tournamentName}"...`, 'info');

            const response = await adminFetch(`/api/admin/tournaments/${tournamentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response) {
                showMessage('Failed to delete tournament. Please try again.', 'error');
                return;
            }

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');

                // Refresh tournaments and analytics
                loadTournaments();
                loadAnalytics();

            } else {
                showMessage(result.error || 'Failed to delete tournament', 'error');
            }

        } catch (error) {
            console.error('Delete tournament error:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // Make functions globally available
    window.viewTournamentParticipantsEnhanced = viewTournamentParticipantsEnhanced;
    window.closeParticipantsModal = closeParticipantsModal;

    // Enhanced function to view tournament participants with team grouping
    function viewTournamentParticipantsEnhanced(tournamentId) {
        console.log('🔍 FIXED: Starting enhanced participants view for tournament:', tournamentId);
    
        // Get tournament info first
        fetch('/api/admin/tournaments')
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Failed to fetch tournaments');
                }
                return response.json();
            })
            .then(function(tournaments) {
                const tournament = tournaments.find(function(t) { return t.id == tournamentId; });
                if (!tournament) {
                    alert('Tournament not found');
                    return;
                }
    
                console.log('✅ FIXED: Tournament found:', tournament.name);
    
                // FIXED: Use enhanced API endpoint that gets REAL team data
                return fetch('/api/admin/tournament/' + tournamentId + '/participants-enhanced')
                    .then(function(response) {
                        console.log('📡 FIXED: API response status:', response.status);
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                        }
                        return response.json();
                    })
                    .then(function(data) {
                        console.log('📊 FIXED: Raw API data received:', data);
    
                        if (!data || data.error) {
                            console.error('❌ FIXED: API error:', data.error);
                            alert('Error loading participants: ' + (data.error || 'Unknown error'));
                            return;
                        }
    
                        // FIXED: Ensure teams is an array
                        const teams = Array.isArray(data.teams) ? data.teams : [];
                        const participants = Array.isArray(data.participants) ? data.participants : [];
    
                        // FIXED: Use REAL team data from database instead of mock teams
                        const modalData = {
                            tournament: tournament,
                            participants: participants,
                            teams: teams, // REAL teams from database
                            totalPlayers: data.totalPlayers || participants.length
                        };
    
                        console.log('🎯 FIXED: Final modal data:', modalData);
    
                        // Create and show modal with FIXED close functionality
                        const modal = document.createElement('div');
                        modal.className = 'participants-modal';
                        modal.id = 'participantsModal';
    
                        try {
                            modal.innerHTML = createParticipantsModalHTML(modalData);
                            console.log('✅ FIXED: Modal HTML created successfully');
                        } catch (htmlError) {
                            console.error('❌ FIXED: Error creating modal HTML:', htmlError);
                            alert('Error creating modal: ' + htmlError.message);
                            return;
                        }
    
                        document.body.appendChild(modal);
                        modal.style.display = 'block';
    
                        // FIXED: Add proper event listeners after modal is in DOM
                        setTimeout(function() {
                            // Close button (×) in header
                            const closeBtn = modal.querySelector('.modal-close');
                            if (closeBtn) {
                                closeBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeParticipantsModal();
                                });
                            }
    
                            // Close button in footer
                            const closeFooterBtn = modal.querySelector('.btn-secondary');
                            if (closeFooterBtn) {
                                closeFooterBtn.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeParticipantsModal();
                                });
                            }
    
                            // Close on overlay click
                            const overlay = modal.querySelector('.modal-overlay');
                            if (overlay) {
                                overlay.addEventListener('click', function(e) {
                                    if (e.target === overlay) {
                                        closeParticipantsModal();
                                    }
                                });
                            }
    
                            // Close on ESC key
                            const escapeHandler = function(e) {
                                if (e.key === 'Escape') {
                                    closeParticipantsModal();
                                    document.removeEventListener('keydown', escapeHandler);
                                }
                            };
                            document.addEventListener('keydown', escapeHandler);
    
                            console.log('✅ FIXED: All close event listeners added');
                        }, 100);
    
                        console.log('✅ FIXED: Modal displayed successfully with working close buttons');
                    })
                    .catch(function(error) {
                        console.error('❌ FIXED: API error:', error);
                        alert('Failed to load participants: ' + error.message);
                    });
            })
            .catch(function(error) {
                console.error('❌ FIXED: Error in participants view:', error);
                alert('Failed to load tournament: ' + error.message);
            });
    }
    
    // FIXED: Create modal HTML with proper error handling and team support
    function createParticipantsModalHTML(data) {
        const tournament = data.tournament || {};
        const tournamentType = tournament.team_mode || 'solo';
        const teams = Array.isArray(data.teams) ? data.teams : [];
        const participants = Array.isArray(data.participants) ? data.participants : [];
    
        console.log('FIXED: Creating modal with data:', {
            tournamentName: tournament.name,
            tournamentType: tournamentType,
            teamsCount: teams.length,
            participantsCount: participants.length
        });
    
        let participantsHTML = '';
    
        if (tournamentType === 'solo' || teams.length === 0) {
            // Show individual participants
            console.log('FIXED: Showing individual participants');
    
            if (participants.length === 0) {
                participantsHTML = '<div class="no-participants">No participants found</div>';
            } else {
                participantsHTML =
                    '<table class="participants-table">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>ID</th>' +
                                '<th>Username</th>' +
                                '<th>Email</th>' +
                                '<th>Wallet Balance</th>' +
                                '<th>Winnings Balance</th>' +
                                '<th>Registration Date</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>';
    
                // FIXED: Use forEach for Node.js 12.22 compatibility
                participants.forEach(function(participant) {
                    const walletBalance = participant.wallet_balance || 0;
                    const winningsBalance = participant.winnings_balance || 0;
                    const regDate = participant.registration_date || participant.created_at || '';
                    const formattedDate = regDate ? new Date(regDate).toLocaleDateString() : 'Unknown';
    
                    participantsHTML += '<tr>' +
                        '<td>' + (participant.id || 'N/A') + '</td>' +
                        '<td>' + escapeHtml(participant.username || 'Unknown') + '</td>' +
                        '<td>' + escapeHtml(participant.email || 'Unknown') + '</td>' +
                        '<td>₹' + parseFloat(walletBalance).toFixed(2) + '</td>' +
                        '<td>₹' + parseFloat(winningsBalance).toFixed(2) + '</td>' +
                        '<td>' + formattedDate + '</td>' +
                    '</tr>';
                });
    
                participantsHTML += '</tbody></table>';
            }
        } else {
            // Show REAL teams with REAL team names from database
            console.log('FIXED: Showing teams, count:', teams.length);
    
            // FIXED: Debug each team
            teams.forEach(function(team, index) {
                console.log('FIXED: Team ' + index + ':', {
                    team_id: team.team_id,
                    team_name: team.team_name,
                    players_count: team.players ? team.players.length : 0
                });
            });
    
            participantsHTML =
                '<div class="team-notice" style="background: #d4edda; padding: 10px; margin-bottom: 15px; border-radius: 5px; border-left: 4px solid #28a745;">' +
                    '<strong>✅ SUCCESS:</strong> Showing ' + teams.length + ' team(s) with ' + (data.totalPlayers || 0) + ' total players.' +
                '</div>' +
                '<table class="participants-table">' +
                    '<thead>' +
                        '<tr>' +
                            '<th>Team/Player</th>' +
                            '<th>Username</th>' +
                            '<th>Role</th>' +
                            '<th>IGN</th>' +
                            '<th>Email</th>' +
                            '<th>Wallet Balance</th>' +
                            '<th>Winnings Balance</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>';
    
            // FIXED: Process each team properly
            teams.forEach(function(team) {
                const teamName = team.team_name || ('Team ' + team.team_id);
                const players = Array.isArray(team.players) ? team.players : [];
    
                console.log('FIXED: Processing team:', teamName, 'with', players.length, 'players');
    
                // Team header row
                participantsHTML +=
                    '<tr class="team-row">' +
                        '<td class="team-name-cell" colspan="7" style="background: #f8f9fa; font-weight: bold; padding: 10px;">' +
                            '🏆 ' + escapeHtml(teamName) + ' (' + players.length + ' players)' +
                        '</td>' +
                    '</tr>';
    
                // Team players
                if (players.length > 0) {
                    players.forEach(function(player) {
                        console.log('FIXED: Processing player:', player.username || 'Unknown');
    
                        const role = player.role || 'player';
                        const roleClass = role === 'leader' ? 'leader' : '';
                        const roleIcon = role === 'leader' ? '👑' :
                                       role === 'substitute' ? '🔄' : '👤';
    
                        const walletBalance = player.wallet_balance || 0;
                        const winningsBalance = player.winnings_balance || 0;
    
                        participantsHTML +=
                            '<tr class="team-member-row">' +
                                '<td style="padding-left: 20px;">├─ ' + roleIcon + '</td>' +
                                '<td>' + escapeHtml(player.username || 'Unknown') + '</td>' +
                                '<td><span class="member-role ' + roleClass + '">' + role + '</span></td>' +
                                '<td>' + escapeHtml(player.ign || player.username || 'Unknown') + '</td>' +
                                '<td>' + escapeHtml(player.email || 'Unknown') + '</td>' +
                                '<td>₹' + parseFloat(walletBalance).toFixed(2) + '</td>' +
                                '<td>₹' + parseFloat(winningsBalance).toFixed(2) + '</td>' +
                            '</tr>';
                    });
                } else {
                    participantsHTML +=
                        '<tr class="team-member-row">' +
                            '<td colspan="7" style="padding-left: 20px; color: #666; font-style: italic;">No players found for this team</td>' +
                        '</tr>';
                }
            });
    
            participantsHTML += '</tbody></table>';
        }
    
        // FIXED: Safe tournament name handling - this is likely where "undefined" was coming from
        const tournamentName = tournament.name || 'Unknown Tournament';
        const totalCount = tournamentType === 'solo'
            ? participants.length
            : teams.length;
        const totalPlayersCount = data.totalPlayers || participants.length;
    
        // FIXED: Return proper HTML string instead of undefined
        return '<div class="modal-overlay" onclick="closeParticipantsModal()">' +
            '<div class="modal-content participants-modal-content" onclick="event.stopPropagation()">' +
                '<div class="modal-header">' +
                    '<h3>Participants: ' + escapeHtml(tournamentName) + '</h3>' +
                    '<span class="tournament-mode-badge">' + tournamentType.toUpperCase() + '</span>' +
                    '<button class="modal-close" onclick="closeParticipantsModal()" type="button" style="cursor: pointer; background: none; border: none; font-size: 24px; color: #666; float: right;">&times;</button>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<div class="participants-summary">' +
                        '<p><strong>Tournament Mode:</strong> ' + tournamentType + '</p>' +
                        '<p><strong>Total ' + (tournamentType === 'solo' ? 'Players' : 'Teams') + ':</strong> ' + totalCount + '</p>' +
                        (tournamentType !== 'solo' ? '<p><strong>Total Players:</strong> ' + totalPlayersCount + '</p>' : '') +
                    '</div>' +
                    '<div class="participants-list">' +
                        participantsHTML +
                    '</div>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="btn btn-secondary" onclick="closeParticipantsModal()" type="button">Close</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    
    
    // Close modal function
    function closeParticipantsModal() {
        console.log('🔒 Closing participants modal...');
        
        // Find all possible modal selectors
        const modalSelectors = [
            '.participants-modal',
            '#participantsModal', 
            '.modal-overlay',
            '[class*="participants-modal"]'
        ];
        
        let modalFound = false;
        
        modalSelectors.forEach(function(selector) {
            const modals = document.querySelectorAll(selector);
            modals.forEach(function(modal) {
                if (modal) {
                    modalFound = true;
                    try {
                        // Add fade out effect
                        modal.style.opacity = '0';
                        modal.style.transition = 'opacity 0.3s ease';
                        
                        // Remove after animation
                        setTimeout(function() {
                            if (modal && modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                                console.log('✅ Modal removed successfully');
                            }
                        }, 300);
                    } catch (error) {
                        console.warn('Error with fade animation, force removing:', error);
                        // Force remove if there's an error
                        if (modal && modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                        }
                    }
                }
            });
        });
        
        if (!modalFound) {
            console.warn('⚠️ No modal found to close');
        }
    }
    
    // Utility function
    function escapeHtml(text) {
        if (!text || text === null || text === undefined) return '';
        if (typeof text !== 'string') return String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // USER MANAGEMENT FUNCTIONS
    async function loadUsers() {
        try {
            const response = await adminFetch('/api/admin/users');
            if (!response) return;

            const users = await response.json();

            if (usersContainer) {
                usersContainer.innerHTML = '';

                // Create search container
                const searchContainer = createUserSearchContainer(users.length);
                usersContainer.appendChild(searchContainer);

                if (users.length === 0) {
                    const noUsersDiv = document.createElement('div');
                    noUsersDiv.className = 'users-no-results';
                    noUsersDiv.innerHTML = `
                        <span class="users-no-results-icon icon-fix">👥</span>
                        <h4>No users found</h4>
                        <p>No users have registered yet.</p>
                    `;
                    usersContainer.appendChild(noUsersDiv);
                    return;
                }

                // Create users table
                const tableContainer = createUsersTable(users);
                usersContainer.appendChild(tableContainer);

                // Setup search functionality
                setupUserSearch(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showMessage('Failed to load users', 'error');
        }
    }

    function createUserSearchContainer(userCount) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'users-search-container';

        const searchHeader = document.createElement('div');
        searchHeader.className = 'users-search-header';

        const searchTitle = document.createElement('h3');
        searchTitle.className = 'users-search-title';
        searchTitle.innerHTML = '<span class="icon-fix">👥</span> Manage Users';

        const countBadge = document.createElement('span');
        countBadge.className = 'users-count-badge';
        countBadge.id = 'totalUsersCount';
        countBadge.textContent = `${userCount} users`;

        searchHeader.appendChild(searchTitle);
        searchHeader.appendChild(countBadge);

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'users-search-wrapper';

        const searchIcon = document.createElement('span');
        searchIcon.className = 'users-search-icon icon-fix';
        searchIcon.textContent = '🔍';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'users-search-input';
        searchInput.id = 'userSearchInput';
        searchInput.placeholder = 'Search users by username, email, or ID...';

        searchWrapper.appendChild(searchIcon);
        searchWrapper.appendChild(searchInput);

        const searchResults = document.createElement('div');
        searchResults.className = 'users-search-results';
        searchResults.id = 'searchResults';

        searchContainer.appendChild(searchHeader);
        searchContainer.appendChild(searchWrapper);
        searchContainer.appendChild(searchResults);

        return searchContainer;
    }

    function createUsersTable(users) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'admin-table-container';
        tableContainer.id = 'usersTableContainer';

        const table = document.createElement('table');
        table.className = 'admin-table';
        table.id = 'usersTable';

        const header = document.createElement('thead');
        header.innerHTML = `
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Wallet Balance</th>
                <th>Winnings Balance</th>
                <th>Created</th>
                <th>Ban Status</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(header);

        const tbody = document.createElement('tbody');
        tbody.id = 'usersTableBody';
        users.forEach(user => {
            const row = createUserRow(user);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableContainer.appendChild(table);
        return tableContainer;
    }

    function createUserRow(user, searchTerm = '') {
        const row = document.createElement('tr');
        const createdDate = new Date(user.created_at).toLocaleDateString();

        const highlightText = (text, term) => {
            if (!term) return text;
            const regex = new RegExp(`(${term})`, 'gi');
            return text.replace(regex, '<span class="search-highlight">$1</span>');
        };

        // Add ban status styling to row
        if (user.ban_status === 'banned') {
            row.classList.add('user-row-banned-permanent');
        } else if (user.ban_status === 'temp_banned') {
            row.classList.add('user-row-banned-temporary');
        }

        const banStatusHTML = getBanStatusHTML(user);
        const banButtonHTML = getBanActionButton(user);

        row.innerHTML = `
            <td>${highlightText(user.id.toString(), searchTerm)}</td>
            <td>${highlightText(user.username, searchTerm)}</td>
            <td>${highlightText(user.email, searchTerm)}</td>
            <td>$${user.wallet_balance.toFixed(2)}</td>
            <td>$${user.winnings_balance.toFixed(2)}</td>
            <td>${createdDate}</td>
            <td class="ban-status-cell">${banStatusHTML}</td>
            <td class="user-actions-cell">
                <div class="user-actions-group">
                    <button class="btn btn-small btn-primary update-winnings-btn"
                            data-user-id="${user.id}" data-username="${user.username}">
                        💰 Update Winnings
                    </button>
                    ${banButtonHTML}
                </div>
            </td>
        `;

        // Add event listeners
        const updateBtn = row.querySelector('.update-winnings-btn');
        updateBtn.addEventListener('click', function () {
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            openWinningsModal(userId, username);
        });

        const banBtn = row.querySelector('.ban-action-btn');
        if (banBtn) {
            banBtn.addEventListener('click', function () {
                const action = this.getAttribute('data-action');
                const userId = this.getAttribute('data-user-id');
                const username = this.getAttribute('data-username');

                if (action === 'ban') {
                    openBanModal(userId, username);
                } else if (action === 'unban') {
                    handleUnbanUser(userId, username);
                }
            });
        }

        return row;
    }

    function setupUserSearch(allUsers) {
        const searchInput = document.getElementById('userSearchInput');
        const searchResults = document.getElementById('searchResults');
        const totalUsersCount = document.getElementById('totalUsersCount');

        let filteredUsers = allUsers;

        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase().trim();

            if (searchTerm === '') {
                filteredUsers = allUsers;
                searchResults.classList.remove('active');
            } else {
                filteredUsers = allUsers.filter(user =>
                    user.username.toLowerCase().includes(searchTerm) ||
                    user.email.toLowerCase().includes(searchTerm) ||
                    user.id.toString().includes(searchTerm)
                );

                searchResults.classList.add('active');
                if (filteredUsers.length > 0) {
                    searchResults.innerHTML = `
                        <span class="search-results-text">
                            Found ${filteredUsers.length} user(s) matching "${searchTerm}"
                        </span>
                        <button class="search-clear-btn" onclick="clearUserSearch()">
                            <span class="icon-fix">✕</span> Clear
                        </button>
                    `;
                } else {
                    searchResults.innerHTML = `
                        <span class="search-results-text no-results">
                            No users found matching "${searchTerm}"
                        </span>
                        <button class="search-clear-btn" onclick="clearUserSearch()">
                            <span class="icon-fix">✕</span> Clear
                        </button>
                    `;
                }
            }

            updateUsersTable(filteredUsers, searchTerm);
            totalUsersCount.textContent = `${filteredUsers.length} of ${allUsers.length} users`;
        });
    }

    function updateUsersTable(users, searchTerm = '') {
        const tableBody = document.getElementById('usersTableBody');
        const tableContainer = document.getElementById('usersTableContainer');

        tableBody.innerHTML = '';

        if (users.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'users-no-results';
            noResults.innerHTML = `
                <span class="users-no-results-icon icon-fix">🔍</span>
                <h4>No users found</h4>
                <p>Try adjusting your search terms or clear the search to see all users.</p>
            `;
            tableContainer.style.display = 'none';
            tableContainer.parentNode.appendChild(noResults);
        } else {
            const existingNoResults = tableContainer.parentNode.querySelector('.users-no-results');
            if (existingNoResults) {
                existingNoResults.remove();
            }
            tableContainer.style.display = 'block';

            users.forEach(user => {
                const row = createUserRow(user, searchTerm);
                tableBody.appendChild(row);
            });
        }
    }

    window.clearUserSearch = function () {
        const searchInput = document.getElementById('userSearchInput');
        const searchResults = document.getElementById('searchResults');

        searchInput.value = '';
        searchResults.classList.remove('active');
        loadUsers();
    }

    // TRANSACTION FUNCTIONS
    async function loadTransactions() {
        try {
            const response = await adminFetch('/api/admin/transactions');
            if (!response) return;

            const transactions = await response.json();

            if (adminTransactionsContainer) {
                adminTransactionsContainer.innerHTML = '';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'admin-transactions-header';

                const headerContent = document.createElement('div');
                headerContent.className = 'admin-transactions-header-content';
                headerContent.innerHTML = `
                    <h3>🔧 Admin Transaction History</h3>
                    <p>📋 Shows only transactions performed by admin (awarding winnings, etc.)</p>
                `;

                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'transactions-controls';

                const countSpan = document.createElement('span');
                countSpan.className = 'transactions-count';
                countSpan.textContent = `${transactions.length} admin actions`;

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'admin-toggle-btn collapsed';
                toggleBtn.id = 'adminTransactionsToggle';
                toggleBtn.innerHTML = `
                    <span>View Actions</span>
                    <span class="toggle-icon">▼</span>
                `;

                controlsDiv.appendChild(countSpan);
                controlsDiv.appendChild(toggleBtn);
                headerDiv.appendChild(headerContent);
                headerDiv.appendChild(controlsDiv);

                const collapsibleDiv = document.createElement('div');
                collapsibleDiv.className = 'transactions-collapsible';
                collapsibleDiv.id = 'adminTransactionsCollapsible';

                if (transactions.length === 0) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'transactions-empty';
                    emptyDiv.innerHTML = `
                        <h4>No admin actions yet</h4>
                        <p>Your admin transaction history will appear here when you award winnings to users.</p>
                    `;
                    collapsibleDiv.appendChild(emptyDiv);
                } else {
                    const table = document.createElement('table');
                    table.className = 'admin-table';

                    const header = document.createElement('thead');
                    header.innerHTML = `
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Balance Type</th>
                            <th>Description</th>
                            <th>Date</th>
                        </tr>
                    `;
                    table.appendChild(header);

                    const tbody = document.createElement('tbody');
                    transactions.forEach(transaction => {
                        const row = createTransactionRow(transaction);
                        tbody.appendChild(row);
                    });
                    table.appendChild(tbody);

                    collapsibleDiv.appendChild(table);
                }

                adminTransactionsContainer.appendChild(headerDiv);
                adminTransactionsContainer.appendChild(collapsibleDiv);

                // Add toggle functionality
                const collapsible = document.getElementById('adminTransactionsCollapsible');
                const toggleIcon = toggleBtn.querySelector('.toggle-icon');

                toggleBtn.addEventListener('click', function () {
                    const isExpanded = collapsible.classList.contains('expanded');

                    if (isExpanded) {
                        collapsible.classList.remove('expanded');
                        toggleBtn.classList.add('collapsed');
                        toggleBtn.querySelector('span').textContent = 'View Actions';
                        toggleIcon.classList.remove('rotated');
                    } else {
                        collapsible.classList.add('expanded');
                        toggleBtn.classList.remove('collapsed');
                        toggleBtn.querySelector('span').textContent = 'Hide Actions';
                        toggleIcon.classList.add('rotated');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            showMessage('Failed to load transactions', 'error');
        }
    }

    function createTransactionRow(transaction) {
        const row = document.createElement('tr');
        const date = new Date(transaction.transaction_date).toLocaleString();
        const typeClass = `transaction-type-${transaction.transaction_type}`;
        const amountPrefix = transaction.transaction_type === 'credit' ? '+' : '-';

        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${transaction.username}</td>
            <td class="${typeClass}">${transaction.transaction_type.toUpperCase()}</td>
            <td class="${typeClass}">${amountPrefix}$${transaction.amount.toFixed(2)}</td>
            <td>${transaction.balance_type.toUpperCase()}</td>
            <td>${transaction.description}</td>
            <td>${date}</td>
        `;

        return row;
    }

    // Tournament Management Functions
    function loadManageTournaments() {
        console.log('Loading tournament management...');
        loadTournamentsForManagement();
        initializeTournamentManagementEvents();
    }

    async function loadTournamentsForManagement() {
        try {
            const response = await adminFetch('/api/admin/tournaments');
            if (!response) return;

            const tournaments = await response.json();
            const select = document.getElementById('manageTournamentSelect');

            if (select) {
                select.innerHTML = '<option value="">Select a tournament...</option>';

                tournaments.forEach(tournament => {
                    const option = document.createElement('option');
                    option.value = tournament.id;
                    option.textContent = `${tournament.name} (${tournament.status}) - ${tournament.current_participants}/${tournament.max_participants} players`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading tournaments for management:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    function initializeTournamentManagementEvents() {
        // Load Tournament Button
        const loadTournamentBtn = document.getElementById('loadTournamentBtn');
        if (loadTournamentBtn) {
            loadTournamentBtn.addEventListener('click', loadSelectedTournament);
        }

        // Match Details Form
        const matchDetailsForm = document.getElementById('matchDetailsForm');
        if (matchDetailsForm) {
            matchDetailsForm.addEventListener('submit', updateMatchDetails);
        }

        // Announcement Form
        const announcementForm = document.getElementById('announcementForm');
        if (announcementForm) {
            announcementForm.addEventListener('submit', postAnnouncement);
        }

        // Character counter for announcements
        const announcementText = document.getElementById('announcementText');
        const announcementCharCount = document.getElementById('announcementCharCount');
        if (announcementText && announcementCharCount) {
            announcementText.addEventListener('input', function () {
                announcementCharCount.textContent = this.value.length;
            });
        }

        // Refresh buttons
        const refreshTournamentBtn = document.getElementById('refreshTournamentBtn');
        if (refreshTournamentBtn) {
            refreshTournamentBtn.addEventListener('click', refreshTournamentData);
        }

        const refreshChatBtn = document.getElementById('refreshChatBtn');
        if (refreshChatBtn) {
            refreshChatBtn.addEventListener('click', loadLiveChatMessages);
        }

        // Action buttons
        const viewTournamentLobbyBtn = document.getElementById('viewTournamentLobbyBtn');
        if (viewTournamentLobbyBtn) {
            viewTournamentLobbyBtn.addEventListener('click', viewTournamentLobby);
        }

        // ===== NEW BUTTON EVENT LISTENERS =====

        // Update Tournament Status Button
        const updateTournamentStatusBtn = document.getElementById('updateTournamentStatusBtn');
        if (updateTournamentStatusBtn) {
            updateTournamentStatusBtn.addEventListener('click', updateTournamentStatus);
        }

        // Export Participants Button
        const exportParticipantsBtn = document.getElementById('exportParticipantsBtn');
        if (exportParticipantsBtn) {
            exportParticipantsBtn.addEventListener('click', exportParticipants);
        }

        // Send Bulk Message Button
        const sendBulkMessageBtn = document.getElementById('sendBulkMessageBtn');
        if (sendBulkMessageBtn) {
            sendBulkMessageBtn.addEventListener('click', sendBulkMessage);
        }
    }

    async function loadSelectedTournament() {
        const select = document.getElementById('manageTournamentSelect');
        const tournamentId = select.value;

        if (!tournamentId) {
            showMessage('Please select a tournament', 'error');
            return;
        }

        currentManagedTournamentId = tournamentId;

        // Show management panels
        const panels = document.getElementById('tournamentManagementPanels');
        if (panels) {
            panels.style.display = 'block';
        }

        // Load tournament data
        await loadTournamentManagementData();
    }

    async function loadTournamentManagementData() {
        if (!currentManagedTournamentId) return;

        try {
            // Load tournament overview
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/manage`);
            if (!response) return;

            const data = await response.json();

            // Update overview
            document.getElementById('manageTournamentName').textContent = data.tournament.name;
            document.getElementById('manageTournamentStatus').textContent = data.tournament.status;
            document.getElementById('manageTournamentParticipants').textContent =
                `${data.tournament.current_participants}/${data.tournament.max_participants}`;
            document.getElementById('manageTournamentPrize').textContent = `$${data.tournament.prize_pool}`;

            // Load match details if they exist
            if (data.matchDetails) {
                const match = data.matchDetails;
                document.getElementById('roomIdInput').value = match.room_id || '';
                document.getElementById('roomPasswordInput').value = match.room_password || '';
                document.getElementById('gameServerInput').value = match.game_server || '';

                if (match.match_start_time) {
                    const date = new Date(match.match_start_time);
                    document.getElementById('matchStartTimeInput').value = date.toISOString().slice(0, 16);
                }
            }

            // Load recent announcements
            await loadRecentAnnouncements();

            // Load live chat
            await loadLiveChatMessages();

            // Start auto-refresh for chat
            if (chatRefreshInterval) {
                clearInterval(chatRefreshInterval);
            }
            chatRefreshInterval = setInterval(loadLiveChatMessages, 5000);

        } catch (error) {
            console.error('Error loading tournament management data:', error);
            showMessage('Failed to load tournament data', 'error');
        }
    }

    async function updateMatchDetails(e) {
        e.preventDefault();

        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const matchDetails = {
            room_id: formData.get('room_id'),
            room_password: formData.get('room_password'),
            match_start_time: formData.get('match_start_time'),
            game_server: formData.get('game_server')
        };

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/match-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(matchDetails)
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Match details updated successfully', 'success');
            } else {
                showMessage(result.error || 'Failed to update match details', 'error');
            }
        } catch (error) {
            console.error('Error updating match details:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function postAnnouncement(e) {
        e.preventDefault();

        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const message = formData.get('message').trim();

        if (!message) {
            showMessage('Announcement cannot be empty', 'error');
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Announcement posted successfully', 'success');
                document.getElementById('announcementText').value = '';
                document.getElementById('announcementCharCount').textContent = '0';
                await loadRecentAnnouncements();
            } else {
                showMessage(result.error || 'Failed to post announcement', 'error');
            }
        } catch (error) {
            console.error('Error posting announcement:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function loadRecentAnnouncements() {
        if (!currentManagedTournamentId) return;

        try {
            const response = await adminFetch(`/api/tournament/${currentManagedTournamentId}/announcements`);
            if (!response) return;

            const announcements = await response.json();
            const container = document.getElementById('recentAnnouncementsList');

            if (container) {
                container.innerHTML = '';

                if (announcements.length === 0) {
                    container.innerHTML = '<p class="no-announcements">No announcements yet</p>';
                    return;
                }

                announcements.slice(0, 5).forEach(announcement => {
                    const announcementElement = createAnnouncementManagementElement(announcement);
                    container.appendChild(announcementElement);
                });
            }
        } catch (error) {
            console.error('Error loading recent announcements:', error);
        }
    }

    function createAnnouncementManagementElement(announcement) {
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'announcement-management-item';

        const timestamp = new Date(announcement.created_at).toLocaleString();

        announcementDiv.innerHTML = `
            <div class="announcement-management-header">
                <span class="announcement-management-time">${timestamp}</span>
            </div>
            <div class="announcement-management-content">${escapeHtml(announcement.message)}</div>
        `;

        return announcementDiv;
    }

    async function loadLiveChatMessages() {
        if (!currentManagedTournamentId) return;

        try {
            const response = await adminFetch(`/api/tournament/${currentManagedTournamentId}/chat`);
            if (!response) return;

            const messages = await response.json();
            const container = document.getElementById('liveChatMessages');

            if (container) {
                container.innerHTML = '';

                if (messages.length === 0) {
                    container.innerHTML = '<p class="no-chat-messages">No chat messages yet</p>';
                    return;
                }

                messages.slice(-10).forEach(message => {
                    const messageElement = createChatManagementElement(message);
                    container.appendChild(messageElement);
                });

                // Scroll to bottom
                container.scrollTop = container.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading live chat messages:', error);
        }
    }

    function createChatManagementElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-management-message ${message.is_admin ? 'admin-message' : 'user-message'}`;

        const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="chat-management-header">
                <span class="chat-management-username ${message.is_admin ? 'admin-username' : ''}">${message.username}${message.is_admin ? ' 👑' : ''}</span>
                <span class="chat-management-time">${timestamp}</span>
            </div>
            <div class="chat-management-content">${escapeHtml(message.message)}</div>
        `;

        return messageDiv;
    }

    async function refreshTournamentData() {
        if (currentManagedTournamentId) {
            await loadTournamentManagementData();
            showMessage('Tournament data refreshed', 'success');
        }
    }

    function viewTournamentLobby() {
        if (currentManagedTournamentId) {
            window.open(`/tournament/${currentManagedTournamentId}`, '_blank');
        }
    }

    // UPDATE TOURNAMENT STATUS FUNCTION
    async function updateTournamentStatus() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        // Get current status
        const currentStatus = document.getElementById('manageTournamentStatus').textContent;

        // Show status selection
        const newStatus = prompt(`Current status: ${currentStatus}\n\nSelect new status:\n- upcoming\n- active\n- completed\n\nEnter new status:`);

        if (!newStatus) {
            return; // User cancelled
        }

        const validStatuses = ['upcoming', 'active', 'completed'];
        if (!validStatuses.includes(newStatus.toLowerCase())) {
            showMessage('Invalid status. Use: upcoming, active, or completed', 'error');
            return;
        }

        if (newStatus.toLowerCase() === currentStatus.toLowerCase()) {
            showMessage('Status is already set to ' + newStatus, 'info');
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus.toLowerCase() })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(`Tournament status updated to: ${newStatus}`, 'success');
                // Refresh tournament data
                await loadTournamentManagementData();
                // Refresh main tournaments list
                if (document.getElementById('tournamentsTab').classList.contains('active')) {
                    loadTournaments();
                }
            } else {
                showMessage(result.error || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating tournament status:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // EXPORT PARTICIPANTS FUNCTION
    async function exportParticipants() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        try {
            showMessage('Exporting participants...', 'info');

            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/export-participants`);

            if (!response) return;

            const exportData = await response.json();

            // Create downloadable file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            // Create download link
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tournament-${currentManagedTournamentId}-participants-${new Date().toISOString().split('T')[0]}.json`;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showMessage(`Exported ${exportData.total_participants} participants successfully!`, 'success');

        } catch (error) {
            console.error('Error exporting participants:', error);
            showMessage('Failed to export participants', 'error');
        }
    }

    // SEND BULK MESSAGE FUNCTION
    async function sendBulkMessage() {
        if (!currentManagedTournamentId) {
            showMessage('No tournament selected', 'error');
            return;
        }

        // Get message from user
        const message = prompt('📢 Send message to all tournament participants:\n\n(This will appear in tournament chat with [ADMIN BROADCAST] prefix)');

        if (!message) {
            return; // User cancelled
        }

        if (message.trim().length === 0) {
            showMessage('Message cannot be empty', 'error');
            return;
        }

        if (message.length > 200) {
            showMessage('Message too long (max 200 characters)', 'error');
            return;
        }

        // Confirm action
        const confirmSend = window.confirm(`Send this message to all tournament participants?\n\n"${message}"\n\nThis cannot be undone.`);

        if (!confirmSend) {
            return;
        }

        try {
            const response = await adminFetch(`/api/admin/tournament/${currentManagedTournamentId}/bulk-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message.trim() })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage('Bulk message sent to all participants!', 'success');
                // Refresh live chat to show the message
                await loadLiveChatMessages();
            } else {
                showMessage(result.error || 'Failed to send bulk message', 'error');
            }
        } catch (error) {
            console.error('Error sending bulk message:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // FORM HANDLERS
    if (createTournamentForm) {
        // Remove any existing listeners by cloning the form
        const newForm = createTournamentForm.cloneNode(true);
        createTournamentForm.parentNode.replaceChild(newForm, createTournamentForm);

        newForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // PREVENT DOUBLE SUBMISSION with better state tracking
            if (window.isCreatingTournament || e.target.dataset.submitting === 'true') {
                console.log('Tournament creation already in progress...');
                return;
            }

            window.isCreatingTournament = true;
            e.target.dataset.submitting = 'true';

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            try {
                // Disable button and show loading
                submitBtn.disabled = true;
                submitBtn.innerHTML = '🔄 Creating Tournament...';

                const formData = new FormData(newForm);

                // FIXED: Handle entry fee properly
                let entryFee = 0;
                const tournamentType = formData.get('tournamentType');

                if (tournamentType === 'free') {
                    entryFee = 0;
                } else {
                    const entryFeeValue = formData.get('entry_fee');
                    if (entryFeeValue && entryFeeValue.trim() !== '') {
                        entryFee = parseFloat(entryFeeValue);
                        if (isNaN(entryFee) || entryFee <= 0) {
                            throw new Error('Please enter a valid entry fee amount');
                        }
                    } else {
                        throw new Error('Entry fee is required for paid tournaments');
                    }
                }

                // FIXED: Handle prize pool - allow 0 for free tournaments
                let prizePool = 0;
                const prizePoolValue = formData.get('prize_pool');
                if (prizePoolValue && prizePoolValue.trim() !== '') {
                    prizePool = parseFloat(prizePoolValue);
                    if (isNaN(prizePool) || prizePool < 0) {
                        throw new Error('Prize pool cannot be negative');
                    }
                } else if (tournamentType === 'paid') {
                    throw new Error('Prize pool is required for paid tournaments');
                }

                const tournamentData = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    game_type: formData.get('game_type'),
                    team_mode: formData.get('team_mode'),
                    entry_fee: entryFee,
                    prize_pool: prizePool,
                    max_participants: parseInt(formData.get('max_participants')),
                    start_date: formData.get('start_date'),
                    end_date: formData.get('end_date'),
                    kill_points: parseInt(formData.get('kill_points')) || 1,
                    rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
                    match_type: formData.get('match_type') || 'Battle Royale'
                };

                console.log('Creating tournament with data:', tournamentData);

                // SINGLE API CALL ONLY
                const response = await fetch('/api/admin/tournaments/enhanced', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(tournamentData)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    const message = entryFee === 0 ?
                        '🎉 FREE tournament created successfully!' :
                        `💰 PAID tournament created successfully! Entry fee: $${entryFee}`;

                    showMessage(result.message || message, 'success');
                    newForm.reset();

                    // Refresh data
                    if (typeof loadAnalytics === 'function') loadAnalytics();
                    if (document.getElementById('tournamentsTab')?.classList.contains('active')) {
                        if (typeof loadTournaments === 'function') loadTournaments();
                    }
                } else {
                    throw new Error(result.error || 'Failed to create tournament');
                }

            } catch (error) {
                console.error('Tournament creation error:', error);
                showMessage(error.message || 'Failed to create tournament', 'error');
            } finally {
                // Re-enable button and reset state
                window.isCreatingTournament = false;
                e.target.dataset.submitting = 'false';
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    if (updateWinningsForm) {
        updateWinningsForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(updateWinningsForm);
            const userId = document.getElementById('selectedUserId').value;
            const amount = parseFloat(formData.get('amount'));

            try {
                const response = await adminFetch('/api/admin/update-winnings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: parseInt(userId), amount: amount })
                });

                if (!response) return;

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, 'success');
                    winningsModal.style.display = 'none';
                    updateWinningsForm.reset();
                    loadUsers();
                    loadAnalytics();
                } else {
                    showMessage(result.error || 'Failed to update winnings', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            }
        });
    }

    // MODAL HANDLERS
    if (closeModal) {
        closeModal.addEventListener('click', function () {
            winningsModal.style.display = 'none';
        });
    }

    window.addEventListener('click', function (e) {
        if (e.target === winningsModal) {
            winningsModal.style.display = 'none';
        }
        if (e.target === document.getElementById('participantsModal')) {
            closeParticipantsModal();
        }
        if (e.target === banModal) {
            closeBanModal();
        }
        if (e.target === document.getElementById('payoutModal')) {
            closePayoutModal();
        }
    });

    // LOGOUT HANDLER
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

    // UTILITY FUNCTIONS
    async function loadUserInfo() {
        try {
            const response = await adminFetch('/api/user');
            if (!response) return;

            const user = await response.json();

            if (usernameDisplay) {
                usernameDisplay.textContent = `Admin: ${user.username}`;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    function openWinningsModal(userId, username) {
        document.getElementById('selectedUserId').value = userId;
        document.querySelector('#winningsModal h3').textContent = `Update Winnings for ${username}`;
        winningsModal.style.display = 'block';
    }

    window.closeParticipantsModal = function () {
        document.getElementById('participantsModal').style.display = 'none';
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // BAN SYSTEM FUNCTIONS
    function initializeBanModal() {
        const banModalHTML = `
        <div id="banModal" class="modal ban-modal">
            <div class="modal-content ban-modal-content">
                <div class="modal-header ban-modal-header">
                    <h3 id="banModalTitle">Ban User</h3>
                    <span class="close ban-modal-close">&times;</span>
                </div>
                <div class="modal-body ban-modal-body">
                    <form id="banUserForm" class="ban-form">
                        <div class="ban-user-info">
                            <div class="ban-user-avatar">👤</div>
                            <div class="ban-user-details">
                                <h4 id="banUserName">Username</h4>
                                <p id="banUserId">ID: #123</p>
                            </div>
                        </div>
                        
                        <div class="ban-form-group">
                            <label for="banType" class="ban-label">Ban Type:</label>
                            <select id="banType" name="banType" class="ban-select" required>
                                <option value="">Select ban type</option>
                                <option value="temporary">⏰ Temporary Ban</option>
                                <option value="permanent">🚫 Permanent Ban</option>
                            </select>
                        </div>
                        
                        <div class="ban-form-group" id="banExpiryGroup" style="display: none;">
                            <label for="banExpiry" class="ban-label">Ban Expires On:</label>
                            <input type="datetime-local" id="banExpiry" name="banExpiry" class="ban-input">
                            <small class="ban-help-text">User will be automatically unbanned after this date</small>
                        </div>
                        
                        <div class="ban-form-group">
                            <label for="banReason" class="ban-label">Reason for Ban:</label>
                            <textarea id="banReason" name="banReason" class="ban-textarea" 
                                    placeholder="Enter detailed reason for banning this user..." 
                                    rows="4" required></textarea>
                            <small class="ban-help-text">This reason will be visible to other admins</small>
                        </div>
                        
                        <div class="ban-form-actions">
                            <button type="button" class="btn btn-secondary ban-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-danger ban-submit-btn">
                                <span class="ban-submit-icon">🔨</span>
                                <span class="ban-submit-text">Ban User</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', banModalHTML);

        banModal = document.getElementById('banModal');
        const banForm = document.getElementById('banUserForm');
        const banTypeSelect = document.getElementById('banType');
        const banExpiryGroup = document.getElementById('banExpiryGroup');
        const closeBtn = banModal.querySelector('.ban-modal-close');
        const cancelBtn = banModal.querySelector('.ban-cancel-btn');

        banTypeSelect.addEventListener('change', function () {
            if (this.value === 'temporary') {
                banExpiryGroup.style.display = 'block';
                document.getElementById('banExpiry').required = true;

                const minDate = new Date();
                minDate.setHours(minDate.getHours() + 1);
                document.getElementById('banExpiry').min = minDate.toISOString().slice(0, 16);
            } else {
                banExpiryGroup.style.display = 'none';
                document.getElementById('banExpiry').required = false;
            }

            const submitText = banModal.querySelector('.ban-submit-text');
            if (this.value === 'permanent') {
                submitText.textContent = 'Permanently Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '🚫';
            } else if (this.value === 'temporary') {
                submitText.textContent = 'Temporarily Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '⏰';
            } else {
                submitText.textContent = 'Ban User';
                banModal.querySelector('.ban-submit-icon').textContent = '🔨';
            }
        });

        banForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            await handleBanUser();
        });

        closeBtn.addEventListener('click', closeBanModal);
        cancelBtn.addEventListener('click', closeBanModal);
    }

    function openBanModal(userId, username) {
        currentBanUserId = userId;
        currentBanUsername = username;

        document.getElementById('banUserName').textContent = username;
        document.getElementById('banUserId').textContent = `ID: #${userId}`;
        document.getElementById('banModalTitle').textContent = `Ban ${username}`;

        document.getElementById('banUserForm').reset();
        document.getElementById('banExpiryGroup').style.display = 'none';
        document.getElementById('banExpiry').required = false;

        banModal.style.display = 'block';
        banModal.classList.add('show');
    }

    function closeBanModal() {
        banModal.style.display = 'none';
        banModal.classList.remove('show');
        currentBanUserId = null;
        currentBanUsername = null;
    }

    async function handleBanUser() {
        const formData = new FormData(document.getElementById('banUserForm'));
        const banData = {
            userId: parseInt(currentBanUserId),
            banType: formData.get('banType'),
            banReason: formData.get('banReason'),
            banExpiry: formData.get('banExpiry') || null
        };

        if (banData.banType === 'temporary') {
            const expiryDate = new Date(banData.banExpiry);
            const now = new Date();

            if (expiryDate <= now) {
                showMessage('Ban expiry date must be in the future', 'error');
                return;
            }
        }

        const submitBtn = banModal.querySelector('.ban-submit-btn');
        if (!submitBtn) {
            console.error('Submit button not found');
            return;
        }

        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.innerHTML = '<span class="loading-spinner">⏳</span> Banning...';
            submitBtn.disabled = true;

            const response = await adminFetch('/api/admin/ban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(banData)
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                closeBanModal();
                loadUsers();
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to ban user', 'error');
            }
        } catch (error) {
            console.error('Ban request error:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            if (submitBtn && originalText) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    async function handleUnbanUser(userId, username) {
        if (!confirm(`Are you sure you want to unban "${username}"? They will regain full access to the platform.`)) {
            return;
        }

        try {
            const response = await adminFetch('/api/admin/unban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: parseInt(userId) })
            });

            if (!response) return;

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                loadUsers();
                loadAnalytics();
            } else {
                showMessage(result.error || 'Failed to unban user', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        }
    }

});

// BAN SYSTEM HELPER FUNCTIONS (outside DOMContentLoaded)
function getBanStatusHTML(user) {
    if (user.ban_status === 'active' || !user.ban_status) {
        return '<span class="ban-status ban-status-active">✅ Active</span>';
    } else if (user.ban_status === 'temp_banned') {
        const expiryDate = new Date(user.ban_expiry);
        const isExpired = expiryDate <= new Date();

        if (isExpired) {
            return '<span class="ban-status ban-status-expired">⏰ Expired</span>';
        } else {
            return `<span class="ban-status ban-status-temporary">⏰ Temp Ban<br><small>Until ${expiryDate.toLocaleDateString()}</small></span>`;
        }
    } else if (user.ban_status === 'banned') {
        return '<span class="ban-status ban-status-permanent">🚫 Permanent</span>';
    }

    return '<span class="ban-status ban-status-active">✅ Active</span>';
}

function getBanActionButton(user) {
    if (user.ban_status === 'active' || !user.ban_status) {
        return `<button class="btn btn-small btn-warning ban-action-btn" 
                       data-action="ban" data-user-id="${user.id}" data-username="${user.username}">
                    🔨 Ban User
                </button>`;
    } else {
        return `<button class="btn btn-small btn-success ban-action-btn" 
                       data-action="unban" data-user-id="${user.id}" data-username="${user.username}">
                    ✅ Unban User
                </button>`;
    }
}


// Enhanced Admin Tournament Creation JavaScript
// Game images mapping
const gameImages = {
    'Free Fire': '/images/games/freefire.jpg',
    'BGMI': '/images/games/bgmi.jpg',
    'Valorant': '/images/games/valorant.jpg',
    'CODM': '/images/games/codm.jpg'
};

// Initialize enhanced tournament creation
function initializeEnhancedTournamentCreation() {
    const gameTypeSelect = document.getElementById('gameType');
    const teamModeSelect = document.getElementById('teamMode');
    const autoFillBtn = document.getElementById('autoFillBtn');
    const tournamentForm = document.getElementById('createTournamentForm');

    // Auto-fill tournament name
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', autoFillTournamentName);
    }

    // Live preview updates
    if (gameTypeSelect) gameTypeSelect.addEventListener('change', updateTournamentPreview);
    if (teamModeSelect) teamModeSelect.addEventListener('change', updateTournamentPreview);

    // Form inputs for preview
    const previewInputs = [
        'tournamentName', 'entryFee', 'prizePool', 'maxParticipants'
    ];

    previewInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', updateTournamentPreview);
        }
    });

    // Enhanced form submission
    if (tournamentForm) {
        tournamentForm.removeEventListener('submit', handleEnhancedTournamentCreation);
        tournamentForm.addEventListener('submit', handleEnhancedTournamentCreation);
    }

    // Set default values
    setDefaultValues();
}

// Set default values for new fields
function setDefaultValues() {
    const killPointsInput = document.getElementById('killPoints');
    const rankPointsInput = document.getElementById('rankPoints');
    const matchTypeSelect = document.getElementById('matchType');

    if (killPointsInput && !killPointsInput.value) {
        killPointsInput.value = '1';
    }

    if (rankPointsInput && !rankPointsInput.value) {
        rankPointsInput.value = '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}';
    }

    if (matchTypeSelect && !matchTypeSelect.value) {
        matchTypeSelect.value = 'Battle Royale';
    }
}

// Auto-fill tournament name based on selection
function autoFillTournamentName() {
    const gameType = document.getElementById('gameType').value;
    const teamMode = document.getElementById('teamMode').value;
    const tournamentNameInput = document.getElementById('tournamentName');

    if (!gameType || !teamMode) {
        showMessage('Please select both game type and team mode first', 'warning');
        return;
    }

    const modeNames = {
        'solo': 'Solo',
        'duo': 'Duo',
        'squad': 'Squad'
    };

    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    const autoName = `${gameType} ${modeNames[teamMode]} Championship - ${dateString}`;

    if (tournamentNameInput) {
        tournamentNameInput.value = autoName;
        updateTournamentPreview();
    }
}

// Update tournament preview
function updateTournamentPreview() {
    const gameType = document.getElementById('gameType').value;
    const teamMode = document.getElementById('teamMode').value;
    const tournamentName = document.getElementById('tournamentName').value;
    const entryFee = document.getElementById('entryFee').value;
    const prizePool = document.getElementById('prizePool').value;
    const maxParticipants = document.getElementById('maxParticipants').value;

    const preview = document.getElementById('tournamentPreview');
    const previewGameImage = document.getElementById('previewGameImage');
    const previewGameBadge = document.getElementById('previewGameBadge');
    const previewModeBadge = document.getElementById('previewModeBadge');
    const previewName = document.getElementById('previewName');
    const previewFee = document.getElementById('previewFee');
    const previewPrize = document.getElementById('previewPrize');
    const previewMax = document.getElementById('previewMax');

    // Show preview if we have basic info
    if (gameType || teamMode || tournamentName) {
        if (preview) preview.style.display = 'block';

        // Update preview content
        if (previewGameImage && gameType) {
            previewGameImage.src = gameImages[gameType] || '/images/games/default.jpg';
        }

        if (previewGameBadge) {
            previewGameBadge.textContent = gameType || 'Select Game';
        }

        if (previewModeBadge) {
            const modeLabels = { 'solo': 'Solo', 'duo': 'Duo', 'squad': 'Squad' };
            previewModeBadge.textContent = modeLabels[teamMode] || 'Select Mode';
        }

        if (previewName) {
            previewName.textContent = tournamentName || 'Tournament Name';
        }

        if (previewFee) {
            previewFee.textContent = entryFee || '0';
        }

        if (previewPrize) {
            previewPrize.textContent = prizePool || '0';
        }

        if (previewMax) {
            previewMax.textContent = maxParticipants || '0';
        }
    } else {
        if (preview) preview.style.display = 'none';
    }
}

// Enhanced tournament creation handler
async function handleEnhancedTournamentCreation(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const tournamentData = {
        name: formData.get('name'),
        description: formData.get('description'),
        game_type: formData.get('game_type'),
        team_mode: formData.get('team_mode'),
        entry_fee: parseFloat(formData.get('entry_fee')),
        prize_pool: parseFloat(formData.get('prize_pool')),
        max_participants: parseInt(formData.get('max_participants')),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date'),
        kill_points: parseInt(formData.get('kill_points')) || 1,
        rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
        match_type: formData.get('match_type') || 'Battle Royale'
    };

    // Validation
    if (!tournamentData.name || !tournamentData.game_type || !tournamentData.team_mode) {
        showMessage('Please fill in all required fields including game type and team mode', 'error');
        return;
    }

    // Validate JSON format for rank points
    try {
        JSON.parse(tournamentData.rank_points);
    } catch (error) {
        showMessage('Invalid rank points format. Please use valid JSON format.', 'error');
        return;
    }

    // Validate dates
    const startDate = new Date(tournamentData.start_date);
    const endDate = new Date(tournamentData.end_date);
    const now = new Date();

    if (startDate < now) {
        showMessage('Start date cannot be in the past', 'error');
        return;
    }

    if (endDate <= startDate) {
        showMessage('End date must be after start date', 'error');
        return;
    }

    try {
        const submitBtn = e.target.querySelector('.create-tournament-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '🔄 Creating Tournament...';
        }

        // Use enhanced API endpoint
        const response = await fetch('/api/admin/tournaments/enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tournamentData)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message || 'Enhanced tournament created successfully!', 'success');

            // Reset form
            e.target.reset();
            setDefaultValues();
            updateTournamentPreview();

            // Refresh tournaments list if visible
            if (typeof loadTournaments === 'function') {
                await loadTournaments();
            }

        } else {
            throw new Error(result.error || 'Failed to create tournament');
        }

    } catch (error) {
        console.error('Enhanced tournament creation error:', error);
        showMessage(error.message || 'Failed to create tournament', 'error');
    } finally {
        const submitBtn = e.target.querySelector('.create-tournament-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 Create Enhanced Tournament';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure all elements are loaded
    setTimeout(() => {
        initializeEnhancedTournamentCreation();
    }, 500);
});

// Make functions globally available

window.initializeEnhancedTournamentCreation = initializeEnhancedTournamentCreation;
window.autoFillTournamentName = autoFillTournamentName;
window.updateTournamentPreview = updateTournamentPreview;

function initializeEntryFeeToggle() {
    const paidRadio = document.getElementById('paidTournament');
    const freeRadio = document.getElementById('freeTournament');
    const entryFeeInput = document.getElementById('entryFeeInput');
    const freeTournamentMessage = document.getElementById('freeTournamentMessage');
    const entryFeeField = document.getElementById('entryFee');
    const prizePoolField = document.getElementById('prizePool');

    if (!paidRadio || !freeRadio || !entryFeeInput || !freeTournamentMessage || !entryFeeField) {
        console.warn('Entry fee toggle elements not found');
        return;
    }

    function toggleEntryFeeMode() {
        if (freeRadio.checked) {
            // Free tournament mode
            entryFeeInput.style.display = 'none';
            freeTournamentMessage.style.display = 'block';
            entryFeeField.removeAttribute('required');
            entryFeeField.value = '0';
            entryFeeField.disabled = true;

            // Allow prize pool to be 0
            if (prizePoolField) {
                prizePoolField.removeAttribute('required');
                prizePoolField.placeholder = '0 (Optional for free tournaments)';
            }
        } else {
            // Paid tournament mode
            entryFeeInput.style.display = 'block';
            freeTournamentMessage.style.display = 'none';
            entryFeeField.setAttribute('required', 'required');
            entryFeeField.disabled = false;
            entryFeeField.value = '';

            // Require prize pool for paid tournaments
            if (prizePoolField) {
                prizePoolField.setAttribute('required', 'required');
                prizePoolField.placeholder = '500.00';
            }
        }
    }

    paidRadio.addEventListener('change', toggleEntryFeeMode);
    freeRadio.addEventListener('change', toggleEntryFeeMode);
    toggleEntryFeeMode(); // Initialize
}

// Initialize when DOM is ready
setTimeout(() => {
    initializeEntryFeeToggle();
}, 1000);

// Enhanced Tournament Creation Form Handler - FIXED VERSION
function enhancedCreateTournamentFormHandler(e) {
    e.preventDefault();

    // PREVENT DOUBLE SUBMISSION
    if (window.isCreatingTournament) {
        console.log('Tournament creation already in progress...');
        return;
    }

    window.isCreatingTournament = true;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '🔄 Creating Tournament...';

        const formData = new FormData(e.target);

        // FIXED: Better handling of entry fee to prevent NaN
        let entryFee = 0;
        const tournamentType = formData.get('tournamentType');

        if (tournamentType === 'free') {
            entryFee = 0; // Explicitly set to 0
            console.log('🎉 Creating FREE tournament (entry fee: $0)');
        } else {
            const entryFeeValue = formData.get('entry_fee');

            // FIXED: Better validation and parsing to prevent NaN
            if (entryFeeValue && entryFeeValue.trim() !== '') {
                entryFee = parseFloat(entryFeeValue);

                // Check if parsing resulted in NaN
                if (isNaN(entryFee) || entryFee <= 0) {
                    throw new Error('Please enter a valid entry fee amount for paid tournaments (minimum $0.01)');
                }
            } else {
                throw new Error('Entry fee is required for paid tournaments');
            }

            console.log('💰 Creating PAID tournament (entry fee: $' + entryFee + ')');
        }

        // FIXED: Ensure all numeric values are properly parsed
        const prizePoolValue = formData.get('prize_pool');
        const maxParticipantsValue = formData.get('max_participants');
        const killPointsValue = formData.get('kill_points');

        const prizePool = parseFloat(prizePoolValue) || 0;
        const maxParticipants = parseInt(maxParticipantsValue) || 0;
        const killPoints = parseInt(killPointsValue) || 1;

        // Validate required numeric fields
        if (prizePool <= 0) {
            throw new Error('Prize pool must be greater than 0');
        }
        if (maxParticipants <= 0) {
            throw new Error('Max participants must be greater than 0');
        }

        const tournamentData = {
            name: formData.get('name'),
            description: formData.get('description'),
            game_type: formData.get('game_type'),
            team_mode: formData.get('team_mode'),
            entry_fee: entryFee, // This will be 0 for free tournaments, never NaN or null
            prize_pool: prizePool,
            max_participants: maxParticipants,
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            kill_points: killPoints,
            rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
            match_type: formData.get('match_type') || 'Battle Royale'
        };

        console.log('Creating tournament with data:', tournamentData);

        // FIXED: Additional validation before sending
        if (tournamentData.entry_fee === null || isNaN(tournamentData.entry_fee)) {
            console.error('Entry fee validation failed:', tournamentData.entry_fee);
            throw new Error('Entry fee validation failed');
        }

        // Create tournament using enhanced endpoint
        createTournamentWithAPI(tournamentData, submitBtn, originalText, e.target);

    } catch (error) {
        console.error('Tournament creation error:', error);
        showMessage(error.message || 'Failed to create tournament', 'error');

        // Re-enable button
        window.isCreatingTournament = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// API call to create tournament - SAME AS BEFORE
async function createTournamentWithAPI(tournamentData, submitBtn, originalText, form) {
    try {
        console.log('Sending tournament data to API:', tournamentData);

        const response = await fetch('/api/admin/tournaments/enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tournamentData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const tournamentTypeMessage = tournamentData.entry_fee === 0 ?
                '🎉 FREE tournament created successfully!' :
                `💰 PAID tournament created successfully! Entry fee: $${tournamentData.entry_fee}`;

            showMessage(result.message || tournamentTypeMessage, 'success');

            // Reset form
            form.reset();

            // FIXED: Reinitialize toggle state after reset
            setTimeout(() => {
                if (typeof initializeEntryFeeToggle === 'function') {
                    initializeEntryFeeToggle();
                }
            }, 100);

            // Refresh data
            if (typeof loadAnalytics === 'function') {
                loadAnalytics();
            }
            if (document.getElementById('tournamentsTab') && document.getElementById('tournamentsTab').classList.contains('active')) {
                if (typeof loadTournaments === 'function') {
                    loadTournaments();
                }
            }
        } else {
            console.error('API Error Response:', result);
            throw new Error(result.error || 'Failed to create tournament');
        }
    } catch (error) {
        console.error('API call error:', error);
        showMessage(error.message || 'Network error. Please try again.', 'error');
    } finally {
        // Re-enable button and reset state
        window.isCreatingTournament = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// FIXED: Enhanced form validation before submit
function validateTournamentForm() {
    const tournamentType = document.querySelector('input[name="tournamentType"]:checked')?.value;
    const entryFeeField = document.getElementById('entryFee');

    if (tournamentType === 'paid') {
        const entryFeeValue = parseFloat(entryFeeField.value);
        if (!entryFeeValue || entryFeeValue <= 0) {
            showMessage('Please enter a valid entry fee for paid tournaments', 'error');
            entryFeeField.focus();
            return false;
        }
    } else if (tournamentType === 'free') {
        // For free tournaments, ensure entry fee is 0
        entryFeeField.value = '0';
    }

    return true;
}

// Initialize when DOM is ready - FIXED VERSION
document.addEventListener('DOMContentLoaded', function () {
    // Wait for page to fully load
    setTimeout(() => {
        console.log('🔧 Initializing enhanced tournament creation...');

        // Initialize the toggle functionality
        initializeEntryFeeToggle();

        // Replace the form handler if it exists
        const createTournamentForm = document.getElementById('createTournamentForm');
        if (createTournamentForm) {
            // Remove any existing listeners
            createTournamentForm.removeEventListener('submit', enhancedCreateTournamentFormHandler);

            // Add form validation before submit
            createTournamentForm.addEventListener('submit', function (e) {
                // Validate form first
                if (!validateTournamentForm()) {
                    e.preventDefault();
                    return false;
                }

                // If validation passes, handle enhanced creation
                enhancedCreateTournamentFormHandler(e);
            });

            console.log('✅ Enhanced tournament creation form handler initialized');
        } else {
            console.warn('⚠️ createTournamentForm not found');
        }

    }, 1000);
});

// Make functions globally available
window.initializeEntryFeeToggle = initializeEntryFeeToggle;
window.enhancedCreateTournamentFormHandler = enhancedCreateTournamentFormHandler;
window.validateTournamentForm = validateTournamentForm;
window.createTournamentWithAPI = createTournamentWithAPI;

// 1. RESET ALL TOURNAMENT CREATION HANDLERS
document.addEventListener('DOMContentLoaded', function () {
    // Wait a bit for page to load
    setTimeout(() => {
        console.log('🔧 Applying quick fixes...');

        // Reset the creation flag
        window.isCreatingTournament = false;

        // Find the form
        const createTournamentForm = document.getElementById('createTournamentForm');
        if (!createTournamentForm) {
            console.warn('Tournament form not found');
            return;
        }

        // COMPLETELY REMOVE ALL EXISTING EVENT LISTENERS
        const newForm = createTournamentForm.cloneNode(true);
        createTournamentForm.parentNode.replaceChild(newForm, createTournamentForm);

        // ADD ONLY ONE EVENT LISTENER
        newForm.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling

            console.log('🎯 SINGLE tournament creation handler called');

            // STRICT double submission check
            if (window.isCreatingTournament === true) {
                console.log('❌ Already creating tournament, skipping...');
                return false;
            }

            // Set flag immediately
            window.isCreatingTournament = true;

            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            // Disable button immediately
            submitBtn.disabled = true;
            submitBtn.innerHTML = '🔄 Creating...';

            // Get form data
            const formData = new FormData(newForm);

            // FIXED: Properly handle tournament type
            const tournamentType = formData.get('tournamentType') || 'paid'; // Default to paid
            let entryFee = 0;

            if (tournamentType === 'free') {
                entryFee = 0;
                console.log('✅ Free tournament - entry fee set to 0');
            } else {
                const entryFeeValue = formData.get('entry_fee');
                if (entryFeeValue && entryFeeValue.trim() !== '') {
                    entryFee = parseFloat(entryFeeValue);
                    if (isNaN(entryFee) || entryFee < 0) {
                        resetCreationState(submitBtn, originalText);
                        showMessage('Please enter a valid entry fee', 'error');
                        return;
                    }
                } else {
                    resetCreationState(submitBtn, originalText);
                    showMessage('Entry fee is required for paid tournaments', 'error');
                    return;
                }
            }

            // Handle prize pool - allow 0 for free tournaments
            let prizePool = 0;
            const prizePoolValue = formData.get('prize_pool');
            if (prizePoolValue && prizePoolValue.trim() !== '') {
                prizePool = parseFloat(prizePoolValue);
                if (isNaN(prizePool) || prizePool < 0) {
                    resetCreationState(submitBtn, originalText);
                    showMessage('Prize pool cannot be negative', 'error');
                    return;
                }
            }

            const tournamentData = {
                name: formData.get('name'),
                description: formData.get('description'),
                game_type: formData.get('game_type'),
                team_mode: formData.get('team_mode'),
                entry_fee: entryFee, // This will be 0 for free tournaments
                prize_pool: prizePool, // This can be 0
                max_participants: parseInt(formData.get('max_participants')),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                kill_points: parseInt(formData.get('kill_points')) || 1,
                rank_points: formData.get('rank_points') || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
                match_type: formData.get('match_type') || 'Battle Royale'
            };

            console.log('📤 Sending tournament data:', tournamentData);

            // SINGLE API CALL
            fetch('/api/admin/tournaments/enhanced', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tournamentData)
            })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        const message = entryFee === 0 ?
                            '🎉 FREE tournament created successfully!' :
                            `💰 PAID tournament created successfully!`;

                        showMessage(message, 'success');
                        newForm.reset();

                        // Refresh data
                        if (typeof loadAnalytics === 'function') loadAnalytics();
                        if (typeof loadTournaments === 'function') loadTournaments();
                    } else {
                        throw new Error(result.error || 'Failed to create tournament');
                    }
                })
                .catch(error => {
                    console.error('❌ Tournament creation error:', error);
                    showMessage(error.message || 'Failed to create tournament', 'error');
                })
                .finally(() => {
                    resetCreationState(submitBtn, originalText);
                });
        });

        console.log('✅ Quick fix applied successfully');

    }, 2000); // Wait 2 seconds for everything to load
});

// Helper function to reset state
function resetCreationState(submitBtn, originalText) {
    window.isCreatingTournament = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
}
