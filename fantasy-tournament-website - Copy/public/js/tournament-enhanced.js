/**
 * Enhanced Tournament Registration System - FINAL VERSION
 * Compatible with older browsers and Windows 7
 */

// Global variables
let allTournaments = []; // FIXED: Store all tournaments for filtering
let currentUser = null;
let teamModal = null;
let currentTournament = null;

// Game images mapping
const gameImages = {
    'Free Fire': '/images/games/freefire.jpg',
    'BGMI': '/images/games/bgmi.jpg', 
    'Valorant': '/images/games/valorant.jpg',
    'CODM': '/images/games/codm.jpg'
};

// Team mode configurations
const teamModeConfig = {
    'solo': { size: 1, label: 'Solo' },
    'duo': { size: 2, label: 'Duo' },
    'squad': { size: 4, label: 'Squad' }
};

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    initializeTournamentSystem();
});

// Initialize the tournament system
function initializeTournamentSystem() {
    loadUserData();
    loadTournaments();
    setupEventListeners();
    createTeamModal();
}

// Setup event listeners
function setupEventListeners() {
    // Close modal on outside click
    document.addEventListener('click', function(e) {
        if (teamModal && e.target === teamModal) {
            closeTeamModal();
        }
    });
    
    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && teamModal && teamModal.classList.contains('active')) {
            closeTeamModal();
        }
    });
    
    // Note: Filter event listeners are now set up in setupFilterEventListeners()
    // after tournaments are loaded
}

// FIXED: Setup filter event listeners after tournaments are loaded
function setupFilterEventListeners() {
    const gameFilter = document.getElementById('gameFilter');
    const modeFilter = document.getElementById('modeFilter');
    
    if (gameFilter) {
        gameFilter.removeEventListener('change', filterTournaments);
        gameFilter.addEventListener('change', filterTournaments);
    }
    
    if (modeFilter) {
        modeFilter.removeEventListener('change', filterTournaments);
        modeFilter.addEventListener('change', filterTournaments);
    }
    
    console.log('Filter event listeners setup complete');
}

// Load user data
async function loadUserData() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// FIXED: Load tournaments and store globally
async function loadTournaments() {
    try {
        showLoading('tournaments-container');
        
        const response = await fetch('/api/tournaments/enhanced');
        if (!response.ok) {
            throw new Error('Failed to load tournaments');
        }
        
        // FIXED: Store all tournaments globally for filtering
        allTournaments = await response.json();
        console.log('Loaded tournaments:', allTournaments.length);
        
        // Render all tournaments initially
        renderTournaments(allTournaments);
        
        // FIXED: Setup filter event listeners AFTER tournaments are loaded
        setupFilterEventListeners();
        
    } catch (error) {
        console.error('Error loading tournaments:', error);
        showAlert('Failed to load tournaments. Please refresh the page.', 'error');
    } finally {
        hideLoading('tournaments-container');
    }
}

