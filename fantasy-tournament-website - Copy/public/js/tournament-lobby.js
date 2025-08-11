// Enhanced Tournament Lobby JavaScript with Image Upload Feature

document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logoutBtn');
    const messageDiv = document.getElementById('message');

    // Tournament elements
    const tournamentName = document.getElementById('tournamentName');
    const tournamentStatus = document.getElementById('tournamentStatus');
    const prizePool = document.getElementById('prizePool');
    const participantCount = document.getElementById('participantCount');
    const startTime = document.getElementById('startTime');
    const timeRemaining = document.getElementById('timeRemaining');
    const tournamentDescription = document.getElementById('tournamentDescription');

    // Chat elements
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const onlineCount = document.getElementById('onlineCount');

    // Admin upload elements
    const adminUploadSection = document.getElementById('adminUploadSection');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const imageMessageInput = document.getElementById('imageMessageInput');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const uploadPreview = document.getElementById('uploadPreview');
    const previewImage = document.getElementById('previewImage');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');

    // Match elements
    const announcementsList = document.getElementById('announcementsList');
    const roomId = document.getElementById('roomId');
    const roomPassword = document.getElementById('roomPassword');
    const matchStartTime = document.getElementById('matchStartTime');
    const gameServer = document.getElementById('gameServer');

    // Players elements
    const playersList = document.getElementById('playersList');
    const refreshPlayers = document.getElementById('refreshPlayers');

    // Rules toggle
    const rulesToggle = document.getElementById('rulesToggle');
    const rulesContent = document.getElementById('rulesContent');

    // Global variables
    let isAdmin = false;
    let selectedFile = null;

    // Get tournament ID from URL path
    const pathParts = window.location.pathname.split('/');
    const tournamentId = pathParts[pathParts.length - 1];

    console.log('🔍 Tournament lobby page loaded');
    console.log('🆔 Tournament ID extracted:', tournamentId);

    if (!tournamentId || tournamentId === 'tournament') {
        console.error('❌ Invalid tournament ID found:', tournamentId);
        showMessage('Invalid tournament ID', 'error');
        setTimeout(() => {
            window.location.href = '/tournaments';
        }, 2000);
        return;
    }

    // Initialize page
    loadUserInfo();
    loadTournamentData();
    loadChatMessages();
    loadPlayers();
    loadAnnouncements();

    // Set up auto-refresh intervals
    setInterval(loadTournamentData, 30000);
    setInterval(loadChatMessages, 5000);
    setInterval(loadPlayers, 30000);
    setInterval(loadAnnouncements, 15000);
    setInterval(updateTimeRemaining, 1000);

    // Event Listeners
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (refreshPlayers) {
        refreshPlayers.addEventListener('click', function() {
            this.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                this.style.transform = 'rotate(0deg)';
            }, 500);
            loadPlayers();
        });
    }

    if (rulesToggle) {
        rulesToggle.addEventListener('click', function() {
            const isExpanded = rulesContent.classList.contains('expanded');
            const toggleIcon = this.querySelector('.toggle-icon');

            if (isExpanded) {
                rulesContent.classList.remove('expanded');
                toggleIcon.textContent = '▼';
            } else {
                rulesContent.classList.add('expanded');
                toggleIcon.textContent = '▲';
            }
        });
    }

    // Image upload event listeners
    if (uploadImageBtn) {
        uploadImageBtn.addEventListener('click', function() {
            imageUploadInput.click();
        });
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageSelect);
    }

    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', cancelImageUpload);
    }

    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', uploadImage);
    }

    // Functions
    async function loadUserInfo() {
        console.log('📊 Loading user info...');
        try {
            const response = await fetch('/api/user');
            const user = await response.json();

            console.log('✅ User info loaded:', user.username);
            isAdmin = user.is_admin || false;

            if (usernameDisplay) {
                usernameDisplay.textContent = `Welcome, ${user.username}`;
            }

            // Show admin upload section if user is admin
            if (isAdmin && adminUploadSection) {
                adminUploadSection.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Error loading user info:', error);
        }
    }

    async function loadTournamentData() {
        console.log('🏆 Loading tournament data for ID:', tournamentId);
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/lobby`);
            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Tournament API error:', data);
                if (response.status === 403) {
                    showMessage('You are not registered for this tournament', 'error');
                    setTimeout(() => {
                        window.location.href = '/tournaments';
                    }, 2000);
                    return;
                }
                throw new Error(data.error || 'Failed to load tournament');
            }

            const tournament = data.tournament;
            console.log('✅ Tournament data loaded:', tournament.name);

            // Update tournament info
            tournamentName.textContent = tournament.name;
            tournamentStatus.textContent = tournament.status;
            tournamentStatus.className = `status-badge status-${tournament.status}`;
            prizePool.textContent = `$${tournament.prize_pool}`;
            participantCount.textContent = `${tournament.current_participants}/${tournament.max_participants}`;
            startTime.textContent = new Date(tournament.start_date).toLocaleString();
            tournamentDescription.textContent = tournament.description || 'No description available';

            // Update match details if available
            if (data.matchDetails) {
                const match = data.matchDetails;
                roomId.textContent = match.room_id || 'Not assigned';
                roomPassword.textContent = match.room_password || 'Not assigned';
                matchStartTime.textContent = match.match_start_time ? new Date(match.match_start_time).toLocaleString() : 'TBD';
                gameServer.textContent = match.game_server || 'TBD';
            }

            // Update online count
            onlineCount.textContent = data.onlineCount || tournament.current_participants;

        } catch (error) {
            console.error('❌ Error loading tournament data:', error);
            showMessage(error.message, 'error');
        }
    }

    async function loadChatMessages() {
        console.log('💬 Loading chat messages...');
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/chat`);
            const messages = await response.json();

            console.log('✅ Chat messages loaded:', messages.length, 'messages');

            chatMessages.innerHTML = '';

            if (messages.length === 0) {
                chatMessages.innerHTML = '<div class="no-messages">No messages yet. Be the first to say hello! 👋</div>';
                return;
            }

            messages.forEach(message => {
                const messageElement = createChatMessage(message);
                chatMessages.appendChild(messageElement);
            });

            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;

        } catch (error) {
            console.error('❌ Error loading chat messages:', error);
        }
    }

    function createChatMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.is_admin ? 'admin-message' : 'user-message'}`;

        const timestamp = new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        let messageContent = '';
        
        // Check if message has an image
        if (message.image_url) {
            messageContent = `
                <div class="message-header">
                    <span class="message-username ${message.is_admin ? 'admin-username' : ''}">${message.username}${message.is_admin ? ' 👑' : ''}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">
                    <div class="message-text">${escapeHtml(message.message)}</div>
                    <div class="message-image">
                        <img src="${message.image_url}" alt="Match Result" onclick="openImageModal('${message.image_url}')">
                        <button class="download-btn" onclick="downloadImage('${message.image_url}', 'match-result.jpg')">📥 Download</button>
                    </div>
                </div>
            `;
        } else {
            messageContent = `
                <div class="message-header">
                    <span class="message-username ${message.is_admin ? 'admin-username' : ''}">${message.username}${message.is_admin ? ' 👑' : ''}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${escapeHtml(message.message)}</div>
            `;
        }

        messageDiv.innerHTML = messageContent;
        return messageDiv;
    }

    function handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showMessage('Please select a valid image file', 'error');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('Image size must be less than 5MB', 'error');
            return;
        }

        selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            uploadPreview.style.display = 'block';
            cancelUploadBtn.style.display = 'inline-block';
            uploadImageBtn.textContent = 'Choose Different Image';
        };
        reader.readAsDataURL(file);
    }

    function cancelImageUpload() {
        selectedFile = null;
        imageUploadInput.value = '';
        imageMessageInput.value = '';
        uploadPreview.style.display = 'none';
        cancelUploadBtn.style.display = 'none';
        uploadImageBtn.textContent = '📷 Upload Match Result';
    }

    async function uploadImage() {
        if (!selectedFile) {
            showMessage('No image selected', 'error');
            return;
        }

        const description = imageMessageInput.value.trim() || 'Match Result Image';
        
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('message', description);

        try {
            confirmUploadBtn.disabled = true;
            confirmUploadBtn.textContent = 'Uploading...';

            const response = await fetch(`/api/tournament/${tournamentId}/upload-image`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Image uploaded successfully!', 'success');
                cancelImageUpload();
                loadChatMessages(); // Refresh chat to show new image
            } else {
                showMessage(result.error || 'Failed to upload image', 'error');
            }

        } catch (error) {
            console.error('Error uploading image:', error);
            showMessage('Failed to upload image', 'error');
        } finally {
            confirmUploadBtn.disabled = false;
            confirmUploadBtn.textContent = 'Upload Image';
        }
    }

    async function sendMessage() {
        const message = chatInput.value.trim();

        if (!message) {
            return;
        }

        if (message.length > 200) {
            showMessage('Message too long (max 200 characters)', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/tournament/${tournamentId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const result = await response.json();

            if (result.success) {
                chatInput.value = '';
                loadChatMessages();
            } else {
                showMessage(result.error || 'Failed to send message', 'error');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            showMessage('Failed to send message', 'error');
        }
    }

    // Global functions for image modal and download
    window.openImageModal = function(imageUrl) {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeImageModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <span class="close-btn" onclick="closeImageModal()">&times;</span>
                    <img src="${imageUrl}" alt="Match Result">
                    <div class="modal-actions">
                        <button onclick="downloadImage('${imageUrl}', 'match-result.jpg')" class="btn btn-primary">📥 Download</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.closeImageModal = function() {
        const modal = document.querySelector('.image-modal');
        if (modal) {
            modal.remove();
        }
    };

    window.downloadImage = function(imageUrl, filename) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Rest of the existing functions remain the same...
    async function loadPlayers() {
        console.log('👥 Loading players...');
        try {
            // Use existing API endpoint
            const response = await fetch(`/api/tournament/${tournamentId}/players`);
            const players = await response.json();
            console.log('✅ Players loaded:', players.length, 'players');
    
            playersList.innerHTML = '';
    
            if (players.length === 0) {
                playersList.innerHTML = '<div class="no-players">No players found</div>';
                return;
            }
    
            // Get tournament info to determine team mode
            const tournamentResponse = await fetch(`/api/tournament/${tournamentId}/lobby`);
            const tournamentData = await tournamentResponse.json();
            const tournament = tournamentData.tournament;
            const teamMode = tournament.team_mode || 'solo';
    
            console.log('Tournament mode:', teamMode);
    
            if (teamMode === 'solo') {
                // Display individual players for solo tournaments
                players.forEach(player => {
                    const playerElement = createPlayerElement(player);
                    playersList.appendChild(playerElement);
                });
            } else {
                // For duo/squad, try to group players into mock teams
                const teams = createMockTeams(players, teamMode);
                console.log('Mock teams created:', teams.length);
    
                if (teams.length > 0) {
                    teams.forEach(team => {
                        const teamElement = createTeamElement(team, teamMode);
                        playersList.appendChild(teamElement);
                    });
                } else {
                    // Fallback to individual display
                    players.forEach(player => {
                        const playerElement = createPlayerElement(player);
                        playersList.appendChild(playerElement);
                    });
                }
            }
    
        } catch (error) {
            console.error('❌ Error loading players:', error);
            showMessage('Failed to load players', 'error');
        }
    }
    
    /**
 * Create mock teams from individual players
 * This is a workaround when team data is not available
 */
function createMockTeams(players, teamMode) {
    const teamsPerGroup = teamMode === 'duo' ? 2 : 4;
    const teams = [];
    
    // Group players into teams of appropriate size
    for (let i = 0; i < players.length; i += teamsPerGroup) {
        const teamPlayers = players.slice(i, i + teamsPerGroup);
        
        if (teamPlayers.length >= 2) { // At least 2 players for a team
            const team = {
                team_id: Math.floor(i / teamsPerGroup) + 1,
                team_name: `Team ${Math.floor(i / teamsPerGroup) + 1}`,
                players: teamPlayers.map((player, index) => ({
                    ...player,
                    role: index === 0 ? 'leader' : 'player',
                    ign: player.username // Use username as IGN fallback
                }))
            };
            teams.push(team);
        }
    }
    
    return teams;
}

    // ============================================================================
    // ADD THIS NEW FUNCTION FOR TEAM DISPLAY
    // ============================================================================
    
    function createTeamElement(team, tournamentType) {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'team-item';
        
        const teamName = team.team_name || `Team ${team.team_id}`;
        const players = team.players || [];
        const isOnline = players.some(p => p.is_online);
        
        let playersHtml = '';
        players.forEach((player, index) => {
            const role = player.role === 'leader' ? '👑' : 
                        player.role === 'substitute' ? '🔄' : '';
            const onlineStatus = player.is_online ? 'online' : 'offline';
            
            playersHtml += `
                <div class="team-player ${onlineStatus}">
                    <span class="player-name">${escapeHtml(player.username)} ${role}</span>
                    <span class="player-ign">${escapeHtml(player.ign || player.username)}</span>
                    <span class="player-status-dot ${onlineStatus}"></span>
                </div>
            `;
        });
    
        teamDiv.innerHTML = `
            <div class="team-header ${isOnline ? 'team-online' : 'team-offline'}">
                <div class="team-info">
                    <h4 class="team-name">${escapeHtml(teamName)}</h4>
                    <span class="team-meta">${players.length} players</span>
                </div>
                <div class="team-status">
                    <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
                </div>
            </div>
            <div class="team-players">
                ${playersHtml}
            </div>
        `;
    
        return teamDiv;
    }

    function createPlayerElement(player) {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${player.is_online ? 'online' : 'offline'}`;

        const joinDate = new Date(player.registration_date).toLocaleDateString();

        playerDiv.innerHTML = `
            <div class="player-avatar">
                <span class="player-initial">${player.username.charAt(0).toUpperCase()}</span>
                <span class="player-status ${player.is_online ? 'online' : 'offline'}"></span>
            </div>
            <div class="player-info">
                <div class="player-name">${player.username}${player.is_admin ? ' 👑' : ''}</div>
                <div class="player-meta">
                    <span class="join-date">Joined: ${joinDate}</span>
                    <span class="player-balance">$${player.wallet_balance.toFixed(2)}</span>
                </div>
            </div>
        `;

        return playerDiv;
    }

    async function loadAnnouncements() {
        console.log('📢 Loading announcements...');
        try {
            const response = await fetch(`/api/tournament/${tournamentId}/announcements`);
            const announcements = await response.json();

            console.log('✅ Announcements loaded:', announcements.length, 'announcements');

            announcementsList.innerHTML = '';

            if (announcements.length === 0) {
                announcementsList.innerHTML = '<p class="no-announcements">No announcements yet</p>';
                return;
            }

            announcements.forEach(announcement => {
                const announcementElement = createAnnouncementElement(announcement);
                announcementsList.appendChild(announcementElement);
            });

        } catch (error) {
            console.error('❌ Error loading announcements:', error);
        }
    }

    function createAnnouncementElement(announcement) {
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'announcement-item';

        const timestamp = new Date(announcement.created_at).toLocaleString();

        announcementDiv.innerHTML = `
            <div class="announcement-header">
                <span class="announcement-type">📢 Admin</span>
                <span class="announcement-time">${timestamp}</span>
            </div>
            <div class="announcement-content">${escapeHtml(announcement.message)}</div>
        `;

        return announcementDiv;
    }

    function updateTimeRemaining() {
        const startTimeText = startTime.textContent;
        if (startTimeText === '-' || !startTimeText) {
            timeRemaining.textContent = '-';
            return;
        }

        const startDate = new Date(startTimeText);
        const now = new Date();
        const diff = startDate - now;

        if (diff <= 0) {
            timeRemaining.textContent = 'Tournament Started';
            timeRemaining.className = 'detail-value tournament-started';
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0) {
                timeRemaining.textContent = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                timeRemaining.textContent = `${hours}h ${minutes}m ${seconds}s`;
            } else {
                timeRemaining.textContent = `${minutes}m ${seconds}s`;
            }

            timeRemaining.className = 'detail-value';
        }
    }

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

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
