/**
 * Unified Tournament System - Fixed Version
 * Resolves all filter issues and JavaScript conflicts
 */

// Global state management
let state = {
    allTournaments: [],
    filteredTournaments: [],
    currentUser: null,
    isLoading: false,
    currentFilters: {
        game: 'all',
        mode: 'all'
    }
};

// DOM elements cache
let elements = {};

// Game configurations
const gameImages = {
    'Free Fire': '/images/games/freefire.jpg',
    'BGMI': '/images/games/bgmi.jpg',
    'Valorant': '/images/games/valorant.jpg',
    'CODM': '/images/games/codm.jpg'
};

const teamModeConfig = {
    'solo': { size: 1, label: 'Solo' },
    'duo': { size: 2, label: 'Duo' },
    'squad': { size: 4, label: 'Squad' }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tournament system initializing...');
    initializeSystem();
});

/**
 * Initialize the tournament system
 */
async function initializeSystem() {
    try {
        // Cache DOM elements
        cacheElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        await Promise.all([
            loadUserInfo(),
            loadTournaments()
        ]);
        
        // Setup filters AFTER tournaments are loaded
        setupFilters();
        
        console.log('Tournament system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize tournament system:', error);
        showError('Failed to initialize system. Please refresh the page.');
    }
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    elements = {
        usernameDisplay: document.getElementById('username-display'),
        logoutBtn: document.getElementById('logoutBtn'),
        walletBalance: document.getElementById('walletBalance'),
        winningsBalance: document.getElementById('winningsBalance'),
        tournamentsGrid: document.getElementById('tournaments-grid'),
        tournamentsContainer: document.getElementById('tournaments-container'),
        gameFilter: document.getElementById('gameFilter'),
        modeFilter: document.getElementById('modeFilter'),
        clearFilters: document.getElementById('clearFilters'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        message: document.getElementById('message'),
        retryBtn: document.getElementById('retry-btn')
    };
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Logout handler
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Retry handler
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            hideError();
            loadTournaments();
        });
    }
    
    // Tournament card interactions (event delegation)
    if (elements.tournamentsGrid) {
        elements.tournamentsGrid.addEventListener('click', handleTournamentInteraction);
    }
}

/**
 * Setup filter functionality AFTER tournaments are loaded
 */
function setupFilters() {
    console.log('Setting up filters with', state.allTournaments.length, 'tournaments');
    
    // Game filter
    if (elements.gameFilter) {
        elements.gameFilter.removeEventListener('change', handleFilterChange);
        elements.gameFilter.addEventListener('change', handleFilterChange);
    }
    
    // Mode filter
    if (elements.modeFilter) {
        elements.modeFilter.removeEventListener('change', handleFilterChange);
        elements.modeFilter.addEventListener('change', handleFilterChange);
    }
    
    // Clear filters
    if (elements.clearFilters) {
        elements.clearFilters.addEventListener('click', clearAllFilters);
    }
    
    console.log('Filters setup complete');
}

/**
 * Handle filter changes
 */
function handleFilterChange() {
    // Update current filters
    state.currentFilters.game = elements.gameFilter ? elements.gameFilter.value : 'all';
    state.currentFilters.mode = elements.modeFilter ? elements.modeFilter.value : 'all';
    
    console.log('Filter changed:', state.currentFilters);
    
    // Apply filters
    applyFilters();
}

/**
 * Apply current filters to tournaments
 */
