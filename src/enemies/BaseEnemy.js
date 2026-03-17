import { Entity, getCachedImage } from '../utils.js';
import { StatusManager, STATUS_TYPES, statusIcons } from '../status_effects.js';
import { spawnProjectile } from '../skills/index.js';
import { DropItem } from '../entities/DropItem.js';
import { AetherLabManager } from '../AetherLabManager.js';
import { Chest } from '../entities/Chest.js';
import { CONFIG } from '../config.js';

const textures = {
    slime: 'assets/enemies/slime.png',
    bat: 'assets/enemies/bat.png',
    goblin: 'assets/enemies/goblin.png',
    skeleton_archer: 'assets/enemies/skeleton_archer.png',
    ghost: 'assets/enemies/ghost.png',
    dummy: 'assets/enemies/slime.png'
};

// Status icons mapping (moved to status_effects.js to avoid circular dependency)

export class Enemy extends Entity {
    constructor(game, x, y, width, height, color, baseHp, speed, textureKey, baseScoreValue = 0, level = 1) {
        // Level scaling: Each level increases stats by 10%
        const scaleFactor = 1 + (level - 1) * 0.05;

        const finalHp = Math.round(baseHp * scaleFactor);
        super(game, x, y, width, height, color, finalHp);

        this.level = level;

        this.speed = speed;
        this.scoreValue = Math.round(baseScoreValue * scaleFactor);
        this.damage = 10; // Fixed default contact damage
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
        this.telegraphDuration = CONFIG.ENEMY.TELEGRAPH_DURATION;

        // Spawn System
        this.isSpawning = true;
        this.spawnTimer = CONFIG.ENEMY.SPAWN_DURATION;
        this.spawnDuration = CONFIG.ENEMY.SPAWN_DURATION;

        this.displayName = `Lv.${level} Enemy`;
        this.canDrop = true; // Flag to enable/disable item/chip drops
        
        // Defense System (Armor): Scales with level and HP. 
        // Based on Warframe formula (300 constant), so we give slightly higher values for impact.
        this.defense = Math.floor((level * 10) + (finalHp / 25));
    }

