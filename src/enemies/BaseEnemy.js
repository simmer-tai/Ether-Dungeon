import { Entity, getCachedImage } from '../utils.js';
import { StatusManager } from '../status_effects.js';
import { DropItem } from '../entities/DropItem.js';

const textures = {
    slime: 'assets/slime.png',
    bat: 'assets/bat.png',
    goblin: 'assets/goblin.png',
    skeleton_archer: 'assets/skeleton_archer.png'
};

const statusIcons = {
    bleed: getCachedImage('assets/icon_bleed.png'),
    slow: getCachedImage('assets/icon_ice.png'),
    burn: getCachedImage('assets/icon_burn.png'),
    wet: getCachedImage('assets/icon_wet.png')
};

export class Enemy extends Entity {
    constructor(game, x, y, width, height, color, hp, speed, textureKey) {
        super(game, x, y, width, height, color, hp);
        this.speed = speed;
        this.damage = 10; // Default contact damage
        this.flashTimer = 0; // Initialize flash timer
        this.image = textures[textureKey] ? getCachedImage(textures[textureKey]) : new Image();
        this.statusManager = new StatusManager(this);

        // Procedural Animation
        this.walkTimer = Math.random() * Math.PI * 2;
        this.bounceSpeed = 8 + Math.random() * 4;
        this.bounceAmount = 0.05 + Math.random() * 0.05;

        // Telegraph System
        this.telegraphTimer = 0;
        this.isTelegraphing = false;
        this.telegraphDuration = 1.0;

        // Spawn System
        this.isSpawning = true;
        this.spawnTimer = 0.67;
        this.spawnDuration = 0.67;
    }

