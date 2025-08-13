// Wallet Maintenance Mode System

const fs = require('fs');
const path = require('path');

class WalletMaintenanceManager {
    constructor() {
        this.configFile = path.join(__dirname, 'wallet-maintenance-config.json');
        this.initializeConfig();
    }

    // Initialize config file if it doesn't exist
    initializeConfig() {
        try {
            if (!fs.existsSync(this.configFile)) {
                const defaultConfig = {
                    maintenance_mode: false,
                    maintenance_message: "Wallet services are temporarily unavailable for maintenance. Please try again later.",
                    deposit_disabled: false,
                    withdrawal_disabled: false,
                    last_updated: new Date().toISOString(),
                    updated_by: "system"
                };
                
                fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
                console.log('✅ Wallet maintenance config initialized');
            }
        } catch (error) {
            console.error('❌ Failed to initialize wallet maintenance config:', error);
        }
    }

    // Get current maintenance status
    getMaintenanceStatus() {
        try {
            if (fs.existsSync(this.configFile)) {
                const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                return config;
            }
            return { maintenance_mode: false };
        } catch (error) {
            console.error('❌ Failed to read maintenance config:', error);
            return { maintenance_mode: false };
        }
    }

    // Check if wallet operations are allowed
    isWalletOperationAllowed(operation) {
        const config = this.getMaintenanceStatus();
        
        if (config.maintenance_mode) {
            return {
                allowed: false,
                message: config.maintenance_message || "Wallet services are temporarily unavailable."
            };
        }

        if (operation === 'deposit' && config.deposit_disabled) {
            return {
                allowed: false,
                message: config.deposit_message || "Deposit services are temporarily disabled."
            };
        }

        if (operation === 'withdrawal' && config.withdrawal_disabled) {
            return {
                allowed: false,
                message: config.withdrawal_message || "Withdrawal services are temporarily disabled."
            };
        }

        return { allowed: true };
    }

    // Enable maintenance mode
    enableMaintenanceMode(message, adminId) {
        try {
            const config = this.getMaintenanceStatus();
            config.maintenance_mode = true;
            config.maintenance_message = message || "Wallet services are temporarily unavailable for maintenance. Please try again later.";
            config.last_updated = new Date().toISOString();
            config.updated_by = adminId || "admin";

            fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
            console.log('🔧 Wallet maintenance mode ENABLED');
            return true;
        } catch (error) {
            console.error('❌ Failed to enable maintenance mode:', error);
            return false;
        }
    }

    // Disable maintenance mode
    disableMaintenanceMode(adminId) {
        try {
            const config = this.getMaintenanceStatus();
            config.maintenance_mode = false;
            config.deposit_disabled = false;
            config.withdrawal_disabled = false;
            config.last_updated = new Date().toISOString();
            config.updated_by = adminId || "admin";

            fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
            console.log('✅ Wallet maintenance mode DISABLED');
            return true;
        } catch (error) {
            console.error('❌ Failed to disable maintenance mode:', error);
            return false;
        }
    }

    // Toggle specific operations
    toggleOperation(operation, disabled, message, adminId) {
        try {
            const config = this.getMaintenanceStatus();
            
            if (operation === 'deposit') {
                config.deposit_disabled = disabled;
                if (message) config.deposit_message = message;
            } else if (operation === 'withdrawal') {
                config.withdrawal_disabled = disabled;
                if (message) config.withdrawal_message = message;
            }

            config.last_updated = new Date().toISOString();
            config.updated_by = adminId || "admin";

            fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
            console.log(`🔧 ${operation} ${disabled ? 'DISABLED' : 'ENABLED'}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to toggle ${operation}:`, error);
            return false;
        }
    }
}

module.exports = WalletMaintenanceManager;