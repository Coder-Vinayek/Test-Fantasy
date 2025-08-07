/**
 * Enhanced Tournament System with Duo/Squad Registration Support
 * Compatible with Node.js 12.22
 * Replace your existing tournaments.js file with this enhanced version
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

// Default values for tournaments without game_type
const defaultGameData = {
    game_type: 'Free Fire',
    team_mode: 'solo',
    game_image_url: '/images/games/freefire.jpg'
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enhanced Tournament system initializing...');
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
        
        console.log('Enhanced Tournament system initialized successfully');
        
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
        elements.retryBtn.addEventListener('click', function() {
            hideError();
            loadTournaments();
        });
    }
}

/**
 * Setup filter functionality
 */
function setupFilters() {
    if (elements.gameFilter) {
        elements.gameFilter.addEventListener('change', applyFilters);
    }
    if (elements.modeFilter) {
        elements.modeFilter.addEventListener('change', applyFilters);
    }
    if (elements.clearFilters) {
        elements.clearFilters.addEventListener('click', clearAllFilters);
    }
}

/**
 * Load tournaments using enhanced API
 */
async function loadTournaments() {
    try {
        showLoading();
        state.isLoading = true;
        console.log('Loading tournaments from enhanced API...');
        
        const response = await fetch('/api/tournaments/enhanced');
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        
        const tournaments = await response.json();
        console.log('Raw tournaments data:', tournaments);
        
        // Process tournaments to ensure they have game data
        state.allTournaments = tournaments.map(function(tournament) {
            return Object.assign({}, tournament, {
                // Use database values or fallback to defaults
                game_type: tournament.game_type || defaultGameData.game_type,
                team_mode: tournament.team_mode || defaultGameData.team_mode,
                game_image_url: tournament.game_image_url || gameImages[tournament.game_type] || defaultGameData.game_image_url
            });
        });
        
        state.filteredTournaments = state.allTournaments.slice(); // Array copy for Node 12.22
        
        console.log('Processed tournaments:', state.allTournaments);
        
        renderTournaments();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading tournaments:', error);
        showError('Failed to load tournaments. Please try again.');
        state.allTournaments = [];
        state.filteredTournaments = [];
    } finally {
        state.isLoading = false;
    }
}

/**
 * Render tournaments with proper game data
 */
function renderTournaments() {
    if (!elements.tournamentsGrid) {
        console.error('Tournaments grid element not found');
        return;
    }
    
    elements.tournamentsGrid.innerHTML = '';
    
    if (state.filteredTournaments.length === 0) {
        elements.tournamentsGrid.innerHTML = 
            '<div class="no-tournaments">' +
            '<h3>No tournaments found</h3>' +
            '<p>Try adjusting your filters or check back later for new tournaments.</p>' +
            '</div>';
        return;
    }
    
    state.filteredTournaments.forEach(function(tournament) {
        const card = createTournamentCard(tournament);
        elements.tournamentsGrid.appendChild(card);
    });
}

/**
 * Create tournament card with dynamic data
 */