function applyFilters() {
    if (!state.allTournaments || state.allTournaments.length === 0) {
        console.log('No tournaments to filter');
        return;
    }
    
    let filtered = [...state.allTournaments];
    
    // Apply game filter
    if (state.currentFilters.game && state.currentFilters.game !== 'all') {
        filtered = filtered.filter(tournament => {
            const gameType = tournament.game_type || 'Free Fire';
            return gameType === state.currentFilters.game;
        });
    }
    
    // Apply mode filter
    if (state.currentFilters.mode && state.currentFilters.mode !== 'all') {
        filtered = filtered.filter(tournament => {
            const teamMode = tournament.team_mode || 'solo';
            return teamMode === state.currentFilters.mode;
        });
    }
    
    console.log(`Filtered ${state.allTournaments.length} tournaments to ${filtered.length}`);
    
    state.filteredTournaments = filtered;
    renderTournaments(filtered);
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    if (elements.gameFilter) elements.gameFilter.value = 'all';
    if (elements.modeFilter) elements.modeFilter.value = 'all';
    
    state.currentFilters = { game: 'all', mode: 'all' };
    
    state.filteredTournaments = [...state.allTournaments];
    renderTournaments(state.filteredTournaments);
}

/**
 * Load user information
 */
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('Failed to load user info');
        
        state.currentUser = await response.json();
        
        // Update UI
        if (elements.usernameDisplay) {
            elements.usernameDisplay.textContent = `Welcome, ${state.currentUser.username}`;
        }
        
        if (elements.walletBalance) {
            elements.walletBalance.textContent = state.currentUser.wallet_balance.toFixed(2);
        }
        
        if (elements.winningsBalance) {
            elements.winningsBalance.textContent = state.currentUser.winnings_balance.toFixed(2);
        }
        
        console.log('User info loaded:', state.currentUser.username);
    } catch (error) {
        console.error('Error loading user info:', error);
        // Don't show error for user info as it's not critical
    }
}

/**
 * Load tournaments from server
 */
async function loadTournaments() {
    try {
        showLoading();
        hideError();
        
        // Try enhanced API first, fallback to basic
        let response;
        try {
            response = await fetch('/api/tournaments/enhanced');
            if (!response.ok) throw new Error('Enhanced API failed');
        } catch (enhancedError) {
            console.log('Enhanced API failed, using fallback');
            response = await fetch('/api/tournaments');
            if (!response.ok) throw new Error('Fallback API failed');
        }
        
        const tournaments = await response.json();
        
        // Store tournaments
        state.allTournaments = tournaments;
        state.filteredTournaments = [...tournaments];
        
        console.log('Loaded tournaments:', tournaments.length);
        
        // Render tournaments
        renderTournaments(tournaments);
        
    } catch (error) {
        console.error('Error loading tournaments:', error);
        showError('Failed to load tournaments');
    } finally {
        hideLoading();
    }
}

/**
 * Render tournaments to the grid
 */
