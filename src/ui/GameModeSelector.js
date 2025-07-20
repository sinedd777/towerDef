export class GameModeSelector {
    constructor() {
        this.container = null;
        this.onModeSelected = null;
        this.createSelector();
    }
    
    createSelector() {
        // Remove existing selector if it exists
        const existing = document.getElementById('game-mode-selector');
        if (existing) existing.remove();
        
        this.container = document.createElement('div');
        this.container.id = 'game-mode-selector';
        this.container.className = 'game-mode-selector';
        
        this.container.innerHTML = `
            <div class="mode-selector-overlay">
                <div class="mode-selector-content">
                    <h1 class="game-title">Tower Defense</h1>
                    <p class="game-subtitle">Choose your game mode</p>
                    
                    <div class="mode-options">
                        <div class="mode-option" data-mode="singleplayer">
                            <div class="mode-icon">🏰</div>
                            <h3>Single Player</h3>
                            <p>Play solo against AI enemies</p>
                            <ul>
                                <li>Build mazes with Tetris shapes</li>
                                <li>Defend against enemy waves</li>
                                <li>Unlock towers and upgrades</li>
                            </ul>
                            <button class="mode-btn single-btn">Play Solo</button>
                        </div>
                        
                        <div class="mode-option" data-mode="multiplayer">
                            <div class="mode-icon">🤝</div>
                            <h3>Multiplayer</h3>
                            <p>Team up with another player</p>
                            <ul>
                                <li>Cooperative tower defense</li>
                                <li>Shared resources and objectives</li>
                                <li>Turn-based building phase</li>
                            </ul>
                            <button class="mode-btn multi-btn">Quick Match</button>
                            <div class="matchmaking-status" style="display: none;">
                                <div class="spinner"></div>
                                <span class="status-text">Finding opponent...</span>
                                <button class="cancel-btn">Cancel</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="server-status" id="server-status">
                        <span class="status-text">Checking server connection...</span>
                    </div>
                    
                    <div class="game-info">
                        <p>Use WASD or arrow keys to move camera • Mouse to interact • R to rotate pieces</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        this.setupEventListeners();
        this.checkServerStatus();
    }
    
    setupEventListeners() {
        // Mode option clicks
        const modeOptions = this.container.querySelectorAll('.mode-option');
        modeOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectMode(option.dataset.mode);
            });
        });
        
        // Mode button clicks
        const modeButtons = this.container.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const mode = button.parentElement.dataset.mode;
                this.selectMode(mode);
            });
        });

        // Cancel matchmaking button
        const cancelButton = this.container.querySelector('.cancel-btn');
        if (cancelButton) {
            cancelButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.cancelMatchmaking();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (this.container.style.display !== 'none') {
                switch (event.code) {
                    case 'Digit1':
                    case 'KeyS':
                        this.selectMode('singleplayer');
                        break;
                    case 'Digit2':
                    case 'KeyM':
                        this.selectMode('multiplayer');
                        break;
                    case 'Escape':
                        if (this.isInMatchmaking) {
                            this.cancelMatchmaking();
                        }
                        break;
                }
            }
        });
    }
    
    selectMode(mode) {
        console.log(`Selected game mode: ${mode}`);
        
        // Visual feedback
        const selectedOption = this.container.querySelector(`[data-mode="${mode}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            
            // Remove selection after animation
            setTimeout(() => {
                selectedOption.classList.remove('selected');
            }, 500);
        }
        
        // Validate multiplayer availability
        if (mode === 'multiplayer') {
            if (!this.isServerAvailable()) {
                this.showServerError();
                return;
            }
            this.startMatchmaking();
            return;
        }
        
        // Call the mode selection callback for singleplayer
        if (this.onModeSelected) {
            this.onModeSelected(mode);
        }
        
        // Hide the selector only for singleplayer
        if (mode === 'singleplayer') {
            this.hide();
        }
    }

    startMatchmaking() {
        const multiplayerOption = this.container.querySelector('[data-mode="multiplayer"]');
        const matchmakingStatus = multiplayerOption.querySelector('.matchmaking-status');
        const quickMatchBtn = multiplayerOption.querySelector('.multi-btn');
        
        // Show matchmaking UI
        quickMatchBtn.style.display = 'none';
        matchmakingStatus.style.display = 'flex';
        this.isInMatchmaking = true;
        
        // Call the mode selection callback with matchmaking
        if (this.onModeSelected) {
            this.onModeSelected('multiplayer', { matchmaking: true });
        }
    }

    cancelMatchmaking() {
        const multiplayerOption = this.container.querySelector('[data-mode="multiplayer"]');
        const matchmakingStatus = multiplayerOption.querySelector('.matchmaking-status');
        const quickMatchBtn = multiplayerOption.querySelector('.multi-btn');
        
        // Hide matchmaking UI
        matchmakingStatus.style.display = 'none';
        quickMatchBtn.style.display = 'block';
        this.isInMatchmaking = false;
        
        // Call the cancel callback
        if (this.onMatchmakingCancelled) {
            this.onMatchmakingCancelled();
        }
    }

    updateMatchmakingStatus(status) {
        const multiplayerOption = this.container.querySelector('[data-mode="multiplayer"]');
        const statusText = multiplayerOption.querySelector('.matchmaking-status .status-text');
        
        switch (status.status) {
            case 'queued':
                statusText.textContent = `Finding opponent... (Position: ${status.position})`;
                break;
            case 'timeout':
                statusText.textContent = 'No opponent found. Try again?';
                this.cancelMatchmaking();
                break;
            case 'cancelled':
                statusText.textContent = 'Matchmaking cancelled';
                this.cancelMatchmaking();
                break;
            case 'error':
                statusText.textContent = 'Error finding match';
                this.cancelMatchmaking();
                break;
        }
    }

    setOnMatchmakingCancelled(callback) {
        this.onMatchmakingCancelled = callback;
    }
    
    async checkServerStatus() {
        const statusElement = document.getElementById('server-status');
        const multiplayerOption = this.container.querySelector('[data-mode="multiplayer"]');
        
        try {
            // Try to connect to the server
            const response = await fetch('http://localhost:4000/health', {
                method: 'GET',
                mode: 'cors',
                timeout: 3000
            });
            
            if (response.ok) {
                const data = await response.json();
                statusElement.innerHTML = `
                    <span class="status-text online">🟢 Server Online</span>
                    <span class="server-info">Players: ${data.players || 0} • Sessions: ${data.sessions || 0}</span>
                `;
                multiplayerOption.classList.remove('disabled');
                this.serverAvailable = true;
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            console.warn('Server not available:', error);
            statusElement.innerHTML = `
                <span class="status-text offline">🔴 Server Offline</span>
                <span class="server-info">Multiplayer unavailable</span>
            `;
            multiplayerOption.classList.add('disabled');
            this.serverAvailable = false;
        }
    }
    
    isServerAvailable() {
        return this.serverAvailable === true;
    }
    
    showServerError() {
        // Create error overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'server-error-overlay';
        errorOverlay.innerHTML = `
            <div class="error-content">
                <h3>🔴 Server Unavailable</h3>
                <p>The multiplayer server is currently offline.</p>
                <p>Please try again later or play in single-player mode.</p>
                <div class="error-actions">
                    <button class="retry-btn">Retry Connection</button>
                    <button class="single-btn">Play Solo Instead</button>
                </div>
            </div>
        `;
        
        this.container.appendChild(errorOverlay);
        
        // Setup error overlay event listeners
        errorOverlay.querySelector('.retry-btn').addEventListener('click', () => {
            errorOverlay.remove();
            this.checkServerStatus();
        });
        
        errorOverlay.querySelector('.single-btn').addEventListener('click', () => {
            errorOverlay.remove();
            this.selectMode('singleplayer');
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorOverlay.parentElement) {
                errorOverlay.remove();
            }
        }, 5000);
    }
    
    // Show the mode selector
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            // Refresh server status when showing
            this.checkServerStatus();
        }
    }
    
    // Hide the mode selector
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    // Destroy the selector
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
    
    // Callback setter
    setOnModeSelected(callback) {
        this.onModeSelected = callback;
    }
    
    // Update server status dynamically
    updateServerStatus(isOnline, playerCount = 0, sessionCount = 0) {
        const statusElement = document.getElementById('server-status');
        const multiplayerOption = this.container?.querySelector('[data-mode="multiplayer"]');
        
        if (!statusElement) return;
        
        if (isOnline) {
            statusElement.innerHTML = `
                <span class="status-text online">🟢 Server Online</span>
                <span class="server-info">Players: ${playerCount} • Sessions: ${sessionCount}</span>
            `;
            if (multiplayerOption) multiplayerOption.classList.remove('disabled');
            this.serverAvailable = true;
        } else {
            statusElement.innerHTML = `
                <span class="status-text offline">🔴 Server Offline</span>
                <span class="server-info">Multiplayer unavailable</span>
            `;
            if (multiplayerOption) multiplayerOption.classList.add('disabled');
            this.serverAvailable = false;
        }
    }
} 