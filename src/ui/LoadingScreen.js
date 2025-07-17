export class LoadingScreen {
    constructor() {
        this.container = null;
        this.progressBar = null;
        this.statusText = null;
        this.progressText = null;
        this.isVisible = false;
        
        this.createLoadingScreen();
    }

    createLoadingScreen() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'loading-screen';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Arial', sans-serif;
            color: white;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease-in-out;
        `;

        // Create title
        const title = document.createElement('h1');
        title.textContent = 'Tower Defense';
        title.style.cssText = `
            font-size: 3rem;
            margin: 0 0 1rem 0;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
        `;

        // Create subtitle
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Loading 3D Assets...';
        subtitle.style.cssText = `
            font-size: 1.2rem;
            margin: 0 0 3rem 0;
            opacity: 0.8;
            text-align: center;
        `;

        // Create progress container
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 400px;
            max-width: 80vw;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 25px;
            padding: 4px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        `;

        // Create progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            width: 0%;
            height: 20px;
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            border-radius: 20px;
            transition: width 0.3s ease-out;
            box-shadow: 0 2px 10px rgba(79, 172, 254, 0.3);
        `;

        // Create progress text
        this.progressText = document.createElement('div');
        this.progressText.textContent = '0%';
        this.progressText.style.cssText = `
            text-align: center;
            margin-top: 1rem;
            font-size: 1.1rem;
            font-weight: bold;
        `;

        // Create status text
        this.statusText = document.createElement('div');
        this.statusText.textContent = 'Initializing...';
        this.statusText.style.cssText = `
            text-align: center;
            margin-top: 0.5rem;
            font-size: 0.9rem;
            opacity: 0.7;
            min-height: 1.2rem;
        `;

        // Create loading animation
        const loadingDots = document.createElement('div');
        loadingDots.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 2rem;
        `;

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 12px;
                height: 12px;
                background: linear-gradient(45deg, #4facfe, #00f2fe);
                border-radius: 50%;
                margin: 0 4px;
                animation: loading-pulse 1.4s infinite ease-in-out;
                animation-delay: ${i * 0.2}s;
            `;
            loadingDots.appendChild(dot);
        }

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes loading-pulse {
                0%, 80%, 100% {
                    transform: scale(0);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        // Assemble the loading screen
        progressContainer.appendChild(this.progressBar);
        this.container.appendChild(title);
        this.container.appendChild(subtitle);
        this.container.appendChild(progressContainer);
        this.container.appendChild(this.progressText);
        this.container.appendChild(this.statusText);
        this.container.appendChild(loadingDots);
    }

    show() {
        if (!this.isVisible) {
            document.body.appendChild(this.container);
            this.isVisible = true;
            // Trigger fade in
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
                this.container.style.pointerEvents = 'all';
            });
        }
    }

    hide() {
        if (this.isVisible) {
            this.container.style.opacity = '0';
            this.container.style.pointerEvents = 'none';
            
            setTimeout(() => {
                if (this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                this.isVisible = false;
            }, 300);
        }
    }

    updateProgress(loaded, total, currentAsset = '') {
        const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }
        
        if (this.progressText) {
            this.progressText.textContent = `${percentage}%`;
        }
        
        if (this.statusText && currentAsset) {
            // Clean up asset name for display
            const cleanName = currentAsset
                .replace('enemies:', '')
                .replace('towers:', '')
                .replace('weapons:', '')
                .replace('projectiles:', '')
                .replace('environment:', '')
                .replace('-', ' ')
                .replace('ufo', 'UFO')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            this.statusText.textContent = `Loading ${cleanName}...`;
        }
    }

    setStatus(status) {
        if (this.statusText) {
            this.statusText.textContent = status;
        }
    }

    destroy() {
        this.hide();
        this.container = null;
        this.progressBar = null;
        this.statusText = null;
        this.progressText = null;
    }
} 