function renderTournaments(tournaments) {
    if (!elements.tournamentsGrid) {
        console.error('Tournament grid element not found');
        return;
    }
    
    console.log('Rendering tournaments:', tournaments.length);
    
    if (tournaments.length === 0) {
        elements.tournamentsGrid.innerHTML = `
            <div class="no-tournaments">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🎮</div>
                <div>No tournaments match your filters</div>
                <div style="margin-top: 12px; font-size: 14px; opacity: 0.7;">
                    Try changing your filter selection
                </div>
            </div>
        `;
        return;
    }
    
    // Render tournament cards
    elements.tournamentsGrid.innerHTML = tournaments
        .map(tournament => createTournamentCard(tournament))
        .join('');
}


 /* Create tournament card HTML*/
 
 function createTournamentCard(tournament) {
    const gameClass = (tournament.game_type || 'freefire').toLowerCase().replace(' ', '');
    const modeConfig = teamModeConfig[tournament.team_mode || 'solo'] || teamModeConfig.solo;
    const statusClass = 'status-' + tournament.status;
    const isRegistered = tournament.is_registered === 1;
    const isFull = tournament.current_participants >= tournament.max_participants;
    
    // Format dates safely
    const startDate = formatDate(tournament.start_date);
    const startTime = formatTime(tournament.start_date);
    
    // FIXED: Better image handling with proper fallback
    const gameImageUrl = gameImages[tournament.game_type] || gameImages['Free Fire'];
    const fallbackImageUrl = 'https://via.placeholder.com/320x200/667eea/ffffff?text=' + encodeURIComponent('🎮 ' + (tournament.game_type || 'Game'));
    
    return `
        <div class="tournament-card game-${gameClass}" data-tournament-id="${tournament.id}">
            <div class="tournament-card-header">
                <img src="${gameImageUrl}"
                     alt="${tournament.game_type || 'Tournament'}"
                     class="game-image"
                     onerror="handleImageError(this, '${fallbackImageUrl}')">
                <div class="game-badge">${tournament.game_type || 'Free Fire'}</div>
                <div class="team-mode-badge">${modeConfig.label}</div>
            </div>
            
            <div class="tournament-card-content">
                <h3 class="tournament-title">${escapeHtml(tournament.name)}</h3>
                <p class="tournament-description">${escapeHtml(tournament.description || 'Join this exciting tournament!')}</p>
                
                <div class="tournament-stats">
                    <div class="stat-item">
                        <div class="stat-label">Prize Pool</div>
                        <div class="stat-value prize">₹${tournament.prize_pool}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Entry Fee</div>
                        <div class="stat-value fee">₹${tournament.entry_fee}</div>
                    </div>
                </div>
                
                <div class="tournament-info">
                    <div class="participants-info">
                        <span class="participants-count">${tournament.current_participants}</span>/${tournament.max_participants} players
                    </div>
                    <div class="tournament-status ${statusClass}">${tournament.status}</div>
                </div>
                
                <div class="tournament-schedule">
                    <div class="schedule-item">
                        <span class="schedule-label">Date:</span>
                        <span class="schedule-value">${startDate}</span>
                    </div>
                    <div class="schedule-item">
                        <span class="schedule-label">Time:</span>
                        <span class="schedule-value">${startTime}</span>
                    </div>
                </div>
                
                ${renderRegisterButton(tournament, isRegistered, isFull)}
            </div>
        </div>
    `;
}

/**
 * FIXED: Handle image errors properly without infinite loops
 */
 function handleImageError(img, fallbackUrl) {
    // Prevent infinite loop - check if already failed
    if (img.hasAttribute('data-fallback-failed')) {
        console.log('Image fallback already failed, creating game icon');
        createGameIcon(img);
        return;
    }
    
    // Mark as failed to prevent infinite loop
    img.setAttribute('data-fallback-failed', 'true');
    
    // Remove the onerror to prevent further calls
    img.onerror = null;
    
    // Create a simple game icon instead
    createGameIcon(img);
}

/**
 * Create a simple game icon when image fails
 */
