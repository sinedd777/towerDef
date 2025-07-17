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
        const rawPath = [];
        let current = endNode;
        
        while (current) {
            // Center waypoints in grid cells instead of placing on grid intersections
            rawPath.unshift(new THREE.Vector3(current.x, 0.1, current.z));
            current = current.parent;
        }
        
        // Create smooth curved path
        const smoothedPath = this.createSmoothPath(rawPath, this.currentObstacles);
        
        // Add turn angle information to each waypoint
        return this.addTurnAngles(smoothedPath);
    }

    // Create a smooth curved path using spline interpolation
    createSmoothPath(rawPath, obstacles) {
        if (rawPath.length <= 2) return rawPath;
        
        // First pass: Simplify path by removing unnecessary intermediate points
        const simplifiedPath = this.simplifyPath(rawPath, obstacles);
        
        // Second pass: Create smooth curves between waypoints
        const smoothPath = [];
        
        for (let i = 0; i < simplifiedPath.length; i++) {
            smoothPath.push(simplifiedPath[i].clone());
            
            // Add curve points between waypoints (except for the last one)
            if (i < simplifiedPath.length - 1) {
                const current = simplifiedPath[i];
                const next = simplifiedPath[i + 1];
                
                // Calculate control points for smooth curves
                const curvePoints = this.createCurvePoints(current, next, simplifiedPath, i);
                smoothPath.push(...curvePoints);
            }
        }
        
        return smoothPath;
    }

    // Simplify path by removing redundant waypoints
    simplifyPath(path, obstacles) {
        if (path.length <= 2) return path;
        
        const simplified = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            let furthest = current + 1;
            
            // Look ahead for furthest visible point
            for (let i = current + 2; i < path.length; i++) {
                if (this.hasLineOfSight(path[current], path[i], obstacles)) {
                    furthest = i;
                } else {
                    break;
                }
            }
            
            simplified.push(path[furthest]);
            current = furthest;
        }
        
        return simplified;
    }

    // Check if there's a clear line of sight between two points
    hasLineOfSight(start, end, obstacles) {
        const direction = new THREE.Vector3().subVectors(end, start);
        const distance = direction.length();
        direction.normalize();
        
        // Sample points along the line
        const samples = Math.ceil(distance * 4); // More samples for better accuracy
        
        for (let i = 1; i < samples; i++) {
            const t = i / samples;
            const samplePoint = new THREE.Vector3().addVectors(
                start, 
                direction.clone().multiplyScalar(distance * t)
            );
            
            // Check if sample point or its surroundings are blocked
            const checkRadius = 0.3; // Safety margin around the path
            const checkPoints = [
                { x: samplePoint.x, z: samplePoint.z },
                { x: samplePoint.x + checkRadius, z: samplePoint.z },
                { x: samplePoint.x - checkRadius, z: samplePoint.z },
                { x: samplePoint.x, z: samplePoint.z + checkRadius },
                { x: samplePoint.x, z: samplePoint.z - checkRadius }
            ];
            
            for (const point of checkPoints) {
                if (!this.isInBounds(point.x, point.z) || 
                    this.isBlocked(point.x, point.z, obstacles)) {
                    return false;
                }
            }
        }
        
        return true;
    }

    // Create smooth curve points between two waypoints
    createCurvePoints(current, next, fullPath, index) {
        const curvePoints = [];
        
        // Determine if this is a turn by looking at previous and next directions
        let prevDirection = null;
        let nextDirection = null;
        
        if (index > 0) {
            prevDirection = new THREE.Vector3()
                .subVectors(current, fullPath[index - 1])
                .normalize();
        }
        
        if (index < fullPath.length - 2) {
            nextDirection = new THREE.Vector3()
                .subVectors(fullPath[index + 2], next)
                .normalize();
        }
        
        const currentDirection = new THREE.Vector3()
            .subVectors(next, current)
            .normalize();
        
        // If this is a significant turn, add curve points
        const isSignificantTurn = prevDirection && 
            Math.abs(prevDirection.dot(currentDirection)) < 0.9; // Angle > ~25 degrees
        
        if (isSignificantTurn) {
            // Create a smooth curve using quadratic bezier
            const controlPoint = this.calculateControlPoint(current, next, prevDirection);
            
            // Add intermediate points along the curve
            const curveSegments = 3;
            for (let t = 0.25; t < 1; t += 0.25) {
                const curvePoint = this.quadraticBezier(current, controlPoint, next, t);
                curvePoints.push(curvePoint);
            }
        } else {
            // For straight sections, add fewer intermediate points
            const midPoint = new THREE.Vector3()
                .addVectors(current, next)
                .multiplyScalar(0.5);
            curvePoints.push(midPoint);
        }
        
        return curvePoints;
    }

    // Calculate control point for bezier curve
    calculateControlPoint(start, end, incomingDirection) {
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        if (incomingDirection) {
            // Offset the control point to create a natural curve
            const perpendicular = new THREE.Vector3(-incomingDirection.z, 0, incomingDirection.x);
            const offset = perpendicular.multiplyScalar(0.3); // Curve intensity
            midPoint.add(offset);
        }
        
        return midPoint;
    }

    // Quadratic bezier interpolation
    quadraticBezier(p0, p1, p2, t) {
        const oneMinusT = 1 - t;
        return new THREE.Vector3(
            oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
            0.1, // Keep Y constant
            oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z
        );
    }

    // Add turn angle information to waypoints for speed modulation
    addTurnAngles(path) {
        if (path.length <= 2) return path;
        
        const pathWithAngles = [];
        
        for (let i = 0; i < path.length; i++) {
            const waypoint = {
                position: path[i].clone(),
                turnAngle: 0,
                isSharpTurn: false
            };
            
            // Calculate turn angle for middle waypoints
            if (i > 0 && i < path.length - 1) {
                const prev = path[i - 1];
                const current = path[i];
                const next = path[i + 1];
                
                const dir1 = new THREE.Vector3().subVectors(current, prev).normalize();
                const dir2 = new THREE.Vector3().subVectors(next, current).normalize();
                
                // Calculate the angle between directions
                const dotProduct = dir1.dot(dir2);
                const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                
                waypoint.turnAngle = angle;
                waypoint.isSharpTurn = angle > Math.PI / 4; // > 45 degrees
            }
            
            pathWithAngles.push(waypoint);
        }
        
        return pathWithAngles;
    }
} 