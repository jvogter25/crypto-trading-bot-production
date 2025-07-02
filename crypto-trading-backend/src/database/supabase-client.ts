import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseService {
    private supabase: SupabaseClient;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL and key must be provided in environment variables');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    getClient(): SupabaseClient {
        return this.supabase;
    }

    async testConnection(): Promise<boolean> {
        try {
            const { data, error } = await this.supabase
                .from('positions')
                .select('count')
                .limit(1);

            if (error) {
                console.error('Supabase connection test failed:', error);
                return false;
            }

            console.log('Supabase connection test successful');
            return true;
        } catch (error) {
            console.error('Supabase connection test error:', error);
            return false;
        }
    }

    // Position management
    async createPosition(position: {
        trading_pair: string;
        entry_price: number;
        current_price: number;
        size: number;
        side: string;
        status: string;
        entry_time: Date;
        strategy_type: string;
        grid_level?: number;
        stop_loss?: number;
        take_profit?: number;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('positions')
                .insert([position])
                .select()
                .single();

            if (error) {
                console.error('Error creating position:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to create position:', error);
            throw error;
        }
    }

    async updatePosition(id: string, updates: {
        current_price?: number;
        status?: string;
        exit_time?: Date;
        realized_pnl?: number;
        unrealized_pnl?: number;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('positions')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating position:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to update position:', error);
            throw error;
        }
    }

    async getActivePositions(tradingPair?: string) {
        try {
            let query = this.supabase
                .from('positions')
                .select('*')
                .eq('status', 'OPEN');

            if (tradingPair) {
                query = query.eq('trading_pair', tradingPair);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching active positions:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Failed to get active positions:', error);
            throw error;
        }
    }

    // Grid trading state management
    async createGridState(gridState: {
        trading_pair: string;
        current_price: number;
        grid_upper_bound: number;
        grid_lower_bound: number;
        grid_spacing: number;
        total_grid_levels: number;
        active_buy_orders: number;
        active_sell_orders: number;
        total_invested: number;
        current_profit: number;
        last_rebalance_time?: Date;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('grid_trading_state')
                .insert([gridState])
                .select()
                .single();

            if (error) {
                console.error('Error creating grid state:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to create grid state:', error);
            throw error;
        }
    }

    async updateGridState(tradingPair: string, updates: {
        current_price?: number;
        grid_upper_bound?: number;
        grid_lower_bound?: number;
        grid_spacing?: number;
        active_buy_orders?: number;
        active_sell_orders?: number;
        total_invested?: number;
        current_profit?: number;
        last_rebalance_time?: Date;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('grid_trading_state')
                .update(updates)
                .eq('trading_pair', tradingPair)
                .select()
                .single();

            if (error) {
                console.error('Error updating grid state:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to update grid state:', error);
            throw error;
        }
    }

    async getGridState(tradingPair: string) {
        try {
            const { data, error } = await this.supabase
                .from('grid_trading_state')
                .select('*')
                .eq('trading_pair', tradingPair)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error fetching grid state:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to get grid state:', error);
            throw error;
        }
    }

    // Performance metrics
    async recordPerformanceMetrics(metrics: {
        trading_pair: string;
        timestamp: Date;
        total_trades: number;
        winning_trades: number;
        losing_trades: number;
        win_rate: number;
        average_profit: number;
        average_loss: number;
        profit_factor: number;
        max_drawdown: number;
        sharpe_ratio?: number;
        sortino_ratio?: number;
        total_pnl: number;
        strategy_type: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('performance_metrics')
                .insert([metrics])
                .select()
                .single();

            if (error) {
                console.error('Error recording performance metrics:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to record performance metrics:', error);
            throw error;
        }
    }

    // Trading rules configuration
    async getTradingRulesConfig(tradingPair: string, strategyType: string, marketCondition: string) {
        try {
            const { data, error } = await this.supabase
                .from('trading_rules_config')
                .select('*')
                .eq('trading_pair', tradingPair)
                .eq('strategy_type', strategyType)
                .eq('market_condition', marketCondition)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching trading rules config:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to get trading rules config:', error);
            throw error;
        }
    }

    async createTradingRulesConfig(config: {
        trading_pair: string;
        strategy_type: string;
        market_condition: string;
        max_position_size: number;
        profit_threshold: number;
        stop_loss_threshold: number;
        reinvestment_percentage: number;
        grid_levels?: number;
        grid_spacing?: number;
        sentiment_threshold?: number;
        technical_confirmation_required: boolean;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('trading_rules_config')
                .insert([config])
                .select()
                .single();

            if (error) {
                console.error('Error creating trading rules config:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to create trading rules config:', error);
            throw error;
        }
    }

    // Market data storage
    async storeMarketData(marketData: {
        trading_pair: string;
        timestamp: Date;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        vwap?: number;
        rsi_14?: number;
        macd?: number;
        macd_signal?: number;
        macd_histogram?: number;
        bollinger_upper?: number;
        bollinger_middle?: number;
        bollinger_lower?: number;
        atr_14?: number;
    }) {
        try {
            const { data, error } = await this.supabase
                .from('market_data')
                .insert([marketData])
                .select()
                .single();

            if (error) {
                console.error('Error storing market data:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to store market data:', error);
            throw error;
        }
    }

    async getLatestMarketData(tradingPair: string, limit: number = 100) {
        try {
            const { data, error } = await this.supabase
                .from('market_data')
                .select('*')
                .eq('trading_pair', tradingPair)
                .order('timestamp', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching market data:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Failed to get market data:', error);
            throw error;
        }
    }
} 