function createTournamentCard(tournament) {
    const card = document.createElement('div');
    card.className = 'tournament-card';
    card.dataset.tournamentId = tournament.id;
    
    // Use actual tournament data instead of hardcoded values
    const gameType = tournament.game_type || 'Unknown Game';
    const teamMode = tournament.team_mode || 'solo';
    const gameImage = tournament.game_image_url || gameImages[gameType] || '/images/games/default.jpg';
    const teamModeLabel = (teamModeConfig[teamMode] && teamModeConfig[teamMode].label) || 
                         teamMode.charAt(0).toUpperCase() + teamMode.slice(1);
    
    // Format dates
    const startDate = formatDate(tournament.start_date);
    const startTime = formatTime(tournament.start_date);
    
    // Registration status
    const isRegistered = tournament.is_registered === 1;
    const isFull = tournament.current_participants >= tournament.max_participants;
    
    card.innerHTML = 
        '<div class="tournament-card-header">' +
        '<div class="tournament-image-container">' +
        '<img src="' + gameImage + '" alt="' + gameType + '" class="tournament-image" ' +
        'onerror="this.src=\'/images/games/default.jpg\'">' +
        '<div class="tournament-status ' + tournament.status + '">' + tournament.status.toUpperCase() + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="tournament-card-body">' +
        '<div class="tournament-badges">' +
        '<span class="game-badge">' + escapeHtml(gameType) + '</span>' +
        '<span class="mode-badge">' + escapeHtml(teamModeLabel) + '</span>' +
        '</div>' +
        '<h3 class="tournament-name">' + escapeHtml(tournament.name) + '</h3>' +
        '<p class="tournament-description">' + escapeHtml(tournament.description || 'No description available') + '</p>' +
        '<div class="tournament-details">' +
        '<div class="detail-row">' +
        '<span class="detail-label">Prize Pool:</span>' +
        '<span class="detail-value prize">₹' + tournament.prize_pool + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Entry Fee:</span>' +
        '<span class="detail-value fee">₹' + tournament.entry_fee + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Participants:</span>' +
        '<span class="detail-value">' + tournament.current_participants + '/' + tournament.max_participants + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Date:</span>' +
        '<span class="detail-value">' + startDate + '</span>' +
        '</div>' +
        '<div class="detail-row">' +
        '<span class="detail-label">Time:</span>' +
        '<span class="detail-value">' + startTime + '</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="tournament-card-footer">' +
        createActionButton(tournament, isRegistered, isFull) +
        '</div>';
    
    // Add event listeners
    setupCardEventListeners(card, tournament);
    
    return card;
}

/**
 * Create action button based on tournament state
 */
function createActionButton(tournament, isRegistered, isFull) {
    if (isRegistered) {
        return '<button class="btn btn-success btn-block" disabled>✓ Registered</button>' +
               '<button class="btn btn-primary btn-sm view-lobby-btn" data-tournament-id="' + tournament.id + '">' +
               'View Lobby</button>';
    }
    
    if (isFull) {
        return '<button class="btn btn-secondary btn-block" disabled>Tournament Full</button>';
    }
    
    if (tournament.status !== 'upcoming') {
        return '<button class="btn btn-secondary btn-block" disabled>Registration Closed</button>';
    }
    
    return '<button class="btn btn-primary btn-block register-btn" data-tournament-id="' + tournament.id + '">' +
           'Register Now</button>';
}

/**
 * Setup event listeners for tournament card
 */
function setupCardEventListeners(card, tournament) {
    // Register button
    const registerBtn = card.querySelector('.register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            openRegistrationModal(tournament);
        });
    }
    
    // View lobby button
    const lobbyBtn = card.querySelector('.view-lobby-btn');
    if (lobbyBtn) {
        lobbyBtn.addEventListener('click', function() {
            window.location.href = '/tournament/' + tournament.id;
        });
    }
    
    // Card click for details
    card.addEventListener('click', function(e) {
        if (!e.target.closest('button')) {
            showTournamentDetails(tournament);
        }
    });
}

/**
 * ENHANCED: Open registration modal based on tournament type
 */
function openRegistrationModal(tournament) {
    console.log('Opening registration modal for tournament:', tournament);
    
    // Check if tournament is Battle Royale and supports team modes
    const isBattleRoyale = tournament.match_type === 'Battle Royale';
    const teamMode = tournament.team_mode;
    
    console.log('Tournament details:', {
        name: tournament.name,
        match_type: tournament.match_type,
        team_mode: teamMode,
        isBattleRoyale: isBattleRoyale
    });
    
    // Solo tournament or non-Battle Royale - register directly
    if (teamMode === 'solo' || !isBattleRoyale) {
        registerForTournament(tournament.id, 'solo');
        return;
    }
    
    // Duo/Squad Battle Royale tournament - show registration form
    if ((teamMode === 'duo' || teamMode === 'squad') && isBattleRoyale) {
        showTeamRegistrationModal(tournament);
        return;
    }
    
    // Fallback to solo registration
    registerForTournament(tournament.id, 'solo');
}

/**
 * ENHANCED: Show team registration modal for duo/squad
 */
function showTeamRegistrationModal(tournament) {
    const isSquad = tournament.team_mode === 'squad';
    const modalId = isSquad ? 'squadRegistrationModal' : 'duoRegistrationModal';
    
    // Remove existing modal if any
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'registration-modal';
    modal.innerHTML = createTeamRegistrationHTML(tournament, isSquad);
    
    document.body.appendChild(modal);
    
    // Setup modal event listeners
    setupTeamModalEventListeners(modal, tournament, isSquad);
    
    // Show modal
    modal.style.display = 'block';
    
    // Auto-fill current user's username
    fillCurrentUserData();
}

