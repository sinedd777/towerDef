import { ELEMENTS, getAvailableTowers } from './Elements.js';

export class ElementManager {
    constructor(gameState, scene) {
        this.gameState = gameState;
        this.scene = scene;
        this.elementSelectionModal = null;
        this.isModalActive = false;
        
        // Set up the element selection callback
        this.gameState.setElementSelectionCallback(() => {
            this.showElementSelection();
        });
        
        this.createElementSelectionModal();
    }
    
    createElementSelectionModal() {
        // Create modal container
        this.elementSelectionModal = document.createElement('div');
        this.elementSelectionModal.id = 'element-selection-modal';
        this.elementSelectionModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #222;
            border: 2px solid #444;
            border-radius: 10px;
            padding: 30px;
            max-width: 600px;
            color: white;
            text-align: center;
        `;
        
        // Modal title
        const title = document.createElement('h2');
        title.textContent = 'Choose Your Element';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #ffdd44;
        `;
        modalContent.appendChild(title);
        
        // Description
        const description = document.createElement('p');
        description.textContent = 'Select an element to unlock new tower types. Each element provides unique abilities and can be combined with others for powerful effects.';
        description.style.cssText = `
            margin: 0 0 30px 0;
            line-height: 1.5;
        `;
        modalContent.appendChild(description);
        
        // Element buttons container
        const elementsContainer = document.createElement('div');
        elementsContainer.id = 'elements-container';
        elementsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        `;
        modalContent.appendChild(elementsContainer);
        
        this.elementSelectionModal.appendChild(modalContent);
        document.body.appendChild(this.elementSelectionModal);
    }
    
    showElementSelection() {
        if (this.isModalActive) return;
        
        this.isModalActive = true;
        const availableElements = this.getAvailableElements();
        const container = document.getElementById('elements-container');
        
        // Clear previous content
        container.innerHTML = '';
        
        // Create buttons for each available element
        availableElements.forEach(elementKey => {
            const element = ELEMENTS[elementKey];
            const button = document.createElement('button');
            button.style.cssText = `
                background: linear-gradient(145deg, #${element.color.toString(16).padStart(6, '0')}, #333);
                border: 2px solid #${element.color.toString(16).padStart(6, '0')};
                border-radius: 8px;
                padding: 20px;
                color: white;
                cursor: pointer;
                transition: all 0.3s;
                min-height: 120px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            `;
            
            // Element name
            const name = document.createElement('div');
            name.textContent = element.name;
            name.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
            `;
            button.appendChild(name);
            
            // Element description
            const desc = document.createElement('div');
            desc.textContent = element.description;
            desc.style.cssText = `
                font-size: 12px;
                opacity: 0.8;
                text-align: center;
                line-height: 1.3;
            `;
            button.appendChild(desc);
            
            // Hover effects
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.05)';
                button.style.boxShadow = `0 0 20px #${element.color.toString(16).padStart(6, '0')}66`;
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
            });
            
            // Click handler
            button.addEventListener('click', () => {
                this.selectElement(element.id);
            });
            
            container.appendChild(button);
        });
        
        // Show modal
        this.elementSelectionModal.style.display = 'flex';
    }
    
    hideElementSelection() {
        this.elementSelectionModal.style.display = 'none';
        this.isModalActive = false;
    }
    
    selectElement(elementId) {
        if (this.gameState.selectElement(elementId)) {
            console.log(`Element ${elementId} selected! Available towers updated.`);
            this.hideElementSelection();
            
            // Update available towers in UI
            this.updateAvailableTowers();
            
            // Show notification
            this.showElementUnlockedNotification(elementId);
        }
    }
    
    getAvailableElements() {
        const unlockedElements = this.gameState.getUnlockedElements();
        const allElements = Object.keys(ELEMENTS).map(key => ELEMENTS[key].id);
        
        // Return elements that haven't been unlocked yet
        return allElements.filter(elementId => !unlockedElements.includes(elementId));
    }
    
    updateAvailableTowers() {
        const unlockedElements = this.gameState.getUnlockedElements();
        const availableTowers = getAvailableTowers(unlockedElements);
        
        // Dispatch event to update tower selection UI
        const event = new CustomEvent('towersUpdated', {
            detail: { availableTowers, unlockedElements }
        });
        document.dispatchEvent(event);
    }
    
    showElementUnlockedNotification(elementId) {
        const element = Object.values(ELEMENTS).find(e => e.id === elementId);
        if (!element) return;
        
        // Create notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: linear-gradient(145deg, #${element.color.toString(16).padStart(6, '0')}, #333);
            border: 2px solid #${element.color.toString(16).padStart(6, '0')};
            border-radius: 8px;
            padding: 15px 20px;
            color: white;
            z-index: 999;
            animation: slideIn 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${element.name} Element Unlocked!</div>
            <div style="font-size: 12px; opacity: 0.9;">${element.description}</div>
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove notification after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.5s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 4000);
    }
    
    getUnlockedElements() {
        return this.gameState.getUnlockedElements();
    }
    
    hasElement(elementId) {
        return this.gameState.hasElement(elementId);
    }
    
    isElementSelectionPending() {
        return this.gameState.isElementSelectionPending();
    }
} 