    update(dt) {
        // Handle Spawning state
        if (this.isSpawning) {
            this.spawnTimer -= dt;
            this.vx = 0;
            this.vy = 0;

            // Enhanced smoke/shadow particles
            if (Math.random() < 0.7) { // Increased density (0.2 -> 0.7)
                this.game.animations.push({
                    type: 'particle',
                    x: this.x + this.width / 2 + (Math.random() - 0.5) * this.width,
                    y: this.y + this.height + (Math.random() - 0.5) * 10,
                    w: 15 + Math.random() * 25, // Slightly larger
                    h: 15 + Math.random() * 25,
                    life: 0.8 + Math.random() * 0.4, // Longer life for smoke
                    maxLife: 1.2,
                    color: 'rgba(60, 60, 60, 0.4)', // Slightly lighter grey
                    vx: (Math.random() - 0.5) * 40,
                    vy: -20 - Math.random() * 40, // Upward drift
                    update: function (pdt) {
                        this.life -= pdt;
                        this.x += this.vx * pdt;
                        this.y += this.vy * pdt;
                        this.w += 15 * pdt; // Expand more
                        this.h += 15 * pdt;
                        this.vx *= 0.98; // Friction
                    },
                    draw: function (ctx) {
                        ctx.save();
                        const alpha = (this.life / this.maxLife);
                        ctx.globalAlpha = alpha * 0.4;
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.w / 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                });
            }

            if (this.spawnTimer <= 0) {
                this.isSpawning = false;

                // Final "Puff" of smoke
                for (let i = 0; i < 15; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 20 + Math.random() * 60;
                    this.game.animations.push({
                        type: 'particle',
                        x: this.x + this.width / 2,
                        y: this.y + this.height * 0.7,
                        w: 20 + Math.random() * 20,
                        h: 20 + Math.random() * 20,
                        life: 0.6 + Math.random() * 0.4,
                        maxLife: 1.0,
                        color: 'rgba(80, 80, 80, 0.5)',
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 20,
                        update: function (pdt) {
                            this.life -= pdt;
                            this.x += this.vx * pdt;
                            this.y += this.vy * pdt;
                            this.w += 20 * pdt;
                            this.h += 20 * pdt;
                        },
                        draw: function (ctx) {
                            ctx.save();
                            ctx.globalAlpha = (this.life / this.maxLife) * 0.3;
                            ctx.fillStyle = this.color;
                            ctx.beginPath();
                            ctx.arc(this.x, this.y, this.w / 2, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        }
                    });
                }

                // Small ground ring
                this.game.animations.push({
                    type: 'ring',
                    x: this.x + this.width / 2,
                    y: this.y + this.height, // Ground level
                    radius: 5,
                    maxRadius: this.width * 1.5,
                    width: 20,
                    life: 0.3,
                    maxLife: 0.3,
                    color: 'rgba(255, 255, 255, 0.3)'
                });
            }
            this.statusManager.update(dt);
            super.update(dt); // Basic Entity movement (collision etc)
            return;
        }

        // Decrease flash timer
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.vx = 0;
            this.vy = 0;
        }

        // Handle Telegraphing independently of flashTimer
        if (this.isTelegraphing) {
            this.telegraphTimer -= dt;
            this.vx = 0;
            this.vy = 0;
            if (this.telegraphTimer <= 0) {
                this.isTelegraphing = false;
                this.executeAttack();
            }
        } else if (this.flashTimer <= 0) {
            // Only move if not flashing and not telegraphing
            if (this.game.player) {
                const dx = this.game.player.x - this.x;
                const dy = this.game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    const speedMult = this.statusManager.getSpeedMultiplier();
                    // Basic tracking force
                    const acc = this.speed * 5;
                    this.vx += (dx / dist) * acc * dt;
                    this.vy += (dy / dist) * acc * dt;
                }

                // --- Soft Separation AI (Avoid overlapping) ---
                const separationDist = this.width * 0.8;
                const separationForce = 150;
                for (let other of this.game.entities) {
                    if (other !== this && other instanceof Enemy) { // Corrected check
                        const odx = other.x - this.x;
                        const ody = other.y - this.y;
                        const odist = Math.sqrt(odx * odx + ody * ody);
                        if (odist < separationDist && odist > 0) {
                            this.vx -= (odx / odist) * separationForce * dt;
                            this.vy -= (ody / odist) * separationForce * dt;
                        }
                    }
                }
            }
        }

        // Cap speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedMult = this.statusManager.getSpeedMultiplier();
        const maxSpeed = this.speed * speedMult;

        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // Drag/Friction to prevent skating
        this.vx *= 0.95;
        this.vy *= 0.95;

        // Update walk timer for bobbing effect (scale by speed)
        if (speed > 10) {
            this.walkTimer += dt * this.bounceSpeed * (speed / this.speed);
        }

        this.statusManager.update(dt);
        super.update(dt);
        this.checkPlayerCollision();
    }

    executeAttack() {
        // Abstract
    }

    startTelegraph(duration) {
        this.isTelegraphing = true;
        this.telegraphTimer = duration;
        this.telegraphDuration = duration;
    }

    checkPlayerCollision() {
        if (this.damage > 0 && // Only if damage is positive
            this.x < this.game.player.x + this.game.player.width &&
            this.x + this.width > this.game.player.x &&
            this.y < this.game.player.y + this.game.player.height &&
            this.y + this.height > this.game.player.y) {
            this.game.player.takeDamage(this.damage);
        }
    }

    takeDamage(amount, damageColor, aetherGain = 1, isCrit = false) {
        if (this.isSpawning) return; // Invulnerable while spawning

        // Flash white on hit
        this.flashTimer = 0.1;

        // Aether Rush Gain
        if (this.game.player) {
            this.game.player.addAether(aetherGain);

            // Blood Altar: Vampirism blessing check
            if (this.game.player.bloodBlessings) {
                const vamp = this.game.player.bloodBlessings.find(b => b.buff && b.buff.vampRate);
                if (vamp && Math.random() < vamp.buff.vampRate) {
                    this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + 1);
                }
            }
        }

        // Camera Shake on hit
        if (this.game.camera) {
            this.game.camera.shake(0.05, 1.5);
        }

