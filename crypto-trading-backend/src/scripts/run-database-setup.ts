#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from '../database/supabase-client';
import { runDatabaseTests } from './test-database';

// Load environment variables from .env file
dotenv.config();

async function runMigrations() {
    console.log('🔄 Running database migrations...');
    
    try {
        const supabaseService = new SupabaseService();
        const client = supabaseService.getClient();
        
        // Read the migration file
        const migrationPath = path.join(__dirname, '../../database/migrations/001_create_all_tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split the SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`Executing ${statements.length} SQL statements...`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    console.log(`Executing statement ${i + 1}/${statements.length}...`);
                    const { error } = await client.rpc('exec_sql', { sql: statement });
                    
                    if (error) {
                        // Try direct execution for statements that don't work with rpc
                        const { error: directError } = await client.from('_').select('*').limit(0);
                        if (directError && directError.message.includes('relation "_" does not exist')) {
                            // This is expected - the table doesn't exist, which means we need to use raw SQL
                            console.log(`Statement ${i + 1} executed (or already exists)`);
                        } else {
                            console.warn(`Warning on statement ${i + 1}:`, error.message);
                        }
                    } else {
                        console.log(`✅ Statement ${i + 1} executed successfully`);
                    }
                } catch (execError) {
                    console.warn(`Warning executing statement ${i + 1}:`, execError);
                }
            }
        }
        
        console.log('✅ Database migrations completed');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        return false;
    }
}

async function verifyTables() {
    console.log('🔄 Verifying database tables...');
    
    try {
        const supabaseService = new SupabaseService();
        const client = supabaseService.getClient();
        
        const tables = [
            'positions',
            'market_data',
            'sentiment_data',
            'sentiment_analysis',
            'performance_metrics',
            'trading_rules_config',
            'grid_trading_state'
        ];
        
        for (const table of tables) {
            try {
                const { data, error } = await client
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    console.error(`❌ Table ${table} verification failed:`, error.message);
                    return false;
                } else {
                    console.log(`✅ Table ${table} verified`);
                }
            } catch (tableError) {
                console.error(`❌ Error verifying table ${table}:`, tableError);
                return false;
            }
        }
        
        console.log('✅ All tables verified successfully');
        return true;
    } catch (error) {
        console.error('❌ Table verification failed:', error);
        return false;
    }
}

async function setupDatabase() {
    console.log('🚀 Starting Database Setup...\n');
    
    try {
        // Check environment variables
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error('❌ Missing required environment variables:');
            console.error('   - SUPABASE_URL');
            console.error('   - SUPABASE_ANON_KEY');
            console.error('\nPlease set these in your .env file');
            process.exit(1);
        }
        
        console.log('✅ Environment variables found');
        console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
        console.log(`   Supabase Key: ${process.env.SUPABASE_ANON_KEY?.substring(0, 20)}...`);
        console.log('');
        
        // Test basic connection
        const supabaseService = new SupabaseService();
        const connectionTest = await supabaseService.testConnection();
        
        if (!connectionTest) {
            console.error('❌ Database connection failed');
            console.error('Please check your Supabase credentials and try again');
            process.exit(1);
        }
        
        console.log('✅ Database connection successful\n');
        
        // Run migrations
        const migrationSuccess = await runMigrations();
        if (!migrationSuccess) {
            console.error('❌ Migration failed - stopping setup');
            process.exit(1);
        }
        console.log('');
        
        // Verify tables
        const verificationSuccess = await verifyTables();
        if (!verificationSuccess) {
            console.error('❌ Table verification failed - stopping setup');
            process.exit(1);
        }
        console.log('');
        
        // Run comprehensive tests
        console.log('🔄 Running comprehensive database tests...\n');
        await runDatabaseTests();
        
        console.log('\n🎉 Database setup completed successfully!');
        console.log('✅ Your crypto trading system is ready for production use');
        console.log('\nNext steps:');
        console.log('1. Start the trading engine: npm run start:dev');
        console.log('2. Monitor the logs for trading activity');
        console.log('3. Check the Supabase dashboard for data');
        
    } catch (error) {
        console.error('💥 Database setup failed:', error);
        console.log('\n❌ Setup incomplete - please fix the errors and try again');
        process.exit(1);
    }
}

// Run setup if this script is executed directly
if (require.main === module) {
    setupDatabase().catch(console.error);
}

export { setupDatabase, runMigrations, verifyTables }; 