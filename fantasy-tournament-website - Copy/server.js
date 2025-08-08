console.log("Server.js file is starting...");

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Import Supabase client
const { supabase } = require('./database/supabase');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fantasy-tournament-secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Enhanced requireAdmin middleware with proper JSON responses
function requireAdmin(req, res, next) {
    if (!req.session) {
        return res.status(403).json({
            error: 'No session found. Please login again.',
            code: 'NO_SESSION'
        });
    }

    if (!req.session.userId) {
        return res.status(403).json({
            error: 'Not logged in. Please login again.',
            code: 'NOT_LOGGED_IN'
        });
    }

    if (!req.session.isAdmin) {
        return res.status(403).json({
            error: 'Admin access required. Please login as admin.',
            code: 'NOT_ADMIN'
        });
    }

    next();
}

// Ban status check middleware
async function checkBanStatus(req, res, next) {
    if (!req.session.userId) {
        return next();
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('ban_status, ban_expiry')
            .eq('id', req.session.userId)
            .single();

        if (error) {
            console.error('Error checking user ban status:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check if temporarily banned and expired
        if (user.ban_status === 'temp_banned' && user.ban_expiry && new Date(user.ban_expiry) <= new Date()) {
            // Update user to remove expired ban
            await supabase
                .from('users')
                .update({
                    ban_status: 'active',
                    ban_expiry: null,
                    ban_reason: null,
                    banned_at: null,
                    banned_by: null
                })
                .eq('id', req.session.userId);

            next(); // Continue - ban has expired
        } else if (user.ban_status === 'temp_banned' || user.ban_status === 'banned') {
            return res.status(403).json({
                error: 'Your account is banned. You can view the website but cannot perform this action.',
                banned: true,
                ban_status: user.ban_status
            });
        } else {
            next(); // Not banned, continue
        }
    } catch (error) {
        console.error('Error in ban status check:', error);
        return res.status(500).json({ error: 'Database error' });
    }
}

// Routes - Serve HTML pages
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/tournaments');
    } else {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/tournaments', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tournaments.html'));
});

app.get('/wallet', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'wallet.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/tournament/:id', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'tournament-lobby.html'));
});

// API Routes - Authentication
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                email,
                password: hashedPassword,
                wallet_balance: 0,
                winnings_balance: 0,
                is_admin: false
            }])
            .select()
            .single();

        if (error) {
            console.error('Registration error:', error);
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'Username or email already exists' });
            }
            return res.status(500).json({ error: 'Registration failed' });
        }

        req.session.userId = data.id;
        req.session.username = username;
        req.session.isAdmin = false;

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin;

        res.json({
            success: true,
            message: 'Login successful',
            isAdmin: user.is_admin
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Admin session check route
app.get('/api/admin/session-check', async (req, res) => {
    if (!req.session || !req.session.userId || !req.session.isAdmin) {
        return res.status(403).json({
            authenticated: false,
            isAdmin: false,
            error: 'Session expired or invalid',
            redirectTo: '/login'
        });
    }

    try {
        // Refresh admin info from database
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, is_admin')
            .eq('id', req.session.userId)
            .eq('is_admin', true)
            .single();

        if (error || !user) {
            req.session.destroy();
            return res.status(403).json({
                authenticated: false,
                isAdmin: false,
                error: 'Admin user not found',
                redirectTo: '/login'
            });
        }

        // Refresh session data
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin;

        res.json({
            authenticated: true,
            isAdmin: true,
            userId: user.id,
            username: user.username
        });
    } catch (error) {
        console.error('Session check error:', error);
        return res.status(500).json({
            authenticated: false,
            isAdmin: false,
            error: 'Database error',
            redirectTo: '/login'
        });
    }
});

function getGameImageUrl(gameType) {
    const gameImages = {
        'Free Fire': '/images/games/freefire.jpg',
        'BGMI': '/images/games/bgmi.jpg',
        'Valorant': '/images/games/valorant.jpg',
        'CODM': '/images/games/codm.jpg'
    };
    return gameImages[gameType] || '/images/games/freefire.jpg';
}

// API Routes - User Info
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, email, wallet_balance, winnings_balance, is_admin, ban_status, ban_expiry, ban_reason, banned_at')
            .eq('id', req.session.userId)
            .single();

        if (error) {
            console.error('Get user error:', error);
            return res.status(500).json({ error: 'Failed to get user info' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ error: 'Failed to get user info' });
    }
});

// API Routes - Tournaments
app.get('/api/tournaments', requireAuth, async (req, res) => {
    try {
        console.log('Loading tournaments for user:', req.session.userId);
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select(`
                *,
                tournament_registrations!left(user_id)
            `)
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Get tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        // Enhanced: Add game data and properly handle free tournaments
        const tournamentsWithRegistration = tournaments.map(tournament => {
            const gameType = tournament.game_type || 'Free Fire';
            const teamMode = tournament.team_mode || 'solo';
            const gameImageUrl = tournament.game_image_url || getGameImageUrl(gameType);

            // Enhanced: Mark tournament as free or paid
            const isFree = tournament.entry_fee === 0;

            return {
                ...tournament,
                game_type: gameType,
                team_mode: teamMode,
                game_image_url: gameImageUrl,
                is_free: isFree, // New field to identify free tournaments
                entry_fee_display: isFree ? 'FREE' : `$${tournament.entry_fee}`, // Display helper
                is_registered: tournament.tournament_registrations.some(reg => reg.user_id === req.session.userId) ? 1 : 0
            };
        });

        console.log('Processed tournaments:', tournamentsWithRegistration.length);
        res.json(tournamentsWithRegistration);

    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ error: 'Failed to get tournaments' });
    }
});


// API Routes - Wallet
app.post('/api/wallet/deposit', requireAuth, async (req, res) => {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
    }

    try {
        // Get current balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Update wallet balance
        const { error: updateError } = await supabase
            .from('users')
            .update({
                wallet_balance: user.wallet_balance + depositAmount
            })
            .eq('id', req.session.userId);

        if (updateError) {
            console.error('Deposit error:', updateError);
            return res.status(500).json({ error: 'Deposit failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'credit',
                amount: depositAmount,
                balance_type: 'wallet',
                description: 'Wallet deposit'
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Deposit successful' });
    } catch (error) {
        console.error('Wallet deposit error:', error);
        return res.status(500).json({ error: 'Deposit failed' });
    }
});

//  Withdrawal system with minimum 25rs requirement and payout requests
app.post('/api/wallet/withdraw', requireAuth, checkBanStatus, async (req, res) => {
    const { amount } = req.body;
    const withdrawAmount = parseFloat(amount);

    console.log('💸 Withdrawal request started:', withdrawAmount, 'for user:', req.session.userId);

    // Minimum withdrawal amount check
    if (!withdrawAmount || withdrawAmount < 25) {
        return res.status(400).json({ error: 'Minimum withdrawal amount is ₹25' });
    }

    try {
        console.log('👤 Getting user data...');
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('winnings_balance')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            console.error('❌ User error:', userError);
            return res.status(400).json({ error: 'User not found' });
        }

        console.log('✅ User found. Winnings balance:', user.winnings_balance);

        if (user.winnings_balance < withdrawAmount) {
            return res.status(400).json({ error: 'Insufficient winnings balance' });
        }

        // Try to create payout request
        console.log('📋 Creating payout request...');
        try {
            const { error: payoutError } = await supabase
                .from('payout_requests')
                .insert([{
                    user_id: req.session.userId,
                    amount: withdrawAmount,
                    status: 'pending',
                    requested_at: new Date().toISOString()
                }]);

            if (payoutError) {
                console.error('❌ Payout request creation failed:', payoutError);
                // Continue without payout request for now
            } else {
                console.log('✅ Payout request created');
            }
        } catch (payoutCreateError) {
            console.error('❌ Payout request table might not exist:', payoutCreateError);
            // Continue without payout request
        }

        // Update winnings balance
        console.log('💰 Updating winnings balance...');
        const { error: updateError } = await supabase
            .from('users')
            .update({
                winnings_balance: user.winnings_balance - withdrawAmount
            })
            .eq('id', req.session.userId);

        if (updateError) {
            console.error('❌ Balance update error:', updateError);
            return res.status(500).json({ error: 'Withdrawal failed' });
        }
        console.log('✅ Winnings balance updated');

        // Try to record transaction
        console.log('📝 Recording transaction...');
        try {
            await supabase
                .from('wallet_transactions')
                .insert([{
                    user_id: req.session.userId,
                    transaction_type: 'debit',
                    amount: withdrawAmount,
                    balance_type: 'winnings',
                    description: 'Winnings withdrawal request'
                }]);
            console.log('✅ Transaction recorded');
        } catch (transactionError) {
            console.error('⚠️ Transaction recording failed (non-critical):', transactionError);
        }

        console.log('🎉 Withdrawal completed successfully');
        res.json({ success: true, message: 'Withdrawal request submitted successfully. Admin will process it soon.' });

    } catch (error) {
        console.error('💥 Withdrawal error:', error);
        return res.status(500).json({ error: 'Withdrawal failed: ' + error.message });
    }
});


app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', req.session.userId)
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error('Get transactions error:', error);
            return res.status(500).json({ error: 'Failed to get transactions' });
        }

        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// ====================================