        // Apply Status Effects Damage Multiplier
        let multiplier = this.statusManager.getDamageMultiplier();
        amount = Math.ceil(amount * multiplier);

        // No invulnerability check for enemies so they can take rapid damage
        this.hp -= amount;

        // Spawn Damage Text (larger for crits)
        this.game.animations.push({
            type: 'text',
            text: isCrit ? `${amount}!` : amount,
            x: this.x + this.width / 2,
            y: this.y,
            vx: (Math.random() - 0.5) * 50,
            vy: isCrit ? -130 : -100,
            life: isCrit ? 1.0 : 0.8,
            maxLife: isCrit ? 1.0 : 0.8,
            color: damageColor || '#fff',
            font: isCrit ? "bold 18px 'Press Start 2P', monospace" : "14px 'Press Start 2P', monospace"
        });

        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            this.game.spawnDeathEffect(this);

            // Spawn Currency Drops
            const dropCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 shards
            for (let i = 0; i < dropCount; i++) {
                const drop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, 1);
                this.game.entities.push(drop);
            }
        }
    }

    draw(ctx) {
        if (this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();

            // Draw Spawn Shadow/Shadow Puddle
            const spawnProgress = this.isSpawning ? (1 - (this.spawnTimer / this.spawnDuration)) : 1.0;
            const shadowAlpha = 0.3 * spawnProgress;
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height);
            ctx.scale(1, 0.5); // Oval
            ctx.fillStyle = 'rgba(0, 0, 0, ' + shadowAlpha + ')';
            ctx.beginPath();
            const shadowRadius = (this.width / 2) * (this.isSpawning ? (0.5 + 0.5 * spawnProgress) : 1);
            ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Squash and Stretch Logic
            const squash = Math.sin(this.walkTimer) * this.bounceAmount;
            let scaleX = 1 + squash;
            let scaleY = 1 - squash;

            // Apply Spawning scale and alpha
            if (this.isSpawning) {
                const s = 0.2 + 0.8 * spawnProgress;
                scaleX *= s;
                scaleY *= s;
                ctx.globalAlpha = spawnProgress;
            }

            ctx.translate(this.x + this.width / 2, this.y + this.height); // Center bottom
            ctx.scale(scaleX, scaleY);

            if (this.flashTimer > 0) {
                // Apply white flash filter
                ctx.filter = 'brightness(0) invert(1)';
            }

            // Draw relative to translated origin (center bottom)
            ctx.drawImage(this.image, -this.width / 2, -this.height, this.width, this.height);
            ctx.restore();
        } else {
            super.draw(ctx);
        }

        // Draw Telegraph Indicator
        if (this.isTelegraphing) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 40, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Fill inner progress
            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);
            const radius = Math.max(0, 40 * progress);
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fill();
            ctx.restore();
        }

        // Draw HP Bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'red';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y - 6), this.width, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y - 6), this.width * (this.hp / this.maxHp), 4);
        }

        this.drawStatusIcons(ctx);
    }

    drawStatusIcons(ctx) {
        const activeEffects = this.statusManager.getActiveEffects();
        if (activeEffects.length > 0) {
            const iconSize = 16;
            const spacing = 4;
            const startY = this.y - 25; // Above HP bar
            let currentX = this.x;

            activeEffects.forEach(effect => {
                const icon = statusIcons[effect.type];
                if (icon && icon.complete && icon.naturalWidth !== 0) {
                    ctx.drawImage(icon, Math.floor(currentX), Math.floor(startY), iconSize, iconSize);

                    // Draw Stack Count
                    if (effect.stacks > 1) {
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 10px sans-serif';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 2;
                        ctx.strokeText(effect.stacks, currentX + iconSize - 4, startY + iconSize);
                        ctx.fillText(effect.stacks, currentX + iconSize - 4, startY + iconSize);
                    }

                    currentX += iconSize + spacing + (effect.stacks > 1 ? 8 : 0);
                }
            });
        }
    }
}
