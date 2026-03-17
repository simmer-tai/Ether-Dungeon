import { Enemy } from './BaseEnemy.js';
import { Entity, getCachedImage, getCachedJson } from '../utils.js';

export class SkeletonArcher extends Enemy {
    constructor(game, x, y, level = 1) {
        super(game, x, y, 40, 48, '#ffffff', 30, 120, 'skeleton_archer', 120, level);

        // Sprite Sheet Assets
        this.fullSheet = getCachedImage('assets/enemies/skeleton_archer_full.png');
        this.walkFrames = [];
        this.attackFrames = [];
        this.walkData = null;
        this.animTimer = 0;
        const initialShootDelay = 1.0 + Math.random() * 2.0;
        this.shootTimer = game.difficulty === 'hard' ? initialShootDelay * 0.5 : initialShootDelay;
        const scaleFactor = 1 + (level - 1) * 0.05;
        this.damage = Math.round(5 * scaleFactor); // Re-enable contact damage
        this.arrowDamage = Math.round(12 * scaleFactor);

        // Wander AI state
        this.wanderTimer = 0;
        this.wanderVx = 0;
        this.wanderVy = 0;

        // Referencing the correct JSON provided by user
        getCachedJson('assets/enemies/sprites_data (4).json').then(data => {
            if (data) {
                this.walkData = data;
                const keys = Object.keys(data.frames).sort();
                this.walkFrames = keys.slice(0, 8);
                this.attackFrames = keys.slice(8, 16);
            }
        });

        this.targetAimPos = { x: 0, y: 0 };
        this.displayName = `Lv.${level} スケルトンアーチャー`;
    }

    update(dt) {
        if (this.isSpawning) {
            super.update(dt);
            return;
        }
        // 1. Update status effects independently
        this.statusManager.update(dt);

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }

        if (this.isTelegraphing) {
            this.telegraphTimer -= dt;
            this.vx = 0;
            this.vy = 0;

            // Lock aim 0.5s before firing
            if (this.telegraphTimer > 0.5) {
                this.targetAimPos.x = this.game.player.x + this.game.player.width / 2;
                this.targetAimPos.y = this.game.player.y + this.game.player.height / 2;
            }

            if (this.telegraphTimer <= 0) {
                this.isTelegraphing = false;
                this.executeAttack();
            }
        } else {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speedMult = this.statusManager.getSpeedMultiplier();

            const hasLOS = this.hasLineOfSight();

            // Wander Logic: Change direction every 1.5-3.5 seconds
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                this.wanderVx = Math.cos(angle) * this.speed * 0.4;
                this.wanderVy = Math.sin(angle) * this.speed * 0.4;
                this.wanderTimer = 1.5 + Math.random() * 2.0;
            }

            // Movement AI: Relaxed Kiting & Randomness + LOS Check
            const kiteDist = 100;     // Too close: retreat (User requested 100px)
            const wanderDist = 400;   // Good range: wander randomly
            const approachDist = 500; // Too far: close in

            if (!hasLOS) {
                // If no LOS, move towards player to find them
                this.vx = (dx / dist) * this.speed * speedMult;
                this.vy = (dy / dist) * this.speed * speedMult;
            } else if (dist < kiteDist) {
                // Move away (Relaxed retreat - now only if extremely close)
                this.vx = -(dx / dist) * this.speed * speedMult;
                this.vy = -(dy / dist) * this.speed * speedMult;
            } else if (dist < wanderDist) {
                // Inside the "sweet spot": Wander semi-randomly
                this.vx = this.wanderVx * speedMult;
                this.vy = this.wanderVy * speedMult;
            } else {
                // Outside range: Move closer
                this.vx = (dx / dist) * this.speed * speedMult;
                this.vy = (dy / dist) * this.speed * speedMult;
            }