//  Get Payout Requests Endpoint
// ====================================
app.get('/api/admin/payout-requests', requireAdmin, async (req, res) => {
    try {
        const { data: payoutRequests, error } = await supabase
            .from('payout_requests')
            .select(`
                *,
                users!payout_requests_user_id_fkey(username, email)
            `)
            .order('requested_at', { ascending: false });

        if (error) {
            console.error('Get payout requests error:', error);
            // If table doesn't exist, return empty array with warning
            if (error.code === '42P01') {
                console.warn('⚠️ payout_requests table does not exist. Please create it first.');
                return res.json([]);
            }
            return res.status(500).json({ error: 'Failed to get payout requests' });
        }

        // Transform data to match expected format
        const transformedRequests = (payoutRequests || []).map(p => ({
            id: p.id,
            user_id: p.user_id,
            username: (p.users && p.users.username) || 'Unknown',
            email: (p.users && p.users.email) || 'Unknown',
            amount: p.amount,
            status: p.status,
            requested_at: p.requested_at,
            processed_at: p.processed_at,
            admin_notes: p.admin_notes
        }));

        console.log(`✅ Loaded ${transformedRequests.length} payout requests`);
        res.json(transformedRequests);
    } catch (error) {
        console.error('Get payout requests error:', error);
        res.status(500).json({ error: 'Failed to get payout requests' });
    }
});

// ====================================
//  Process Payout Request Endpoint
// ====================================
app.post('/api/admin/process-payout', requireAdmin, async (req, res) => {
    const { payoutId, action, adminNotes } = req.body;

    if (!payoutId || !action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid payout action' });
    }

    try {
        const updateData = {
            status: action === 'approve' ? 'approved' : 'rejected',
            processed_at: new Date().toISOString(),
            processed_by: req.session.userId,
            admin_notes: adminNotes || null
        };

        const { error: updateError } = await supabase
            .from('payout_requests')
            .update(updateData)
            .eq('id', payoutId);

        if (updateError) {
            console.error('Process payout error:', updateError);
            return res.status(500).json({ error: 'Failed to process payout' });
        }

        // If rejected, refund the winnings balance
        if (action === 'reject') {
            const { data: payout, error: payoutError } = await supabase
                .from('payout_requests')
                .select('user_id, amount')
                .eq('id', payoutId)
                .single();

            if (!payoutError && payout) {
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('winnings_balance')
                    .eq('id', payout.user_id)
                    .single();

                if (!userError && user) {
                    await supabase
                        .from('users')
                        .update({
                            winnings_balance: user.winnings_balance + payout.amount
                        })
                        .eq('id', payout.user_id);

                    // Record refund transaction
                    await supabase
                        .from('wallet_transactions')
                        .insert([{
                            user_id: payout.user_id,
                            transaction_type: 'credit',
                            amount: payout.amount,
                            balance_type: 'winnings',
                            description: 'Withdrawal request rejected - refund'
                        }]);
                }
            }
        }

        console.log(`✅ Payout request ${payoutId} ${action}d by admin ${req.session.userId}`);
        res.json({
            success: true,
            message: `Payout request ${action}d successfully`
        });
    } catch (error) {
        console.error('Process payout error:', error);
        return res.status(500).json({ error: 'Failed to process payout' });
    }
});

// ====================================
//  Analytics Endpoint
// ====================================
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
        const analytics = {};

        // Get total users
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_admin', false);

        if (usersError) throw usersError;
        analytics.totalUsers = totalUsers || 0;

        // Get total tournaments
        const { count: totalTournaments, error: tournamentsError } = await supabase
            .from('tournaments')
            .select('*', { count: 'exact', head: true });

        if (tournamentsError) throw tournamentsError;
        analytics.totalTournaments = totalTournaments || 0;

        // Get active tournaments
        const { count: activeTournaments, error: activeError } = await supabase
            .from('tournaments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'upcoming');

        if (activeError) throw activeError;
        analytics.activeTournaments = activeTournaments || 0;

        // Get total revenue (wallet deposits)
        const { data: revenueData, error: revenueError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .eq('transaction_type', 'credit')
            .eq('balance_type', 'wallet');

        if (revenueError) throw revenueError;
        analytics.totalRevenue = (revenueData || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Get total withdrawals
        const { data: withdrawalData, error: withdrawalError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .eq('transaction_type', 'debit')
            .eq('balance_type', 'winnings');

        if (withdrawalError) throw withdrawalError;
        analytics.totalWithdrawals = (withdrawalData || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Get entry fees collected
        const { data: entryFeeData, error: entryFeeError } = await supabase
            .from('wallet_transactions')
            .select('amount')
            .ilike('description', '%Tournament registration:%');

        if (entryFeeError) throw entryFeeError;
        analytics.entryFeesCollected = (entryFeeData || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Calculate total profit
        analytics.totalProfit = analytics.totalRevenue - analytics.totalWithdrawals;

        // Recent users (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: recentUsers, error: recentError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('is_admin', false)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (recentError) throw recentError;
        analytics.recentUsers = recentUsers || 0;

        // Get pending payout requests count
        try {
            const { count: pendingPayouts, error: payoutError } = await supabase
                .from('payout_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (payoutError) {
                console.warn('⚠️ Could not get payout count:', payoutError.message);
                analytics.pendingPayouts = 0;
            } else {
                analytics.pendingPayouts = pendingPayouts || 0;
            }
        } catch (error) {
            console.warn('⚠️ Payout requests table might not exist yet');
            analytics.pendingPayouts = 0;
        }

        // FIXED: Get popular tournament data
        try {
            const { data: popularTournamentData, error: popularError } = await supabase
                .from('tournaments')
                .select('id, name, current_participants, max_participants')
                .order('current_participants', { ascending: false })
                .limit(1)
                .single();

            if (popularError || !popularTournamentData) {
                analytics.popularTournament = {
                    name: 'No tournaments',
                    current_participants: 0,
                    max_participants: 0
                };
            } else {
                analytics.popularTournament = popularTournamentData;
            }
        } catch (error) {
            console.warn('⚠️ Could not get popular tournament:', error.message);
            analytics.popularTournament = {
                name: 'No tournaments',
                current_participants: 0,
                max_participants: 0
            };
        }

        // FIXED: Get tournament status distribution
        try {
            const { data: statusData, error: statusError } = await supabase
                .from('tournaments')
                .select('status');

            if (statusError) throw statusError;

            // Count statuses manually for Node 12.22 compatibility
            const statusCounts = {};
            (statusData || []).forEach(tournament => {
                const status = tournament.status || 'unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            analytics.tournamentStatus = Object.keys(statusCounts).map(status => ({
                status: status,
                count: statusCounts[status]
            }));
        } catch (error) {
            console.warn('⚠️ Could not get tournament status:', error.message);
            analytics.tournamentStatus = [];
        }

        // FIXED: Get transaction trends (last 7 days)
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: trendData, error: trendError } = await supabase
                .from('wallet_transactions')
                .select('transaction_type, amount, transaction_date')
                .gte('transaction_date', sevenDaysAgo.toISOString())
                .or('description.ilike.%admin%,description.ilike.%Prize winnings%,description.ilike.%added by admin%');

            if (trendError) throw trendError;

            // Group by date and type for Node 12.22 compatibility
            const groupedTrends = {};
            (trendData || []).forEach(transaction => {
                const date = transaction.transaction_date.split('T')[0]; // Get date part only
                const type = transaction.transaction_type;

                if (!groupedTrends[date]) {
                    groupedTrends[date] = { credit: 0, debit: 0 };
                }

                groupedTrends[date][type] = (groupedTrends[date][type] || 0) + parseFloat(transaction.amount || 0);
            });

            analytics.transactionTrends = Object.keys(groupedTrends).map(date => ({
                date: date,
                transaction_type: 'credit',
                total_amount: groupedTrends[date].credit
            })).concat(Object.keys(groupedTrends).map(date => ({
                date: date,
                transaction_type: 'debit',
                total_amount: groupedTrends[date].debit
            })));
        } catch (error) {
            console.warn('⚠️ Could not get transaction trends:', error.message);
            analytics.transactionTrends = [];
        }

        console.log('📊 Analytics loaded successfully:', {
            totalUsers: analytics.totalUsers,
            totalTournaments: analytics.totalTournaments,
            pendingPayouts: analytics.pendingPayouts,
            popularTournament: analytics.popularTournament.name
        });

        res.json(analytics);
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({
            error: 'Failed to load analytics',
            details: error.message
        });
    }
});