    update(dt) {
        if (this.isDemo) {
            if (this.isSpawning) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.isSpawning = false;
                    this.spawnTimer = 0;
                }
            }
            this.frameTimer += dt;
            if (this.frameTimer > (this.frameInterval || 0.1)) {
                this.frameX++;
                if (this.frameX >= (this.maxFrames || 4)) this.frameX = 0;
                this.frameTimer = 0;
            }
            return;
        }
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
        } else {
            // Only move if not telegraphing
            if (this.game.player) {
                const dx = this.game.player.x - this.x;
                const dy = this.game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0) {
                    const speedMult = this.statusManager.getSpeedMultiplier();
                    // Basic tracking force - Reduced while knocked back
                    let acc = this.speed * 5;
                    if (this.knockbackDuration > 0) {
                        acc *= 0.2; // 80% reduction during impact
                    }
                    this.vx += (dx / dist) * acc * dt;
                    this.vy += (dy / dist) * acc * dt;
                }

                // --- Soft Separation AI (Avoid overlapping) ---
                const separationDist = this.width * 0.8;
                const separationForce = CONFIG.ENEMY.SEPARATION_FORCE;
                if (this.game.enemies) {
                    for (const other of this.game.enemies) {
                        if (other !== this && other instanceof Enemy) {
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

        // --- Status Visual Effects (Particles) ---
        if (this.game && this.game.spawnParticles) {
            // FIRE (Burn) Effect: occasional orange/red particles
            if (this.statusManager.effects.has(STATUS_TYPES.BURN)) {
                if (Math.random() < 0.25) {
                    const px = this.x + Math.random() * this.width;
                    const py = this.y + Math.random() * this.height;
                    this.game.spawnParticles(px, py, 1, '#ff6600', 0, -30);
                }
            }
            // SHOCK Effect: small yellow sparks (using actual lightning assets)
            if (this.statusManager.effects.has(STATUS_TYPES.SHOCK)) {
                if (Math.random() < 0.1) {
                    const px = this.x + Math.random() * this.width;
                    const py = this.y + Math.random() * this.height;
                    const partId = Math.floor(Math.random() * 10) + 1;
                    const partStr = partId < 10 ? `0${partId}` : `${partId}`;
                    
                    spawnProjectile(this.game, px, py, 0, 0, {
                        visual: true,
                        spriteSheet: `assets/skills/vfx/lightning_part_${partStr}.png`,
                        frames: 1,
                        life: 0.15 + Math.random() * 0.1,
                        width: 24 + Math.random() * 24,
                        height: 24 + Math.random() * 24,
                        rotation: Math.random() * Math.PI * 2,
                        color: '#ffff00',
                        filter: 'sepia(1) saturate(10) hue-rotate(0deg) brightness(1.2)',
                        blendMode: 'lighter'
                    });
                }
            }
        }

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
        if (this.damage <= 0) return;

        // Use a hit-box slightly smaller than the visual width/height (15% padding)
        const padX = this.width * 0.15;
        const padY = this.height * 0.15;

        if (this.x + padX < this.game.player.x + this.game.player.width &&
            this.x + this.width - padX > this.game.player.x &&
            this.y + padY < this.game.player.y + this.game.player.height &&
            this.y + this.height - padY > this.game.player.y) {
            this.game.player.takeDamage(this.damage);
        }
    }

    takeDamage(amount, color, aetherGain = 0, isCrit = false, kx = 0, ky = 0, stunDuration = 0, silent = false, source = null, ignoreDefense = 0) {
        if (this.markedForDeletion || this.isSpawning) return;

        // Gambler's Dice Randomization
        if (this.game.player && this.game.player.circuit) {
            const gamblerRange = this.game.player.circuit.getBonuses().damageRandomRange || 0;
            if (gamblerRange > 0) {
                const multiplier = 1 + (Math.random() * 2 - 1) * gamblerRange;
                amount *= multiplier;
            }
        }

        // Apply Defense Mitigation (unless ignored)
        if (this.defense > 0 && ignoreDefense < 1) {
            // Formula: damage = amount * (300 / (300 + effectiveArmor))
            // ignoreDefense is a fraction (e.g. 0.25 for 25% ignore)
            const effectiveDefense = this.defense * (1 - ignoreDefense);
            const multiplier = 300 / (300 + effectiveDefense);
            amount = Math.max(1, Math.round(amount * multiplier));
        }

        // Apply knockback if provided
        if (kx !== 0 || ky !== 0) {
            const resistance = this.knockbackResistance || 0;
            const factor = Math.max(0, 1 - resistance);
            this.knockbackVx = kx * factor;
            this.knockbackVy = ky * factor;
            this.knockbackDuration = stunDuration || 0.15;
            // Stop current momentum to feel the impact
            this.vx = 0;
            this.vy = 0;
        }

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
        let multiplier = this.statusManager ? this.statusManager.getDamageMultiplier(amount) : 1.0;
        amount = Math.round(amount * multiplier);

        // No invulnerability check for enemies so they can take rapid damage
        this.hp -= amount;

        // Handle Shock Chain Damage
        if (this.statusManager && this.statusManager.handleTakeDamage) {
            this.statusManager.handleTakeDamage(amount, silent);
        }

        // Spawn Damage Text (larger for crits)
        if (!silent) {
            const finalColor = isCrit ? '#ffff00' : '#ffffff';
            const anim = {
                type: 'text',
                isDamageText: true,
                text: amount,
                x: this.x + this.width / 2,
                y: this.y,
                vx: (Math.random() - 0.5) * 180, // Wide horizontal spread
                vy: isCrit ? -180 : -140, // Increased upward velocity
                life: isCrit ? 1.0 : 0.8,
                maxLife: isCrit ? 1.0 : 0.8,
                color: finalColor,
                font: isCrit ? "bold 18px 'Meiryo', 'Hiragino Kaku Gothic ProN', 'MS PGothic', sans-serif" : "14px 'Meiryo', 'Hiragino Kaku Gothic ProN', 'MS PGothic', sans-serif",
                icons: []
            };
            this.game.animations.push(anim);
            this.lastDamageAnim = anim;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            this.game.spawnDeathEffect(this);

            // Pandemic Spread
            if (this.statusManager.effects.has(STATUS_TYPES.PANDEMIC)) {
                // Spawn 4 homing spores to transmit the infection
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const speed = 200;
                    spawnProjectile(this.game, this.x + this.width / 2, this.y + this.height / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, {
                        visual: true,
                        color: '#BF40BF',
                        shape: 'circle',
                        width: 12,
                        height: 12,
                        damage: 0,
                        life: 2.0,
                        homing: true,
                        homingRange: 300,
                        homingStrength: 0.2,
                        statusEffect: STATUS_TYPES.PANDEMIC,
                        statusDuration: 5.0,
                        pierce: 1,
                        noTrail: false,
                        trailColor: 'rgba(191, 64, 191, 0.5)'
                    });
                }
            }

            // Notify Player of Kill (for Training Chip)
            if (this.game.player && this.game.player.onEnemyKill) {
                this.game.player.onEnemyKill();
            }

            // Add Score
            if (this.game.score !== undefined) {
                this.game.addScore(this.scoreValue);
            }

            if (this.isDemo || !this.canDrop) return; // No drops in demo or if disabled

            // Spawn Currency Drops (Aether Coins for Dungeon Shop)
            const scoreValue = this.scoreValue || 50;
            let dropCount = 1;
            let coinValue = 1;

            if (this.isBoss) {
                dropCount = 10 + Math.floor(Math.random() * 6); // 10-15
                coinValue = 50;
            } else if (scoreValue >= 200) { // Elite (Goblin)
                dropCount = 3 + Math.floor(Math.random() * 3); // 3-5
                coinValue = 5;
            } else if (scoreValue >= 100) { // Mid (Ghost, Archer)
                dropCount = 2 + Math.floor(Math.random() * 2); // 2-3
                coinValue = 2;
            } else { // Weak (Slime, Bat)
                dropCount = 1 + Math.floor(Math.random() * 2); // 1-2
                coinValue = 1;
            }

            for (let i = 0; i < dropCount; i++) {
                const drop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, coinValue, 'coins');
                this.game.entities.push(drop);
            }

            // --- Aether Chip Drop Logic ---
            if (this.isBoss) {
                // Boss always drops chips
                for (let i = 0; i < CONFIG.ENEMY.BOSS_CHIP_DROP_COUNT; i++) {
                    const chipInstance = AetherLabManager.getRandomChipByWeightedRarity();
                    if (chipInstance) {
                        const chipDrop = new DropItem(this.game, this.x + this.width / 2 + (Math.random() - 0.5) * 40, this.y + this.height / 2 + (Math.random() - 0.5) * 40, chipInstance, 'chip');
                        this.game.entities.push(chipDrop);
                    }
                }

                // Boss always spawns treasure chests
                for (let i = 0; i < CONFIG.ENEMY.BOSS_CHEST_DROP_COUNT; i++) {
                    const angle = (i / CONFIG.ENEMY.BOSS_CHEST_DROP_COUNT) * Math.PI * 2;
                    const dist = 60;
                    const rawCx = this.x + this.width / 2 + Math.cos(angle) * dist - 15;
                    const rawCy = this.y + this.height / 2 + Math.sin(angle) * dist - 15;
                    const { x: cx, y: cy } = Chest.getSafeSpawnPosition(this.game, rawCx, rawCy);
                    const chest = new Chest(this.game, cx, cy);
                    this.game.chests.push(chest);
                }
            } else if (Math.random() < CONFIG.ENEMY.CHIP_DROP_CHANCE) {
                // Normal enemies: custom chance for 1 chip
                const chipInstance = AetherLabManager.getRandomChipByWeightedRarity();
                if (chipInstance) {
                    const chipDrop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, chipInstance, 'chip');
                    this.game.entities.push(chipDrop);
                }
            }

            // --- Aether Shard/Fragment Drop Logic ---
            if (Math.random() < CONFIG.ENEMY.SHARD_DROP_CHANCE) {
                const scoreVal = this.game.scoreManager ? this.game.scoreManager.getScoreValue(this.type) : this.scoreValue;
                let shardCount = 1;

                if (scoreVal >= 500) { // Boss
                    shardCount = 5 + Math.floor(Math.random() * 6); // 5-10
                } else if (scoreVal >= 200) { // Elite
                    shardCount = 2 + Math.floor(Math.random() * 3); // 2-4
                } else if (scoreVal >= 100) { // Mid
                    shardCount = 1 + Math.floor(Math.random() * 3); // 1-3
                } else { // Weak
                    shardCount = Math.random() < 0.2 ? 2 : 1; // 1 (20% for 2)
                }

                for (let i = 0; i < shardCount; i++) {
                    const shardDrop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, 1, 'shards');
                    this.game.entities.push(shardDrop);
                }
            }

            if (Math.random() < CONFIG.ENEMY.FRAGMENT_DROP_CHANCE) {
                const fragmentDrop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, 1, 'fragments');
                this.game.entities.push(fragmentDrop);
            }

            // --- Grant Aether Resonance ---
            if (this.game && this.game.player) {
                let resonanceGain = 5; // Base amount
                if (this.isBoss) {
                    resonanceGain = 100 + (this.game.currentFloor * 20); // Boss bonus
                } else if (this.scoreValue >= 200) {
                    resonanceGain = 15; // Elite
                } else {
                    resonanceGain = 5 + Math.floor(Math.random() * 6); // Normal enemy 5-10
                }
                
                // Scale with floor
                resonanceGain += Math.floor(this.game.currentFloor * 1.5);
            this.game.player.aetherResonance += resonanceGain;
            }
        }
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        if (this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();

            // Draw Spawn Shadow/Shadow Puddle
            let spawnProgress = this.isSpawning ? (1 - (this.spawnTimer / this.spawnDuration)) : 1.0;
            spawnProgress = Math.max(0, Math.min(1.0, spawnProgress));
            const shadowAlpha = 0.3 * spawnProgress;
            ctx.save();
            ctx.translate(interpX + this.width / 2, interpY + this.height);
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

            ctx.translate(interpX + this.width / 2, interpY + this.height); // Center bottom
            ctx.scale(scaleX, scaleY);

            if (this.flashTimer > 0) {
                // Apply white flash filter
                ctx.filter = 'brightness(0) invert(1)';
            } else if (this.statusManager.effects.has(STATUS_TYPES.PANDEMIC)) {
                // Vibrant purple for Pandemic
                ctx.filter = 'sepia(1) hue-rotate(250deg) saturate(5) brightness(0.8) contrast(1.2)';
            } else if (this.statusManager.effects.has(STATUS_TYPES.POISON)) {
                // Dim green filter for Poison
                ctx.filter = 'sepia(1) hue-rotate(85deg) saturate(3) brightness(0.6)';
            }

            // Draw relative to translated origin (center bottom)
            ctx.drawImage(this.image, -this.width / 2, -this.height, this.width, this.height);
            ctx.restore();
        } else {
            super.draw(ctx, alpha);
        }

        // Draw Telegraph Indicator
        if (this.isTelegraphing) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(interpX + this.width / 2, interpY + this.height / 2, 40, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Fill inner progress
            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);
            const radius = Math.max(0, 40 * progress);
            ctx.beginPath();
            ctx.arc(interpX + this.width / 2, interpY + this.height / 2, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fill();
            ctx.restore();
        }

        // Draw HP Bar
        if (this.hp < this.maxHp) {
            const barY = Math.floor(this.y - 6);
            const barWidth = this.width;
            const barHeight = 4;

            // Draw cyan decoration if the enemy has defense
            if (this.defense > 0) {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(Math.floor(this.x) - 1, barY - 1, barWidth + 2, barHeight + 2);
            }

            ctx.fillStyle = 'red';
            ctx.fillRect(Math.floor(this.x), barY, barWidth, barHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(Math.floor(this.x), barY, barWidth * (this.hp / this.maxHp), barHeight);

            // Draw Name above HP bar
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.displayName, this.x + this.width / 2, barY - 4);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'start'; // Reset
        }

        this.drawStatusIcons(ctx);
    }

    drawStatusIcons(ctx) {
        const activeEffects = this.statusManager.getActiveEffects();
        if (activeEffects.length > 0) {
            const iconSize = 16;
            const spacing = 8;
            const startY = this.y - 40; // Positioned clearly above the name and HP bar
            let currentX = this.x + (this.width - (activeEffects.length * iconSize + (activeEffects.length - 1) * spacing)) / 2;

            for (const effect of activeEffects) {
                const icon = statusIcons[effect.type];

                if (icon && icon.complete && icon.naturalWidth !== 0) {
                    ctx.save();
                    
                    // Silhouette Filter (White)
                    ctx.filter = 'grayscale(1) brightness(2)';
                    ctx.drawImage(icon, Math.floor(currentX), Math.floor(startY), iconSize, iconSize);
                    ctx.restore();

                    // Stack Count
                    if (effect.stacks > 1) {
                        ctx.save();
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 10px sans-serif';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 2;
                        ctx.strokeText(effect.stacks, currentX + iconSize - 4, startY + iconSize);
                        ctx.fillText(effect.stacks, currentX + iconSize - 4, startY + iconSize);
                        ctx.restore();
                    }

                    currentX += iconSize + spacing;
                }
            }
        }
    }
}

