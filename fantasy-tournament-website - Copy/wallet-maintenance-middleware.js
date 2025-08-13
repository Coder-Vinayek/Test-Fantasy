// Wallet Maintenance Middleware

const WalletMaintenanceManager = require('./wallet-maintenance');

class WalletMaintenanceMiddleware {
    constructor() {
        this.maintenanceManager = new WalletMaintenanceManager();
    }

    // Middleware to check wallet maintenance before deposit operations
    checkDepositMaintenance() {
        return (req, res, next) => {
            const operationCheck = this.maintenanceManager.isWalletOperationAllowed('deposit');
            
            if (!operationCheck.allowed) {
                return res.status(503).json({
                    error: operationCheck.message,
                    maintenance_mode: true,
                    operation: 'deposit'
                });
            }
            
            next();
        };
    }

    // Middleware to check wallet maintenance before withdrawal operations
    checkWithdrawalMaintenance() {
        return (req, res, next) => {
            const operationCheck = this.maintenanceManager.isWalletOperationAllowed('withdrawal');
            
            if (!operationCheck.allowed) {
                return res.status(503).json({
                    error: operationCheck.message,
                    maintenance_mode: true,
                    operation: 'withdrawal'
                });
            }
            
            next();
        };
    }

    // Middleware to add maintenance status to wallet page responses
    addMaintenanceStatus() {
        return (req, res, next) => {
            const status = this.maintenanceManager.getMaintenanceStatus();
            res.locals.walletMaintenanceStatus = status;
            next();
        };
    }

    // Get maintenance manager instance
    getMaintenanceManager() {
        return this.maintenanceManager;
    }
}

module.exports = WalletMaintenanceMiddleware;