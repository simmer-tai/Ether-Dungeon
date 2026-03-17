import { Enemy } from './BaseEnemy.js';
import { Entity } from '../utils.js';

export class Bat extends Enemy {
    constructor(game, x, y, level = 1) {
        super(game, x, y, 24, 24, '#4a00e0', 10, 150, 'bat', 30, level);
        this.randomTimer = 0;
        this.randomDir = { x: 0, y: 0 };
        const scaleFactor = 1 + (level - 1) * 0.05;
        this.damage = 5; // Fixed contact damage
        this.dashDamage = 10; // Fixed dash damage

        // Attack States
        this.state = 'WANDER'; // WANDER, PREPARING, DASHING
        this.attackCooldown = 2.0;
        this.telegraphTimer = 0;
        this.dashTimer = 0;
        this.dashDir = { x: 0, y: 0 };
        this.dashDistance = 150; // Drastically reduced for gameplay balance
        this.displayName = `Lv.${level} コウモリ`;
    }

    update(dt) {
        if (this.isSpawning) {
            super.update(dt);
            return;
        }

        // Always update status
        this.statusManager.update(dt);

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }

        const distToPlayer = Math.sqrt((this.game.player.x - this.x) ** 2 + (this.game.player.y - this.y) ** 2);

        switch (this.state) {
            case 'WANDER':
                this.updateVagueChase(dt, distToPlayer);
                // Check for attack trigger
                this.attackCooldown -= dt;
                if (this.attackCooldown <= 0 && distToPlayer < 150) { // Attack in range
                    this.state = 'PREPARING';
                    this.telegraphTimer = 1.0;
                    this.vx = 0;
                    this.vy = 0;
                    // Lock direction to player
                    const dx = this.game.player.x + this.game.player.width / 2 - (this.x + this.width / 2);
                    const dy = this.game.player.y + this.game.player.height / 2 - (this.y + this.height / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    this.dashDir = { x: dx / dist, y: dy / dist };
                }
                this.damage = 0;
                break;

            case 'PREPARING':
                this.vx = 0;
                this.vy = 0;
                this.telegraphTimer -= dt;
                if (this.telegraphTimer <= 0) {
                    this.state = 'DASHING';
                    this.dashTimer = 0.25; // 600 speed * 0.25s = 150px
                    this.damage = this.dashDamage; // Enable scaled damage during dash
                }
                break;

            case 'DASHING':
                const dashSpeed = 600;
                this.vx = this.dashDir.x * dashSpeed;
                this.vy = this.dashDir.y * dashSpeed;
                this.dashTimer -= dt;
                if (this.dashTimer <= 0) {
                    this.vx = 0; // Reset velocity to prevent overshoot
                    this.vy = 0;
                    this.state = 'WANDER';
                    this.attackCooldown = 1.5 + Math.random();
                    this.damage = 5;
                }
                break;
        }

        // Cap speed (only for WANDER, dash has its own)
        if (this.state === 'WANDER') {
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const speedMult = this.statusManager.getSpeedMultiplier();
            const maxSpeed = this.speed * speedMult;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }
            this.vx *= 0.95;
            this.vy *= 0.95;

            if (speed > 10) {
                this.walkTimer += dt * this.bounceSpeed * (speed / this.speed);
            }
        } else {
            // High bobbing animation during prep/dash
            this.walkTimer += dt * 25;
        }

        // Final physics update and collision check for this frame
        Entity.prototype.update.call(this, dt);
        this.checkPlayerCollision();
    }

    // Moving vaguely toward player
    updateVagueChase(dt, distToPlayer) {
        // High jitter, low direct bias
        this.randomTimer -= dt;
        if (this.randomTimer <= 0) {
            this.randomTimer = 0.3 + Math.random() * 0.4;
            this.randomDir = {
                x: (Math.random() - 0.5) * 4, // Very erratic
                y: (Math.random() - 0.5) * 4
            };
        }

        // Bias towards player
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let tx = 0, ty = 0;
        if (dist > 10) { // Small buffer to prevent jitter at zero distance
            tx = dx / dist;
            ty = dy / dist;
        }

        // Vague combination (Reduced direct weight slightly for more 'drift')
        this.vx += (tx * 0.3 + this.randomDir.x) * 1000 * dt;
        this.vy += (ty * 0.3 + this.randomDir.y) * 1000 * dt;
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        // Draw Telegraph Area
        if (this.state === 'PREPARING') {
            ctx.save();
            const startX = interpX + this.width / 2;
            const startY = interpY + this.height / 2;
            const angle = Math.atan2(this.dashDir.y, this.dashDir.x);
            const progress = 1 - (this.telegraphTimer / 1.0);

            ctx.translate(startX, startY);
            ctx.rotate(angle);

            // 1. Background (faint red)
            ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
            ctx.fillRect(0, -this.width / 2, this.dashDistance, this.width);

            // 2. Filling Progress (stronger red)
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, -this.width / 2, this.dashDistance * progress, this.width);

            // 3. Border
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(0, -this.width / 2, this.dashDistance, this.width);

            ctx.restore();
        }

        super.draw(ctx, alpha);
    }
}