/**
 * Create team registration HTML
 */
function createTeamRegistrationHTML(tournament, isSquad) {
    const teamType = isSquad ? 'Squad' : 'Duo';
    const playerCount = isSquad ? '4 main players + 1 substitute' : '2 players';
    
    if (isSquad) {
        return createSquadRegistrationHTML(tournament);
    } else {
        return createDuoRegistrationHTML(tournament);
    }
}

/**
 * Create duo registration HTML
 */
function createDuoRegistrationHTML(tournament) {
    return '<div class="modal-overlay">' +
           '<div class="modal-content">' +
           '<div class="modal-header">' +
           '<h3>Duo Registration - ' + escapeHtml(tournament.name) + '</h3>' +
           '<button class="modal-close" onclick="closeRegistrationModal()">&times;</button>' +
           '</div>' +
           '<div class="modal-body">' +
           '<form id="duoRegistrationForm">' +
           '<div class="form-section">' +
           '<h4>Player 1 (You - Team Leader)</h4>' +
           '<div class="form-group">' +
           '<label for="player1Username">Your Username:</label>' +
           '<input type="text" id="player1Username" name="player1Username" readonly class="readonly-input">' +
           '</div>' +
           '<div class="form-group">' +
           '<label for="player1IGN">Your IGN (In Game Name):</label>' +
           '<input type="text" id="player1IGN" name="player1IGN" required placeholder="Enter your in-game name">' +
           '</div>' +
           '</div>' +
           '<div class="form-section">' +
           '<h4>Player 2 (Teammate)</h4>' +
           '<div class="form-group">' +
           '<label for="player2Username">Teammate Username:</label>' +
           '<input type="text" id="player2Username" name="player2Username" required placeholder="Enter teammate\'s username">' +
           '<div class="validation-feedback" id="player2Validation"></div>' +
           '</div>' +
           '<div class="form-group">' +
           '<label for="player2IGN">Teammate IGN (In Game Name):</label>' +
           '<input type="text" id="player2IGN" name="player2IGN" required placeholder="Enter teammate\'s in-game name">' +
           '</div>' +
           '</div>' +
           '<div class="registration-note">' +
           '<p><strong>Note:</strong> All players should be registered in this website. ' +
           'Match ID and Pass will also be shared with the provided usernames.</p>' +
           '</div>' +
           '<div class="form-actions">' +
           '<button type="button" class="btn btn-secondary" onclick="closeRegistrationModal()">Cancel</button>' +
           '<button type="submit" class="btn btn-primary" id="duoSubmitBtn">Register Duo Team</button>' +
           '</div>' +
           '</form>' +
           '</div>' +
           '</div>' +
           '</div>';
}

/**
 * Create squad registration HTML
 */
function createSquadRegistrationHTML(tournament) {
    return '<div class="modal-overlay">' +
           '<div class="modal-content squad-modal">' +
           '<div class="modal-header">' +
           '<h3>Squad Registration - ' + escapeHtml(tournament.name) + '</h3>' +
           '<button class="modal-close" onclick="closeRegistrationModal()">&times;</button>' +
           '</div>' +
           '<div class="modal-body">' +
           '<form id="squadRegistrationForm">' +
           '<div class="form-section">' +
           '<div class="form-group">' +
           '<label for="teamName">Team Name:</label>' +
           '<input type="text" id="teamName" name="teamName" required placeholder="Enter your team name">' +
           '</div>' +
           '</div>' +
           '<div class="form-section">' +
           '<h4>Player 1 (You - IGL/Team Leader)</h4>' +
           '<div class="form-group">' +
           '<label for="player1Username">Your Username:</label>' +
           '<input type="text" id="player1Username" name="player1Username" readonly class="readonly-input">' +
           '</div>' +
           '<div class="form-group">' +
           '<label for="player1IGN">Your IGN (In Game Name):</label>' +
           '<input type="text" id="player1IGN" name="player1IGN" required placeholder="Enter your in-game name">' +
           '</div>' +
           '</div>' +
           createSquadPlayerHTML(2) +
           createSquadPlayerHTML(3) +
           createSquadPlayerHTML(4) +
           '<div class="form-section substitute-section">' +
           '<h4>Player 5 (Substitute - Optional)</h4>' +
           '<div class="form-group">' +
           '<label for="player5Username">Substitute Username:</label>' +
           '<input type="text" id="player5Username" name="player5Username" placeholder="Enter substitute\'s username (optional)">' +
           '<div class="validation-feedback" id="player5Validation"></div>' +
           '</div>' +
           '<div class="form-group">' +
           '<label for="player5IGN">Substitute IGN:</label>' +
           '<input type="text" id="player5IGN" name="player5IGN" placeholder="Enter substitute\'s in-game name (optional)">' +
           '</div>' +
           '</div>' +
           '<div class="registration-note">' +
           '<p><strong>Note:</strong> All players should be registered in the website. ' +
           'Match ID and Pass will also be shared with the provided usernames.</p>' +
           '</div>' +
           '<div class="form-actions">' +
           '<button type="button" class="btn btn-secondary" onclick="closeRegistrationModal()">Cancel</button>' +
           '<button type="submit" class="btn btn-primary" id="squadSubmitBtn">Register Squad Team</button>' +
           '</div>' +
           '</form>' +
           '</div>' +
           '</div>' +
           '</div>';
}