// Admin Users Route
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, email, wallet_balance, winnings_balance, created_at, ban_status, ban_expiry, ban_reason, banned_at, banned_by')
            .eq('is_admin', false);

        if (error) {
            console.error('Get admin users error:', error);
            return res.status(500).json({ error: 'Failed to get users' });
        }

        res.json(users);
    } catch (error) {
        console.error('Get admin users error:', error);
        return res.status(500).json({ error: 'Failed to get users' });
    }
});

// Rest of the existing admin routes remain unchanged...
// (I'll continue with the remaining routes from your original server.js)

// Admin Tournaments Routes
app.get('/api/admin/tournaments', requireAdmin, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get admin tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        res.json(tournaments);
    } catch (error) {
        console.error('Get admin tournaments error:', error);
        return res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

// Delete Tournament Route
app.delete('/api/admin/tournaments/:id', requireAdmin, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    if (!tournamentId || isNaN(tournamentId)) {
        return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    try {
        // Get tournament details first
        const { data: tournament, error: getError } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', tournamentId)
            .single();

        if (getError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Delete tournament registrations first (due to foreign key constraints)
        const { error: regError } = await supabase
            .from('tournament_registrations')
            .delete()
            .eq('tournament_id', tournamentId);

        if (regError) {
            console.error('Error deleting registrations:', regError);
            return res.status(500).json({ error: 'Failed to delete tournament registrations' });
        }

        // Delete the tournament
        const { error: deleteError } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (deleteError) {
            console.error('Error deleting tournament:', deleteError);
            return res.status(500).json({ error: 'Failed to delete tournament' });
        }

        res.json({
            success: true,
            message: `Tournament "${tournament.name}" deleted successfully.`
        });
    } catch (error) {
        console.error('Delete tournament error:', error);
        return res.status(500).json({ error: 'Failed to delete tournament' });
    }
});

// Tournament Participants Route
app.get('/api/admin/tournament/:id/participants', requireAdmin, async function(req, res) {
    const tournamentId = req.params.id;
    
    try {
        // FIXED: Specify which relationship to use
        const { data: participants, error } = await supabase
            .from('tournament_registrations')
            .select('id, registration_date, registration_type, team_leader_id, users!tournament_registrations_user_id_fkey(id, username, email, wallet_balance, winnings_balance), tournaments!inner(name)')
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });
        
        if (error) {
            console.error('Get participants error:', error);
            return res.status(500).json({ error: 'Failed to get tournament participants' });
        }
        
        // Transform data to match expected format (Node 12.22 compatible)
        const transformedParticipants = participants.map(function(p) {
            return {
                id: p.users.id,
                username: p.users.username,
                email: p.users.email,
                wallet_balance: p.users.wallet_balance,
                winnings_balance: p.users.winnings_balance,
                registration_date: p.registration_date,
                registration_type: p.registration_type || 'solo',
                team_leader_id: p.team_leader_id,
                tournament_name: p.tournaments.name
            };
        });
        
        res.json(transformedParticipants);
        
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({ error: 'Failed to get tournament participants' });
    }
});

// Update Winnings Route
app.post('/api/admin/update-winnings', requireAdmin, async (req, res) => {
    const { userId, amount } = req.body;
    const winningsAmount = parseFloat(amount);

    if (!winningsAmount || winningsAmount <= 0) {
        return res.status(400).json({ error: 'Invalid winnings amount' });
    }

    try {
        // Get current winnings balance
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('winnings_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Update winnings balance
        const { error: updateError } = await supabase
            .from('users')
            .update({
                winnings_balance: user.winnings_balance + winningsAmount
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Update winnings error:', updateError);
            return res.status(500).json({ error: 'Failed to update winnings' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'credit',
                amount: winningsAmount,
                balance_type: 'winnings',
                description: 'Prize winnings added by admin'
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({ success: true, message: 'Winnings updated successfully' });
    } catch (error) {
        console.error('Update winnings error:', error);
        return res.status(500).json({ error: 'Failed to update winnings' });
    }
});

// Admin Transactions Route
app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('wallet_transactions')
            .select(`
                *,
                users!inner(username)
            `)
            .or('description.ilike.%admin%,description.ilike.%Prize winnings%,description.ilike.%added by admin%')
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error('Get transactions error:', error);
            return res.status(500).json({ error: 'Failed to get admin transactions' });
        }

        // Transform data to match expected format
        const transformedTransactions = transactions.map(t => ({
            ...t,
            username: t.users.username
        }));

        res.json(transformedTransactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ error: 'Failed to get admin transactions' });
    }
});

// Ban User Route
app.post('/api/admin/ban-user', requireAdmin, async (req, res) => {
    const { userId, banType, banReason, banExpiry } = req.body;

    if (!userId || !banType || !banReason) {
        return res.status(400).json({ error: 'User ID, ban type, and reason are required' });
    }

    if (banType === 'temporary' && !banExpiry) {
        return res.status(400).json({ error: 'Expiry date is required for temporary bans' });
    }

    // Map frontend values to database values
    let dbBanStatus;
    if (banType === 'temporary') {
        dbBanStatus = 'temp_banned';
    } else if (banType === 'permanent') {
        dbBanStatus = 'banned';
    } else {
        return res.status(400).json({ error: 'Invalid ban type' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ban_status: dbBanStatus,
                ban_reason: banReason,
                banned_at: new Date().toISOString(),
                banned_by: req.session.userId,
                ban_expiry: banExpiry || null
            })
            .eq('id', userId)
            .eq('is_admin', false)
            .select();

        if (error) {
            console.error('Ban user error:', error);
            return res.status(500).json({ error: 'Failed to ban user' });
        }

        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }

        res.json({
            success: true,
            message: `User ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned successfully`
        });
    } catch (error) {
        console.error('Ban user error:', error);
        return res.status(500).json({ error: 'Failed to ban user' });
    }
});

// Unban User Route
app.post('/api/admin/unban-user', requireAdmin, async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ban_status: 'active',
                ban_expiry: null,
                ban_reason: null,
                banned_at: null,
                banned_by: null
            })
            .eq('id', userId)
            .eq('is_admin', false)
            .select();

        if (error) {
            console.error('Unban user error:', error);
            return res.status(500).json({ error: 'Failed to unban user' });
        }

        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'User not found or is admin' });
        }

        res.json({ success: true, message: 'User unbanned successfully' });
    } catch (error) {
        console.error('Unban user error:', error);
        return res.status(500).json({ error: 'Failed to unban user' });
    }
});

// Tournament Management Routes
app.get('/api/admin/tournament/:id/manage', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Get match details if exists
        const { data: matchDetails, error: matchError } = await supabase
            .from('tournament_match_details')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Don't fail if no match details exist
        res.json({
            tournament: tournament,
            matchDetails: matchDetails || null
        });
    } catch (error) {
        console.error('Get tournament management error:', error);
        return res.status(500).json({ error: 'Failed to get tournament' });
    }
});

