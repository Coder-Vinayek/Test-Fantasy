require('dotenv').config();
const { supabase } = require('./database/supabase');

async function quickTest() {
    console.log('🔄 Testing Supabase connection...');
    console.log('📍 URL:', process.env.SUPABASE_URL);
    console.log('🔑 Key exists:', !!process.env.SUPABASE_ANON_KEY);
    
    try {
        // Test 1: Basic connection
        console.log('\n📋 Test 1: Checking users table...');
        const { data, error } = await supabase
            .from('users')
            .select('*');
        
        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }
        
        console.log('✅ Success! Found', data.length, 'users');
        
        if (data.length > 0) {
            console.log('\n👨‍💼 Admin user details:');
            data.forEach(user => {
                console.log(`   - Username: ${user.username}`);
                console.log(`   - Email: ${user.email}`);
                console.log(`   - Is Admin: ${user.is_admin}`);
                console.log(`   - Wallet: $${user.wallet_balance}`);
            });
        }
        
        // Test 2: Check tournaments table
        console.log('\n🏆 Test 2: Checking tournaments table...');
        const { data: tournaments, error: tourError } = await supabase
            .from('tournaments')
            .select('count', { count: 'exact', head: true });
        
        if (tourError) {
            console.error('❌ Tournaments error:', tourError.message);
            return;
        }
        
        console.log('✅ Tournaments table accessible');
        
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('🚀 Supabase is working correctly!');
        console.log('📋 Next: Update your server.js to use Supabase');
        
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check your .env file exists');
        console.log('2. Verify Supabase credentials');
        console.log('3. Make sure you ran the database schema in Supabase');
    }
}

quickTest();