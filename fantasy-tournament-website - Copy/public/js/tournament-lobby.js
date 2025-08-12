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
    if (typeof tournamentId !== 'undefined') {
        setInterval(loadPlayers, 30000); // This will now use our enhanced version
    }
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

    window.loadPlayers = loadPlayers;
    async function loadPlayers() {
        try {
            const tournamentId = window.location.pathname.split('/').pop();
            
            if (!tournamentId || tournamentId === 'tournament') {
                console.error('❌ Invalid tournament ID');
                document.getElementById('playersList').innerHTML = '<div class="error-players">Invalid tournament ID</div>';
                return;
            }
    
            // FIXED: Use enhanced API endpoint that returns REAL team data
            const response = await fetch('/api/tournament/' + tournamentId + '/players-enhanced');
            
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ': ' + response.statusText);
            }
            
            const data = await response.json();
    
            if (data.error) {
                throw new Error(data.error);
            }
    
            console.log('✅ FIXED: Enhanced players data loaded:', data);
    
            const playersList = document.getElementById('playersList');
            if (!playersList) {
                console.error('❌ playersList element not found');
                return;
            }
    
            playersList.innerHTML = '';
    
            if (!data.players || data.players.length === 0) {
                playersList.innerHTML = '<div class="no-players">No players found</div>';
                return;
            }
    
            const tournamentType = data.tournament_type || 'solo';
            console.log('FIXED: Tournament type:', tournamentType);
    
            if (tournamentType === 'solo' || !data.teams || data.teams.length === 0) {
                // Display individual players for solo tournaments
                console.log('FIXED: Displaying', data.players.length, 'individual players');
                data.players.forEach(function(player) {
                    const playerElement = createPlayerElement(player);
                    playersList.appendChild(playerElement);
                });
            } else {
                // FIXED: Display REAL teams with REAL team names from database
                console.log('FIXED: Displaying', data.teams.length, 'REAL teams with actual names');
    
                data.teams.forEach(function(team) {
                    console.log('FIXED: Team name from database:', team.team_name);
                    const teamElement = createTeamElement(team, tournamentType);
                    playersList.appendChild(teamElement);
                });
            }
    
        } catch (error) {
            console.error('❌ Error loading players:', error);
            const playersList = document.getElementById('playersList');
            if (playersList) {
                playersList.innerHTML = '<div class="error-players">Failed to load players: ' + error.message + '. Please refresh.</div>';
            }
        }
    }
    
    // FIXED: Create team element with proper null checks
    function createTeamElement(team, tournamentType) {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'team-item';
    
        // FIXED: Use REAL team name from database, NOT "Team 1", "Team 2"
        const teamName = team.team_name || ('Team ' + team.team_id); // Fallback if no name
        const players = Array.isArray(team.players) ? team.players : [];
        const isOnline = players.some(function(p) { return p.is_online; });
    
        console.log('FIXED: Creating team element with REAL name:', teamName);
    
        let playersHtml = '';
        players.forEach(function(player, index) {
            const role = player.role || 'player';
            const roleIcon = role === 'leader' ? '👑' :
                            role === 'substitute' ? '🔄' : '👤';
            const onlineStatus = player.is_online ? 'online' : 'offline';
            const username = player.username || 'Unknown';
            const ign = player.ign || username;
    
            playersHtml +=
                '<div class="team-player ' + onlineStatus + '">' +
                    '<span class="player-name">' + escapeHtml(username) + ' ' + roleIcon + '</span>' +
                    '<span class="player-ign">' + escapeHtml(ign) + '</span>' +
                    '<span class="player-status-dot ' + onlineStatus + '"></span>' +
                '</div>';
        });
    
        teamDiv.innerHTML =
            '<div class="team-header ' + (isOnline ? 'team-online' : 'team-offline') + '">' +
                '<div class="team-info">' +
                    '<h4 class="team-name">' + escapeHtml(teamName) + '</h4>' +
                    '<span class="team-meta">' + players.length + ' players</span>' +
                '</div>' +
                '<div class="team-status">' +
                    '<span class="status-indicator ' + (isOnline ? 'online' : 'offline') + '"></span>' +
                '</div>' +
            '</div>' +
            '<div class="team-players">' +
                playersHtml +
            '</div>';
    
        return teamDiv;
    }
    
    // FIXED: Create player element with proper null checks
    function createPlayerElement(player) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item ' + (player.is_online ? 'online' : 'offline');
    
        const username = player.username || 'Unknown';
        const joinDate = player.registration_date || player.created_at;
        const formattedDate = joinDate ? new Date(joinDate).toLocaleDateString() : 'Unknown';
        const walletBalance = player.wallet_balance || 0;
    
        playerDiv.innerHTML =
            '<div class="player-avatar">' +
                '<span class="player-initial">' + username.charAt(0).toUpperCase() + '</span>' +
                '<span class="player-status ' + (player.is_online ? 'online' : 'offline') + '"></span>' +
            '</div>' +
            '<div class="player-info">' +
                '<div class="player-name">' + escapeHtml(username) + (player.is_admin ? ' 👑' : '') + '</div>' +
                '<div class="player-meta">' +
                    '<span class="join-date">Joined: ' + formattedDate + '</span>' +
                    '<span class="player-balance">₹' + parseFloat(walletBalance).toFixed(2) + '</span>' +
                '</div>' +
            '</div>';
    
        return playerDiv;
    }

    async function loadAnnouncements() {
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
        if (!text || text === null || text === undefined) return '';
        if (typeof text !== 'string') return String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }  
});
