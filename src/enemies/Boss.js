import { Enemy } from './BaseEnemy.js';
import { getCachedImage, getCachedJson } from '../utils.js';
import { spawnExplosion, spawnProjectile } from '../skills/common.js';

export class Boss extends Enemy {
    constructor(game, x, y, level = 1) {
        // Base stats for Aether Golem
        const hp = 3500;
        const speed = 80; // Reduced from 100 to 80 (20% decrease)
        super(game, x, y, 90, 90, '#4444ff', hp, speed, 'boss', 5000, level);

        this.attackScale = 1.0; // Damage no longer scales with level

        this.displayName = `Lv.${level} AETHER GOLEM`;
        this.isBoss = true;
        this.wallCollisionPadding = 12; // Allow slightly more overlap to prevent snagging on corners
        this.phase = 1;

        // Visual setup (Aether Golem sprites)
        this.spriteData = {
            walk: getCachedImage('assets/enemies/aether_golem/aether_golem_walk.png'),
            dash: getCachedImage('assets/enemies/aether_golem/aether_golem_dash.png'),
            attack: getCachedImage('assets/enemies/aether_golem/aether_golem_attack.png'),
            crystals: [
                getCachedImage('assets/enemies/aether_golem/aether_crystal_1.png'),
                getCachedImage('assets/enemies/aether_golem/aether_crystal_2.png'),
                getCachedImage('assets/enemies/aether_golem/aether_crystal_3.png'),
                getCachedImage('assets/enemies/aether_golem/aether_crystal_4.png')
            ]
        };

        this.walkData = null;
        this.dashData = null;
        this.attackData = null;

        this.walkFrames = [];
        this.dashFrames = [];
        this.attackFrames = [];

        // Load JSON data asynchronously
        getCachedJson('assets/enemies/aether_golem/aether_golem_walk.json').then(data => {
            if (data) {
                this.walkData = data;
                this.walkFrames = Object.keys(data.frames).sort();
            }
        });
        getCachedJson('assets/enemies/aether_golem/aether_golem_dash.json').then(data => {
            if (data) {
                this.dashData = data;
                this.dashFrames = Object.keys(data.frames).sort();
            }
        });
        getCachedJson('assets/enemies/aether_golem/aether_golem_attack.json').then(data => {
            if (data) {
                this.attackData = data;
                this.attackFrames = Object.keys(data.frames).sort();
            }
        });

        this.image = this.spriteData.walk; // Fallback image set to walk sprite
        this.frameX = 0;
        this.frameTimer = 0;
        this.animationFPS = 13;

        // Jump (Aether Leap) state
        this.isJumping = false;
        this.jumpState = 'idle'; // 'rising', 'falling'
        this.jumpTimer = 0;
        this.jumpHeight = 0;
        this.jumpTarget = { x: 0, y: 0 };
        this.jumpStart = { x: 0, y: 0 };

        this.currentAttack = '';
        this.attackCooldown = 2.0;

        // Aura pulsing
        this.auraTimer = 0;

        this.isStunned = false;
        this.stunTimer = 0;

        this.groundSlamRange = 240; // Unified to Phase 2 power (v1.3.0)
        this.recoveryTimer = 0;
        this.dashAngle = 0;

        // State machine
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashSpeed = 975; // Unified to Phase 2 speed (v1.3.0)
        this.dashDirection = { x: 0, y: 0 };

        // Disabled knockback for boss
        this.knockbackResistance = 1.0;
    }

