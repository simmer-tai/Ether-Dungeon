import { CONFIG } from './config.js';

export class InputHandler {
    constructor() {
        this.keys = {};
        this.pressed = {}; // For single frame press
        this.mouseX = 0;
        this.mouseY = 0;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') e.preventDefault();
            if (!this.keys[e.code]) {
                this.pressed[e.code] = true;
            }
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                if (!this.keys['Click']) this.pressed['Click'] = true;
                this.keys['Click'] = true;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.keys['Click'] = false;
        });
        window.addEventListener('mousemove', (e) => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
                this.mouseY = e.clientY - rect.top;
            } else {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            }
        });
    }
    isDown(key) { return this.keys[key]; }
    isPressed(key) { return this.pressed[key]; }
    update() { this.pressed = {}; }
}

export const getCachedImage = (src) => {
    if (!window.imageCache) window.imageCache = {};
    if (window.imageCache[src]) return window.imageCache[src];
    const img = new Image();
    img.src = src;
    img.onerror = () => console.error("Failed to load image:", src);
    window.imageCache[src] = img;
    return img;
};

export const getCachedJson = async (src) => {
    if (!window.jsonCache) window.jsonCache = {};
    if (window.jsonCache[src]) return window.jsonCache[src];
    try {
        const response = await fetch(src);
        const data = await response.json();
        window.jsonCache[src] = data;
        return data;
    } catch (e) {
        console.error("Failed to load JSON:", src, e);
        return null;
    }
};

export class Camera {
    constructor(width, height, mapWidth, mapHeight) {
        this.width = width;
        this.height = height;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.baseX = 0;
        this.baseY = 0;
        this.x = 0;
        this.y = 0;
        this.zoom = 1.0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
    }

    shake(duration, intensity) {
        // Use Math.max to ensure stronger/longer shakes are not overwritten by weaker hits/effects
        this.shakeTimer = Math.max(this.shakeTimer, duration);
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    isVisible(x, y, w, h) {
        // Simple AABB check
        // Add minimal padding to prevent pop-in
        const padding = 50;
        return (
            x + w + padding > this.x &&
            x - padding < this.x + this.width &&
            y + h + padding > this.y &&
            y - padding < this.y + this.height
        );
    }

    follow(target, dt, offsetX = 0, offsetY = 0, zoom = 1.0, smoothFactor = 5) {
        this.zoom = zoom;
        // Adjust viewport size based on internal zoom
        const viewW = this.width / this.zoom;
        const viewH = this.height / this.zoom;

        let targetX = target.x + target.width / 2 - viewW / 2 + offsetX;
        let targetY = target.y + target.height / 2 - viewH / 2 + offsetY;

        if (dt) {
            const factor = 1.0 - Math.exp(-smoothFactor * dt); // Frame-rate independent smoothing
            this.baseX += (targetX - this.baseX) * factor;
            this.baseY += (targetY - this.baseY) * factor;
        } else {
            this.baseX = targetX;
            this.baseY = targetY;
        }

        // Apply Shake Offset
        let shakeDX = 0;
        let shakeDY = 0;
        
        if (this.shakeTimer > 0) {
            // Use time-based sine waves for smooth but fast rumble, avoiding single-frame random static noise
            // that causes visual stuttering when imageSmoothing is enabled.
            const time = Date.now() / 1000;
            shakeDX = Math.sin(time * 45) * this.shakeIntensity;
            shakeDY = Math.cos(time * 55) * this.shakeIntensity;

            this.shakeTimer -= dt;
            if (this.shakeTimer <= 0) {
                this.shakeTimer = 0;
                this.shakeIntensity = 0;
            }
        }

        // Keep base coordinates inside map bounds
        this.baseX = Math.max(0, Math.min(this.baseX, this.mapWidth - viewW));
        this.baseY = Math.max(0, Math.min(this.baseY, this.mapHeight - viewH));

        // Final output coordinates (with shake applied)
        this.x = this.baseX + shakeDX;
        this.y = this.baseY + shakeDY;
    }
}

export class Entity {
    constructor(game, x, y, width, height, color, hp) {
        this.id = Math.random().toString(36).substr(2, 9); // Simple unique ID
        this.game = game;
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.hp = hp;
        this.maxHp = hp;
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.markedForDeletion = false;
        this.invulnerable = 0;
        this.damageColor = '#fff'; // Default damage text color

        // Knockback properties
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDuration = 0;
        this.ignoreWalls = false;
    }

    savePrevPos() {
        this.prevX = this.x;
        this.prevY = this.y;
    }

    // Expose base update for children to bypass overrides
    superUpdate(dt) {
        let nextX = this.x + this.vx * dt;
        if (!this.checkCollision(nextX, this.y)) {
            this.x = nextX;
        }

        let nextY = this.y + this.vy * dt;
        if (!this.checkCollision(this.x, nextY)) {
            this.y = nextY;
        }
    }

