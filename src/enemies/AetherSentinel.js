import { Enemy } from './BaseEnemy.js';
import { getCachedImage } from '../utils.js';

export class AetherSentinel extends Enemy {
    constructor(game, x, y, level = 1) {
        // Stats: HP: 80, Speed: 60, Score: 250
        super(game, x, y, 48, 48, '#00ffff', 80, 60, 'sentinel', 250, level);
        this.displayName = `Lv.${level} エーテル・センチネル`;

        // Texture specifically for sentinel
        this.image = getCachedImage('assets/enemies/aether_sentinel.png');

        this.floatPhase = Math.random() * Math.PI * 2;
        this.shootTimer = 2.0 + Math.random() * 2.0;
        this.barrierTimer = 3.0 + Math.random() * 2.0;
        this.isBarrierActive = false;
        this.barrierDuration = 8.0;
        this.barrierActiveTimer = 0;

        const scaleFactor = 1 + (level - 1) * 0.05;
        this.projectileDamage = 15; // Fixed projectile damage

        this.targetDist = 250; // Ideal distance to maintain

        this.canDrop = true;
        this.actionInterval = 1.5;
        this.actionTimer = 1.0;

        // Animation properties
        this.walkTimer = 0;
        this.bounceAmount = 0.05; // Subtle bobbing
        this.bounceSpeed = 8;
    }

    update(dt) {
        if (this.isSpawning) {
            // Keep status and base entity movement during spawn (shadow logic uses spawnTimer)
            if (this.statusManager) this.statusManager.update(dt);
            this.superUpdate(dt);
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.isSpawning = false;
                this.spawnTimer = 0;
            }
            return;
        }

        // Safety check for player
        if (!this.game.player) {
            this.superUpdate(dt);
            return;
        }

        // 1. Move logic (Maintain distance with wavy float)
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const speedMult = this.statusManager ? this.statusManager.getSpeedMultiplier() : 1.0;
            const maxSpeed = this.speed * speedMult;

            // Tracking / Kiting
            let moveX = 0;
            let moveY = 0;

            if (dist > this.targetDist + 50) {
                moveX = dx / dist;
                moveY = dy / dist;
            } else if (dist < this.targetDist - 50 && dist > 0) {
                moveX = -dx / dist;
                moveY = -dy / dist;
            } else if (dist > 0) {
                moveX = -dy / dist * 0.5;
                moveY = dx / dist * 0.5;
            }

            this.vx += moveX * this.speed * 2 * dt;
            this.vy += moveY * this.speed * 2 * dt;

