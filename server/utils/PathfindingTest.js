import ServerPathfinding from './Pathfinding.js';

// Simple test utility to verify pathfinding works
export function testServerPathfinding() {
    console.log('🧪 Testing server-side pathfinding...');
    
    const pathfinding = new ServerPathfinding(20);
    
    // Test 1: Simple path without obstacles
    const start = { x: -8, z: -8 };
    const end = { x: 8, z: 8 };
    const obstacles = [];
    
    const simplePath = pathfinding.findPath(start, end, obstacles);
    
    if (simplePath && simplePath.length > 0) {
        console.log('✅ Simple path test passed:', simplePath.length, 'waypoints');
    } else {
        console.log('❌ Simple path test failed');
        return false;
    }
    
    // Test 2: Path with obstacles
    const complexObstacles = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 2, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
        { x: 2, z: 1 }
    ];
    
    const complexPath = pathfinding.findPath(start, end, complexObstacles);
    
    if (complexPath && complexPath.length > 0) {
        console.log('✅ Complex path test passed:', complexPath.length, 'waypoints');
    } else {
        console.log('❌ Complex path test failed');
        return false;
    }
    
    // Test 3: Blocked path (should return null)
    const blockedObstacles = [];
    for (let x = -10; x <= 10; x++) {
        blockedObstacles.push({ x, z: 0 });
    }
    
    const blockedPath = pathfinding.findPath(start, end, blockedObstacles);
    
    if (blockedPath === null) {
        console.log('✅ Blocked path test passed (correctly returned null)');
    } else {
        console.log('❌ Blocked path test failed (should have returned null)');
        return false;
    }
    
    console.log('🎉 All pathfinding tests passed!');
    return true;
}

// Test cooperative mode pathfinding
export function testCooperativePathfinding() {
    console.log('🧪 Testing cooperative mode pathfinding...');
    
    const pathfinding = new ServerPathfinding(20);
    
    // Cooperative mode spawn points and exit
    const spawnPoints = [
        { x: -8, z: -8 },  // Northwest
        { x: -8, z: 8 }    // Southwest
    ];
    const exitPoint = { x: 8, z: 0 };  // East center
    
    const obstacles = [
        { x: 0, z: -2 },
        { x: 0, z: -1 },
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 0, z: 2 }
    ];
    
    // Test paths from both spawn points
    for (let i = 0; i < spawnPoints.length; i++) {
        const path = pathfinding.findPath(spawnPoints[i], exitPoint, obstacles);
        
        if (path && path.length > 0) {
            console.log(`✅ Cooperative spawn ${i + 1} test passed:`, path.length, 'waypoints');
        } else {
            console.log(`❌ Cooperative spawn ${i + 1} test failed`);
            return false;
        }
    }
    
    console.log('🎉 Cooperative pathfinding tests passed!');
    return true;
} 