/**
 * Create individual squad player HTML
 */
function createSquadPlayerHTML(playerNum) {
    return '<div class="form-section">' +
           '<h4>Player ' + playerNum + '</h4>' +
           '<div class="form-group">' +
           '<label for="player' + playerNum + 'Username">Player ' + playerNum + ' Username:</label>' +
           '<input type="text" id="player' + playerNum + 'Username" name="player' + playerNum + 'Username" required placeholder="Enter player ' + playerNum + '\'s username">' +
           '<div class="validation-feedback" id="player' + playerNum + 'Validation"></div>' +
           '</div>' +
           '<div class="form-group">' +
           '<label for="player' + playerNum + 'IGN">Player ' + playerNum + ' IGN:</label>' +
           '<input type="text" id="player' + playerNum + 'IGN" name="player' + playerNum + 'IGN" required placeholder="Enter player ' + playerNum + '\'s in-game name">' +
           '</div>' +
           '</div>';
}

/**
 * Setup team modal event listeners
 */
function setupTeamModalEventListeners(modal, tournament, isSquad) {
    // Form submission
    const form = modal.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (isSquad) {
                handleSquadRegistration(tournament);
            } else {
                handleDuoRegistration(tournament);
            }
        });
    }
    
    // Username validation for teammates
    if (isSquad) {
        // Squad validation
        for (let i = 2; i <= 5; i++) {
            const usernameInput = modal.querySelector('#player' + i + 'Username');
            if (usernameInput) {
                usernameInput.addEventListener('blur', function() {
                    if (this.value.trim()) {
                        validateUsername(this.value.trim(), 'player' + i + 'Validation');
                    }
                });
            }
        }
    } else {
        // Duo validation
        const teammateInput = modal.querySelector('#player2Username');
        if (teammateInput) {
            teammateInput.addEventListener('blur', function() {
                if (this.value.trim()) {
                    validateUsername(this.value.trim(), 'player2Validation');
                }
            });
        }
    }
    
    // Close modal on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeRegistrationModal();
        }
    });
}

/**
 * Validate username exists
 */
async function validateUsername(username, feedbackElementId) {
    const feedbackElement = document.getElementById(feedbackElementId);
    if (!feedbackElement) return;
    
    try {
        feedbackElement.innerHTML = '<span class="validating">Validating...</span>';
        
        const response = await fetch('/api/validate-usernames', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usernames: [username] })
        });
        
        const result = await response.json();
        
        if (result.notFound.length > 0) {
            feedbackElement.innerHTML = '<span class="invalid">✗ User not found</span>';
            return false;
        }
        
        if (result.banned.length > 0) {
            feedbackElement.innerHTML = '<span class="invalid">✗ User is banned</span>';
            return false;
        }
        
        feedbackElement.innerHTML = '<span class="valid">✓ User found</span>';
        return true;
        
    } catch (error) {
        console.error('Username validation error:', error);
        feedbackElement.innerHTML = '<span class="error">⚠ Validation failed</span>';
        return false;
    }
}

