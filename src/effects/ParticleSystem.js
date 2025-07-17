import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 100;
    }

    /**
     * Create an explosion effect at the specified position
     * @param {THREE.Vector3} position - Explosion position
     * @param {number} intensity - Explosion intensity (0-1)
     * @param {THREE.Color} color - Explosion color
     */
    createExplosion(position, intensity = 1.0, color = new THREE.Color(0xff6600)) {
        const particleCount = Math.floor(intensity * 20);
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = this.createExplosionParticle(position, color, intensity);
            particles.push(particle);
            this.scene.add(particle.mesh);
        }

        // Animate particles
        this.animateExplosion(particles);
    }

    /**
     * Create a single explosion particle
     */
    createExplosionParticle(position, color, intensity) {
        const geometry = new THREE.SphereGeometry(0.02 * intensity, 6, 4);
        const material = new THREE.MeshBasicMaterial({
            color: color.clone(),
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10 * intensity,
            Math.random() * 8 * intensity,
            (Math.random() - 0.5) * 10 * intensity
        );

        return {
            mesh,
            velocity,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02
        };
    }

    /**
     * Animate explosion particles
     */
    animateExplosion(particles) {
        const animate = () => {
            let activeParticles = 0;

            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                
                if (particle.life <= 0) {
                    this.scene.remove(particle.mesh);
                    particle.mesh.geometry.dispose();
                    particle.mesh.material.dispose();
                    particles.splice(i, 1);
                    continue;
                }

                // Update position
                particle.mesh.position.add(particle.velocity.clone().multiplyScalar(0.016));
                
                // Apply gravity
                particle.velocity.y -= 9.8 * 0.016;
                
                // Update life and opacity
                particle.life -= particle.decay;
                particle.mesh.material.opacity = particle.life * 0.8;
                
                // Scale down over time
                const scale = particle.life;
                particle.mesh.scale.set(scale, scale, scale);
                
                activeParticles++;
            }

            if (activeParticles > 0) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    /**
     * Create impact spark effect
     * @param {THREE.Vector3} position - Impact position
     * @param {THREE.Vector3} direction - Impact direction
     * @param {string} projectileType - Type of projectile for different effects
     */
    createImpactSparks(position, direction, projectileType = 'bullet') {
        const sparkCount = this.getSparksCount(projectileType);
        const sparks = [];

        for (let i = 0; i < sparkCount; i++) {
            const spark = this.createSpark(position, direction, projectileType);
            sparks.push(spark);
            this.scene.add(spark.mesh);
        }

        this.animateSparks(sparks);
    }

    /**
     * Get number of sparks based on projectile type
     */
    getSparksCount(projectileType) {
        switch (projectileType) {
            case 'bullet': return 5;
            case 'arrow': return 3;
            case 'cannonball': return 12;
            case 'boulder': return 15;
            default: return 5;
        }
    }

    /**
     * Create a single spark particle
     */
    createSpark(position, direction, projectileType) {
        const geometry = new THREE.SphereGeometry(0.01, 4, 3);
        const color = this.getSparkColor(projectileType);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        // Velocity based on impact direction with some randomness
        const velocity = new THREE.Vector3(
            direction.x + (Math.random() - 0.5) * 2,
            Math.abs(direction.y) + Math.random() * 3,
            direction.z + (Math.random() - 0.5) * 2
        );
        velocity.multiplyScalar(5);

        return {
            mesh,
            velocity,
            life: 0.5 + Math.random() * 0.3,
            decay: 0.05 + Math.random() * 0.03
        };
    }

    /**
     * Get spark color based on projectile type
     */
    getSparkColor(projectileType) {
        switch (projectileType) {
            case 'bullet': return new THREE.Color(0xffff00); // Yellow
            case 'arrow': return new THREE.Color(0xffffff); // White
            case 'cannonball': return new THREE.Color(0xff4400); // Orange
            case 'boulder': return new THREE.Color(0x996633); // Brown
            default: return new THREE.Color(0xffff00);
        }
    }

    /**
     * Animate spark particles
     */
    animateSparks(sparks) {
        const animate = () => {
            let activeSparks = 0;

            for (let i = sparks.length - 1; i >= 0; i--) {
                const spark = sparks[i];
                
                if (spark.life <= 0) {
                    this.scene.remove(spark.mesh);
                    spark.mesh.geometry.dispose();
                    spark.mesh.material.dispose();
                    sparks.splice(i, 1);
                    continue;
                }

                // Update position
                spark.mesh.position.add(spark.velocity.clone().multiplyScalar(0.016));
                
                // Apply gravity and air resistance
                spark.velocity.y -= 9.8 * 0.016;
                spark.velocity.multiplyScalar(0.98); // Air resistance
                
                // Update life and opacity
                spark.life -= spark.decay;
                spark.mesh.material.opacity = spark.life;
                
                activeSparks++;
            }

            if (activeSparks > 0) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    /**
     * Create muzzle flash effect
     * @param {THREE.Vector3} position - Muzzle position
     * @param {THREE.Vector3} direction - Firing direction
     * @param {string} weaponType - Type of weapon
     */
    createMuzzleFlash(position, direction, weaponType = 'turret') {
        const flash = this.createFlashMesh(position, direction, weaponType);
        this.scene.add(flash);

        // Animate flash
        let life = 1.0;
        const animate = () => {
            life -= 0.1;
            flash.material.opacity = life;
            flash.scale.multiplyScalar(1.1);

            if (life > 0) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }
        };

        animate();
    }

    /**
     * Create muzzle flash mesh
     */
    createFlashMesh(position, direction, weaponType) {
        const size = this.getFlashSize(weaponType);
        const geometry = new THREE.PlaneGeometry(size, size * 0.5);
        const color = this.getFlashColor(weaponType);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Orient flash towards firing direction
        mesh.lookAt(position.clone().add(direction));
        
        return mesh;
    }

    /**
     * Get flash size based on weapon type
     */
    getFlashSize(weaponType) {
        switch (weaponType) {
            case 'turret': return 0.3;
            case 'ballista': return 0.2;
            case 'cannon': return 0.6;
            case 'catapult': return 0.4;
            default: return 0.3;
        }
    }

    /**
     * Get flash color based on weapon type
     */
    getFlashColor(weaponType) {
        switch (weaponType) {
            case 'turret': return new THREE.Color(0xffff00);
            case 'ballista': return new THREE.Color(0xffffff);
            case 'cannon': return new THREE.Color(0xff6600);
            case 'catapult': return new THREE.Color(0xff4400);
            default: return new THREE.Color(0xffff00);
        }
    }

    /**
     * Create death effect for enemies
     * @param {THREE.Vector3} position - Death position
     * @param {number} enemySize - Size of the enemy for scaling effect
     */
    createDeathEffect(position, enemySize = 1.0) {
        // Create explosion
        this.createExplosion(position, enemySize, new THREE.Color(0xff3300));
        
        // Create energy dispersal effect
        const energyParticles = [];
        const particleCount = Math.floor(enemySize * 8);

        for (let i = 0; i < particleCount; i++) {
            const particle = this.createEnergyParticle(position, enemySize);
            energyParticles.push(particle);
            this.scene.add(particle.mesh);
        }

        this.animateEnergyParticles(energyParticles);
    }

    /**
     * Create energy particle for death effect
     */
    createEnergyParticle(position, scale) {
        const geometry = new THREE.SphereGeometry(0.02 * scale, 4, 3);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random() * 0.3, 0.8, 0.6), // Random blue-green
            transparent: true,
            opacity: 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        // Upward spiral motion
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 2;
        
        return {
            mesh,
            angle,
            radius,
            speed: 1 + Math.random() * 2,
            life: 1.0,
            decay: 0.015 + Math.random() * 0.01
        };
    }

    /**
     * Animate energy particles with spiral motion
     */
    animateEnergyParticles(particles) {
        const animate = () => {
            let activeParticles = 0;

            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                
                if (particle.life <= 0) {
                    this.scene.remove(particle.mesh);
                    particle.mesh.geometry.dispose();
                    particle.mesh.material.dispose();
                    particles.splice(i, 1);
                    continue;
                }

                // Spiral upward motion
                particle.angle += particle.speed * 0.016;
                particle.mesh.position.y += particle.speed * 0.016 * 2;
                particle.mesh.position.x = particle.mesh.position.x + Math.cos(particle.angle) * particle.radius * 0.016;
                particle.mesh.position.z = particle.mesh.position.z + Math.sin(particle.angle) * particle.radius * 0.016;
                
                // Update life and opacity
                particle.life -= particle.decay;
                particle.mesh.material.opacity = particle.life * 0.9;
                
                activeParticles++;
            }

            if (activeParticles > 0) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    /**
     * Clean up all particles
     */
    cleanup() {
        for (const particle of this.particles) {
            this.scene.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        }
        this.particles = [];
    }
}

// Export singleton instance
export const particleSystem = new ParticleSystem(); 