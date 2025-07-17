import * as THREE from 'three';

class Node {
    constructor(x, z, g = 0, h = 0) {
        this.x = x;
        this.z = z;
        this.g = g; // Cost from start to this node
        this.h = h; // Estimated cost from this node to end
        this.f = g + h; // Total cost
        this.parent = null;
    }

    equals(other) {
        return this.x === other.x && this.z === other.z;
    }

    toString() {
        return `${this.x},${this.z}`;
    }
}

export class Pathfinding {
    constructor(gridSize = 20) {
        this.gridSize = gridSize;
        this.nodeSize = 1; // Size of each grid cell
        this.directions = [
            { x: 1, z: 0 },   // right
            { x: -1, z: 0 },  // left
            { x: 0, z: 1 },   // down
            { x: 0, z: -1 },  // up
            { x: 1, z: 1 },   // diagonal
            { x: -1, z: 1 },
            { x: 1, z: -1 },
            { x: -1, z: -1 }
        ];
    }

    // Calculate heuristic (estimated distance to goal)
    heuristic(node, goal) {
        // Using diagonal distance
        const dx = Math.abs(node.x - goal.x);
        const dz = Math.abs(node.z - goal.z);
        return Math.max(dx, dz);
    }

    // Check if position is blocked by obstacles
    isBlocked(x, z, obstacles) {
        // Check each obstacle
        for (const obstacle of obstacles) {
            // Use a larger threshold for collision detection
            // Since our grid cells are 1x1, we use 0.8 to ensure proper spacing
            const threshold = 0.8;
            
            // Check if the point is within the obstacle's bounds
            // Obstacles are assumed to be 1x1 grid cells
            const obstacleMinX = obstacle.x - threshold;
            const obstacleMaxX = obstacle.x + threshold;
            const obstacleMinZ = obstacle.z - threshold;
            const obstacleMaxZ = obstacle.z + threshold;
            
            if (x >= obstacleMinX && x <= obstacleMaxX && 
                z >= obstacleMinZ && z <= obstacleMaxZ) {
                return true;
            }
        }
        return false;
    }

    // Check if position is within grid bounds
    isInBounds(x, z) {
        const halfGrid = this.gridSize / 2;
        // Add a 1-unit buffer from the edges
        return x > (-halfGrid + 1) && x < (halfGrid - 1) && 
               z > (-halfGrid + 1) && z < (halfGrid - 1);
    }

    // Get valid neighbors for a node
    getNeighbors(node, obstacles) {
        const neighbors = [];
        
        for (const dir of this.directions) {
            const newX = node.x + dir.x;
            const newZ = node.z + dir.z;
            
            // Skip if out of bounds or blocked
            if (!this.isInBounds(newX, newZ) || this.isBlocked(newX, newZ, obstacles)) {
                continue;
            }
            
            // For diagonal movement, ensure both orthogonal paths are clear
            if (dir.x !== 0 && dir.z !== 0) {
                // Check both orthogonal paths to avoid cutting corners
                if (this.isBlocked(node.x + dir.x, node.z, obstacles) || 
                    this.isBlocked(node.x, node.z + dir.z, obstacles)) {
                    continue;
                }
                
                // Also check a bit further along diagonal to prevent close passes
                if (this.isBlocked(node.x + dir.x * 0.5, node.z + dir.z * 0.5, obstacles)) {
                    continue;
                }
            }
            
            neighbors.push(new Node(newX, newZ));
        }
        
        return neighbors;
    }

    // Find path using A* algorithm
    findPath(start, end, obstacles) {
        // Store obstacles for path reconstruction
        this.currentObstacles = obstacles;
        
        const startNode = new Node(start.x, start.z);
        const endNode = new Node(end.x, end.z);
        
        // If start or end is blocked, return null to indicate no valid path
        if (this.isBlocked(start.x, start.z, obstacles) || this.isBlocked(end.x, end.z, obstacles)) {
            return null;
        }
        
        // Initialize open and closed sets
        const openSet = new Map();
        const closedSet = new Map();
        
        openSet.set(startNode.toString(), startNode);
        
        while (openSet.size > 0) {
            // Get node with lowest f cost
            let current = null;
            let lowestF = Infinity;
            
            for (const [_, node] of openSet) {
                if (node.f < lowestF) {
                    lowestF = node.f;
                    current = node;
                }
            }
            
            // Check if we reached the end
            if (current.equals(endNode)) {
                return this.reconstructPath(current);
            }
            
            // Move current node from open to closed set
            openSet.delete(current.toString());
            closedSet.set(current.toString(), current);
            
            // Check all neighbors
            for (const neighbor of this.getNeighbors(current, obstacles)) {
                // Skip if in closed set
                if (closedSet.has(neighbor.toString())) {
                    continue;
                }
                
                // Calculate g cost (cost from start to neighbor through current)
                const gCost = current.g + ((neighbor.x - current.x !== 0 && 
                                          neighbor.z - current.z !== 0) ? 1.4 : 1);
                
                const existingNeighbor = openSet.get(neighbor.toString());
                
                if (!existingNeighbor || gCost < existingNeighbor.g) {
                    // This is a better path, record it
                    neighbor.g = gCost;
                    neighbor.h = this.heuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;
                    
                    if (!existingNeighbor) {
                        openSet.set(neighbor.toString(), neighbor);
                    }
                }
            }
        }
        
        // No path found, return null instead of straight line
        return null;
    }

    // Reconstruct path from end node
    reconstructPath(endNode) {
        const path = [];
        let current = endNode;
        
        while (current) {
            path.unshift(new THREE.Vector3(current.x, 0.1, current.z));
            current = current.parent;
        }
        
        // Smooth the path
        return this.smoothPath(path, this.currentObstacles);
    }

    // Smooth the path by removing unnecessary waypoints
    smoothPath(path, obstacles) {
        if (path.length <= 2) return path;
        
        const smoothed = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            let furthest = current + 1;
            
            // Look ahead for furthest visible node
            for (let i = current + 2; i < path.length; i++) {
                const line = new THREE.Line3(path[current], path[i]);
                let blocked = false;
                
                // Check more points along the line for better obstacle detection
                for (let t = 0; t <= 1; t += 0.05) { // Increased sampling frequency
                    const point = new THREE.Vector3();
                    line.at(t, point);
                    
                    // Check if point is in bounds
                    if (!this.isInBounds(point.x, point.z)) {
                        blocked = true;
                        break;
                    }
                    
                    // Check the point and its surroundings for better clearance
                    const checkPoints = [
                        { x: point.x, z: point.z },
                        { x: point.x + 0.4, z: point.z },
                        { x: point.x - 0.4, z: point.z },
                        { x: point.x, z: point.z + 0.4 },
                        { x: point.x, z: point.z - 0.4 }
                    ];
                    
                    for (const checkPoint of checkPoints) {
                        if (!this.isInBounds(checkPoint.x, checkPoint.z) || 
                            this.isBlocked(checkPoint.x, checkPoint.z, obstacles)) {
                            blocked = true;
                            break;
                        }
                    }
                    
                    if (blocked) break;
                }
                
                if (!blocked) {
                    furthest = i;
                } else {
                    break; // Stop looking ahead if we found a blocked path
                }
            }
            
            smoothed.push(path[furthest]);
            current = furthest;
        }
        
        return smoothed;
    }
} 