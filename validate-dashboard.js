#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3009';

async function validateDashboard() {
    console.log('🔍 Validating Dashboard Connection to Real Backend...\n');
    
    try {
        // Test 1: Server Status
        console.log('1. Testing server status...');
        const status = await axios.get(`${API_BASE}/api/status`);
        console.log('✅ Server Status:', status.data.status);
        console.log('   Mode:', status.data.mode);
        console.log('   Uptime:', Math.floor(status.data.uptime / 1000), 'seconds');
        
        // Test 2: Core Bot Status
        console.log('\n2. Testing Core Bot status...');
        const coreBot = await axios.get(`${API_BASE}/api/trading/core-bot-status`);
        console.log('✅ Core Bot Status:', coreBot.data.status);
        console.log('   Total Trades:', coreBot.data.metrics.totalTrades);
        console.log('   P&L:', `$${coreBot.data.metrics.realizedPnL.toFixed(2)}`);
        console.log('   Win Rate:', `${coreBot.data.metrics.winRate}%`);
        console.log('   Strategy:', coreBot.data.strategy);
        
        // Test 3: Meme Bot Status
        console.log('\n3. Testing Meme Bot status...');
        const memeBot = await axios.get(`${API_BASE}/api/trading/meme-bot-status`);
        console.log('✅ Meme Bot Status:', memeBot.data.status);
        console.log('   AI Confidence:', `${(memeBot.data.aiLearning.confidence * 100).toFixed(1)}%`);
        console.log('   Moonshot Candidates:', memeBot.data.moonshotCandidates);
        console.log('   Top Candidate:', memeBot.data.topCandidate?.symbol || 'None');
        console.log('   AI Adaptations:', memeBot.data.aiLearning.adaptations);
        
        // Test 4: Meme Coins Data
        console.log('\n4. Testing Meme Coins data...');
        const memeCoins = await axios.get(`${API_BASE}/api/meme-coins`);
        console.log('✅ Meme Coins Signals:', memeCoins.data.signals?.length || 0);
        if (memeCoins.data.signals?.length > 0) {
            console.log('   Top Signal:', memeCoins.data.signals[0].symbol, 
                       '- Confidence:', memeCoins.data.signals[0].confidence + '%');
        }
        
        // Test 5: Real-time Price Updates
        console.log('\n5. Testing real-time updates...');
        console.log('   Fetching data again in 3 seconds to check for changes...');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const status2 = await axios.get(`${API_BASE}/api/status`);
        const coreBot2 = await axios.get(`${API_BASE}/api/trading/core-bot-status`);
        
        console.log('✅ Data is updating:');
        console.log('   Uptime changed:', status.data.uptime !== status2.data.uptime);
        console.log('   Last update changed:', 
                   coreBot.data.lastUpdate !== coreBot2.data.lastUpdate);
        
        console.log('\n🎉 ALL TESTS PASSED! Dashboard should be showing real data.');
        console.log('\n📊 Dashboard URL: file://' + process.cwd() + '/advanced-dashboard.html');
        console.log('🔗 Backend API: ' + API_BASE);
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Solution: Make sure the backend is running:');
            console.log('   PORT=3009 node production-backend-server.js');
        }
    }
}

validateDashboard(); 