// FIXED: Render tournaments function
function renderTournaments(tournamentsToRender) {
    const container = document.getElementById('tournaments-grid');
    if (!container) {
        console.error('Tournament container not found');
        return;
    }
    
    console.log('Rendering tournaments:', tournamentsToRender.length);
    
    if (tournamentsToRender.length === 0) {
        container.innerHTML = `
            <div class="no-tournaments">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🎮</div>
                No tournaments match your filters
                <div style="margin-top: 12px; font-size: 14px; opacity: 0.7;">
                    Try changing your filter selection
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tournamentsToRender.map(tournament => createTournamentCard(tournament)).join('');
    
    // Add event listeners to register buttons
    addRegisterButtonListeners();
}

// Create tournament card HTML
function createTournamentCard(tournament) {
    const gameClass = (tournament.game_type || 'freefire').toLowerCase().replace(' ', '');
    const modeConfig = teamModeConfig[tournament.team_mode || 'solo'] || teamModeConfig.solo;
    const statusClass = 'status-' + tournament.status;
    const isRegistered = tournament.is_registered === 1;
    const isFull = tournament.current_participants >= tournament.max_participants;
    
    // Format dates
    const startDate = new Date(tournament.start_date).toLocaleDateString();
    const startTime = new Date(tournament.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Fixed image handling - no infinite loop
    const gameImageUrl = gameImages[tournament.game_type] || gameImages['Free Fire'];
    
    return `
        <div class="tournament-card game-${gameClass}">
            <div class="tournament-card-header">
                <img src="${gameImageUrl}" 
                     alt="${tournament.game_type || 'Tournament'}" 
                     class="game-image"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMyMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNjY3ZWVhIi8+Cjx0ZXh0IHg9IjE2MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCI+8J+OriDwn46uPC90ZXh0Pjx0ZXh0IHg9IjE2MCIgeT0iMTIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIj5HYW1lIEltYWdlPC90ZXh0Pjwvc3ZnPg==';">
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
                
                ${renderRegisterButton(tournament, isRegistered, isFull)}
            </div>
        </div>
    `;
}

// Render register button based on tournament state
function renderRegisterButton(tournament, isRegistered, isFull) {
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
    
    if (!currentUser || (currentUser.wallet_balance + currentUser.winnings_balance) < tournament.entry_fee) {
        return `
            <button class="register-btn" disabled>
                Insufficient Balance
            </button>
        `;
    }
    
    const buttonText = (tournament.team_mode === 'solo' || !tournament.team_mode) ? 'Register Now' : 'Create Team';
    
    return `
        <button class="register-btn" 
                data-tournament-id="${tournament.id}" 
                data-team-mode="${tournament.team_mode || 'solo'}">
            ${buttonText}
        </button>
    `;
}

// Add event listeners to register buttons
function addRegisterButtonListeners() {
    const registerButtons = document.querySelectorAll('.register-btn[data-tournament-id]:not(.registered)');
    const enterButtons = document.querySelectorAll('.enter-tournament-btn[data-tournament-id]');
    
    registerButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tournamentId = parseInt(this.getAttribute('data-tournament-id'));
            const teamMode = this.getAttribute('data-team-mode') || 'solo';
            
            const tournament = allTournaments.find(t => t.id === tournamentId);
            if (!tournament) return;
            
            if (teamMode === 'solo') {
                registerForTournament(tournamentId);
            } else {
                openTeamModal(tournament);
            }
        });
    });
    
    enterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tournamentId = this.getAttribute('data-tournament-id');
            window.location.href = `/tournament/${tournamentId}`;
        });
    });
}

// FIXED: Filter tournaments function
function filterTournaments() {
    const gameFilter = document.getElementById('gameFilter');
    const modeFilter = document.getElementById('modeFilter');
    
    if (!gameFilter || !modeFilter || !allTournaments || allTournaments.length === 0) {
        console.log('Filters or tournaments not ready');
        return;
    }
    
    const selectedGame = gameFilter.value;
    const selectedMode = modeFilter.value;
    
    console.log('Filtering:', { selectedGame, selectedMode, totalTournaments: allTournaments.length });
    
    let filtered = [...allTournaments]; // Create a copy of all tournaments
    
    // Filter by game
    if (selectedGame && selectedGame !== 'all') {
        filtered = filtered.filter(tournament => {
            const gameType = tournament.game_type || 'Free Fire';
            return gameType === selectedGame;
        });
    }
    
    // Filter by mode
    if (selectedMode && selectedMode !== 'all') {
        filtered = filtered.filter(tournament => {
            const teamMode = tournament.team_mode || 'solo';
            return teamMode === selectedMode;
        });
    }
    
    console.log('Filtered results:', filtered.length);
    
    // Re-render filtered tournaments
    renderTournaments(filtered);
}

// Register for tournament (solo)
async function registerForTournament(tournamentId) {
    try {
        const button = document.querySelector(`[data-tournament-id="${tournamentId}"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="loading-spinner"></span>Registering...';
        }
        
        const response = await fetch('/api/tournaments/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tournamentId })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Registration successful!', 'success');
            await loadTournaments(); // Reload to update UI
            await loadUserData(); // Update user balance
        } else {
            throw new Error(result.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showAlert(error.message || 'Registration failed', 'error');
    } finally {
        // Re-enable button and restore text
        const button = document.querySelector(`[data-tournament-id="${tournamentId}"]`);
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Register Now';
        }
    }
}

