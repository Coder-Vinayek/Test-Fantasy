// Enhanced Tournaments JavaScript - Backward compatible with existing system
document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const walletBalanceSpan = document.getElementById('walletBalance');
    const winningsBalanceSpan = document.getElementById('winningsBalance');
    
    // Support both old and new container IDs
    const tournamentsContainer = document.getElementById('tournamentsContainer') || document.getElementById('tournaments-grid');
    const messageDiv = document.getElementById('message');

    // Initialize page
    loadUserInfo();
    loadTournaments();

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
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

    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user');
            const user = await response.json();

            if (usernameDisplay) {
                usernameDisplay.textContent = `Welcome, ${user.username}`;
            }
            if (walletBalanceSpan) {
                walletBalanceSpan.textContent = user.wallet_balance.toFixed(2);
            }
            if (winningsBalanceSpan) {
                winningsBalanceSpan.textContent = user.winnings_balance.toFixed(2);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async function loadTournaments() {
        try {
            // Try enhanced API first, fallback to original
            let response;
            let tournaments;
            
            try {
                response = await fetch('/api/tournaments/enhanced');
                if (response.ok) {
                    tournaments = await response.json();
                } else {
                    throw new Error('Enhanced API not available');
                }
            } catch (enhancedError) {
                console.log('Using fallback tournament API');
                response = await fetch('/api/tournaments');
                tournaments = await response.json();
            }

            if (tournamentsContainer) {
                tournamentsContainer.innerHTML = '';
                
                if (tournaments.length === 0) {
                    tournamentsContainer.innerHTML = '<p>No tournaments available at the moment.</p>';
                    return;
                }

                // Check if enhanced tournament system is available
                const hasEnhancedSupport = tournaments.some(t => t.game_type || t.team_mode);
                
                tournaments.forEach(tournament => {
                    const tournamentCard = hasEnhancedSupport ? 
                        createEnhancedTournamentCard(tournament) : 
                        createTournamentCard(tournament);
                    
                    if (hasEnhancedSupport) {
                        // For enhanced cards, insert HTML directly
                        const cardElement = document.createElement('div');
                        cardElement.innerHTML = tournamentCard;
                        tournamentsContainer.appendChild(cardElement.firstElementChild);
                    } else {
                        // For old cards, append the element
                        tournamentsContainer.appendChild(tournamentCard);
                    }
                });

                // Add event listeners for enhanced buttons
                if (hasEnhancedSupport) {
                    addEnhancedEventListeners();
                }
            }
        } catch (error) {
            console.error('Error loading tournaments:', error);
            showMessage('Failed to load tournaments', 'error');
        }
    }

    // Original tournament card (for backward compatibility)
    function createTournamentCard(tournament) {
        const card = document.createElement('div');
        card.className = 'tournament-card';

        const startDate = new Date(tournament.start_date).toLocaleString();
        const endDate = new Date(tournament.end_date).toLocaleString();
        const statusClass = `status-${tournament.status}`;
        const isRegistered = tournament.is_registered === 1;
        const isFull = tournament.current_participants >= tournament.max_participants;

        card.innerHTML = `
            <h3>${tournament.name}</h3>
            <div class="tournament-info">
                <p><strong>Entry Fee:</strong> $${tournament.entry_fee}</p>
                <p><strong>Prize Pool:</strong> $${tournament.prize_pool}</p>
                <p><strong>Participants:</strong> ${tournament.current_participants}/${tournament.max_participants}</p>
                <p><strong>Start:</strong> ${startDate}</p>
                <p><strong>End:</strong> ${endDate}</p>
                <p><strong>Status:</strong> <span class="tournament-status ${statusClass}">${tournament.status}</span></p>
                ${tournament.description ? `<p><strong>Description:</strong> ${tournament.description}</p>` : ''}
            </div>
            <div class="tournament-actions">
                ${getActionButtons(tournament, isRegistered, isFull)}
            </div>
        `;

        return card;
    }

    // Enhanced tournament card (new system)
    function createEnhancedTournamentCard(tournament) {
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

        const gameClass = (tournament.game_type || 'Free Fire').toLowerCase().replace(' ', '');
        const modeConfig = teamModeConfig[tournament.team_mode || 'solo'] || teamModeConfig.solo;
        const statusClass = 'status-' + tournament.status;
        const isRegistered = tournament.is_registered === 1;
        const isFull = tournament.current_participants >= tournament.max_participants;
        
        // Format dates
        const startDate = new Date(tournament.start_date).toLocaleDateString();
        const startTime = new Date(tournament.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        return `
            <div class="tournament-card game-${gameClass}">
                <div class="tournament-card-header">
                    <img src="${gameImages[tournament.game_type] || '/images/games/default.jpg'}" 
                         alt="${tournament.game_type || 'Tournament'}" class="game-image"
                         onerror="this.src='/images/games/default.jpg'">
                    <div class="game-badge">${tournament.game_type || 'Free Fire'}</div>
                    <div class="team-mode-badge">${modeConfig.label}</div>
                </div>
                
                <div class="tournament-card-content">
                    <h3 class="tournament-title">${tournament.name}</h3>
                    <p class="tournament-description">${tournament.description || 'Join this exciting tournament!'}</p>
                    
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
                    
                    ${renderEnhancedRegisterButton(tournament, isRegistered, isFull)}
                </div>
            </div>
        `;
    }

    // Enhanced register button rendering
    function renderEnhancedRegisterButton(tournament, isRegistered, isFull) {
        if (isRegistered) {
            return `
                <button class="register-btn registered enter-tournament-btn" data-tournament-id="${tournament.id}">
                    🎮 Enter Tournament
                </button>
            `;
        }
        
        if (isFull) {
            return `
                <button class="register-btn" disabled>
                    Tournament Full
                </button>
            `;
        }
        
        if (tournament.status !== 'upcoming') {
            return `
                <button class="register-btn" disabled>
                    Registration Closed
                </button>
            `;
        }
        
        const buttonText = (tournament.team_mode === 'solo' || !tournament.team_mode) ? 'Register Now' : 'Create Team';
        
        return `
            <button class="register-btn" 
                    data-tournament-id="${tournament.id}" 
                    data-team-mode="${tournament.team_mode || 'solo'}"
                    data-entry-fee="${tournament.entry_fee}">
                ${buttonText}
            </button>
        `;
    }

    // Original action buttons (for backward compatibility)
    function getActionButtons(tournament, isRegistered, isFull) {
        let buttons = '';

        if (isRegistered) {
            buttons += `<button class="btn btn-success enter-tournament-btn" data-tournament-id="${tournament.id}">Enter Tournament 🎮</button>`;
            buttons += '<span class="registered-indicator">✓ Registered</span>';
        } else {
            if (isFull) {
                buttons += '<button class="btn btn-secondary" disabled>Tournament Full</button>';
            } else if (tournament.status === 'upcoming') {
                buttons += `<button class="btn btn-primary register-btn" data-tournament-id="${tournament.id}" data-entry-fee="${tournament.entry_fee}">Register ($${tournament.entry_fee})</button>`;
            } else {
                buttons += '<button class="btn btn-secondary" disabled>Registration Closed</button>';
            }
        }

        return buttons;
    }

    // Enhanced event listeners
    function addEnhancedEventListeners() {
        const registerButtons = document.querySelectorAll('.register-btn[data-tournament-id]:not(.registered)');
        
        registerButtons.forEach(button => {
            button.addEventListener('click', function() {
                const tournamentId = parseInt(this.getAttribute('data-tournament-id'));
                const teamMode = this.getAttribute('data-team-mode') || 'solo';
                const entryFee = parseFloat(this.getAttribute('data-entry-fee'));
                
                if (teamMode === 'solo') {
                    registerForTournament(tournamentId, entryFee);
                } else {
                    // If enhanced team modal exists, use it
                    if (window.openTeamModal && typeof window.openTeamModal === 'function') {
                        const tournaments = window.tournaments || [];
                        const tournament = tournaments.find(t => t.id === tournamentId);
                        if (tournament) {
                            window.openTeamModal(tournament);
                        }
                    } else {
                        // Fallback to simple registration
                        registerForTournament(tournamentId, entryFee);
                    }
                }
            });
        });
    }

    // Tournament registration handler
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('enter-tournament-btn')) {
            const tournamentId = e.target.getAttribute('data-tournament-id');
            // Navigate to tournament lobby
            window.location.href = `/tournament/${tournamentId}`;
        }

        // Handle old-style register buttons
        if (e.target.classList.contains('register-btn') && !e.target.hasAttribute('data-team-mode')) {
            const tournamentId = parseInt(e.target.getAttribute('data-tournament-id'));
            const entryFee = parseFloat(e.target.getAttribute('data-entry-fee'));
            registerForTournament(tournamentId, entryFee);
        }
    });

    // Registration function
    async function registerForTournament(tournamentId, entryFee) {
        // Confirm registration
        if (!confirm(`Register for this tournament? Entry fee: ₹${entryFee}`)) {
            return;
        }

        try {
            const response = await fetch('/api/tournaments/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tournamentId: tournamentId })
            });

            const result = await response.json();

            if (result.success) {
                showMessage(result.message, 'success');
                // Reload tournaments and user info
                await loadTournaments();
                await loadUserInfo();
            } else {
                showMessage(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        }
    }

    function showMessage(message, type) {
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `message ${type}`;
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    }

    // Make loadTournaments available globally for enhanced system
    window.loadTournaments = loadTournaments;
    window.loadUserInfo = loadUserInfo;
});

// Additional styles for enhanced tournaments
const enhancedStyles = `
    .schedule-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
    }
    
    .schedule-label {
        color: #888;
        font-weight: 500;
    }
    
    .schedule-value {
        color: #fff;
        font-weight: 600;
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedStyles;
document.head.appendChild(styleSheet);
