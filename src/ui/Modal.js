export class Modal {
    constructor() {
        this.modalContainer = document.createElement('div');
        this.modalContainer.className = 'modal-container';
        this.modalContainer.style.display = 'none';

        this.modalContent = document.createElement('div');
        this.modalContent.className = 'modal-content';

        this.titleElement = document.createElement('h2');
        this.titleElement.className = 'modal-title';

        this.contentElement = document.createElement('div');
        this.contentElement.className = 'modal-body';

        this.closeButton = document.createElement('button');
        this.closeButton.className = 'modal-close';
        // Create a sci-fi themed close icon
        this.closeButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2L18 18M2 18L18 2" stroke="#8ab4f8" stroke-width="2" stroke-linecap="round"/>
                <circle cx="10" cy="10" r="9" stroke="#8ab4f8" stroke-width="1" opacity="0.5"/>
            </svg>
        `;
        this.closeButton.onclick = () => this.hide();

        this.modalContent.appendChild(this.closeButton);
        this.modalContent.appendChild(this.titleElement);
        this.modalContent.appendChild(this.contentElement);
        this.modalContainer.appendChild(this.modalContent);

        document.body.appendChild(this.modalContainer);
    }

    show(title, content) {
        this.titleElement.textContent = title;
        if (typeof content === 'string') {
            this.contentElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.contentElement.innerHTML = '';
            this.contentElement.appendChild(content);
        }
        this.modalContainer.style.display = 'flex';
    }

    hide() {
        this.modalContainer.style.display = 'none';
    }

    destroy() {
        document.body.removeChild(this.modalContainer);
    }
} 