// Create team modal
function createTeamModal() {
    const modalHtml = `
        <div id="teamModal" class="team-modal">
            <div class="team-modal-content">
                <div class="team-modal-header">
                    <h3 class="team-modal-title">Create Team</h3>
                    <button class="close-modal" onclick="closeTeamModal()">&times;</button>
                </div>
                
                <form id="teamRegistrationForm">
                    <div class="form-group">
                        <label class="form-label">Team Name</label>
                        <input type="text" id="teamName" class="form-input" 
                               placeholder="Enter your team name" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Team Size</label>
                        <div id="teamSizeSelector" class="team-size-selector">
                            <!-- Team size options will be populated based on tournament mode -->
                        </div>
                    </div>
                    
                    <div id="teamMembersSection" class="form-group" style="display: none;">
                        <label class="form-label">Team Members (Enter Usernames)</label>
                        <div id="teamMembersInputs">
                            <!-- Member inputs will be generated dynamically -->
                        </div>
                    </div>
                    
                    <div id="alertContainer"></div>
                    
                    <button type="submit" id="submitTeamBtn" class="submit-btn">
                        Create Team & Register
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    teamModal = document.getElementById('teamModal');
    
    // Setup form submission
    const form = document.getElementById('teamRegistrationForm');
    form.addEventListener('submit', handleTeamRegistration);
}

// Open team modal
function openTeamModal(tournament) {
    currentTournament = tournament;
    const modal = document.getElementById('teamModal');
    const title = document.querySelector('.team-modal-title');
    
    title.textContent = `Create Team - ${tournament.name}`;
    
    // Setup team size options based on tournament mode
    setupTeamSizeOptions(tournament.team_mode);
    
    // Reset form
    document.getElementById('teamRegistrationForm').reset();
    document.getElementById('teamMembersSection').style.display = 'none';
    document.getElementById('alertContainer').innerHTML = '';
    
    modal.classList.add('active');
}

// Close team modal
function closeTeamModal() {
    const modal = document.getElementById('teamModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentTournament = null;
}

// Setup team size options
function setupTeamSizeOptions(teamMode) {
    const selector = document.getElementById('teamSizeSelector');
    const maxSize = teamModeConfig[teamMode]?.size || 4;
    
    let options = '';
    for (let i = 1; i <= maxSize; i++) {
        const label = i === 1 ? 'Solo' : i === 2 ? 'Duo' : `${i} Players`;
        const selected = i === maxSize ? 'selected' : '';
        options += `
            <div class="team-size-option ${selected}" 
                 data-size="${i}" onclick="selectTeamSize(${i})">
                ${label}
            </div>
        `;
    }
    
    selector.innerHTML = options;
    
    // Show member inputs for max size by default
    if (maxSize > 1) {
        showTeamMemberInputs(maxSize);
    }
}

// Select team size
function selectTeamSize(size) {
    // Remove previous selection
    const options = document.querySelectorAll('.team-size-option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    // Add selection to clicked option
    const selectedOption = document.querySelector(`[data-size="${size}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Show/hide member inputs
    if (size > 1) {
        showTeamMemberInputs(size);
    } else {
        document.getElementById('teamMembersSection').style.display = 'none';
    }
}

// Show team member inputs
function showTeamMemberInputs(teamSize) {
    const container = document.getElementById('teamMembersInputs');
    const section = document.getElementById('teamMembersSection');
    
    let inputs = '';
    for (let i = 2; i <= teamSize; i++) {
        inputs += `
            <div class="form-group">
                <input type="text" name="member${i}" class="form-input" 
                       placeholder="Player ${i} username" required>
            </div>
        `;
    }
    
    container.innerHTML = inputs;
    section.style.display = 'block';
}

// Handle team registration
async function handleTeamRegistration(e) {
    e.preventDefault();
    
    if (!currentTournament) return;
    
    const formData = new FormData(e.target);
    const teamName = formData.get('teamName') || document.getElementById('teamName').value;
    const selectedSize = document.querySelector('.team-size-option.selected');
    
    if (!selectedSize) {
        showModalAlert('Please select team size', 'error');
        return;
    }
    
    const teamSize = parseInt(selectedSize.getAttribute('data-size'));
    const members = [];
    
    // Collect team member usernames
    for (let i = 2; i <= teamSize; i++) {
        const memberInput = document.querySelector(`[name="member${i}"]`);
        if (memberInput && memberInput.value.trim()) {
            members.push(memberInput.value.trim());
        }
    }
    
    if (members.length !== teamSize - 1) {
        showModalAlert(`Please enter ${teamSize - 1} team member username(s)`, 'error');
        return;
    }
    
    try {
        const submitBtn = document.getElementById('submitTeamBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span>Creating Team...';
        
        const response = await fetch('/api/tournaments/register-team', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tournamentId: currentTournament.id,
                teamName: teamName,
                teamSize: teamSize,
                members: members
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Team created and registered successfully!', 'success');
            closeTeamModal();
            await loadTournaments();
            await loadUserData();
        } else {
            throw new Error(result.error || 'Team registration failed');
        }
        
    } catch (error) {
        console.error('Team registration error:', error);
        showModalAlert(error.message || 'Team registration failed', 'error');
    } finally {
        const submitBtn = document.getElementById('submitTeamBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Team & Register';
        }
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Insert at top of tournaments container
    const container = document.getElementById('tournaments-container');
    if (container) {
        container.insertBefore(alert, container.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Show modal alert
function showModalAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Show loading state
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #888;"><div class="loading-spinner" style="display: inline-block; margin-right: 10px;"></div>Loading tournaments...</div>';
    }
}

// Hide loading state
function hideLoading(containerId) {
    // Loading will be hidden when content is rendered
}

// Make functions globally available
window.closeTeamModal = closeTeamModal;
window.selectTeamSize = selectTeamSize;
