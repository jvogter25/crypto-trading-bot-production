import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// =====================================================
// HEALTH CHECK CONTROLLER
// =====================================================
// Comprehensive health monitoring for the trading bot backend
// Provides detailed status information for Docker health checks

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    exchanges: ServiceHealth;
    trading: ServiceHealth;
    monitoring: ServiceHealth;
  };
  system: {
    memory: MemoryInfo;
    cpu: number;
    disk: DiskInfo;
  };
  trading: {
    liveTradingEnabled: boolean;
    emergencyStopActive: boolean;
    activePositions: number;
    dailyPnL: number;
    safetyScore: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  details?: any;
  error?: string;
}

interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
}

interface DiskInfo {
  used: number;
  total: number;
  percentage: number;
}

@Controller('health')
export class HealthController {
  private startTime: Date = new Date();

  constructor(
    // Inject your database repository here if needed
    // @InjectRepository(SomeEntity) private repository: Repository<SomeEntity>,
  ) {}

  // =====================================================
  // BASIC HEALTH CHECK
  // =====================================================
  @Get()
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }

  // =====================================================
  // DETAILED HEALTH CHECK
  // =====================================================
  @Get('detailed')
  async getDetailedHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Check all services
      const [
        databaseHealth,
        redisHealth,
        exchangesHealth,
        tradingHealth,
        monitoringHealth
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkExchanges(),
        this.checkTradingServices(),
        this.checkMonitoring()
      ]);

      // Get system information
      const systemInfo = this.getSystemInfo();
      const tradingInfo = await this.getTradingInfo();

      // Determine overall status
      const services = {
        database: this.getServiceResult(databaseHealth),
        redis: this.getServiceResult(redisHealth),
        exchanges: this.getServiceResult(exchangesHealth),
        trading: this.getServiceResult(tradingHealth),
        monitoring: this.getServiceResult(monitoringHealth)
      };

      const overallStatus = this.determineOverallStatus(services);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services,
        system: systemInfo,
        trading: tradingInfo
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Health check failed' },
          redis: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Health check failed' },
          exchanges: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Health check failed' },
          trading: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Health check failed' },
          monitoring: { status: 'unhealthy', lastCheck: new Date().toISOString(), error: 'Health check failed' }
        },
        system: this.getSystemInfo(),
        trading: {
          liveTradingEnabled: false,
          emergencyStopActive: true,
          activePositions: 0,
          dailyPnL: 0,
          safetyScore: 0
        }
      };
    }
  }

  // =====================================================
  // READINESS CHECK
  // =====================================================
  @Get('ready')
  async getReadiness(): Promise<{ ready: boolean; timestamp: string; details?: any }> {
    try {
      // Check critical services required for operation
      const criticalChecks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkExchanges()
      ]);

      const allCriticalHealthy = criticalChecks.every(
        result => result.status === 'fulfilled' && result.value.status === 'healthy'
      );

      return {
        ready: allCriticalHealthy,
        timestamp: new Date().toISOString(),
        details: allCriticalHealthy ? undefined : 'Critical services not ready'
      };

    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        details: `Readiness check failed: ${error.message}`
      };
    }
  }

  // =====================================================
  // LIVENESS CHECK
  // =====================================================
  @Get('live')
  async getLiveness(): Promise<{ alive: boolean; timestamp: string }> {
    // Simple liveness check - if we can respond, we're alive
    return {
      alive: true,
      timestamp: new Date().toISOString()
    };
  }

  // =====================================================
  // TRADING STATUS CHECK
  // =====================================================
  @Get('trading')
  async getTradingStatus(): Promise<any> {
    try {
      const tradingInfo = await this.getTradingInfo();
      const exchangesHealth = await this.checkExchanges();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        trading: tradingInfo,
        exchanges: exchangesHealth,
        riskManagement: {
          emergencyStopEnabled: process.env.EMERGENCY_STOP_ENABLED === 'true',
          maxAllocation: parseFloat(process.env.MAX_ALLOCATION || '20.00'),
          liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true'
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // =====================================================
  // SERVICE HEALTH CHECKS
  // =====================================================

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Implement actual database health check
      // Example: await this.repository.query('SELECT 1');
      
      // For now, simulate a database check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          connectionPool: 'active',
          queries: 'responsive'
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Implement actual Redis health check
      // Example: await this.redisService.ping();
      
      // For now, simulate a Redis check
      await new Promise(resolve => setTimeout(resolve, 5));
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          connection: 'active',
          memory: 'optimal'
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkExchanges(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check exchange connectivity
      const exchanges = ['binanceUS', 'coinbaseAdvanced'];
      const exchangeResults = await Promise.allSettled(
        exchanges.map(exchange => this.checkSingleExchange(exchange))
      );

      const healthyExchanges = exchangeResults.filter(
        result => result.status === 'fulfilled' && result.value
      ).length;

      const status = healthyExchanges > 0 ? 'healthy' : 'unhealthy';

      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          healthyExchanges: `${healthyExchanges}/${exchanges.length}`,
          exchanges: exchanges.reduce((acc, exchange, index) => {
            acc[exchange] = exchangeResults[index].status === 'fulfilled' ? 'healthy' : 'unhealthy';
            return acc;
          }, {})
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkSingleExchange(exchange: string): Promise<boolean> {
    try {
      // Implement actual exchange connectivity check
      // Example: await this.exchangeService.checkConnectivity(exchange);
      
      // For now, simulate exchange check
      await new Promise(resolve => setTimeout(resolve, 20));
      return Math.random() > 0.1; // 90% success rate simulation

    } catch (error) {
      return false;
    }
  }

  private async checkTradingServices(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check trading engine status
      const tradingEngineHealthy = await this.checkTradingEngine();
      const riskManagementHealthy = await this.checkRiskManagement();
      const signalGeneratorHealthy = await this.checkSignalGenerator();

      const allHealthy = tradingEngineHealthy && riskManagementHealthy && signalGeneratorHealthy;

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          tradingEngine: tradingEngineHealthy ? 'healthy' : 'unhealthy',
          riskManagement: riskManagementHealthy ? 'healthy' : 'unhealthy',
          signalGenerator: signalGeneratorHealthy ? 'healthy' : 'unhealthy'
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkMonitoring(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check monitoring services
      const loggingHealthy = await this.checkLogging();
      const alertingHealthy = await this.checkAlerting();

      return {
        status: loggingHealthy && alertingHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          logging: loggingHealthy ? 'healthy' : 'unhealthy',
          alerting: alertingHealthy ? 'healthy' : 'unhealthy'
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // =====================================================
  // INDIVIDUAL SERVICE CHECKS
  // =====================================================

  private async checkTradingEngine(): Promise<boolean> {
    try {
      // Implement actual trading engine health check
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRiskManagement(): Promise<boolean> {
    try {
      // Check if emergency stop is working
      const emergencyStopEnabled = process.env.EMERGENCY_STOP_ENABLED === 'true';
      return emergencyStopEnabled;
    } catch (error) {
      return false;
    }
  }

  private async checkSignalGenerator(): Promise<boolean> {
    try {
      // Implement signal generator health check
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkLogging(): Promise<boolean> {
    try {
      // Check if logging services are working
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkAlerting(): Promise<boolean> {
    try {
      // Check if alerting services are working
      const slackEnabled = !!process.env.SLACK_WEBHOOK_URL;
      return slackEnabled;
    } catch (error) {
      return false;
    }
  }

  // =====================================================
  // SYSTEM INFORMATION
  // =====================================================

  private getSystemInfo(): { memory: MemoryInfo; cpu: number; disk: DiskInfo } {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      },
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      disk: {
        used: 0, // Would need additional library to get disk usage
        total: 0,
        percentage: 0
      }
    };
  }

  private async getTradingInfo(): Promise<any> {
    try {
      // Get trading information from your trading services
      return {
        liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
        emergencyStopActive: false, // Get from actual trading engine
        activePositions: 0, // Get from actual trading engine
        dailyPnL: 0, // Get from actual trading engine
        safetyScore: 100 // Get from actual risk management
      };
    } catch (error) {
      return {
        liveTradingEnabled: false,
        emergencyStopActive: true,
        activePositions: 0,
        dailyPnL: 0,
        safetyScore: 0
      };
    }
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  private getServiceResult(settledResult: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: settledResult.reason?.message || 'Unknown error'
      };
    }
  }

  private determineOverallStatus(services: Record<string, ServiceHealth>): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(services).map(service => service.status);
    
    if (statuses.every(status => status === 'healthy')) {
      return 'healthy';
    } else if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }
} 