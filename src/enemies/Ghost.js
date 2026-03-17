import { Enemy } from './BaseEnemy.js';
import { STATUS_TYPES } from '../status_effects.js';
import { getCachedJson } from '../utils.js';

export class Ghost extends Enemy {
    constructor(game, x, y, level = 1) {
        // Ghost: lower health than goblin, spectral appearance, reduced speed (120 -> 84)
        super(game, x, y, 40, 48, 'rgba(150, 200, 255, 0.5)', 20, 84, 'ghost', 150, level);
        this.displayName = `Lv.${level} ゴースト`;
        this.ignoreWalls = true;
        this.damage = Math.round(8 * (1 + (level - 1) * 0.05));
        this.knockbackResistance = -0.5; // 50% more knockback

        // Sprite Sheet Data
        this.animTimer = 0;
        this.frames = [];
        this.spriteData = null;

        getCachedJson('assets/enemies/ghost.json').then(data => {
            if (data && data.frames) {
                this.spriteData = data;
                // Sort keys to ensure consistent animation sequence
                this.frames = Object.keys(data.frames).sort();
            }
        });

        // Custom animation properties
        this.floatPhase = Math.random() * Math.PI * 2;
    }

    update(dt) {
        if (this.isSpawning) {
            this.floatPhase += dt * 3;
            // Spawning logic (rings, etc.) is handled in BaseEnemy's update(dt) if we call super.update(dt)
            // But we need to call super.update(dt) only when NOT spawning?
            // Actually, BaseEnemy.js handles isSpawning at the start of its update.
        }

        if (this.game.player && !this.isSpawning && !this.isTelegraphing) {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                const speedMult = this.statusManager.getSpeedMultiplier();
                const maxSpeed = this.speed * speedMult;

                // 1. Core Tracking Force (much smoother than base)
                const trackingAcc = this.speed * 2.0; // Moderate acceleration
                this.vx += (dx / dist) * trackingAcc * dt;
                this.vy += (dy / dist) * trackingAcc * dt;

                // 2. Wavy Force (Perpendicular to tracking direction)
                // Periodically shift the ghost left/right relative to its path
                const waveFreq = 2.5;
                const waveAmp = 180; // Force amplitude
                const wavePhase = (this.game.lastTime / 1000) * waveFreq;

                // Perpendicular vector (-dy, dx)
                const px = -dy / dist;
                const py = dx / dist;

                const waveForce = Math.sin(wavePhase + this.floatPhase) * waveAmp;
                this.vx += px * waveForce * dt;
                this.vy += py * waveForce * dt;

                // 3. Apply Max Speed and Friction
                const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (currentSpeed > maxSpeed) {
                    this.vx = (this.vx / currentSpeed) * maxSpeed;
                    this.vy = (this.vy / currentSpeed) * maxSpeed;
                }

                // Slightly lower friction for smoother "drifting" feel
                this.vx *= 0.97;
                this.vy *= 0.97;
            }
        }

        // Base update handles physics, collisions, and spawning logic
        super.update(dt);

        // Visual effects
        this.floatPhase += dt * 3;
        if (this.frames.length > 0) {
            this.animTimer += dt * 8; // 8 FPS
        }
    }

    checkPlayerCollision() {
        if (this.damage <= 0) return;

        const padX = this.width * 0.15;
        const padY = this.height * 0.15;

        if (this.x + padX < this.game.player.x + this.game.player.width &&
            this.x + this.width - padX > this.game.player.x &&
            this.y + padY < this.game.player.y + this.game.player.height &&
            this.y + this.height - padY > this.game.player.y) {

            this.game.player.takeDamage(this.damage);

            // Apply Slow on contact
            if (this.game.player.statusManager) {
                this.game.player.statusManager.applyStatus(STATUS_TYPES.SLOW, 2.0, 0.6); // 40% slow for 2s
            }
        }
    }

    draw(ctx, alpha = 1) {
        if (this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();

            // Interpolated Position
            const interpX = this.prevX + (this.x - this.prevX) * alpha;
            const interpY = this.prevY + (this.y - this.prevY) * alpha;

            // Spectral transparency pulse
            const pulse = 0.4 + Math.sin(this.floatPhase) * 0.1;
            ctx.globalAlpha = this.isSpawning ? (pulse * (1 - (this.spawnTimer / this.spawnDuration))) : pulse;

            // Floating vertical offset (visual)
            const offsetY = Math.sin(this.floatPhase) * 8;

            // Centered bottom alignment logic
            ctx.translate(interpX + this.width / 2, interpY + this.height + offsetY);

            // Ghostly tint/glow
            if (this.flashTimer > 0) {
                ctx.filter = 'brightness(0) invert(1)';
            } else {
                // Keep subtle glow but remove heavy color shift since it has its own colors now
                ctx.filter = 'drop-shadow(0 0 5px rgba(100, 200, 255, 0.5))';
            }

            // Facing logic (horizontal flip)
            const faceLeft = this.game.player && this.game.player.x < this.x;
            if (faceLeft) ctx.scale(-1, 1);

            if (this.spriteData && this.frames.length > 0) {
                const frameIndex = Math.floor(this.animTimer) % this.frames.length;
                const frameKey = this.frames[frameIndex];
                const rect = this.spriteData.frames[frameKey].frame;

                // Draw clipped frame from sprite sheet
                ctx.drawImage(
                    this.image,
                    rect.x, rect.y, rect.w, rect.h,
                    -this.width / 2, -this.height, this.width, this.height
                );
            } else {
                // Fallback to full image if JSON loading/parsing failed
                ctx.drawImage(this.image, -this.width / 2, -this.height, this.width, this.height);
            }

            ctx.restore();

            // BaseEnemy's UI (HP Bar)
            this.drawHPBar(ctx, interpX, interpY);
        } else {
            super.draw(ctx, alpha);
        }
    }

    // Helper to draw HP bar since we override draw
    drawHPBar(ctx, interpX, interpY) {
        if (this.hp < this.maxHp) {
            const barY = interpY - 12;
            ctx.fillStyle = 'red';
            ctx.fillRect(interpX, barY, this.width, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(interpX, barY, this.width * (this.hp / this.maxHp), 4);

            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.displayName, interpX + this.width / 2, barY - 4);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'start';
        }
        this.drawStatusIcons(ctx);
    }
}