            // Attack Logic: Shoot if player is reasonably in range AND visible
            if (hasLOS && dist < approachDist + 100) {
                this.shootTimer -= dt;
                if (this.shootTimer <= 0) {
                    const duration = this.game.difficulty === 'hard' ? 0.5 : 1.0;
                    this.startTelegraph(duration);
                }
            }
        }

        // --- Animation Timer ---
        const isMoving = Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
        if (!this.isTelegraphing && isMoving) {
            this.animTimer += dt * 10;
        } else if (this.isTelegraphing) {
            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);
            this.animTimer = progress * (this.attackFrames.length - 1);
        } else {
            this.animTimer = 0;
        }

        // 2. Core Physics Update (Bypass BaseEnemy.update's tracking logic)
        Entity.prototype.update.call(this, dt);

        // 3. Keep collision with player active
        this.checkPlayerCollision();
    }

    hasLineOfSight() {
        const startX = this.x + this.width / 2;
        const startY = this.y + this.height / 2;
        const endX = this.game.player.x + this.game.player.width / 2;
        const endY = this.game.player.y + this.game.player.height / 2;

        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) return true;

        const step = 8;
        const cos = dx / dist;
        const sin = dy / dist;

        for (let d = 0; d < dist; d += step) {
            const rx = startX + cos * d;
            const ry = startY + sin * d;
            if (this.game.map.isWall(rx, ry)) {
                return false;
            }
        }
        return true;
    }

    draw(ctx, alpha = 1) {
        if (!this.walkData || this.walkFrames.length === 0 || !this.fullSheet.complete || this.fullSheet.naturalWidth === 0) {
            super.draw(ctx, alpha);
            return;
        }

        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save(); // Main save for SkeletonArcher draw

        let framesToUse = this.walkFrames;
        if (this.isTelegraphing) {
            framesToUse = this.attackFrames;
        }

        const frameIndex = Math.floor(this.animTimer) % framesToUse.length;
        const frameKey = framesToUse[frameIndex];
        const frameRect = this.walkData.frames[frameKey].frame;

        // Shadow and Spawning Effect
        const spawnProgress = this.isSpawning ? (1 - (this.spawnTimer / this.spawnDuration)) : 1.0;
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

        if (this.isSpawning) {
            ctx.globalAlpha = spawnProgress;
        }

        ctx.save();
        const faceLeft = this.game.player.x < this.x;
        ctx.translate(interpX + this.width / 2, interpY + this.height);
        if (faceLeft) ctx.scale(-1, 1);

        if (this.flashTimer > 0) ctx.filter = 'brightness(0) invert(1)';

        const targetH = 64;
        const scale = targetH / frameRect.h;
        const targetW = frameRect.w * scale;

        ctx.drawImage(
            this.fullSheet,
            frameRect.x, frameRect.y, frameRect.w, frameRect.h,
            -targetW / 2, -targetH, targetW, targetH
        );
        ctx.restore();

        if (this.isTelegraphing) {
            ctx.save();
            const startX = interpX + this.width / 2;
            const startY = interpY + this.height / 2;
            
            // Interpolate Aim Position
            const interpAimX = this.prevAimX + (this.targetAimPos.x - this.prevAimX) * alpha;
            const interpAimY = this.prevAimY + (this.targetAimPos.y - this.prevAimY) * alpha;

            const dx = interpAimX - startX;
            const dy = interpAimY - startY;
            const angle = Math.atan2(dy, dx);

            // Raycasting to find wall
            let lineEndX = interpAimX;
            let lineEndY = interpAimY;
            const step = 8;
            const maxDist = 2000;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            for (let d = 0; d < maxDist; d += step) {
                const rx = startX + cos * d;
                const ry = startY + sin * d;
                if (this.game.map.isWall(rx, ry)) {
                    lineEndX = rx;
                    lineEndY = ry;
                    break;
                }
                // Fallback: stop at end of range if no wall found
                lineEndX = rx;
                lineEndY = ry;
            }

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(lineEndX, lineEndY);
            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + progress * 0.6})`;
            ctx.lineWidth = 1 + progress * 2;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = -Date.now() / 50;
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore(); // Main restore for SkeletonArcher draw

        this.drawStatusIcons(ctx);
        if (this.hp < this.maxHp) {
            const barY = interpY - 35;
            ctx.fillStyle = 'red';
            ctx.fillRect(interpX, barY, this.width, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(interpX, barY, this.width * (this.hp / this.maxHp), 4);

            // Draw Name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.displayName, interpX + this.width / 2, barY - 4);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'start';
        }
    }

    savePrevPos() {
        super.savePrevPos();
        this.prevAimX = this.targetAimPos.x;
        this.prevAimY = this.targetAimPos.y;
    }

    executeAttack() {
        const dx = this.targetAimPos.x - (this.x + this.width / 2);
        const dy = this.targetAimPos.y - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            this.game.enemyProjectiles.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                vx: (dx / dist) * 650,
                vy: (dy / dist) * 650,
                width: 32,
                height: 32,
                angle: angle,
                damage: this.arrowDamage,
                life: 3.0,
                image: getCachedImage('assets/skills/vfx/projectile_arrow.png'),
                update: function (dt, game) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.life -= dt;
                    const pdx = game.player.x + game.player.width / 2 - this.x;
                    const pdy = game.player.y + game.player.height / 2 - this.y;
                    if (Math.sqrt(pdx * pdx + pdy * pdy) < 20) {
                        game.player.takeDamage(this.damage);
                        this.life = 0;
                    }
                    if (game.map.isWall(this.x, this.y)) this.life = 0;
                },
                draw: function (ctx) {
                    if (this.image.complete && this.image.naturalWidth > 0) {
                        ctx.save();
                        ctx.translate(this.x, this.y);
                        ctx.rotate(this.angle - (Math.PI * 0.75));
                        ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
                        ctx.restore();
                    } else {
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(this.x, this.y);
                        ctx.lineTo(this.x - Math.cos(this.angle) * 20, this.y - Math.sin(this.angle) * 20);
                        ctx.stroke();
                    }
                }
            });
        }
        this.attackCooldown = 3.0; // Contact damage cooldown
        const nextShootDelay = 2.0 + Math.random() * 1.5;
        this.shootTimer = this.game.difficulty === 'hard' ? nextShootDelay * 0.5 : nextShootDelay;
    }
}
