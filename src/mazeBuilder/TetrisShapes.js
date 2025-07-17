export const TETRIS_SHAPES = [
    {
        name: 'I',
        color: 0x00FFFF,
        cells: [
            [0, 1], [1, 1], [2, 1], [3, 1]
        ]
    },
    {
        name: 'O',
        color: 0xFFFF00,
        cells: [
            [0, 0], [1, 0], [0, 1], [1, 1]
        ]
    },
    {
        name: 'T',
        color: 0x800080,
        cells: [
            [1, 0], [0, 1], [1, 1], [2, 1]
        ]
    },
    {
        name: 'J',
        color: 0x0000FF,
        cells: [
            [0, 0], [0, 1], [1, 1], [2, 1]
        ]
    },
    {
        name: 'L',
        color: 0xFF8000,
        cells: [
            [2, 0], [0, 1], [1, 1], [2, 1]
        ]
    },
    {
        name: 'S',
        color: 0x00FF00,
        cells: [
            [1, 0], [2, 0], [0, 1], [1, 1]
        ]
    },
    {
        name: 'Z',
        color: 0xFF0000,
        cells: [
            [0, 0], [1, 0], [1, 1], [2, 1]
        ]
    }
];

export class Shape {
    constructor(shapeData) {
        this.name = shapeData.name;
        this.color = shapeData.color;
        this.cells = [...shapeData.cells]; // Copy cells
        this.rotation = 0;
        this.position = { x: 0, z: 0 };
        this.placed = false;
    }

    // Rotate the shape 90 degrees clockwise
    rotate() {
        if (this.placed) return false;
        
        // Find bounds for rotation
        const minX = Math.min(...this.cells.map(cell => cell[0]));
        const maxX = Math.max(...this.cells.map(cell => cell[0]));
        const minY = Math.min(...this.cells.map(cell => cell[1]));
        const maxY = Math.max(...this.cells.map(cell => cell[1]));
        
        // Calculate center point (using integer division to maintain grid alignment)
        const centerX = Math.floor((minX + maxX) / 2);
        const centerY = Math.floor((minY + maxY) / 2);
        
        // Rotate each cell around center
        const newCells = this.cells.map(cell => {
            const relX = cell[0] - centerX;
            const relY = cell[1] - centerY;
            
            // 90-degree clockwise rotation: (x, y) -> (y, -x)
            const newX = relY + centerX;
            const newY = -relX + centerY;
            
            return [Math.round(newX), Math.round(newY)];
        });
        
        // Update cells
        this.cells = newCells;
        this.rotation = (this.rotation + 90) % 360;
        return true;
    }

    // Get world positions of cells relative to shape position
    getWorldCells() {
        return this.cells.map(cell => ({
            // Add cell offsets to the already-centered position
            x: this.position.x + cell[0],
            z: this.position.z + cell[1]
        }));
    }

    // Check if shape can be placed at given position
    canPlaceAt(x, z, gridState, gridSize = 10) {
        this.position = { x, z };
        
        for (const cell of this.getWorldCells()) {
            // Check bounds (adjusted for cell-centered coordinates)
            if (cell.x < -gridSize/2 + 0.5 || cell.x >= gridSize/2 - 0.5 || 
                cell.z < -gridSize/2 + 0.5 || cell.z >= gridSize/2 - 0.5) {
                return false;
            }
            
            // Convert to grid coordinates (0-based)
            const gridX = Math.floor(cell.x + gridSize/2);
            const gridZ = Math.floor(cell.z + gridSize/2);
            
            // Check if cell is already occupied or restricted
            if (gridState[gridZ] && gridState[gridZ][gridX] && 
                (gridState[gridZ][gridX].occupied || gridState[gridZ][gridX].restricted)) {
                return false;
            }
        }
        
        return true;
    }

    // Place the shape in the grid state
    placeInGrid(gridState, gridSize = 10) {
        if (this.placed) return false;
        
        for (const cell of this.getWorldCells()) {
            // Convert cell-centered coordinates to grid indices
            const gridX = Math.floor(cell.x + gridSize/2);
            const gridZ = Math.floor(cell.z + gridSize/2);
            
            if (!gridState[gridZ]) gridState[gridZ] = {};
            gridState[gridZ][gridX] = {
                occupied: true,
                shape: this,
                color: this.color
            };
        }
        
        this.placed = true;
        return true;
    }
}

// Generate random hand of shapes
export function generateShapeHand(count = 3) {
    let availableShapes = [...TETRIS_SHAPES];
    const hand = [];
    
    for (let i = 0; i < count; i++) {
        // If we've used all shapes, reset the available shapes
        if (i % TETRIS_SHAPES.length === 0) {
            availableShapes = [...TETRIS_SHAPES];
        }
        
        const randomIndex = Math.floor(Math.random() * availableShapes.length);
        const shapeData = availableShapes.splice(randomIndex, 1)[0];
        hand.push(new Shape(shapeData));
    }
    
    return hand;
} 