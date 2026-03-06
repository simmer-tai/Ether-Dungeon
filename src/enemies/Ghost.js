import { Enemy } from './BaseEnemy.js';
import { STATUS_TYPES } from '../status_effects.js';
import { getCachedJson } from '../utils.js';

export class Ghost extends Enemy {
    constructor(game, x, y) {
        // Ghost: lower health than goblin, spectral appearance, reduced speed (120 -> 60)
        super(game, x, y, 40, 48, 'rgba(150, 200, 255, 0.5)', 30, 60, 'ghost', 150);
        this.displayName = 'ゴースト';
        this.ignoreWalls = true;
        this.damage = 8;

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
        super.update(dt);
        // Floating effect (physics/visual)
        this.floatPhase += dt * 3;

        // Advance frame animation
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

    draw(ctx) {
        if (this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();

            // Spectral transparency pulse
            const pulse = 0.4 + Math.sin(this.floatPhase) * 0.1;
            ctx.globalAlpha = this.isSpawning ? (pulse * (1 - (this.spawnTimer / this.spawnDuration))) : pulse;

            // Floating vertical offset (visual)
            const offsetY = Math.sin(this.floatPhase) * 8;

            // Centered bottom alignment logic
            ctx.translate(this.x + this.width / 2, this.y + this.height + offsetY);

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
            this.drawHPBar(ctx);
        } else {
            super.draw(ctx);
        }
    }

    // Helper to draw HP bar since we override draw
    drawHPBar(ctx) {
        if (this.hp < this.maxHp) {
            const barY = Math.floor(this.y - 12);
            ctx.fillStyle = 'red';
            ctx.fillRect(Math.floor(this.x), barY, this.width, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(Math.floor(this.x), barY, this.width * (this.hp / this.maxHp), 4);

            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.displayName, this.x + this.width / 2, barY - 4);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'start';
        }
        this.drawStatusIcons(ctx);
    }
}