/**
 * Handle duo registration
 */
async function handleDuoRegistration(tournament) {
    const form = document.getElementById('duoRegistrationForm');
    const submitBtn = document.getElementById('duoSubmitBtn');
    
    if (!form) return;
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
    
    try {
        // Get form data
        const formData = new FormData(form);
        const playerData = {
            leader: {
                username: formData.get('player1Username'),
                ign: formData.get('player1IGN')
            },
            teammate: {
                username: formData.get('player2Username'),
                ign: formData.get('player2IGN')
            }
        };
        
        // Validate all fields
        if (!playerData.leader.ign || !playerData.teammate.username || !playerData.teammate.ign) {
            throw new Error('Please fill in all required fields');
        }
        
        // Validate teammate exists
        const validationResponse = await fetch('/api/validate-usernames', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usernames: [playerData.teammate.username] })
        });
        
        const validationResult = await validationResponse.json();
        
        if (!validationResult.allValid) {
            const errors = [];
            if (validationResult.notFound.length > 0) {
                errors.push('Teammate username not found: ' + validationResult.notFound.join(', '));
            }
            if (validationResult.banned.length > 0) {
                errors.push('Teammate is banned: ' + validationResult.banned.join(', '));
            }
            throw new Error(errors.join('\n'));
        }
        
        // Submit registration
        const registrationResponse = await fetch('/api/tournaments/register-enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tournamentId: tournament.id,
                registrationType: 'duo',
                teamData: { playerData: playerData }
            })
        });
        
        const registrationResult = await registrationResponse.json();
        
        if (registrationResponse.ok && registrationResult.success) {
            showMessage(registrationResult.message, 'success');
            closeRegistrationModal();
            await loadTournaments(); // Refresh tournaments
            await loadUserInfo(); // Refresh balance
        } else {
            throw new Error(registrationResult.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Duo registration error:', error);
        showMessage(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Duo Team';
    }
}

/**
 * Handle squad registration
 */
async function handleSquadRegistration(tournament) {
    const form = document.getElementById('squadRegistrationForm');
    const submitBtn = document.getElementById('squadSubmitBtn');
    
    if (!form) return;
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
    
    try {
        // Get form data
        const formData = new FormData(form);
        const teamName = formData.get('teamName');
        
        if (!teamName || !teamName.trim()) {
            throw new Error('Please enter a team name');
        }
        
        // Collect all players data
        const players = [];
        const usernamesToValidate = [];
        
        // Add team leader (player 1)
        players.push({
            username: formData.get('player1Username'),
            ign: formData.get('player1IGN'),
            role: 'leader'
        });
        
        // Add players 2-4 (required)
        for (let i = 2; i <= 4; i++) {
            const username = formData.get('player' + i + 'Username');
            const ign = formData.get('player' + i + 'IGN');
            
            if (!username || !ign) {
                throw new Error('Please fill in all required player information (Players 1-4)');
            }
            
            players.push({
                username: username.trim(),
                ign: ign.trim(),
                role: 'player'
            });
            
            usernamesToValidate.push(username.trim());
        }
        
        // Add player 5 (substitute - optional)
        const player5Username = formData.get('player5Username');
        const player5IGN = formData.get('player5IGN');
        
        if (player5Username && player5Username.trim()) {
            if (!player5IGN || !player5IGN.trim()) {
                throw new Error('Please enter IGN for substitute player');
            }
            
            players.push({
                username: player5Username.trim(),
                ign: player5IGN.trim(),
                role: 'substitute'
            });
            
            usernamesToValidate.push(player5Username.trim());
        }
        
        // Validate all usernames exist
        if (usernamesToValidate.length > 0) {
            const validationResponse = await fetch('/api/validate-usernames', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ usernames: usernamesToValidate })
            });
            
            const validationResult = await validationResponse.json();
            
            if (!validationResult.allValid) {
                const errors = [];
                if (validationResult.notFound.length > 0) {
                    errors.push('Users not found: ' + validationResult.notFound.join(', '));
                }
                if (validationResult.banned.length > 0) {
                    errors.push('Banned users: ' + validationResult.banned.join(', '));
                }
                throw new Error(errors.join('\n'));
            }
        }
        
        // Submit registration
        const registrationResponse = await fetch('/api/tournaments/register-enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tournamentId: tournament.id,
                registrationType: 'squad',
                teamData: {
                    teamName: teamName.trim(),
                    players: players
                }
            })
        });
        
        const registrationResult = await registrationResponse.json();
        
        if (registrationResponse.ok && registrationResult.success) {
            showMessage(registrationResult.message, 'success');
            closeRegistrationModal();
            await loadTournaments(); // Refresh tournaments
            await loadUserInfo(); // Refresh balance
        } else {
            throw new Error(registrationResult.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Squad registration error:', error);
        showMessage(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Squad Team';
    }
}

/**
 * Fill current user's data automatically
 */
function fillCurrentUserData() {
    if (state.currentUser) {
        const usernameField = document.getElementById('player1Username');
        if (usernameField) {
            usernameField.value = state.currentUser.username;
        }
    }
}

/**
 * Close registration modal
 */
function closeRegistrationModal() {
    const modals = document.querySelectorAll('.registration-modal');
    modals.forEach(function(modal) {
        modal.remove();
    });
}

// Make closeRegistrationModal globally available
window.closeRegistrationModal = closeRegistrationModal;

/**
 * ENHANCED: Register for tournament with type support
 */
async function registerForTournament(tournamentId, registrationType) {
    try {
        showMessage('Processing registration...', 'info');
        
        const response = await fetch('/api/tournaments/register-enhanced', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                tournamentId: tournamentId,
                registrationType: registrationType || 'solo'
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showMessage(result.message, 'success');
            await loadTournaments(); // Refresh tournaments
            await loadUserInfo(); // Refresh balance
        } else {
            throw new Error(result.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showMessage(error.message, 'error');
    }
}

/**
 * Apply filters to tournaments
 */
function applyFilters() {
    const gameFilter = (elements.gameFilter && elements.gameFilter.value) || 'all';
    const modeFilter = (elements.modeFilter && elements.modeFilter.value) || 'all';
    
    state.currentFilters = { game: gameFilter, mode: modeFilter };
    
    state.filteredTournaments = state.allTournaments.filter(function(tournament) {
        const gameMatch = gameFilter === 'all' || tournament.game_type === gameFilter;
        const modeMatch = modeFilter === 'all' || tournament.team_mode === modeFilter;
        return gameMatch && modeMatch;
    });
    
    console.log('Filtered tournaments:', state.filteredTournaments);
    renderTournaments();
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    if (elements.gameFilter) elements.gameFilter.value = 'all';
    if (elements.modeFilter) elements.modeFilter.value = 'all';
    state.currentFilters = { game: 'all', mode: 'all' };
    state.filteredTournaments = state.allTournaments.slice();
    renderTournaments();
}

/**
 * Load user information
 */
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('Failed to load user info');
        
        const user = await response.json();
        state.currentUser = user;
        
        if (elements.usernameDisplay) {
            elements.usernameDisplay.textContent = user.username;
        }
        if (elements.walletBalance) {
            elements.walletBalance.textContent = user.wallet_balance.toFixed(2);
        }
        if (elements.winningsBalance) {
            elements.winningsBalance.textContent = user.winnings_balance.toFixed(2);
        }
        
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Show tournament details modal (optional feature)
 */
function showTournamentDetails(tournament) {
    console.log('Tournament details:', tournament);
}

/**
 * Utility functions
 */
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString();
    } catch (e) {
        return 'TBD';
    }
}

function formatTime(dateString) {
    try {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
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
        const errorP = elements.errorState.querySelector('p');
        if (errorP) errorP.textContent = message;
    }
    if (elements.tournamentsGrid) elements.tournamentsGrid.style.display = 'none';
}

function hideError() {
    if (elements.errorState) elements.errorState.style.display = 'none';
}

function showMessage(message, type) {
    type = type || 'info';
    if (!elements.message) return;
    
    elements.message.textContent = message;
    elements.message.className = 'message ' + type;
    elements.message.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(function() {
        if (elements.message) {
            elements.message.style.display = 'none';
        }
    }, 5000);
}

// Make some functions globally available for debugging
window.tournamentSystem = {
    state: state,
    loadTournaments: loadTournaments,
    applyFilters: applyFilters,
    clearAllFilters: clearAllFilters,
    openRegistrationModal: openRegistrationModal
};