// Update Match Details Route
app.post('/api/admin/tournament/:id/match-details', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { room_id, room_password, match_start_time, game_server } = req.body;

    try {
        const { data, error } = await supabase
            .from('tournament_match_details')
            .upsert({
                tournament_id: tournamentId,
                room_id: room_id,
                room_password: room_password,
                match_start_time: match_start_time,
                game_server: game_server,
                updated_by: req.session.userId,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'tournament_id'
            });

        if (error) {
            console.error('Update match details error:', error);
            return res.status(500).json({ error: 'Failed to update match details' });
        }

        res.json({ success: true, message: 'Match details updated successfully' });
    } catch (error) {
        console.error('Update match details error:', error);
        return res.status(500).json({ error: 'Failed to update match details' });
    }
});

// Post Tournament Announcement Route
app.post('/api/admin/tournament/:id/announce', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Announcement cannot be empty' });
    }

    if (message.length > 500) {
        return res.status(400).json({ error: 'Announcement too long (max 500 characters)' });
    }

    try {
        const { data, error } = await supabase
            .from('tournament_announcements')
            .insert([{
                tournament_id: tournamentId,
                admin_id: req.session.userId,
                message: message.trim()
            }]);

        if (error) {
            console.error('Post announcement error:', error);
            return res.status(500).json({ error: 'Failed to post announcement' });
        }

        res.json({ success: true, message: 'Announcement posted successfully' });
    } catch (error) {
        console.error('Post announcement error:', error);
        return res.status(500).json({ error: 'Failed to post announcement' });
    }
});

// Update Tournament Status Route
app.post('/api/admin/tournament/:id/status', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { status } = req.body;

    if (!status || !['upcoming', 'active', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .update({ status: status })
            .eq('id', tournamentId)
            .select();

        if (error) {
            console.error('Update tournament status error:', error);
            return res.status(500).json({ error: 'Failed to update tournament status' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        res.json({ success: true, message: 'Tournament status updated successfully' });
    } catch (error) {
        console.error('Update tournament status error:', error);
        return res.status(500).json({ error: 'Failed to update tournament status' });
    }
});

// Export Participants Route
app.get('/api/admin/tournament/:id/export-participants', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        const { data: participants, error } = await supabase
        .from('tournament_registrations')
        .select(`
            id,
            registration_date,
            registration_type,
            team_leader_id,
            users!tournament_registrations_user_id_fkey(id, username, email, wallet_balance, winnings_balance),
            tournaments!inner(name)
        `)
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });

        if (error) {
            console.error('Export participants error:', error);
            return res.status(500).json({ error: 'Failed to export participants' });
        }

        // Format data for export
        const exportData = {
            tournament_name: participants.length > 0 ? participants[0].tournaments.name : 'Unknown',
            export_date: new Date().toISOString(),
            total_participants: participants.length,
            participants: participants.map(p => ({
                id: p.users.id,
                username: p.users.username,
                email: p.users.email,
                wallet_balance: p.users.wallet_balance,
                winnings_balance: p.users.winnings_balance,
                registration_date: p.registration_date
            }))
        };

        res.json(exportData);
    } catch (error) {
        console.error('Export participants error:', error);
        return res.status(500).json({ error: 'Failed to export participants' });
    }
});

// Send Bulk Message Route
app.post('/api/admin/tournament/:id/bulk-message', requireAdmin, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }

    try {
        // Insert message as admin in tournament chat
        const { data, error } = await supabase
            .from('tournament_chat_messages')
            .insert([{
                tournament_id: tournamentId,
                user_id: req.session.userId,
                message: `[ADMIN BROADCAST] ${message.trim()}`
            }]);

        if (error) {
            console.error('Bulk message error:', error);
            return res.status(500).json({ error: 'Failed to send bulk message' });
        }

        res.json({ success: true, message: 'Bulk message sent successfully' });
    } catch (error) {
        console.error('Bulk message error:', error);
        return res.status(500).json({ error: 'Failed to send bulk message' });
    }
});

// Tournament Announcements Route (for users/admins)
app.get('/api/tournament/:id/announcements', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const { data: announcements, error } = await supabase
            .from('tournament_announcements')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Get announcements error:', error);
            return res.status(500).json({ error: 'Failed to get announcements' });
        }

        res.json(announcements);

    } catch (error) {
        console.error('Get announcements error:', error);
        return res.status(500).json({ error: 'Failed to get announcements' });
    }
});