export class TrainingDummy extends Enemy {
    constructor(game, x, y) {
        super(game, x, y, 36, 36, '#888888', 99999999, 0, 'dummy', 0, 1);
        this.displayName = "訓練用カカシ";
        this.canDrop = false;
        this.isDummy = true;
        this.isSpawning = false; // Appear immediately
        this.isSolid = true;
        this.knockbackResistance = 1.0; // 100% resistance
        this.defense = 0; // Training dummy has no armor
    }

    update(dt) {
        // Dummy doesn't follow player or move
        this.statusManager.update(dt);
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Force reset any movement/knockback
        this.vx = 0;
        this.vy = 0;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDuration = 0;
        
        // Safety: ensure it's never deleted
        this.markedForDeletion = false;
        if (this.hp < 99999999) this.hp = 99999999;
        
        // Minimal bobbing for visual feedback
        this.walkTimer += dt * 2;
    }

    takeDamage(amount, color, aether, crit, kx, ky, kd, silent, source) {
        // Call super for damage text, but ensure it never hits 0 HP
        this.hp = 99999999;
        // Force kx, ky to 0 to prevent any slight movement
        super.takeDamage(amount, color, 0, crit, 0, 0, 0, silent, source);
        
        // Reset state immediately
        this.hp = 99999999;
        this.markedForDeletion = false;
    }

    draw(ctx, alpha = 1) {
        ctx.save();
        // Add a gray/metallic filter to distinguish from a normal slime
        ctx.filter = 'grayscale(1) brightness(0.8)';
        super.draw(ctx, alpha);
        ctx.restore();
    }
}
