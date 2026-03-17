import { Enemy } from './BaseEnemy.js';
import { getCachedImage, getCachedJson } from '../utils.js';

export class Goblin extends Enemy {
    constructor(game, x, y, level = 1) {
        super(game, x, y, 64, 64, '#33cc33', 80, 60, 'goblin', 200, level);
        this.attackCooldown = 0;
        this.bounceAmount = 0; // Disable squash and stretch

        // Attack Visuals
        this.imgNormal = this.image;
        this.imgTelegraph = getCachedImage('assets/enemies/goblin_telegraph.png');
        this.imgAttack = getCachedImage('assets/enemies/goblin_attack.png');
        this.attackImageTimer = 0;

        // Walk Animation
        this.walkSheet = getCachedImage('assets/enemies/goblin_walk.png');
        this.walkData = null;
        this.frameKeys = [];
        this.animTimer = 0;

        getCachedJson('assets/enemies/goblin_walk.json').then(data => {
            if (data) {
                this.walkData = data;
                this.frameKeys = Object.keys(data.frames);
            }
        });

        const scaleFactor = 1 + (level - 1) * 0.05;
        this.stunTimer = 0;
        this.damage = Math.round(10 * scaleFactor); // Re-enable contact damage
        this.slamDamage = Math.round(20 * scaleFactor);
        this.displayName = `Lv.${level} ゴブリン`;
    }

