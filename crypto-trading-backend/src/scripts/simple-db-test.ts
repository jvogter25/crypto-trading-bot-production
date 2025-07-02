import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

async function testConnection() {
    console.log('🔄 Testing Supabase connection...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
        return false;
    }
    
    console.log(`Connecting to: ${supabaseUrl}`);
    console.log(`Using key: ${supabaseKey.substring(0, 20)}...`);
    
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test basic connection by trying to select from a system table
        const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .limit(1);
        
        if (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
        
        console.log('✅ Supabase connection successful!');
        console.log('Database is accessible and ready for operations');
        return true;
        
    } catch (error) {
        console.error('❌ Connection error:', error);
        return false;
    }
}

// Run test if executed directly
if (require.main === module) {
    testConnection()
        .then(success => {
            if (success) {
                console.log('\n🎉 Database connection test passed!');
                console.log('You can now run the full database setup with: npm run db:setup');
            } else {
                console.log('\n💥 Database connection test failed!');
                console.log('Please check your Supabase credentials and try again.');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Test failed with error:', error);
            process.exit(1);
        });
}

export { testConnection }; 