    update(dt) {
        if (this.isSpawning) {
            super.update(dt);
            return;
        }

        if (this.isStunned) {
            this.stunTimer -= dt;
            this.vx = 0;
            this.vy = 0;
            if (this.stunTimer <= 0) {
                this.isStunned = false;
                this.stunTimer = 0;
            }
            this.updateAnimation(dt);
            super.update(dt);
            return;
        }

        if (this.recoveryTimer > 0) {
            this.recoveryTimer -= dt;
            this.vx = 0;
            this.vy = 0;
            this.updateAnimation(dt);
            super.update(dt);
            return;
        }

        // Phase Check (Mainly visual/cool-down trigger now)
        if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
            this.phase = 2;
            this.attackCooldown = 0.5; // Immediate first attack trigger
            this.game.camera.shake(0.6, 20);
            this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 60, '#4444ff');
            this.game.logToScreen("GOLEM OVERLOADED!");
        }

        if (this.isDashing) {
            this.vx = this.dashDirection.x * this.dashSpeed;
            this.vy = this.dashDirection.y * this.dashSpeed;

            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else if (this.isJumping) {
            this.updateJump(dt);
        } else {
            // Normal update behavior
            if (!this.isTelegraphing) {
                this.attackCooldown -= dt;
                if (this.attackCooldown <= 0) {
                    this.decideAttack();
                }
            }
        }

        // Move the boss
        if (this.isDashing) {
            const nextX = this.x + this.vx * dt;
            const nextY = this.y + this.vy * dt;

            // 3-point collision check (center, top-corner, bottom-corner) for robust wall detection
            const buffer = this.width * 0.5; // Adjusted to match sprite radius (45px)
            const offH = this.height * 0.35; // Vertical offset for corner checks

            const points = [
                { x: nextX + this.width / 2 + this.dashDirection.x * buffer, y: nextY + this.height / 2 + this.dashDirection.y * buffer },
                { x: nextX + this.width / 2 + this.dashDirection.x * buffer, y: nextY + this.height / 2 + this.dashDirection.y * buffer - offH },
                { x: nextX + this.width / 2 + this.dashDirection.x * buffer, y: nextY + this.height / 2 + this.dashDirection.y * buffer + offH }
            ];

            const hitWall = points.some(p => this.game.map.isWall(p.x, p.y));

            if (!hitWall) {
                this.x = nextX;
                this.y = nextY;
            } else {
                this.isDashing = false;

                // Unstuck: Ensure the boss isn't inside a wall after collision
                this.resolveWallPenetration();

                this.game.camera.shake(0.15, 8.4);
                this.spawnDashImpact();

                // 50% chance to immediately chain into another dash
                if (Math.random() < 0.5) {
                    const dxArr = this.game.player.x - (this.x + this.width / 2);
                    const dyArr = this.game.player.y - (this.y + this.height / 2);
                    this.dashAngle = Math.atan2(dyArr, dxArr);
                    this.currentAttack = 'dash';
                    this.startTelegraph(0.5);
                    this.isStunned = false;
                    this.stunTimer = 0;
                    this.recoveryTimer = 0;
                } else {
                    this.isStunned = true;
                    this.stunTimer = 0.2;
                    this.recoveryTimer = 0.2;
                }
            }
            this.statusManager.update(dt);
            this.checkPlayerCollision();
        } else {
            super.update(dt);
        }

        this.updateAnimation(dt);
        this.auraTimer += dt;
        this.flashTimer = Math.max(0, (this.flashTimer || 0) - dt);
    }

    updateAnimation(dt) {
        this.frameTimer += dt;
        if (this.frameTimer >= 1 / this.animationFPS) {
            this.frameTimer = 0;
            this.frameX++;
        }
    }

    decideAttack() {
        if (!this.game.player) return;

        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const choices = [];

        if (dist < 280) {
            choices.push('slam');
        }

        choices.push('crystal');
        choices.push('dash');
        choices.push('jump');
        choices.push('storm'); // Available from Phase 1 (v1.3.0)

        const picked = choices[Math.floor(Math.random() * choices.length)];
        this.currentAttack = picked;

        if (picked === 'dash') {
            const dxArr = this.game.player.x - (this.x + this.width / 2);
            const dyArr = this.game.player.y - (this.y + this.height / 2);
            this.dashAngle = Math.atan2(dyArr, dxArr);
        }

        let duration = 1.0;
        if (picked === 'dash') duration = 0.5;
        if (picked === 'slam') duration = 1.1;
        if (picked === 'storm') duration = 1.5;
        if (picked === 'jump') duration = 0.6; // Telegraph for jump (50% faster)

        this.startTelegraph(duration);
    }

    executeAttack() {
        if (this.currentAttack === 'slam') {
            this.attackSlam();
        } else if (this.currentAttack === 'dash') {
            this.attackDash();
        } else if (this.currentAttack === 'storm') {
            this.attackStorm();
        } else if (this.currentAttack === 'crystal') {
            this.attackCrystal();
        } else if (this.currentAttack === 'jump') {
            this.attackJump();
        }
        this.attackCooldown = Math.random() * 1.5 + 2.5; // Unified and shortened for all phases (v1.3.0)
    }

    checkPlayerCollision() {
        if (this.isJumping) return; // Ignore contact damage while in the air
        super.checkPlayerCollision();
    }

    attackJump() {
        this.isJumping = true;
        this.jumpState = 'rising';
        this.jumpTimer = 0;
        // Use centers for smoother interpolation
        this.jumpStart = {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
        this.jumpTarget = {
            x: this.game.player.x + this.game.player.width / 2,
            y: this.game.player.y + this.game.player.height / 2
        };
        this.vx = 0;
        this.vy = 0;
    }

    updateJump(dt) {
        const riseTime = 0.5;
        const waitTime = 1.0;
        const fallTime = 0.25;
        const maxHeight = 800;

        if (this.jumpState === 'rising') {
            this.jumpTimer += dt;
            const progress = Math.min(1.0, this.jumpTimer / riseTime);
            this.jumpHeight = progress * maxHeight;

            if (progress >= 1.0) {
                this.jumpState = 'waiting';
                this.jumpTimer = 0;
            }
        } else if (this.jumpState === 'waiting') {
            this.jumpTimer += dt;
            const progress = Math.min(1.0, this.jumpTimer / waitTime);

            // Lock target 0.7s before landing (total: waitTime + fallTime = 1.25s)
            const lockTime = (waitTime + fallTime) - 0.7;

            if (this.game.player && this.jumpTimer < lockTime) {
                this.jumpTarget = {
                    x: this.game.player.x + this.game.player.width / 2,
                    y: this.game.player.y + this.game.player.height / 2
                };
            }

            if (progress >= 1.0) {
                this.jumpState = 'falling';
                this.jumpTimer = 0;
                this.jumpStart = { x: this.x + this.width / 2, y: this.y + this.height / 2 };
            }
        } else if (this.jumpState === 'falling') {
            this.jumpTimer += dt;
            const progress = Math.min(1.0, this.jumpTimer / fallTime);
            this.jumpHeight = (1 - progress) * maxHeight;

            const curX = this.jumpStart.x + (this.jumpTarget.x - this.jumpStart.x) * progress;
            const curY = this.jumpStart.y + (this.jumpTarget.y - this.jumpStart.y) * progress;
            this.x = curX - this.width / 2;
            this.y = curY - this.height / 2;

            if (progress >= 1.0) {
                this.isJumping = false;
                this.jumpState = 'idle';
                this.jumpHeight = 0;
                this.landJump();
            }
        }
    }

    landJump() {
        this.game.camera.shake(0.15, 9.1);

        // Use slam logic for landing impact
        const px = this.game.player.x + this.game.player.width / 2;
        const py = this.game.player.y + this.game.player.height / 2;
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        const dist = Math.hypot(px - bx, py - by);
        const jumpRange = this.groundSlamRange * 0.75; // 120px (50% reduction)
        if (dist < jumpRange) {
            this.game.player.takeDamage(Math.round(35 * this.attackScale));
        }

        // Visual impact (medium-large explosion)
        spawnExplosion(this.game, bx, by, '#4444ff', 1.9);

        // Extra particles for "heavy" feel
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 200 + Math.random() * 300;
            this.game.animations.push({
                type: 'particle', x: bx, y: by,
                w: 8 + Math.random() * 8, h: 8 + Math.random() * 8,
                life: 0.8, maxLife: 0.8, color: '#554433',
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50
            });
        }
    }

    attackSlam() {
        this.game.camera.shake(0.15, 7.0);
        // Use center of player for accurate distance check
        const px = this.game.player.x + this.game.player.width / 2;
        const py = this.game.player.y + this.game.player.height / 2;
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;

        const dist = Math.hypot(px - bx, py - by);
        if (dist < this.groundSlamRange) {
            this.game.player.takeDamage(Math.round(15 * this.attackScale));
        }
        // Increase explosion scale to 2.5 to match 160px range visually
        spawnExplosion(this.game, bx, by, '#4444ff', 2.5, 0.4);
        this.recoveryTimer = 0.8;
    }


    attackDash() {
        this.isDashing = true;
        this.dashTimer = 1.0;
        this.dashDirection = { x: Math.cos(this.dashAngle), y: Math.sin(this.dashAngle) };
    }

    attackStorm() {
        let shots = 20;
        const interval = 0.08;
        const timerId = setInterval(() => {
            if (shots <= 0 || this.markedForDeletion) {
                clearInterval(timerId);
                return;
            }
            const angle = Math.random() * Math.PI * 2;
            spawnProjectile(this.game, this.x + this.width / 2, this.y + this.height / 2, Math.cos(angle) * 350, Math.sin(angle) * 350, {
                damage: Math.round(15 * this.attackScale),
                color: '#33ccff',
                width: 12,
                height: 12,
                isEnemy: true
            });
            shots--;
        }, interval * 1000);
    }

    spawnSingleCrystal(cx, cy) {
        if (this.game.map.isWall(cx, cy)) return;

        // INTENSIFIED TELEGRAPH: More and faster debris particles
        for (let j = 0; j < 25; j++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pSpeed = 100 + Math.random() * 180;
            this.game.animations.push({
                type: 'particle', x: cx, y: cy,
                w: 4 + Math.random() * 8, h: 4 + Math.random() * 8,
                life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
                color: j % 2 === 0 ? '#554433' : '#665544',
                vx: Math.cos(pAngle) * pSpeed, vy: Math.sin(pAngle) * pSpeed - 60,
                gravity: 0.6
            });
        }

        const crystalImg = this.spriteData.crystals[Math.floor(Math.random() * 4)];
        this.game.enemyProjectiles.push({
            x: cx - 25, y: cy - 25, w: 50, h: 50,
            spawnDelay: 0.5,
            riseTimer: 0.1, // Further doubled speed (0.2 -> 0.1)
            life: 7.0, active: true, damage: Math.round(15 * this.attackScale),
            canDamagePlayer: true,
            // REMOVED: hp/takeDamage (Crystals are now indestructible)
            game: this.game,
            shakeX: 0, shakeY: 0,
            update: function (dt, game) {
                if (this.spawnDelay > 0) {
                    this.spawnDelay -= dt;
                    this.shakeX = (Math.random() - 0.5) * 4;
                    this.shakeY = (Math.random() - 0.5) * 4;

                    if (Math.random() < 0.6) { // Increased frequency from 0.2 to 0.6
                        game.animations.push({
                            type: 'particle', x: this.x + 25 + (Math.random() - 0.5) * 30, y: this.y + 45,
                            w: 4 + Math.random() * 6, h: 4 + Math.random() * 6, life: 0.4, maxLife: 0.4, color: '#665544',
                            vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40
                        });
                    }
                    return;
                }
                if (this.riseTimer > 0) {
                    this.riseTimer -= dt;
                }
                this.life -= dt;
                if (this.life <= 0) this.active = false;

                // Contact damage check (Multi-hit)
                if (this.canDamagePlayer && this.riseTimer <= 0 && this.active) {
                    const pcx = game.player.x + game.player.width / 2;
                    const pcy = game.player.y + game.player.height / 2;
                    const d = Math.hypot(pcx - (this.x + 25), pcy - (this.y + 25));
                    if (d < 30) {
                        game.player.takeDamage(this.damage);
                    }
                }
            },
            draw: function (ctx) {
                ctx.save();
                // 2x Fade Out Speed at the end
                ctx.globalAlpha = Math.min(1.0, this.life * 2.0);

                if (this.spawnDelay > 0) {
                    ctx.translate(this.shakeX, this.shakeY);
                    ctx.strokeStyle = 'rgba(85, 68, 51, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                        ctx.moveTo(this.x + 25, this.y + 25);
                        ctx.lineTo(this.x + 25 + Math.cos(a) * 20, this.y + 25 + Math.sin(a) * 15);
                    }
                    ctx.stroke();
                } else {
                    const riseProgress = Math.min(1.0, 1.0 - (this.riseTimer / 0.1));
                    const drawH = 50 * riseProgress;
                    const drawYOffset = 50 * (1.0 - riseProgress);

                    // Crystals are now indestructible

                    if (crystalImg && crystalImg.complete) {
                        ctx.drawImage(
                            crystalImg,
                            0, 0, crystalImg.naturalWidth, crystalImg.naturalHeight * riseProgress,
                            this.x, this.y + drawYOffset, 50, drawH
                        );
                    } else {
                        ctx.fillStyle = '#8844ff';
                        ctx.fillRect(this.x, this.y + drawYOffset, 50, drawH);
                    }
                }
                ctx.restore();
            }
        });
    }

    attackCrystal() {
        this.game.camera.shake(0.5, 10);
        const bx = this.x + this.width / 2;
        const by = this.y + this.height / 2;
        this.recoveryTimer = 1.2;

        const pattern = Math.random();
        if (pattern < 0.35) {
            // Pattern 1: Crisis Ring (Around Player)
            const px = this.game.player.x + this.game.player.width / 2;
            const py = this.game.player.y + this.game.player.height / 2;
            const count = 7;
            const radius = 90;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this.spawnSingleCrystal(px + Math.cos(angle) * radius, py + Math.sin(angle) * radius);
            }
        } else if (pattern < 0.70) {
            // Pattern 2: Straight Line (Towards Player)
            const px = this.game.player.x + this.game.player.width / 2;
            const py = this.game.player.y + this.game.player.height / 2;
            const angle = Math.atan2(py - by, px - bx);
            const count = 6;
            const spacing = 60;
            const startDist = 80;
            for (let i = 0; i < count; i++) {
                const d = startDist + i * spacing;
                setTimeout(() => {
                    if (this.markedForDeletion) return;
                    this.spawnSingleCrystal(bx + Math.cos(angle) * d, by + Math.sin(angle) * d);
                }, i * 100); // 0.1s delay between each crystal
            }
        } else {
            // Pattern 3: Random Spread (Original behavior)
            const crystalCount = 6;
            for (let i = 0; i < crystalCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 100 + Math.random() * 200;
                this.spawnSingleCrystal(bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist);
            }
        }
    }

    spawnDashImpact() {
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 150 + Math.random() * 250;
            this.game.animations.push({
                type: 'particle', x: this.x + this.width / 2, y: this.y + this.height / 2,
                w: 12, h: 12, life: 0.6, maxLife: 0.6, color: '#ffffff',
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed
            });
        }
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;
        const interpJumpHeight = this.isJumping ? (this.prevJumpHeight !== undefined ? this.prevJumpHeight + (this.jumpHeight - this.prevJumpHeight) * alpha : this.jumpHeight) : 0;

        // 1. Draw Telegraph Indicator (Custom for Boss)
        if (this.isTelegraphing) {
            ctx.save();
            const progress = 1 - (this.telegraphTimer / this.telegraphDuration);

            if (this.currentAttack === 'slam') {
                // Slam Circle
                ctx.beginPath();
                ctx.arc(interpX + this.width / 2, interpY + this.height / 2, this.groundSlamRange, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + progress * 0.4})`;
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(interpX + this.width / 2, interpY + this.height / 2, this.groundSlamRange * progress, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                ctx.fill();
            } else if (this.currentAttack === 'dash') {
                // Dash Line
                ctx.save();
                ctx.translate(interpX + this.width / 2, interpY + this.height / 2);
                ctx.rotate(this.dashAngle);
                ctx.fillStyle = `rgba(255, 0, 0, 0.1)`;
                ctx.fillRect(0, -this.height / 2.5, 800, this.height * 0.8);
                ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + progress * 0.5})`;
                ctx.fillRect(0, -this.height / 3.0, 800 * progress, this.height * 0.6);
                ctx.restore();
            }
            ctx.restore();
        }

        if (this.isJumping && (this.jumpState === 'waiting' || this.jumpState === 'falling')) {
            ctx.save();
            const progress = this.jumpState === 'waiting' ? (this.jumpTimer / 1.0) : 1.0;
            const jumpRadius = this.groundSlamRange * 0.75; // 120px (50% reduction)

            ctx.beginPath();
            ctx.arc(this.jumpTarget.x, this.jumpTarget.y, jumpRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 0, 0.5)`;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.jumpTarget.x, this.jumpTarget.y, jumpRadius * progress, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 0, 0.2)`;
            ctx.fill();
            ctx.restore();
        }

        // 2. Sprite selection
        let currentImage = this.spriteData.walk;
        let jsonData = this.walkData;
        let frames = this.walkFrames;

        if (this.isDashing) {
            currentImage = this.spriteData.dash;
            jsonData = this.dashData;
            frames = this.dashFrames;
        } else if (this.isTelegraphing) {
            if (this.currentAttack === 'dash') {
                currentImage = this.spriteData.dash;
                jsonData = this.dashData;
                frames = this.dashFrames;
            } else {
                currentImage = this.spriteData.attack;
                jsonData = this.attackData;
                frames = this.attackFrames;
            }
        } else if (this.recoveryTimer > 0 || (this.isStunned && this.recoveryTimer > 0)) {
            currentImage = this.spriteData.attack;
            jsonData = this.attackData;
            frames = this.attackFrames;
        }

        // 3. Render Sprite
        if (currentImage && currentImage.complete && currentImage.naturalWidth !== 0 && jsonData && frames.length > 0) {
            // Shadow on ground during jump
            if (this.isJumping) {
                ctx.save();
                ctx.beginPath();
                const shadowScale = Math.max(0.2, 1.0 - (this.jumpHeight / 400));
                ctx.ellipse(this.x + this.width / 2, this.y + this.height, 40 * shadowScale, 20 * shadowScale, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fill();
                ctx.restore();
            }

            ctx.save();
            // Height offset for jump
            ctx.translate(interpX + this.width / 2, interpY + this.height - interpJumpHeight);

            // Flip logic
            let flip = false;
            if (Math.abs(this.vx) > 5) {
                flip = this.vx < 0;
            } else if (this.game.player) {
                flip = (this.game.player.x + this.game.player.width / 2) < (interpX + this.width / 2);
            }
            if (flip) ctx.scale(-1, 1);

            let frameIndex = this.frameX % frames.length;
            if (currentImage === this.spriteData.attack) {
                if (this.isTelegraphing) frameIndex = 0;
                else if (this.recoveryTimer > 0) frameIndex = 1;
            } else if (currentImage === this.spriteData.dash) {
                if (this.isTelegraphing) frameIndex = 0;
                else if (this.isDashing) frameIndex = 1;
            }

            const key = frames[Math.min(frameIndex, frames.length - 1)];
            const f = jsonData.frames[key].frame;

            if (this.flashTimer > 0) ctx.filter = 'brightness(0) invert(1)';

            const isDashSprite = currentImage === this.spriteData.dash;
            const referenceH = isDashSprite ? 488 : 350;
            const targetH = isDashSprite ? 100.8 : 126;
            const scale = targetH / referenceH;

            const renderW = f.w * scale;
            const renderH = f.h * scale;

            ctx.drawImage(
                currentImage,
                f.x, f.y, f.w, f.h,
                -renderW / 2, -renderH, renderW, renderH
            );
            ctx.restore();
        } else {
            super.draw(ctx, alpha);
        }
    }

    savePrevPos() {
        super.savePrevPos();
        this.prevJumpHeight = this.jumpHeight;
    }
}