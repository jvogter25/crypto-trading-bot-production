import * as fs from 'fs';
import * as path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

interface GoogleSheetsSetupConfig {
  serviceAccountEmail: string;
  privateKey: string;
  spreadsheetId?: string;
  createNewSpreadsheet?: boolean;
  spreadsheetTitle?: string;
}

class GoogleSheetsSetup {
  private config: GoogleSheetsSetupConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): GoogleSheetsSetupConfig {
    console.log('📊 Loading Google Sheets configuration...');

    // Check for environment variables
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!serviceAccountEmail || !privateKey) {
      console.log('\n⚠️  Google Sheets credentials not found in environment variables');
      console.log('📋 Please set up the following environment variables:');
      console.log('   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com');
      console.log('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
      console.log('   GOOGLE_SPREADSHEET_ID=your-spreadsheet-id (optional - will create new if not provided)');
      console.log('\n📖 Setup Instructions:');
      this.printSetupInstructions();
      
      throw new Error('Google Sheets credentials not configured');
    }

    return {
      serviceAccountEmail,
      privateKey,
      spreadsheetId,
      createNewSpreadsheet: !spreadsheetId,
      spreadsheetTitle: 'Crypto Trading Bot - Audit Trail'
    };
  }

  private printSetupInstructions(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📖 GOOGLE SHEETS API SETUP INSTRUCTIONS');
    console.log('='.repeat(80));
    
    console.log('\n1️⃣  CREATE GOOGLE CLOUD PROJECT:');
    console.log('   • Go to https://console.cloud.google.com/');
    console.log('   • Create a new project or select existing one');
    console.log('   • Note your project ID');

    console.log('\n2️⃣  ENABLE GOOGLE SHEETS API:');
    console.log('   • Go to APIs & Services > Library');
    console.log('   • Search for "Google Sheets API"');
    console.log('   • Click "Enable"');

    console.log('\n3️⃣  CREATE SERVICE ACCOUNT:');
    console.log('   • Go to APIs & Services > Credentials');
    console.log('   • Click "Create Credentials" > "Service Account"');
    console.log('   • Name: "crypto-bot-sheets-logger"');
    console.log('   • Role: "Editor" (for creating/editing sheets)');

    console.log('\n4️⃣  GENERATE SERVICE ACCOUNT KEY:');
    console.log('   • Click on your service account');
    console.log('   • Go to "Keys" tab');
    console.log('   • Click "Add Key" > "Create New Key"');
    console.log('   • Choose "JSON" format');
    console.log('   • Download the JSON file');

    console.log('\n5️⃣  EXTRACT CREDENTIALS FROM JSON:');
    console.log('   • Open the downloaded JSON file');
    console.log('   • Copy "client_email" value to GOOGLE_SERVICE_ACCOUNT_EMAIL');
    console.log('   • Copy "private_key" value to GOOGLE_PRIVATE_KEY');
    console.log('   • Make sure to keep the \\n characters in the private key');

    console.log('\n6️⃣  CREATE OR USE EXISTING SPREADSHEET:');
    console.log('   • Option A: Let the bot create a new spreadsheet automatically');
    console.log('   • Option B: Create manually and share with service account email');
    console.log('   • If using existing, set GOOGLE_SPREADSHEET_ID environment variable');

    console.log('\n7️⃣  SET ENVIRONMENT VARIABLES:');
    console.log('   • Add to your .env file or export in terminal:');
    console.log('   export GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"');
    console.log('   export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log('   export GOOGLE_SPREADSHEET_ID="your-spreadsheet-id" # Optional');

    console.log('\n8️⃣  TEST CONNECTION:');
    console.log('   • Run: npm run sheets:setup');
    console.log('   • This will validate your credentials and create worksheets');

    console.log('\n' + '='.repeat(80));
  }

  async validateCredentials(): Promise<boolean> {
    console.log('🔐 Validating Google Sheets credentials...');

    try {
      const serviceAccountAuth = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      // Test authentication
      await serviceAccountAuth.authorize();
      console.log('✅ Google Sheets credentials validated successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Credential validation failed:', error.message);
      
      if (error.message.includes('invalid_grant')) {
        console.log('\n💡 Common fixes for invalid_grant error:');
        console.log('   • Check that private key is properly formatted with \\n characters');
        console.log('   • Ensure service account email is correct');
        console.log('   • Verify that the service account key is not expired');
      }
      
      return false;
    }
  }

  async createOrConnectSpreadsheet(): Promise<string> {
    console.log('📊 Setting up Google Spreadsheet...');

    try {
      const serviceAccountAuth = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      let doc: GoogleSpreadsheet;

      if (this.config.spreadsheetId) {
        // Connect to existing spreadsheet
        console.log(`🔗 Connecting to existing spreadsheet: ${this.config.spreadsheetId}`);
        doc = new GoogleSpreadsheet(this.config.spreadsheetId, serviceAccountAuth);
        await doc.loadInfo();
        console.log(`✅ Connected to spreadsheet: "${doc.title}"`);
      } else {
        // Create new spreadsheet
        console.log('📝 Creating new spreadsheet...');
        doc = await GoogleSpreadsheet.createNewSpreadsheetDocument(serviceAccountAuth, {
          title: this.config.spreadsheetTitle!
        });
        console.log(`✅ Created new spreadsheet: "${doc.title}"`);
        console.log(`📋 Spreadsheet ID: ${doc.spreadsheetId}`);
        console.log(`🔗 Spreadsheet URL: https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`);
        
        // Update environment variable suggestion
        console.log('\n💡 Add this to your .env file:');
        console.log(`GOOGLE_SPREADSHEET_ID="${doc.spreadsheetId}"`);
      }

      return doc.spreadsheetId;

    } catch (error: any) {
      console.error('❌ Failed to create/connect spreadsheet:', error.message);
      throw error;
    }
  }

  async setupWorksheets(spreadsheetId: string): Promise<void> {
    console.log('📋 Setting up audit trail worksheets...');

    try {
      const serviceAccountAuth = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();

      const requiredSheets = [
        {
          title: 'Trades',
          headers: [
            'Timestamp', 'Trade_ID', 'Asset', 'Action', 'Quantity', 'Price', 'Total_Value',
            'Fees', 'Profit_Loss', 'Strategy', 'Market_Condition', 'Reasoning',
            'Portfolio_Value', 'Cash_Reserves', 'Risk_Level', 'RSI', 'MACD',
            'Bollinger_Position', 'Volatility', 'Execution_Latency', 'Order_ID', 'Exchange_Order_ID'
          ]
        },
        {
          title: 'Performance',
          headers: [
            'Timestamp', 'Total_Portfolio_Value', 'Total_Profit_Loss', 'Daily_Return',
            'Weekly_Return', 'Monthly_Return', 'Sharpe_Ratio', 'Max_Drawdown',
            'Win_Rate', 'Total_Trades', 'Successful_Trades', 'Average_Trade_Size',
            'Largest_Win', 'Largest_Loss', 'Current_Positions', 'Cash_Percentage', 'Risk_Score'
          ]
        },
        {
          title: 'Decisions',
          headers: [
            'Timestamp', 'Decision_Type', 'Asset', 'Decision', 'Reasoning', 'Confidence',
            'Market_Price', 'Market_Volume', 'Market_Volatility', 'Market_Sentiment',
            'Portfolio_Exposure', 'Asset_Exposure', 'Correlation_Risk', 'Liquidity_Risk',
            'Outcome', 'Executed'
          ]
        },
        {
          title: 'System_Events',
          headers: [
            'Timestamp', 'Event_Type', 'Component', 'Message', 'Severity',
            'Details', 'Resolved', 'Resolution_Time'
          ]
        },
        {
          title: 'Daily_Summary',
          headers: [
            'Date', 'Starting_Value', 'Ending_Value', 'Daily_Return', 'Total_Trades',
            'Winning_Trades', 'Losing_Trades', 'Win_Rate', 'Largest_Win', 'Largest_Loss',
            'Total_Fees', 'Net_Profit_Loss', 'Risk_Score', 'Max_Drawdown', 'Volatility'
          ]
        },
        {
          title: 'Monthly_Summary',
          headers: [
            'Month', 'Starting_Value', 'Ending_Value', 'Monthly_Return', 'Total_Trades',
            'Win_Rate', 'Sharpe_Ratio', 'Max_Drawdown', 'Total_Fees', 'Net_Profit_Loss',
            'Best_Day', 'Worst_Day', 'Average_Daily_Return', 'Volatility', 'Risk_Score'
          ]
        }
      ];

      for (const sheetConfig of requiredSheets) {
        let sheet = doc.sheetsByTitle[sheetConfig.title];
        
        if (!sheet) {
          console.log(`📄 Creating worksheet: ${sheetConfig.title}`);
          sheet = await doc.addSheet({ 
            title: sheetConfig.title,
            headerValues: sheetConfig.headers
          });
        } else {
          console.log(`📄 Worksheet exists: ${sheetConfig.title}`);
          // Update headers if needed
          await sheet.setHeaderRow(sheetConfig.headers);
        }

        // Format the header row
        await sheet.loadCells('A1:Z1');
        for (let i = 0; i < sheetConfig.headers.length; i++) {
          const cell = sheet.getCell(0, i);
          cell.textFormat = { bold: true };
          cell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
        }
        await sheet.saveUpdatedCells();
      }

      // Remove default "Sheet1" if it exists and is empty
      const defaultSheet = doc.sheetsByTitle['Sheet1'];
      if (defaultSheet && defaultSheet.rowCount <= 1) {
        console.log('🗑️  Removing default Sheet1');
        await defaultSheet.delete();
      }

      console.log('✅ All audit trail worksheets set up successfully');

    } catch (error: any) {
      console.error('❌ Failed to setup worksheets:', error.message);
      throw error;
    }
  }

  async testLogging(spreadsheetId: string): Promise<void> {
    console.log('🧪 Testing logging functionality...');

    try {
      const serviceAccountAuth = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
      await doc.loadInfo();

      // Test logging to Trades sheet
      const tradesSheet = doc.sheetsByTitle['Trades'];
      if (tradesSheet) {
        const testRow = [
          new Date().toISOString(),
          'TEST_TRADE_001',
          'BTC',
          'BUY',
          0.1,
          45000,
          4500,
          4.5,
          0,
          'SETUP_TEST',
          'TEST_CONDITION',
          'Testing Google Sheets integration setup',
          50000,
          20000,
          0.3,
          65,
          0.5,
          'MIDDLE',
          0.15,
          150,
          'TEST_ORDER',
          'TEST_EXCHANGE_ORDER'
        ];

        await tradesSheet.addRow(testRow);
        console.log('✅ Test trade logged successfully');
      }

      // Test logging to System_Events sheet
      const eventsSheet = doc.sheetsByTitle['System_Events'];
      if (eventsSheet) {
        const testEvent = [
          new Date().toISOString(),
          'STARTUP',
          'SETUP_SYSTEM',
          'Google Sheets integration setup completed successfully',
          'INFO',
          JSON.stringify({ setupVersion: '1.0', testMode: true }),
          true,
          new Date().toISOString()
        ];

        await eventsSheet.addRow(testEvent);
        console.log('✅ Test system event logged successfully');
      }

      console.log('✅ Logging functionality test completed');

    } catch (error: any) {
      console.error('❌ Logging test failed:', error.message);
      throw error;
    }
  }

  async generateEnvTemplate(): Promise<void> {
    const envTemplate = `# Google Sheets API Configuration for Crypto Trading Bot
# Generated on ${new Date().toISOString()}

# Google Service Account Credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n"

# Google Spreadsheet Configuration
GOOGLE_SPREADSHEET_ID="your-spreadsheet-id-here"

# Optional: Logging Configuration
GOOGLE_SHEETS_BATCH_SIZE=50
GOOGLE_SHEETS_BATCH_INTERVAL=30000
GOOGLE_SHEETS_RETRY_ATTEMPTS=3
GOOGLE_SHEETS_RETRY_DELAY=5000

# Other required environment variables for the trading bot
DATABASE_URL="postgresql://username:password@localhost:5432/crypto_trading"
KRAKEN_API_KEY="your-kraken-api-key"
KRAKEN_API_SECRET="your-kraken-api-secret"
`;

    const envPath = path.join(process.cwd(), '.env.google-sheets-template');
    fs.writeFileSync(envPath, envTemplate);
    
    console.log(`📝 Environment template created: ${envPath}`);
    console.log('💡 Copy this template to .env and fill in your actual credentials');
  }

  async runSetup(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 GOOGLE SHEETS INTEGRATION SETUP');
    console.log('='.repeat(80));
    console.log('📊 Setting up external logging system for comprehensive audit trail');
    console.log('💼 This system is essential for tax reporting and performance analysis\n');

    try {
      // Step 1: Validate credentials
      const credentialsValid = await this.validateCredentials();
      if (!credentialsValid) {
        throw new Error('Invalid credentials - setup cannot continue');
      }

      // Step 2: Create or connect to spreadsheet
      const spreadsheetId = await this.createOrConnectSpreadsheet();

      // Step 3: Setup worksheets
      await this.setupWorksheets(spreadsheetId);

      // Step 4: Test logging
      await this.testLogging(spreadsheetId);

      // Step 5: Generate environment template
      await this.generateEnvTemplate();

      console.log('\n' + '='.repeat(80));
      console.log('🎉 GOOGLE SHEETS SETUP COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(80));
      console.log('✅ Credentials validated');
      console.log('✅ Spreadsheet configured');
      console.log('✅ Audit trail worksheets created');
      console.log('✅ Logging functionality tested');
      console.log('✅ Environment template generated');

      console.log('\n📋 NEXT STEPS:');
      console.log('1. Your Google Sheets audit trail is ready for use');
      console.log('2. Run "npm run sheets:demo" to see the logging system in action');
      console.log('3. Run "npm run test:sheets-integration" to validate all functionality');
      console.log('4. Start your trading bot with audit logging enabled');

      console.log('\n🔗 SPREADSHEET ACCESS:');
      console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
      console.log(`   ID: ${spreadsheetId}`);

      console.log('\n💼 TAX COMPLIANCE:');
      console.log('✅ Complete trade history logging');
      console.log('✅ Profit/loss tracking with cost basis');
      console.log('✅ Holding period calculations');
      console.log('✅ Strategy attribution for each trade');
      console.log('✅ Real-time performance metrics');

      console.log('\n🛡️  AUDIT TRAIL FEATURES:');
      console.log('✅ Every trade logged with complete details');
      console.log('✅ Decision reasoning documented');
      console.log('✅ Risk management events tracked');
      console.log('✅ System events and errors logged');
      console.log('✅ Performance metrics continuously updated');

      console.log('='.repeat(80));

    } catch (error: any) {
      console.error('\n❌ Setup failed:', error.message);
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Verify your Google Cloud project has Sheets API enabled');
      console.log('2. Check that service account has proper permissions');
      console.log('3. Ensure private key is properly formatted with \\n characters');
      console.log('4. Confirm service account email is correct');
      console.log('\n📖 For detailed setup instructions, run this script again');
      throw error;
    }
  }
}

// Main setup execution
async function runGoogleSheetsSetup(): Promise<void> {
  const setup = new GoogleSheetsSetup();
  
  try {
    await setup.runSetup();
  } catch (error: any) {
    console.error('🚨 Google Sheets setup failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other modules
export { GoogleSheetsSetup, runGoogleSheetsSetup };

// Run setup if this file is executed directly
if (require.main === module) {
  runGoogleSheetsSetup().catch(console.error);
} 