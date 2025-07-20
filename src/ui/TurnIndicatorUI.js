export class TurnIndicatorUI {
    constructor() {
        this.container = null;
        this.turnDisplay = null;
        this.phaseDisplay = null;
        this.progressDisplay = null;
        this.createUI();
    }

    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'turn-indicator';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1500;
            border: 2px solid #444;
            min-width: 200px;
            transition: all 0.3s ease;
        `;

        // Turn display
        this.turnDisplay = document.createElement('div');
        this.turnDisplay.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        `;
        this.container.appendChild(this.turnDisplay);

        // Phase display
        this.phaseDisplay = document.createElement('div');
        this.phaseDisplay.style.cssText = `
            font-size: 12px;
            margin-bottom: 8px;
            text-align: center;
            color: #ccc;
        `;
        this.container.appendChild(this.phaseDisplay);

        // Progress display (shapes remaining, etc.)
        this.progressDisplay = document.createElement('div');
        this.progressDisplay.style.cssText = `
            font-size: 12px;
            text-align: center;
            color: #aaa;
        `;
        this.container.appendChild(this.progressDisplay);

        // Add to document
        document.body.appendChild(this.container);
        
        // Initially hidden
        this.hide();
    }

    updateTurn(data) {
        const { currentTurn, gamePhase, shapesPlaced, sharedResources } = data;
        
        // Update turn display
        this.turnDisplay.textContent = `${currentTurn}'s Turn`;
        this.turnDisplay.style.color = currentTurn === 'player1' ? '#4CAF50' : '#2196F3';
        
        // Update phase display
        const phaseText = gamePhase === 'building' ? 'Building Phase' : 'Defense Phase';
        this.phaseDisplay.textContent = phaseText;
        this.phaseDisplay.style.color = gamePhase === 'building' ? '#FFA726' : '#F44336';
        
        // Update progress display
        if (gamePhase === 'building' && shapesPlaced) {
            const totalShapes = shapesPlaced.player1 + shapesPlaced.player2;
            const remaining = 6 - totalShapes;
            this.progressDisplay.textContent = `Shapes: ${totalShapes}/6 (${remaining} remaining)`;
        } else if (gamePhase === 'defense' && sharedResources) {
            this.progressDisplay.textContent = `Health: ${sharedResources.health} | Money: $${sharedResources.money} | Score: ${sharedResources.score}`;
        }

        // Add pulsing effect for current turn
        this.container.style.animation = 'pulse 2s infinite';
        setTimeout(() => {
            this.container.style.animation = '';
        }, 2000);
    }

    updateMyTurn(isMyTurn) {
        if (isMyTurn) {
            this.container.style.borderColor = '#4CAF50';
            this.container.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
            this.turnDisplay.textContent = 'Your Turn!';
            this.turnDisplay.style.color = '#4CAF50';
        } else {
            this.container.style.borderColor = '#FF9800';
            this.container.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.3)';
        }
    }

    updatePhase(phase) {
        const phaseText = phase === 'building' ? 'Building Phase' : 'Defense Phase';
        this.phaseDisplay.textContent = phaseText;
        
        if (phase === 'building') {
            this.phaseDisplay.style.color = '#FFA726';
            this.container.style.background = 'rgba(255, 167, 38, 0.1)';
        } else if (phase === 'defense') {
            this.phaseDisplay.style.color = '#F44336';
            this.container.style.background = 'rgba(244, 67, 54, 0.1)';
        }
    }

    showPhaseTransition(newPhase) {
        // Clear any waiting messages when defense phase starts
        if (newPhase === 'defense') {
            this.clearWaitingMessages();
        }
        
        // Create transition overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 3000;
            color: white;
            font-size: 48px;
            font-weight: bold;
            text-align: center;
        `;
        
        const message = newPhase === 'defense' ? 
            'Defense Phase Starting!' : 
            `${newPhase} Phase`;
            
        overlay.textContent = message;
        document.body.appendChild(overlay);
        
        // Fade out after 3 seconds
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 1s';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 1000);
        }, 2000);
    }

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

    clearWaitingMessages() {
        // Remove the waiting for players element
        const waitingElement = document.getElementById('waiting-for-players');
        if (waitingElement) {
            waitingElement.remove();
            console.log('🔄 Waiting for players message cleared');
        }
        
        // Also remove any other waiting messages by content
        const waitingSelectors = [
            '[id*="waiting"]',
            '[class*="waiting"]',
            'div',
            'p'
        ];
        
        waitingSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el.textContent && (
                    el.textContent.includes('Waiting for other players') || 
                    el.textContent.includes('Your maze is complete')
                )) {
                    el.remove();
                    console.log('🔄 Waiting element removed by content:', el.textContent.slice(0, 50));
                }
            });
        });
    }

    cleanup() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Add CSS animation for pulse effect
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .disabled-turn {
        filter: grayscale(0.5);
        opacity: 0.6 !important;
    }
`;
document.head.appendChild(style); 