// Tournament Chat Route (for users/admins)
app.get('/api/tournament/:id/chat', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const { data: messages, error } = await supabase
            .from('tournament_chat_messages')
            .select(`
                *,
                users!inner(username, is_admin)
            `)
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Get chat messages error:', error);
            return res.status(500).json({ error: 'Failed to get messages' });
        }

        // Transform data to match expected format
        const transformedMessages = messages.map(m => ({
            ...m,
            username: m.users.username,
            is_admin: m.users.is_admin
        }));

        res.json(transformedMessages);

    } catch (error) {
        console.error('Get chat messages error:', error);
        return res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send Chat Message Route
app.post('/api/tournament/:id/chat', requireAuth, checkBanStatus, async (req, res) => {
    const tournamentId = req.params.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 200) {
        return res.status(400).json({ error: 'Message too long (max 200 characters)' });
    }

    try {
        // FIXED: Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('tournament_id', tournamentId)
                .eq('user_id', req.session.userId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Insert chat message
        const { data, error } = await supabase
            .from('tournament_chat_messages')
            .insert([{
                tournament_id: tournamentId,
                user_id: req.session.userId,
                message: message.trim()
            }]);

        if (error) {
            console.error('Send message error:', error);
            return res.status(500).json({ error: 'Failed to send message' });
        }

        res.json({ success: true, message: 'Message sent successfully' });

    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ error: 'Failed to send message' });
    }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `match-result-${uniqueSuffix}${fileExtension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Admin Image Upload Route for Tournament Chat
app.post('/api/tournament/:id/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
    const tournamentId = req.params.id;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    try {
        // Insert image message into chat
        const imageUrl = `/uploads/${req.file.filename}`;
        const message = req.body.message || 'Match Result Image';

        const { data, error } = await supabase
            .from('tournament_chat_messages')
            .insert([{
                tournament_id: tournamentId,
                user_id: req.session.userId,
                message: message,
                image_url: imageUrl,
                message_type: 'image'
            }])
            .select()
            .single();

        if (error) {
            console.error('Image message insert error:', error);
            // Delete uploaded file if database insert fails
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: 'Failed to save image message' });
        }

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl: imageUrl,
            messageId: data.id
        });

    } catch (error) {
        console.error('Image upload error:', error);
        // Delete uploaded file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Tournament Lobby Data Route
app.get('/api/tournament/:id/lobby', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        // FIXED: Check if user is admin first, if yes, skip registration check
        if (!req.session.isAdmin) {
            // Only check registration for non-admin users
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('*')
                .eq('user_id', req.session.userId)
                .eq('tournament_id', tournamentId)
                .single();

            if (regError || !registration) {
                return res.status(403).json({ error: 'You are not registered for this tournament' });
            }
        } else {
            console.log(`✅ Admin access granted to tournament ${tournamentId} for user ${req.session.userId}`);
        }

        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // Get match details if exists
        const { data: matchDetails, error: matchError } = await supabase
            .from('tournament_match_details')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Don't fail if no match details exist
        res.json({
            tournament: tournament,
            matchDetails: matchDetails || null,
            onlineCount: tournament.current_participants // Simplified for now
        });

    } catch (error) {
        console.error('Get tournament lobby error:', error);
        return res.status(500).json({ error: 'Failed to get tournament data' });
    }
});

// Tournament Players Route
app.get('/api/tournament/:id/players', requireAuth, async function(req, res) {
    const tournamentId = req.params.id;
    
    try {
        // Check if user is admin OR registered for this tournament
        if (!req.session.isAdmin) {
            const { data: registration, error: regError } = await supabase
                .from('tournament_registrations')
                .select('id')
                .eq('user_id', req.session.userId)
                .eq('tournament_id', tournamentId)
                .single();
            
            if (regError || !registration) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        // FIXED: Specify which relationship to use
        const { data: players, error } = await supabase
            .from('tournament_registrations')
            .select('registration_date, registration_type, team_leader_id, users!tournament_registrations_user_id_fkey(id, username, wallet_balance, winnings_balance, is_admin)')
            .eq('tournament_id', tournamentId)
            .order('registration_date', { ascending: true });
        
        if (error) {
            console.error('Get tournament players error:', error);
            return res.status(500).json({ error: 'Failed to get players' });
        }
        
        // Transform data to match expected format (Node 12.22 compatible)
        const transformedPlayers = players.map(function(p) {
            return {
                id: p.users.id,
                username: p.users.username,
                wallet_balance: p.users.wallet_balance,
                winnings_balance: p.users.winnings_balance,
                is_admin: p.users.is_admin,
                registration_date: p.registration_date,
                registration_type: p.registration_type || 'solo',
                team_leader_id: p.team_leader_id,
                is_online: p.users.id === req.session.userId ? 1 : 0 // Simplified online status
            };
        });
        
        res.json(transformedPlayers);
        
    } catch (error) {
        console.error('Get tournament players error:', error);
        res.status(500).json({ error: 'Failed to get players' });
    }
});


// Enhanced Tournament Routes - Add these to your server.js file

// Enhanced tournaments API with game types and team modes
app.get('/api/tournaments/enhanced', requireAuth, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select(`
                *,
                tournament_registrations!left(user_id),
                team_registrations!left(team_leader_id)
            `)
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Get enhanced tournaments error:', error);
            return res.status(500).json({ error: 'Failed to get tournaments' });
        }

        // Transform data to include registration status
        const tournamentsWithRegistration = tournaments.map(tournament => {
            // Check solo registration
            const soloRegistered = tournament.tournament_registrations.some(reg => reg.user_id === req.session.userId);

            // Check team registration (as leader)
            const teamRegistered = tournament.team_registrations.some(team => team.team_leader_id === req.session.userId);

            return {
                ...tournament,
                is_registered: (soloRegistered || teamRegistered) ? 1 : 0
            };
        });

        res.json(tournamentsWithRegistration);
    } catch (error) {
        console.error('Get enhanced tournaments error:', error);
        return res.status(500).json({ error: 'Failed to get tournaments' });
    }
});

// Enhanced tournament registration with combined wallet balance
app.post('/api/tournaments/register', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId } = req.body;

    try {
        console.log('🎮 Tournament registration started for user:', req.session.userId, 'tournament:', tournamentId);

        // Get tournament details
        console.log('📋 Fetching tournament details...');
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            console.error('❌ Tournament not found:', tournamentError);
            return res.status(400).json({ error: 'Tournament not found' });
        }

        console.log('✅ Tournament found:', tournament.name, 'Entry fee:', tournament.entry_fee);

        // Check if tournament is full
        if (tournament.current_participants >= tournament.max_participants) {
            return res.status(400).json({ error: 'Tournament is full' });
        }

        // Check if already registered
        console.log('🔍 Checking existing registration...');
        const { data: existingSolo, error: soloCheckError } = await supabase
            .from('tournament_registrations')
            .select('id')
            .eq('user_id', req.session.userId)
            .eq('tournament_id', tournamentId)
            .single();

        if (existingSolo) {
            return res.status(400).json({ error: 'Already registered for this tournament' });
        }

        // ENHANCED: Handle free vs paid tournaments
        if (tournament.entry_fee === 0) {
            console.log('🎉 FREE TOURNAMENT - No payment required');

            // Register user directly for free tournament
            const { error: registrationError } = await supabase
                .from('tournament_registrations')
                .insert([{
                    user_id: req.session.userId,
                    tournament_id: tournamentId
                }]);

            if (registrationError) {
                console.error('❌ Registration error:', registrationError);
                return res.status(500).json({ error: 'Registration failed' });
            }

            console.log('✅ User registered for free tournament');

            // Update tournament participant count
            console.log('📊 Updating tournament participant count...');
            const { error: tournamentUpdateError } = await supabase
                .from('tournaments')
                .update({
                    current_participants: tournament.current_participants + 1
                })
                .eq('id', tournamentId);

            if (tournamentUpdateError) {
                console.error('❌ Tournament update error:', tournamentUpdateError);
                return res.status(500).json({ error: 'Registration failed' });
            }

            console.log('✅ Tournament participant count updated');

            // Record transaction for tracking (optional for free tournaments)
            try {
                await supabase
                    .from('wallet_transactions')
                    .insert([{
                        user_id: req.session.userId,
                        transaction_type: 'info',
                        amount: 0,
                        balance_type: 'tournament',
                        description: `Free tournament registration: ${tournament.name}`
                    }]);
                console.log('✅ Free tournament registration logged');
            } catch (transactionError) {
                console.error('⚠️ Transaction logging failed (non-critical):', transactionError);
            }

            console.log('🎉 Free tournament registration completed successfully');
            return res.json({
                success: true,
                message: 'Successfully registered for free tournament!',
                tournament_type: 'free'
            });

        } else {
            console.log('💰 PAID TOURNAMENT - Payment required, entry fee:', tournament.entry_fee);

            // Get user details for paid tournament
            console.log('👤 Fetching user details...');
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', req.session.userId)
                .single();

            if (userError || !user) {
                console.error('❌ User not found:', userError);
                return res.status(400).json({ error: 'User not found' });
            }

            console.log('✅ User found:', user.username);

            // Check combined balance for paid tournaments
            console.log('💰 Checking balances...');
            const totalBalance = parseFloat(user.wallet_balance) + parseFloat(user.winnings_balance);
            console.log('Wallet:', user.wallet_balance, 'Winnings:', user.winnings_balance, 'Total:', totalBalance, 'Entry fee:', tournament.entry_fee);

            if (totalBalance < tournament.entry_fee) {
                return res.status(400).json({ error: 'Insufficient combined balance' });
            }

            // Register user for paid tournament
            console.log('📝 Registering user for paid tournament...');
            const { error: registrationError } = await supabase
                .from('tournament_registrations')
                .insert([{
                    user_id: req.session.userId,
                    tournament_id: tournamentId
                }]);

            if (registrationError) {
                console.error('❌ Registration error:', registrationError);
                return res.status(500).json({ error: 'Registration failed' });
            }

            console.log('✅ User registered successfully');

            // Calculate balance deductions for paid tournaments
            console.log('🧮 Calculating balance deductions...');
            let newWalletBalance = parseFloat(user.wallet_balance);
            let newWinningsBalance = parseFloat(user.winnings_balance);
            let remainingFee = parseFloat(tournament.entry_fee);

            if (newWalletBalance >= remainingFee) {
                newWalletBalance -= remainingFee;
            } else {
                remainingFee -= newWalletBalance;
                newWalletBalance = 0;
                newWinningsBalance -= remainingFee;
            }

            console.log('New wallet balance:', newWalletBalance, 'New winnings balance:', newWinningsBalance);

            // Update user balances
            console.log('💳 Updating user balances...');
            const { error: balanceError } = await supabase
                .from('users')
                .update({
                    wallet_balance: newWalletBalance,
                    winnings_balance: newWinningsBalance
                })
                .eq('id', req.session.userId);

            if (balanceError) {
                console.error('❌ Balance update error:', balanceError);
                return res.status(500).json({ error: 'Payment failed' });
            }

            console.log('✅ Balances updated');

            // Update tournament participant count
            console.log('📊 Updating tournament participant count...');
            const { error: tournamentUpdateError } = await supabase
                .from('tournaments')
                .update({
                    current_participants: tournament.current_participants + 1
                })
                .eq('id', tournamentId);

            if (tournamentUpdateError) {
                console.error('❌ Tournament update error:', tournamentUpdateError);
                return res.status(500).json({ error: 'Registration failed' });
            }

            console.log('✅ Tournament participant count updated');

            // Record transaction for paid tournaments
            console.log('📝 Recording transaction...');
            try {
                await supabase
                    .from('wallet_transactions')
                    .insert([{
                        user_id: req.session.userId,
                        transaction_type: 'debit',
                        amount: tournament.entry_fee,
                        balance_type: 'wallet',
                        description: `Tournament registration: ${tournament.name}`
                    }]);
                console.log('✅ Transaction recorded');
            } catch (transactionError) {
                console.error('⚠️ Transaction recording failed (non-critical):', transactionError);
            }

            console.log('🎉 Paid tournament registration completed successfully');
            return res.json({
                success: true,
                message: `Successfully registered for tournament! Entry fee: $${tournament.entry_fee}`,
                tournament_type: 'paid',
                entry_fee: tournament.entry_fee
            });
        }

    } catch (error) {
        console.error('💥 Tournament registration error:', error);
        return res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Team registration endpoint
app.post('/api/tournaments/register-team', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId, teamName, teamSize, members } = req.body;

    if (!teamName || !teamSize || !members || !Array.isArray(members)) {
        return res.status(400).json({ error: 'Invalid team data' });
    }

    if (teamSize < 2 || teamSize > 4) {
        return res.status(400).json({ error: 'Invalid team size' });
    }

    if (members.length !== teamSize - 1) {
        return res.status(400).json({ error: 'Member count does not match team size' });
    }

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }

        // Validate tournament supports team mode
        const maxTeamSize = tournament.team_mode === 'duo' ? 2 : tournament.team_mode === 'squad' ? 4 : 1;
        if (teamSize > maxTeamSize) {
            return res.status(400).json({ error: `Tournament only supports up to ${maxTeamSize} players` });
        }

        // Get team leader details
        const { data: leader, error: leaderError } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();

        if (leaderError || !leader) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check if leader has enough balance
        const totalBalance = parseFloat(leader.wallet_balance) + parseFloat(leader.winnings_balance);
        const totalEntryFee = tournament.entry_fee * teamSize;

        if (totalBalance < totalEntryFee) {
            return res.status(400).json({ error: `Insufficient balance. Need ₹${totalEntryFee} for team registration` });
        }

        // Validate team members exist
        const { data: memberUsers, error: memberError } = await supabase
            .from('users')
            .select('id, username')
            .in('username', members);

        if (memberError) {
            console.error('Member validation error:', memberError);
            return res.status(500).json({ error: 'Failed to validate team members' });
        }

        if (memberUsers.length !== members.length) {
            const foundUsernames = memberUsers.map(u => u.username);
            const notFound = members.filter(m => !foundUsernames.includes(m));
            return res.status(400).json({ error: `Users not found: ${notFound.join(', ')}` });
        }

        // Check if tournament has space for the team
        const spotsNeeded = teamSize;
        const availableSpots = tournament.max_participants - tournament.current_participants;

        if (availableSpots < spotsNeeded) {
            return res.status(400).json({ error: 'Not enough spots available for your team' });
        }

        // Check if any team member is already registered
        const allUserIds = [req.session.userId, ...memberUsers.map(u => u.id)];

        const { data: existingRegs, error: regCheckError } = await supabase
            .from('tournament_registrations')
            .select('user_id')
            .eq('tournament_id', tournamentId)
            .in('user_id', allUserIds);

        if (existingRegs && existingRegs.length > 0) {
            return res.status(400).json({ error: 'One or more team members are already registered' });
        }

        // Create team registration
        const { data: teamReg, error: teamRegError } = await supabase
            .from('team_registrations')
            .insert([{
                tournament_id: tournamentId,
                team_leader_id: req.session.userId,
                team_name: teamName,
                team_members: allUserIds,
                team_size: teamSize
            }])
            .select()
            .single();

        if (teamRegError) {
            console.error('Team registration error:', teamRegError);
            return res.status(500).json({ error: 'Team registration failed' });
        }

        // Register all team members individually
        const registrations = allUserIds.map(userId => ({
            user_id: userId,
            tournament_id: tournamentId
        }));

        const { error: memberRegError } = await supabase
            .from('tournament_registrations')
            .insert(registrations);

        if (memberRegError) {
            console.error('Member registration error:', memberRegError);
            return res.status(500).json({ error: 'Failed to register team members' });
        }

        // Deduct entry fee from team leader (pays for whole team)
        let newWalletBalance = leader.wallet_balance;
        let newWinningsBalance = leader.winnings_balance;
        let remainingFee = totalEntryFee;

        if (newWalletBalance >= remainingFee) {
            newWalletBalance -= remainingFee;
        } else {
            remainingFee -= newWalletBalance;
            newWalletBalance = 0;
            newWinningsBalance -= remainingFee;
        }

        const { error: balanceError } = await supabase
            .from('users')
            .update({
                wallet_balance: newWalletBalance,
                winnings_balance: newWinningsBalance
            })
            .eq('id', req.session.userId);

        if (balanceError) {
            console.error('Balance update error:', balanceError);
            return res.status(500).json({ error: 'Payment failed' });
        }

        // Update tournament participant count
        const { error: tournamentUpdateError } = await supabase
            .from('tournaments')
            .update({
                current_participants: tournament.current_participants + teamSize
            })
            .eq('id', tournamentId);

        if (tournamentUpdateError) {
            console.error('Tournament update error:', tournamentUpdateError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Record transaction
        const { error: transactionError } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: req.session.userId,
                transaction_type: 'debit',
                amount: totalEntryFee,
                balance_type: 'tournament',
                description: `Team registration: ${tournament.name} (${teamName})`
            }]);

        if (transactionError) {
            console.error('Transaction error:', transactionError);
            return res.status(500).json({ error: 'Transaction recording failed' });
        }

        res.json({
            success: true,
            message: `Team "${teamName}" registered successfully for ₹${totalEntryFee}`,
            teamId: teamReg.id
        });

    } catch (error) {
        console.error('Team registration error:', error);
        return res.status(500).json({ error: 'Team registration failed' });
    }
});

// Enhanced admin tournament creation
app.post('/api/admin/tournaments/enhanced', requireAdmin, async (req, res) => {
    const {
        name,
        description,
        game_type,
        team_mode,
        entry_fee,
        prize_pool,
        max_participants,
        start_date,
        end_date,
        kill_points,
        rank_points,
        match_type
    } = req.body;

    if (!name || !game_type || !team_mode || entry_fee === undefined || prize_pool === undefined || !max_participants || !start_date) {
        return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate game type
    const validGames = ['Free Fire', 'BGMI', 'Valorant', 'CODM'];
    if (!validGames.includes(game_type)) {
        return res.status(400).json({ error: 'Invalid game type' });
    }

    // Validate team mode
    const validModes = ['solo', 'duo', 'squad'];
    if (!validModes.includes(team_mode)) {
        return res.status(400).json({ error: 'Invalid team mode' });
    }

    // FIXED: Validate entry fee (allow 0 for free tournaments)
    const entryFeeValue = parseFloat(entry_fee);
    if (isNaN(entryFeeValue) || entryFeeValue < 0) {
        console.log('❌ Entry fee validation failed:', entry_fee, 'parsed as:', entryFeeValue);
        return res.status(400).json({ error: 'Entry fee cannot be negative' });
    }

    console.log('✅ Entry fee validation passed:', {
        original: entry_fee,
        parsed: entryFeeValue,
        type: typeof entry_fee
    });


    // FIXED: Validate prize pool (allow 0 for free tournaments)
    const prizePoolValue = parseFloat(prize_pool);
    if (isNaN(prizePoolValue) || prizePoolValue < 0) {
        console.log('❌ Prize pool validation failed:', prize_pool, 'parsed as:', prizePoolValue);
        return res.status(400).json({ error: 'Prize pool cannot be negative' });
    }

    console.log('✅ Prize pool validation passed:', {
        original: prize_pool,
        parsed: prizePoolValue,
        type: typeof prize_pool
    });

    console.log('Creating tournament with entry fee:', entryFeeValue, 'and prize pool:', prizePoolValue);

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .insert([{
                name,
                description: description || `${game_type} ${team_mode} tournament`,
                game_type,
                team_mode,
                entry_fee: entryFeeValue,
                prize_pool: prizePoolValue, // Can now be 0
                max_participants: parseInt(max_participants),
                start_date,
                end_date: end_date || start_date,
                kill_points: parseInt(kill_points) || 1,
                rank_points: rank_points || '{"1":10,"2":8,"3":6,"4":4,"5":2,"6":1}',
                match_type: match_type || 'Battle Royale',
                game_image_url: getGameImageUrl(game_type),
                status: 'upcoming',
                current_participants: 0
            }])
            .select()
            .single();

        if (error) {
            console.error('Create enhanced tournament error:', error);
            return res.status(500).json({ error: 'Failed to create tournament' });
        }

        const tournamentTypeMessage = entryFeeValue === 0 ?
            `Free tournament "${name}" created successfully!` :
            `Paid tournament "${name}" created successfully with $${entryFeeValue} entry fee!`;

        res.json({
            success: true,
            message: tournamentTypeMessage,
            tournament: data
        });

    } catch (error) {
        console.error('Create enhanced tournament error:', error);
        return res.status(500).json({ error: 'Failed to create tournament' });
    }
});

// Get team details for a tournament
app.get('/api/tournament/:id/teams', requireAuth, async (req, res) => {
    const tournamentId = req.params.id;

    try {
        const { data: teams, error } = await supabase
            .from('team_registrations')
            .select(`
                *,
                users!team_registrations_team_leader_id_fkey(username)
            `)
            .eq('tournament_id', tournamentId)
            .eq('is_active', true);

        if (error) {
            console.error('Get teams error:', error);
            return res.status(500).json({ error: 'Failed to get teams' });
        }

        // Get member details for each team
        const teamsWithMembers = await Promise.all(teams.map(async (team) => {
            const { data: members, error: memberError } = await supabase
                .from('users')
                .select('id, username')
                .in('id', team.team_members);

            return {
                ...team,
                leader_username: team.users.username,
                members: members || []
            };
        }));

        res.json(teamsWithMembers);
    } catch (error) {
        console.error('Get teams error:', error);
        return res.status(500).json({ error: 'Failed to get teams' });
    }
});

app.get('/api/debug/tournaments', requireAuth, async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            message: 'DEBUG: Raw tournament data from database',
            tournaments: tournaments,
            count: tournaments.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enhanced Tournament Registration API Endpoints for Duo/Squad Support
// Validate team member usernames endpoint
app.post('/api/validate-usernames', requireAuth, async (req, res) => {
    const { usernames } = req.body;

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({ error: 'Invalid usernames array' });
    }

    try {
        console.log('🔍 Validating usernames:', usernames);

        // Check if all usernames exist and are not banned
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, ban_status')
            .in('username', usernames)
            .neq('is_admin', true); // Exclude admin users

        if (error) {
            console.error('Username validation error:', error);
            return res.status(500).json({ error: 'Failed to validate usernames' });
        }

        const foundUsernames = users.map(u => u.username);
        const validUsers = users.filter(u => u.ban_status !== 'banned' && u.ban_status !== 'temp_banned');
        const validUsernames = validUsers.map(u => u.username);
        const bannedUsers = users.filter(u => u.ban_status === 'banned' || u.ban_status === 'temp_banned');

        const notFound = usernames.filter(username => !foundUsernames.includes(username));
        const banned = bannedUsers.map(u => u.username);

        res.json({
            valid: validUsernames,
            notFound: notFound,
            banned: banned,
            allValid: notFound.length === 0 && banned.length === 0
        });

    } catch (error) {
        console.error('Username validation error:', error);
        res.status(500).json({ error: 'Failed to validate usernames' });
    }
});

// Enhanced tournament registration for duo/squad with battle royale check
app.post('/api/tournaments/register-enhanced', requireAuth, checkBanStatus, async (req, res) => {
    const { tournamentId, registrationType, teamData } = req.body;

    console.log('🎮 Enhanced tournament registration:', { tournamentId, registrationType, teamData });

    try {
        // Get tournament details
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(400).json({ error: 'Tournament not found' });
        }

        // Check if tournament is Battle Royale (required for duo/squad registration logic)
        const isBattleRoyale = tournament.match_type === 'Battle Royale';
        console.log('Tournament type:', tournament.match_type, 'Is Battle Royale:', isBattleRoyale);

        // Solo registration (no change from existing logic)
        if (registrationType === 'solo' || tournament.team_mode === 'solo') {
            return await handleSoloRegistration(req, res, tournament);
        }

        // Duo/Squad registration for Battle Royale tournaments
        if ((registrationType === 'duo' || registrationType === 'squad') && isBattleRoyale) {
            return await handleTeamRegistration(req, res, tournament, registrationType, teamData);
        }

        // Fallback to solo registration for non-Battle Royale tournaments
        return await handleSoloRegistration(req, res, tournament);

    } catch (error) {
        console.error('Enhanced registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Handle solo registration (existing logic)
async function handleSoloRegistration(req, res, tournament) {
    const userId = req.session.userId;

    console.log('📝 Handling solo registration for user:', userId);

    // Check if already registered
    const { data: existingReg } = await supabase
        .from('tournament_registrations')
        .select('id')
        .eq('user_id', userId)
        .eq('tournament_id', tournament.id)
        .single();

    if (existingReg) {
        return res.status(400).json({ error: 'Already registered for this tournament' });
    }

    // Check tournament capacity
    if (tournament.current_participants >= tournament.max_participants) {
        return res.status(400).json({ error: 'Tournament is full' });
    }

    // Handle free vs paid tournaments
    if (tournament.entry_fee === 0) {
        // Free tournament registration
        const { error: regError } = await supabase
            .from('tournament_registrations')
            .insert([{
                user_id: userId,
                tournament_id: tournament.id,
                registration_type: 'solo'
            }]);

        if (regError) {
            console.error('Registration error:', regError);
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Update participant count
        await supabase
            .from('tournaments')
            .update({ current_participants: tournament.current_participants + 1 })
            .eq('id', tournament.id);

        return res.json({
            success: true,
            message: 'Successfully registered for free tournament!',
            tournament_type: 'free'
        });
    } else {
        // Paid tournament registration (existing logic)
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        const totalBalance = parseFloat(user.wallet_balance) + parseFloat(user.winnings_balance);

        if (totalBalance < tournament.entry_fee) {
            return res.status(400).json({ error: 'Insufficient combined balance' });
        }

        // Register user
        const { error: regError } = await supabase
            .from('tournament_registrations')
            .insert([{
                user_id: userId,
                tournament_id: tournament.id,
                registration_type: 'solo'
            }]);

        if (regError) {
            return res.status(500).json({ error: 'Registration failed' });
        }

        // Deduct entry fee
        let newWalletBalance = parseFloat(user.wallet_balance);
        let newWinningsBalance = parseFloat(user.winnings_balance);
        let remainingFee = parseFloat(tournament.entry_fee);

        if (newWalletBalance >= remainingFee) {
            newWalletBalance -= remainingFee;
        } else {
            remainingFee -= newWalletBalance;
            newWalletBalance = 0;
            newWinningsBalance -= remainingFee;
        }

        await supabase
            .from('users')
            .update({
                wallet_balance: newWalletBalance,
                winnings_balance: newWinningsBalance
            })
            .eq('id', userId);

        // Update participant count
        await supabase
            .from('tournaments')
            .update({ current_participants: tournament.current_participants + 1 })
            .eq('id', tournament.id);

        // Record transaction
        await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'debit',
                amount: tournament.entry_fee,
                balance_type: 'wallet',
                description: `Tournament registration: ${tournament.name}`
            }]);

        return res.json({
            success: true,
            message: `Successfully registered for tournament! Entry fee: ₹${tournament.entry_fee}`,
            tournament_type: 'paid',
            entry_fee: tournament.entry_fee
        });
    }
}

// Handle team registration (duo/squad for Battle Royale)
async function handleTeamRegistration(req, res, tournament, registrationType, teamData) {
    const userId = req.session.userId;

    console.log('👥 Handling team registration:', { registrationType, teamData });

    if (!teamData) {
        return res.status(400).json({ error: 'Team data is required for team registration' });
    }

    const isSquad = registrationType === 'squad';
    let expectedSize = isSquad ? 4 : 2; // Initial size, will be adjusted for squad

    // Validate team data structure
    if (isSquad) {
        const { teamName, players } = teamData;
        if (!teamName || !players || !Array.isArray(players)) {
            return res.status(400).json({ error: 'Invalid squad data' });
        }
        
        // FIXED: Allow 4-5 players (4 required + 1 optional substitute)
        if (players.length < 4 || players.length > 5) {
            return res.status(400).json({ error: 'Squad must have 4 main players and optionally 1 substitute' });
        }
        
        // Update expectedSize based on actual players
        expectedSize = players.length;
    } else {
        // Duo validation
        const { playerData } = teamData;
        if (!playerData || !playerData.teammate) {
            return res.status(400).json({ error: 'Invalid duo data' });
        }
    }

    // Get team leader details
    const { data: leader, error: leaderError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (leaderError || !leader) {
        return res.status(400).json({ error: 'User not found' });
    }

    let allTeamMembers = [];
    let teamName = '';

    if (isSquad) {
        // Squad processing - FIXED VERSION
        teamName = teamData.teamName;
        
        // Filter usernames - only include non-empty ones
        const playerUsernames = [];
        for (let i = 0; i < teamData.players.length; i++) {
            const player = teamData.players[i];
            if (player.username && player.username.trim()) {
                playerUsernames.push(player.username.trim());
            }
        }
        
        console.log('Squad player usernames to validate:', playerUsernames);

        // The first username should be the team leader, so we skip it for validation
        const teamMemberUsernames = playerUsernames.slice(1);
        
        if (teamMemberUsernames.length > 0) {
            // Validate all usernames exist (except team leader)
            const { data: memberUsers, error: memberError } = await supabase
                .from('users')
                .select('id, username')
                .in('username', teamMemberUsernames);

            if (memberError || memberUsers.length !== teamMemberUsernames.length) {
                const foundUsernames = memberUsers ? memberUsers.map(function(u) { return u.username; }) : [];
                const notFound = teamMemberUsernames.filter(function(u) { return !foundUsernames.includes(u); });
                return res.status(400).json({ error: 'Users not found: ' + notFound.join(', ') });
            }

            // Create team members array: [leader_id, ...member_ids]
            allTeamMembers = [userId];
            memberUsers.forEach(function(user) {
                allTeamMembers.push(user.id);
            });
        } else {
            // Only team leader (shouldn't happen but handle gracefully)
            allTeamMembers = [userId];
        }
        
        console.log('Squad team members:', allTeamMembers);
        
    } else {
        // Duo processing
        const teammateUsername = teamData.playerData.teammate.username;

        if (!teammateUsername) {
            return res.status(400).json({ error: 'Teammate username is required' });
        }

        const { data: teammate, error: teammateError } = await supabase
            .from('users')
            .select('id, username')
            .eq('username', teammateUsername)
            .single();

        if (teammateError || !teammate) {
            return res.status(400).json({ error: 'Teammate not found' });
        }

        allTeamMembers = [userId, teammate.id];
        teamName = leader.username + ' & ' + teammate.username;
    }

    // Check if any team member is already registered
    const { data: existingRegs } = await supabase
        .from('tournament_registrations')
        .select('user_id')
        .eq('tournament_id', tournament.id)
        .in('user_id', allTeamMembers);

    if (existingRegs && existingRegs.length > 0) {
        return res.status(400).json({ error: 'One or more team members are already registered' });
    }

    // Check tournament capacity
    const spotsNeeded = expectedSize;
    const availableSpots = tournament.max_participants - tournament.current_participants;

    if (availableSpots < spotsNeeded) {
        return res.status(400).json({ error: 'Not enough spots available for your team' });
    }

    // Calculate total entry fee (team leader pays for whole team)
    const totalEntryFee = tournament.entry_fee * expectedSize;

    if (tournament.entry_fee > 0) {
        // Check if leader has enough balance
        const totalBalance = parseFloat(leader.wallet_balance) + parseFloat(leader.winnings_balance);

        if (totalBalance < totalEntryFee) {
            return res.status(400).json({
                error: 'Insufficient balance. Need ₹' + totalEntryFee + ' for team registration'
            });
        }

        // Deduct entry fee from team leader
        let newWalletBalance = leader.wallet_balance;
        let newWinningsBalance = leader.winnings_balance;
        let remainingFee = totalEntryFee;

        if (newWalletBalance >= remainingFee) {
            newWalletBalance -= remainingFee;
        } else {
            remainingFee -= newWalletBalance;
            newWalletBalance = 0;
            newWinningsBalance -= remainingFee;
        }

        await supabase
            .from('users')
            .update({
                wallet_balance: newWalletBalance,
                winnings_balance: newWinningsBalance
            })
            .eq('id', userId);

        // Record transaction
        await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'debit',
                amount: totalEntryFee,
                balance_type: 'tournament',
                description: registrationType.charAt(0).toUpperCase() + registrationType.slice(1) + ' registration: ' + tournament.name + ' (' + teamName + ')'
            }]);
    }

    // Create team registration record
    const teamRegData = {
        tournament_id: tournament.id,
        team_leader_id: userId,
        team_name: teamName,
        team_members: allTeamMembers,
        team_size: expectedSize
    };

    if (isSquad) {
        teamRegData.team_data = JSON.stringify(teamData);
    } else {
        teamRegData.team_data = JSON.stringify(teamData.playerData);
    }

    const { error: teamRegError } = await supabase
        .from('team_registrations')
        .insert([teamRegData]);

    if (teamRegError) {
        console.error('Team registration error:', teamRegError);
        return res.status(500).json({ error: 'Team registration failed: ' + teamRegError.message });
    }

    // Register all team members individually
    const registrations = allTeamMembers.map(function(memberId) {
        return {
            user_id: memberId,
            tournament_id: tournament.id,
            registration_type: registrationType,
            team_leader_id: userId
        };
    });

    const { error: memberRegError } = await supabase
        .from('tournament_registrations')
        .insert(registrations);

    if (memberRegError) {
        console.error('Member registration error:', memberRegError);
        return res.status(500).json({ error: 'Failed to register team members: ' + memberRegError.message });
    }

    // Update tournament participant count
    await supabase
        .from('tournaments')
        .update({ current_participants: tournament.current_participants + expectedSize })
        .eq('id', tournament.id);

    const message = tournament.entry_fee === 0
        ? 'Team "' + teamName + '" registered successfully for free tournament!'
        : 'Team "' + teamName + '" registered successfully for ₹' + totalEntryFee;

    res.json({
        success: true,
        message: message,
        tournament_type: tournament.entry_fee === 0 ? 'free' : 'paid',
        team_name: teamName,
        entry_fee: totalEntryFee
    });
}


// Initialize and start server
async function initializeServer() {
    try {
        // Test Supabase connection
        console.log('🔄 Testing Supabase connection...');
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact' })
            .limit(1);

        if (error) {
            throw new Error(`Supabase connection failed: ${error.message}`);
        }

        console.log('✅ Supabase connection established');

        // Check if admin user exists
        const { data: adminUser, error: adminError } = await supabase
            .from('users')
            .select('id')
            .eq('is_admin', true)
            .single();

        if (adminError && adminError.code === 'PGRST116') {
            // No admin user found, create one
            console.log('🔧 Creating admin user...');
            const hashedPassword = bcrypt.hashSync('admin123', 10);

            const { data: newAdmin, error: createError } = await supabase
                .from('users')
                .insert([{
                    username: 'admin',
                    email: 'admin@fantasy.com',
                    password: hashedPassword,
                    is_admin: true,
                    wallet_balance: 0,
                    winnings_balance: 0
                }])
                .select()
                .single();

            if (createError) {
                console.error("❌ Error creating admin:", createError);
            } else {
                console.log("✅ Admin user created successfully");
            }
        }

        app.listen(PORT, () => {
            console.log(`🚀 Fantasy Tournament Server running on http://localhost:${PORT}`);
            console.log('🗄️ Database: Supabase');
            console.log('👨‍💼 Admin credentials: username=admin, password=admin123');
            console.log('🔧 Change admin password after first login!');
        });

    } catch (error) {
        console.error('❌ Failed to initialize server:', error);
        process.exit(1);
    }
}

initializeServer();