            // Caps and Friction
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > maxSpeed) {
                this.vx = (this.vx / currentSpeed) * maxSpeed;
                this.vy = (this.vy / currentSpeed) * maxSpeed;
            }
            this.vx *= 0.95;
            this.vy *= 0.95;

            // Safety: NaN guard
            if (isNaN(this.vx)) this.vx = 0;
            if (isNaN(this.vy)) this.vy = 0;

            // Update walk timer for bobbing
            if (currentSpeed > 5) {
                this.walkTimer += dt * this.bounceSpeed;
            }
        }

        // 2 & 3. Action Logic
        if (this.actionTimer > 0) {
            this.actionTimer -= dt;
        } else {
            if (this.isCharging) {
                this.chargeTimer -= dt;
                // Charge particles
                if (Math.random() < 0.4) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 30 + Math.random() * 20;
                    const px = this.x + this.width / 2 + Math.cos(angle) * r;
                    const py = this.y + this.height / 2 + Math.sin(angle) * r;
                    this.game.spawnParticles(px, py, 1, '#00ffff', -Math.cos(angle) * 150, -Math.sin(angle) * 150, { size: 2 });
                }

                if (this.chargeTimer <= 0) {
                    this.isCharging = false;
                    this.executeAttack();
                    this.actionTimer = this.actionInterval;
                }
            } else if (this.isBarrierActive) {
                this.barrierActiveTimer -= dt;
                if (this.barrierActiveTimer <= 0) {
                    this.isBarrierActive = false;
                    this.actionTimer = this.actionInterval;
                }
            } else {
                const r = Math.random();
                if (r < 0.4) {
                    this.startCharging(1.0);
                } else if (r < 0.7 && !this.isBarrierActive) {
                    this.activateBarrier();
                } else {
                    this.actionTimer = 0.5;
                }
            }
        }

        this.floatPhase += dt * 2.5;

        // Manual updates
        if (this.statusManager) this.statusManager.update(dt);
        if (this.flashTimer > 0) this.flashTimer -= dt;

        this.superUpdate(dt);
        this.checkPlayerCollision();
    }

    startCharging(duration) {
        this.isCharging = true;
        this.chargeTimer = duration;
    }

    activateBarrier() {
        this.isBarrierActive = true;
        this.barrierActiveTimer = this.barrierDuration;
        this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 15, '#00ffff');
    }

    executeAttack() {
        if (!this.game.player) return;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const angle = Math.atan2(this.game.player.y - cy, this.game.player.x - cx);
        const speed = 280;

        this.game.enemyProjectiles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            width: 20,
            height: 20,
            damage: this.projectileDamage,
            color: '#00ffff',
            life: 5.0,
            rotation: 0,
            update: function (dt, game) {
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                this.life -= dt;
                this.rotation += dt * 5;
                if (game.player && Math.hypot(game.player.x - this.x, game.player.y - this.y) < 18) {
                    game.player.takeDamage(this.damage);
                    this.life = 0;
                }
            },
            draw: function (ctx) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);

                // Outer glow
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
                grad.addColorStop(0, 'white');
                grad.addColorStop(0.4, '#00ffff');
                grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();

                // Star shape for core
                ctx.fillStyle = 'white';
                for (let i = 0; i < 4; i++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.fillRect(-8, -1, 16, 2);
                }
                ctx.restore();
            }
        });
    }

    takeDamage(amount, color, aether, crit, kx, ky, kd, silent, source) {
        if (this.isBarrierActive) {
            amount *= 0.15; // Enhanced barrier
            this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 4, '#00ffff', (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
        }
        return super.takeDamage(amount, color, aether, crit, kx, ky, kd, silent, source);
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        // --- 1. Shadow (Base logic restored) ---
        let spawnProgress = this.isSpawning ? (1 - (this.spawnTimer / (this.spawnDuration || 0.67))) : 1.0;
        spawnProgress = Math.max(0, Math.min(1.0, spawnProgress));

        ctx.save();
        ctx.translate(interpX + this.width / 2, interpY + this.height);
        ctx.scale(1, 0.5);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * spawnProgress})`;
        ctx.beginPath();
        const shadowRadius = (this.width / 2) * (this.isSpawning ? (0.5 + 0.5 * spawnProgress) : 1);
        ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- 2. Main Body ---
        ctx.save();
        const cx = interpX + this.width / 2;
        const cy = interpY + this.height / 2;
        const floatY = Math.sin(this.floatPhase) * 6;

        ctx.translate(cx, cy + floatY);

        // Squash/Stretch (Restored and enhanced)
        const squash = Math.sin(this.walkTimer) * this.bounceAmount;
        let scaleX = 1 + squash;
        let scaleY = 1 - squash;

        if (this.isSpawning) {
            const s = 0.2 + 0.8 * spawnProgress;
            scaleX *= s;
            scaleY *= s;
            ctx.globalAlpha = spawnProgress;
        }

        ctx.scale(scaleX, scaleY);
        const rotation = Math.sin(this.floatPhase * 0.4) * 0.15;
        ctx.rotate(rotation);

        if (this.image.complete && this.image.naturalWidth !== 0) {
            if (this.flashTimer > 0) {
                ctx.filter = 'brightness(0) invert(1)';
            }
            ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.restore();

        // --- 3. Barrier (Upgraded visuals) ---
        if (this.isBarrierActive) {
            ctx.save();
            ctx.translate(cx, cy + floatY);
            const pulse = 1.0 + Math.sin(Date.now() / 150) * 0.08;

            const grad = ctx.createRadialGradient(0, 0, 35 * pulse, 0, 0, 45 * pulse);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
            grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.4)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, 45 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, 40 * pulse, Date.now() / 500, Date.now() / 500 + Math.PI * 1.5);
            ctx.stroke();
            ctx.restore();
        }

        // --- 4. Charge Effect (Upgraded) ---
        if (this.isCharging) {
            ctx.save();
            ctx.translate(cx, cy + floatY);
            const prog = 1.0 - (this.chargeTimer / 1.0);

            ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + prog * 0.6})`;
            ctx.lineWidth = 2 + prog * 4;
            ctx.beginPath();
            ctx.arc(0, 0, 50 * (1 - prog), 0, Math.PI * 2);
            ctx.stroke();

            // Core glow
            if (prog > 0.5) {
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 * prog);
                glow.addColorStop(0, 'white');
                glow.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(0, 0, 20 * prog, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // HP Bar and Status
        if (this.hp < this.maxHp) {
            const barY = interpY + floatY - 12;
            ctx.fillStyle = 'red';
            ctx.fillRect(interpX, barY, this.width, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(interpX, barY, this.width * (this.hp / this.maxHp), 4);

            // Name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.displayName, interpX + this.width / 2, barY - 5);
            ctx.shadowBlur = 0;
        }

        this.drawStatusIcons(ctx);
    }
}