    update(dt) {
        if (this.isSpawning) {
            super.update(dt);
            return;
        }
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackImageTimer > 0) this.attackImageTimer -= dt;
        // If stunned, temporarily set speed to 0 so BaseEnemy AI doesn't move
        const originalSpeed = this.speed;
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.speed = 0;
        }

        // If not telegraphing and cooldown is off, check for heavy strike
        // Removed !this.flashTimer check so attacks can start/continue while being hit
        if (!this.isTelegraphing && this.stunTimer <= 0 && this.attackCooldown <= 0) {
            const dist = Math.sqrt((this.game.player.x - this.x) ** 2 + (this.game.player.y - this.y) ** 2);
            if (dist < 75) {
                const duration = this.game.difficulty === 'hard' ? 0.78 : 1.2;
                this.startTelegraph(duration);
            }
        }

        super.update(dt);
        this.speed = originalSpeed;

        // Advance animation if moving
        if (!this.isTelegraphing && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
            this.animTimer += dt * 30; // Increased to 30 FPS for 32-frame animation
        } else {
            this.animTimer = 0;
        }
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save();
        // Selection of image based on state
        let currentImg = this.imgNormal;
        let frameRect = null;

        if (this.isTelegraphing) {
            currentImg = this.imgTelegraph;
        } else if (this.attackImageTimer > 0 || this.stunTimer > 0) {
            currentImg = this.imgAttack;
        } else if (this.walkData && this.frameKeys.length > 0 && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
            currentImg = this.walkSheet;
            const frameIndex = Math.floor(this.animTimer) % this.frameKeys.length;
            frameRect = this.walkData.frames[this.frameKeys[frameIndex]].frame;
        }

        this.image = currentImg;

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

        if (frameRect && currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.save();
            if (this.flashTimer > 0) {
                ctx.filter = 'brightness(0) invert(1)';
            }

            // Flip horizontally based on player position
            const faceLeft = this.game.player.x < this.x;

            // Draw matching height alignment with BaseEnemy's center-bottom logic
            ctx.translate(interpX + this.width / 2, interpY + this.height);

            if (faceLeft) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(
                currentImg,
                frameRect.x, frameRect.y, frameRect.w, frameRect.h,
                -this.width / 2, -this.height, this.width, this.height
            );
            ctx.restore();
        } else if (currentImg.complete && currentImg.naturalWidth !== 0) {
            // Fallback to base drawing for single images
            ctx.save();
            const faceLeft = this.game.player.x < this.x;

            // Adjust size based on action
            let drawWidth = this.width;
            let drawHeight = this.height;
            if (this.isTelegraphing || this.attackImageTimer > 0) {
                drawWidth = 96; // 1.5x base size for visibility without being too huge
                drawHeight = 96;
            }

            // Center bottom alignment
            ctx.translate(interpX + this.width / 2, interpY + this.height);
            if (faceLeft) ctx.scale(-1, 1);

            if (this.flashTimer > 0) ctx.filter = 'brightness(0) invert(1)';

            ctx.drawImage(this.image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
            ctx.restore();
        }

        ctx.restore(); // Restore main draw save

        // Draw extra UI like telegraph circles or HP bars
        this.drawUI(ctx, interpX, interpY);
    }

    // Helper to draw UI elements since we are overriding draw
    drawUI(ctx, interpX, interpY) {
        // Draw Telegraph Indicator
        if (this.isTelegraphing) {
            ctx.save();
            ctx.beginPath();
            const attackRadius = 112; // 150 * 0.75 = 112.5
            ctx.arc(interpX + this.width / 2, interpY + this.height / 2, attackRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);
            const radius = Math.max(0, attackRadius * progress);
            ctx.beginPath();
            ctx.arc(interpX + this.width / 2, interpY + this.height / 2, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fill();
            ctx.restore();
        }

        // Draw HP Bar
        if (this.hp < this.maxHp) {
            const barY = interpY - 6;
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

        this.drawStatusIcons(ctx);
    }

    executeAttack() {
        const attackRadius = 112;
        const goblinCenterX = this.x + this.width / 2;
        const goblinCenterY = this.y + this.height / 2;
        const playerCenterX = this.game.player.x + this.game.player.width / 2;
        const playerCenterY = this.game.player.y + this.game.player.height / 2;

        const dist = Math.sqrt((playerCenterX - goblinCenterX) ** 2 + (playerCenterY - goblinCenterY) ** 2);

        // Show attack image for 0.3 seconds
        this.attackImageTimer = 0.3;

        // More intense camera shake
        this.game.camera.shake(0.2, 12);

        if (dist < attackRadius) {
            this.game.player.takeDamage(this.slamDamage);
        }

        // 1. Grand White Shockwave (Single Ring, matching Aether Rush style)
        this.game.animations.push({
            type: 'ring',
            x: goblinCenterX,
            y: goblinCenterY,
            radius: 10,
            maxRadius: attackRadius * 1.5,
            width: 40,
            life: 0.3,
            maxLife: 0.3,
            color: 'rgba(255, 255, 255, 0.8)'
        });

        // 2. Ground Crack Effect (Dynamic/Flickering as per user request)
        const crackCount = 8;
        const cracks = [];
        for (let i = 0; i < crackCount; i++) {
            const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const length = attackRadius * (0.8 + Math.random() * 0.4);
            cracks.push({ angle, length });
        }

        this.game.animations.push({
            type: 'custom',
            layer: 'bottom', // Draw behind entities
            x: goblinCenterX,
            y: goblinCenterY,
            cracks: cracks,
            life: 2.0,
            maxLife: 2.0,
            update: function (dt) { this.life -= dt; },
            draw: function (ctx) {
                ctx.save();
                ctx.strokeStyle = '#443322'; // Dark floor crack color
                ctx.globalAlpha = Math.min(1.0, this.life);

                const lifeMult = (this.life / this.maxLife);

                this.cracks.forEach(c => {
                    let lastX = this.x;
                    let lastY = this.y;

                    const segments = 5; // More segments for smoother tapering
                    for (let s = 1; s <= segments; s++) {
                        const distProgress = s / segments;
                        const dist = c.length * distProgress;
                        const jitter = (Math.random() - 0.5) * 15;
                        const targetX = this.x + Math.cos(c.angle) * dist + Math.cos(c.angle + Math.PI / 2) * jitter;
                        const targetY = this.y + Math.sin(c.angle) * dist + Math.sin(c.angle + Math.PI / 2) * jitter;

                        // Taper: thick at start (progress=0), thin at end (progress=1)
                        ctx.lineWidth = Math.max(0.5, (6 * (1 - distProgress * 0.8)) * lifeMult);

                        ctx.beginPath();
                        ctx.moveTo(lastX, lastY);
                        ctx.lineTo(targetX, targetY);
                        ctx.stroke();

                        lastX = targetX;
                        lastY = targetY;
                    }
                });
                ctx.restore();
            }
        });

        // 3. Dust Particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            const dist = Math.random() * 20;
            this.game.animations.push({
                type: 'dust',
                x: goblinCenterX + Math.cos(angle) * dist,
                y: goblinCenterY + Math.sin(angle) * dist,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 0.5 + Math.random() * 0.5,
                color: '#887766',
                update: function (dt) {
                    this.life -= dt;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vx *= 0.95;
                    this.vy *= 0.95;
                },
                draw: function (ctx) {
                    ctx.save();
                    ctx.globalAlpha = this.life / this.maxLife;
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            });
        }

        this.attackCooldown = 3.0;
        this.stunTimer = 2.0; // Stun for 2 seconds after attack
    }
}