function createGameIcon(img) {
    // Hide the broken image
    img.style.display = 'none';
    
    // Get the game type from alt text or parent
    const gameType = img.alt || 'Game';
    
    // Create icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'game-icon-fallback';
    iconContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        font-size: 48px;
        text-align: center;
        flex-direction: column;
        gap: 8px;
    `;
    
    // Add game icon and text
    iconContainer.innerHTML = `
        <div style="font-size: 48px;">🎮</div>
        <div style="font-size: 14px; font-weight: 600;">${gameType}</div>
    `;
    
    // Replace the image with icon
    img.parentElement.appendChild(iconContainer);
}

// Make function globally available
window.handleImageError = handleImageError;

/**
 * Render register button based on tournament state
 */
function renderRegisterButton(tournament, isRegistered, isFull) {
    if (isRegistered) {
        return `
            <button class="register-btn registered" data-action="enter" data-tournament-id="${tournament.id}">
                🎮 Enter Tournament
            </button>
        `;
    }
    
    if (isFull) {
        return `<button class="register-btn" disabled>Tournament Full</button>`;
    }
    
    if (tournament.status !== 'upcoming') {
        return `<button class="register-btn" disabled>Registration Closed</button>`;
    }
    
    // Check user balance
    if (state.currentUser) {
        const totalBalance = state.currentUser.wallet_balance + state.currentUser.winnings_balance;
        if (totalBalance < tournament.entry_fee) {
            return `<button class="register-btn" disabled>Insufficient Balance</button>`;
        }
    }
    
    const buttonText = (tournament.team_mode === 'solo' || !tournament.team_mode) ? 'Register Now' : 'Create Team';
    const action = (tournament.team_mode === 'solo' || !tournament.team_mode) ? 'register' : 'create-team';
    
    return `
        <button class="register-btn" 
                data-action="${action}" 
                data-tournament-id="${tournament.id}"
                data-team-mode="${tournament.team_mode || 'solo'}"
                data-entry-fee="${tournament.entry_fee}">
            ${buttonText}
        </button>
    `;
}

/**
 * Handle tournament interactions (register, enter, etc.)
 */
async function handleTournamentInteraction(event) {
    const button = event.target.closest('.register-btn');
    if (!button) return;
    
    event.preventDefault();
    
    const action = button.getAttribute('data-action');
    const tournamentId = parseInt(button.getAttribute('data-tournament-id'));
    const teamMode = button.getAttribute('data-team-mode') || 'solo';
    const entryFee = parseFloat(button.getAttribute('data-entry-fee') || 0);
    
    console.log('Tournament interaction:', { action, tournamentId, teamMode, entryFee });
    
    switch (action) {
        case 'register':
            await handleRegister(tournamentId, entryFee, button);
            break;
        case 'create-team':
            handleCreateTeam(tournamentId);
            break;
        case 'enter':
            handleEnterTournament(tournamentId);
            break;
    }
}

/**
 * Handle tournament registration
 */
async function handleRegister(tournamentId, entryFee, button) {
    if (!confirm(`Register for this tournament? Entry fee: ₹${entryFee}`)) {
        return;
    }
    
    const originalText = button.innerHTML;
    
    try {
        // Update button state
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span>Registering...';
        
        const response = await fetch('/api/tournaments/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tournamentId })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Registration successful!', 'success');
            
            // Reload data
            await Promise.all([
                loadTournaments(),
                loadUserInfo()
            ]);
            
        } else {
            throw new Error(result.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showMessage(error.message || 'Registration failed', 'error');
        
        // Restore button
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

/**
 * Handle team creation (placeholder for now)
 */
function handleCreateTeam(tournamentId) {
    // For now, just register as solo
    // You can implement team modal here later
    const tournament = state.allTournaments.find(t => t.id === tournamentId);
    if (tournament) {
        const button = document.querySelector(`[data-tournament-id="${tournamentId}"]`);
        handleRegister(tournamentId, tournament.entry_fee, button);
    }
}

/**
 * Handle entering tournament
 */
function handleEnterTournament(tournamentId) {
    window.location.href = `/tournament/${tournamentId}`;
}

/**
 * Handle logout
 */
async function handleLogout() {
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
}

/**
 * Utility functions
 */
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString();
    } catch {
        return 'TBD';
    }
}

function formatTime(dateString) {
    try {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'TBD';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * UI state management
 */
function showLoading() {
    if (elements.loadingState) elements.loadingState.style.display = 'block';
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'none';
}

function hideLoading() {
    if (elements.loadingState) elements.loadingState.style.display = 'none';
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'grid';
}

function showError(message) {
    if (elements.errorState) {
        elements.errorState.style.display = 'block';
        elements.errorState.querySelector('p').textContent = message;
    }
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'none';
}

function hideError() {
    if (elements.errorState) elements.errorState.style.display = 'none';
}

function showMessage(message, type = 'info') {
    if (!elements.message) return;
    
    elements.message.textContent = message;
    elements.message.className = `message ${type}`;
    elements.message.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (elements.message) {
            elements.message.style.display = 'none';
        }
    }, 5000);
}

// Make some functions globally available for debugging
window.tournamentSystem = {
    state,
    loadTournaments,
    applyFilters,
    clearAllFilters
};
