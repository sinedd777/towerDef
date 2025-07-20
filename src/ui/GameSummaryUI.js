export class GameSummaryUI {
    constructor() {
        this.overlay = null;
    }

    show(stats, isVictory = false) {
        // Create overlay if it doesn't exist
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'game-summary-overlay';
            document.body.appendChild(this.overlay);
        }

        const resultText = isVictory ? 'VICTORY!' : 'GAME OVER';
        const resultClass = isVictory ? 'victory' : 'defeat';

        this.overlay.innerHTML = `
            <div class="game-summary-content ${resultClass}">
                <h1>${resultText}</h1>
                <div class="summary-stats">
                    <p>Wave Reached: ${stats.wave}</p>
                    <p>Final Score: ${stats.score}</p>
                    <p>Money Remaining: $${stats.money}</p>
                    <p>Health Remaining: ${stats.health}</p>
                </div>
                <button class="play-again-btn" onclick="location.reload()">Play Again</button>
            </div>
        `;

        this.overlay.style.display = 'flex';
    }

    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    cleanup() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
} 