export class MultiplayerStatusUI {
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.container = null;
        this.playerStats = {
            player1: { health: 100, money: 150, score: 0, wave: 1 },
            player2: { health: 100, money: 150, score: 0, wave: 1 }
        };
        
        this.createStatusBar();
        this.setupNetworkUpdates();
    }
    
    createStatusBar() {
        // Remove existing status bar if it exists
        const existing = document.getElementById('multiplayer-status-bar');
        if (existing) existing.remove();
        
        this.container = document.createElement('div');
        this.container.id = 'multiplayer-status-bar';
        this.container.className = 'multiplayer-status-bar';
        
        this.container.innerHTML = `
            <div class="status-bar">
                <div class="player-stats player1-stats">
                    <span class="player-name">Player 1 (You)</span>
                    <span class="health">❤️ <span id="p1-health">100</span>/100</span>
                    <span class="money">💰 $<span id="p1-money">150</span></span>
                    <span class="score">🏆 <span id="p1-score">0</span></span>
                    <span class="wave">Wave: <span id="p1-wave">1</span></span>
                </div>
                
                <div class="game-info">
                    <div class="session-info">
                        <span class="session-id">Session: <span id="session-id">Connecting...</span></span>
                        <span class="connection-status" id="connection-status">●●●○ 45ms</span>
                    </div>
                    <div class="game-phase">
                        <span class="phase-indicator" id="phase-indicator">Waiting for players...</span>
                    </div>
                </div>
                
                <div class="player-stats player2-stats">
                    <span class="player-name">Player 2 (Opponent)</span>
                    <span class="health">❤️ <span id="p2-health">100</span>/100</span>
                    <span class="money">💰 $<span id="p2-money">150</span></span>
                    <span class="score">🏆 <span id="p2-score">0</span></span>
                    <span class="wave">Wave: <span id="p2-wave">1</span></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Update connection status immediately
        this.updateConnectionStatus();
        
        // Set up periodic connection status updates
        setInterval(() => this.updateConnectionStatus(), 1000);
    }
    
    setupNetworkUpdates() {
        if (!this.networkManager) return;
        
        // Update session ID when connected
        this.networkManager.setOnSessionJoined((data) => {
            this.updateSessionInfo(data.sessionId);
            this.updatePlayerInfo(data);
        });
        
        // Update connection status
        this.networkManager.setOnConnected(() => {
            this.updateConnectionStatus();
            this.updatePhaseIndicator('Connected - Finding match...');
        });
        
        this.networkManager.setOnDisconnected(() => {
            this.updateConnectionStatus();
            this.updatePhaseIndicator('Disconnected');
        });
        
        // Update game state
        this.networkManager.setOnGameStateUpdate((data) => {
            this.updateGameState(data);
        });
        
        // Update player actions
        this.networkManager.setOnPlayerJoined((data) => {
            this.updatePhaseIndicator('Player joined - Starting game...');
        });
        
        this.networkManager.setOnPlayerLeft((data) => {
            this.updatePhaseIndicator('Player left - Waiting for new player...');
        });
    }
    
    updatePlayerStats(playerId, stats) {
        // Store stats locally
        this.playerStats[playerId] = { ...this.playerStats[playerId], ...stats };
        
        // Update DOM elements
        const prefix = playerId === 'player1' ? 'p1' : 'p2';
        
        if (stats.health !== undefined) {
            const healthElement = document.getElementById(`${prefix}-health`);
            if (healthElement) {
                healthElement.textContent = stats.health;
                
                // Add visual feedback for low health
                const healthSpan = healthElement.parentElement;
                if (stats.health <= 30) {
                    healthSpan.classList.add('low-health');
                } else {
                    healthSpan.classList.remove('low-health');
                }
            }
        }
        
        if (stats.money !== undefined) {
            const moneyElement = document.getElementById(`${prefix}-money`);
            if (moneyElement) moneyElement.textContent = stats.money;
        }
        
        if (stats.score !== undefined) {
            const scoreElement = document.getElementById(`${prefix}-score`);
            if (scoreElement) scoreElement.textContent = stats.score;
        }
        
        if (stats.wave !== undefined) {
            const waveElement = document.getElementById(`${prefix}-wave`);
            if (waveElement) waveElement.textContent = stats.wave;
        }
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement || !this.networkManager) return;
        
        const status = this.networkManager.getConnectionStatus();
        
        if (status.connected) {
            statusElement.textContent = `${status.icon} ${status.latency}ms`;
            statusElement.className = `connection-status ${status.quality}`;
        } else {
            statusElement.textContent = '○○○○ Offline';
            statusElement.className = 'connection-status offline';
        }
    }
    
    updateSessionInfo(sessionId) {
        const sessionElement = document.getElementById('session-id');
        if (sessionElement) {
            // Display shortened session ID
            const shortId = sessionId ? sessionId.substring(0, 6).toUpperCase() : 'N/A';
            sessionElement.textContent = shortId;
        }
    }
    
    updatePhaseIndicator(phaseText) {
        const phaseElement = document.getElementById('phase-indicator');
        if (phaseElement) {
            phaseElement.textContent = phaseText;
        }
    }
    
    updateGameState(gameStateData) {
        // Update both players' stats from server data
        if (gameStateData.players) {
            Object.keys(gameStateData.players).forEach(playerId => {
                const playerData = gameStateData.players[playerId];
                this.updatePlayerStats(playerId, {
                    health: playerData.health,
                    money: playerData.money,
                    score: playerData.score,
                    wave: playerData.wave || 1
                });
            });
        }
        
        // Update game phase
        if (gameStateData.phase) {
            let phaseText = '';
            switch (gameStateData.phase) {
                case 'waiting':
                    phaseText = 'Waiting for players...';
                    break;
                case 'building':
                    phaseText = 'Build your maze!';
                    break;
                case 'defense':
                    phaseText = 'Defense phase - Fight!';
                    break;
                case 'ended':
                    phaseText = 'Game over';
                    break;
                default:
                    phaseText = 'In progress...';
            }
            this.updatePhaseIndicator(phaseText);
        }
    }
    
    // Update when local player performs actions
    updateLocalPlayerStats(stats) {
        const localPlayerId = this.networkManager?.playerId || 'player1';
        this.updatePlayerStats(localPlayerId, stats);
    }
    
    // Show victory/defeat messages
    showGameResult(isWinner, stats) {
        const resultOverlay = document.createElement('div');
        resultOverlay.className = 'game-result-overlay';
        
        const resultText = isWinner ? 'VICTORY!' : 'DEFEAT!';
        const resultClass = isWinner ? 'victory' : 'defeat';
        
        resultOverlay.innerHTML = `
            <div class="result-content ${resultClass}">
                <h1>${resultText}</h1>
                <div class="final-stats">
                    <p>Final Score: ${stats.score}</p>
                    <p>Waves Survived: ${stats.wave}</p>
                    <p>Money Remaining: $${stats.money}</p>
                </div>
                <button class="play-again-btn" onclick="location.reload()">Play Again</button>
            </div>
        `;
        
        document.body.appendChild(resultOverlay);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            resultOverlay.remove();
        }, 10000);
    }
    
    // Show/hide the status bar
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    // Cleanup
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
    
    // Animate statistics changes
    animateStatChange(playerId, statType, oldValue, newValue) {
        const prefix = playerId === 'player1' ? 'p1' : 'p2';
        const element = document.getElementById(`${prefix}-${statType}`);
        
        if (!element) return;
        
        // Add animation class
        element.classList.add('stat-change');
        
        // Determine if increase or decrease
        if (newValue > oldValue) {
            element.classList.add('stat-increase');
        } else if (newValue < oldValue) {
            element.classList.add('stat-decrease');
        }
        
        // Remove animation classes after animation completes
        setTimeout(() => {
            element.classList.remove('stat-change', 'stat-increase', 'stat-decrease');
        }, 500);
    }
    
    // Flash status for important events
    flashStatus(message, type = 'info', duration = 3000) {
        const flashElement = document.createElement('div');
        flashElement.className = `status-flash ${type}`;
        flashElement.textContent = message;
        
        this.container.appendChild(flashElement);
        
        // Animate in
        setTimeout(() => flashElement.classList.add('show'), 10);
        
        // Remove after duration
        setTimeout(() => {
            flashElement.classList.remove('show');
            setTimeout(() => flashElement.remove(), 300);
        }, duration);
    }
} 