    update(dt) {
        if (this.invulnerable > 0) this.invulnerable -= dt;

        // Apply knockback
        let currentVx = this.vx;
        let currentVy = this.vy;

        if (this.knockbackDuration > 0) {
            this.knockbackDuration -= dt;
            currentVx += this.knockbackVx;
            currentVy += this.knockbackVy;

            // Decay knockback (Smoother glide)
            const decay = Math.pow(0.96, dt * 60);
            this.knockbackVx *= decay;
            this.knockbackVy *= decay;

            if (this.knockbackDuration <= 0) {
                this.knockbackVx = 0;
                this.knockbackVy = 0;
                this.knockbackDuration = 0;
            }
        }

        let nextX = this.x + currentVx * dt;
        if (!this.checkCollision(nextX, this.y)) {
            this.x = nextX;
        }

        let nextY = this.y + currentVy * dt;
        if (!this.checkCollision(this.x, nextY)) {
            this.y = nextY;
        }
    }

    checkCollision(x, y) {
        if (this.ignoreWalls) return false;

        // Tile-based collision with optional padding
        const pad = this.wallCollisionPadding || 0;
        const left = x + pad;
        const right = x + this.width - pad;
        const top = y + pad;
        const bottom = y + this.height - pad;

        const points = [
            { x: left, y: top },
            { x: right, y: top },
            { x: left, y: bottom },
            { x: right, y: bottom }
        ];

        // Add middle points for large entities (straddling check)
        const innerW = this.width - 2 * pad;
        const innerH = this.height - 2 * pad;
        const tileSize = this.game.map.tileSize || 32;

        if (innerW > tileSize || innerH > tileSize) {
            const midX = x + this.width / 2;
            const midY = y + this.height / 2;
            points.push({ x: midX, y: top });
            points.push({ x: midX, y: bottom });
            points.push({ x: left, y: midY });
            points.push({ x: right, y: midY });
            points.push({ x: midX, y: midY });
        }

        const isWall = points.some(p => this.game.map.isWall(p.x, p.y));

        if (isWall) return true;

        // Entity-based solid collision (Crates, etc.)
        // Block player and monsters (non-solid enemies)
        const isMovable = this === this.game.player || (!this.isSolid && this.game.enemies.includes(this));
        if (isMovable && this.game.solidEntities) {
            for (const other of this.game.solidEntities) {
                if (other === this || other.markedForDeletion) continue;
                if (x < other.x + other.width && x + this.width > other.x &&
                    y < other.y + other.height && y + this.height > other.y) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Attempts to push the entity out of a wall if it's currently penetrating one.
     * Scans surrounding areas to find the nearest safe spot.
     */
    resolveWallPenetration() {
        if (!this.checkCollision(this.x, this.y)) return;

        const maxDist = this.width; // Scan up to entity size
        const step = 8; // Scan resolution

        for (let r = step; r <= maxDist; r += step) {
            // Check in 8 directions expanding outwards
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const testX = this.x + Math.cos(angle) * r;
                const testY = this.y + Math.sin(angle) * r;

                if (!this.checkCollision(testX, testY)) {
                    this.x = testX;
                    this.y = testY;
                    return true;
                }
            }
        }
        return false;
    }

    takeDamage(amount, color = null, aetherAmount = 0, isCrit = false, kx = 0, ky = 0, kDuration = 0.2, silent = false, source = null) {
        if (this.invulnerable > 0 || this.isCheatInvincible) return;

        // Apply global defense / reduction if available (Player only)
        let finalDamage = amount;
        if (this.takenDamageMultiplier !== undefined) {
            finalDamage *= this.takenDamageMultiplier;
        }

        // Screen shake on hit
        if (this.game.camera) this.game.camera.shake(0.2, 5);

        this.hp -= finalDamage;
        if (this === this.game.player) {
            this.invulnerable = CONFIG.PLAYER.INVULNERABLE_DURATION;
        } else {
            this.invulnerable = 0.5;
        }

        // Spawn Damage Text
        if (!silent) {
            const anim = {
                type: 'text',
                isDamageText: true,
                text: Math.ceil(finalDamage),
                x: this.x + this.width / 2,
                y: this.y,
                vx: (Math.random() - 0.5) * 150, // Increased horizontal spread
                vy: -150, // More upward velocity specifically for the bounce
                life: 0.8,
                maxLife: 0.8,
                color: this.damageColor || '#ffffff',
                font: "bold 20px 'Meiryo', sans-serif",
                icons: []
            };
            this.game.animations.push(anim);
            this.lastDamageAnim = anim;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            if (this === this.game.player) {
                if (!this.game.isGameOver) {
                    this.game.isGameOver = true;
                    this.game.gameState = 'GAME_OVER';
                }
            } else {
                this.markedForDeletion = true;
            }
        }
    }

    draw(ctx, alpha = 1) {
        ctx.fillStyle = this.color;
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.fillStyle = 'white';
        }

        // Interpolated Position
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.fillRect(interpX, interpY, this.width, this.height);

        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'red';
            ctx.fillRect(interpX, interpY - 10, this.width, 5);
            ctx.fillStyle = 'green';
            ctx.fillRect(interpX, interpY - 10, this.width * (this.hp / this.maxHp), 5);
        }
    }
}

/**
 * Modifies an array in-place, keeping only elements for which the condition returns true.
 * This completely avoids memory allocation (garbage collection) compared to Array.prototype.filter().
 */
export function filterInPlace(array, condition) {
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < array.length; readIdx++) {
        if (condition(array[readIdx])) {
            if (writeIdx !== readIdx) {
                array[writeIdx] = array[readIdx];
            }
            writeIdx++;
        }
    }
    array.length = writeIdx;
    return array;
}
