import { Entity, getCachedImage } from '../utils.js';

export class DropItem extends Entity {
    constructor(game, x, y, value, type = 'shards') {
        super(game, x, y, 16, 16, '#ffd700', 1);
        this.value = value || 1;
        this.type = type; // 'shards' | 'coins' | 'fragments' | 'chip'

        // Physics: Stiff Angle Snapping
        const rawAngle = Math.random() * Math.PI * 2;
        const angleStep = Math.PI / 6; // 30 degree increments
        const angle = Math.round(rawAngle / angleStep) * angleStep;

        const speed = 150 + Math.random() * 100;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Friction for "Stiff" stop
        this.deceleration = 400; // Linear deceleration

        // Visuals based on type
        if (this.type === 'coins') {
            this.image = getCachedImage('assets/ui/aether_coin.png');
            this.color = '#ffcc00';
        } else if (this.type === 'fragments') {
            this.image = getCachedImage('assets/ui/aether_fragment.png');
            this.color = '#00ffff';
        } else if (this.type === 'chip') {
            this.image = getCachedImage('assets/ui/aether_shard.png'); // Placeholder icon for chip
            this.chipInstance = value; // The ChipInstance object
            const rarity = this.chipInstance.data.rarity || 'common';
            const colors = {
                common: '#ffffff',
                rare: '#3498db',
                epic: '#9b59b6',
                legendary: '#f1c40f'
            };
            this.color = colors[rarity] || '#ffffff';
        } else {
            this.image = getCachedImage('assets/ui/aether_shard.png');
            this.color = '#00aaff';
        }

        // Magnet
        this.magnetRange = 150;
        this.magnetForce = 600;
        this.isMagnetized = false;

        // Floating animation
        this.floatTimer = 0;

        // Pickup Delay
        this.pickupDelay = 0.8;
    }

    update(dt) {
        // Physics with Linear Deceleration (Stiff Stop)
        if (!this.isMagnetized) {
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > 0) {
                const newSpeed = Math.max(0, currentSpeed - this.deceleration * dt);
                const ratio = newSpeed / currentSpeed;
                this.vx *= ratio;
                this.vy *= ratio;
            }
        }

        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;

        // Wall Collision (Bounce)
        if (this.game.map.isWall(nextX + 8, this.y + 8)) {
            this.vx *= -0.5;
            nextX = this.x;
        }
        if (this.game.map.isWall(this.x + 8, nextY + 8)) {
            this.vy *= -0.5;
            nextY = this.y;
        }

        this.x = nextX;
        this.y = nextY;

        // Rigid Bobbing
        this.floatTimer += dt * 5;
        const bob = Math.floor(Math.sin(this.floatTimer) * 2);
        this.renderYOffset = bob;

        // Pickup Delay Logic
        if (this.pickupDelay > 0) {
            this.pickupDelay -= dt;
            return;
        }

        // Magnet Logic
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < this.magnetRange) {
            this.isMagnetized = true;
        }

        if (this.isMagnetized) {
            const angle = Math.atan2(dy, dx);
            const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const targetVx = Math.cos(snappedAngle) * 400;
            const targetVy = Math.sin(snappedAngle) * 400;
            this.vx += (targetVx - this.vx) * 10 * dt;
            this.vy += (targetVy - this.vy) * 10 * dt;
        }

        // Pickup Collision
        if (dist < 24) {
            let label = "";
            if (this.type === 'coins') {
                this.game.player.addDungeonCoins(this.value);
                label = `COINS x ${this.value}`;
            } else if (this.type === 'fragments') {
                this.game.player.addAetherFragments(this.value);
                label = `FRAGMENTS x ${this.value}`;
            } else if (this.type === 'chip') {
                this.game.player.circuit.ownedChips.push(this.chipInstance);
                this.game.logToScreen(`CHIP GET: ${this.chipInstance.data.name}`, this.color);
                this.game.player.saveAetherData();
                label = `${this.chipInstance.data.name} x 1`;
            } else {
                this.game.player.addAetherShards(this.value);
                label = `SHARDS x ${this.value}`;
            }

            // Spawn floating text above player
            if (label) {
                this.game.spawnFloatingText(
                    label,
                    this.game.player.x + this.game.player.width / 2,
                    this.game.player.y - 30,
                    this.color,
                    { font: "bold 16px 'Press Start 2P', monospace" }
                );
            }

            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();
            // Glow based on type/rarity
            if (this.type === 'coins') {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                ctx.shadowBlur = 4;
            } else if (this.type === 'fragments') {
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 10;
            } else if (this.type === 'chip') {
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 15;
                // Add a small rotation or scale pulse for chips
                const pulse = 1 + Math.sin(this.floatTimer * 2) * 0.1;
                ctx.translate(this.x + 8, this.y + 8);
                ctx.scale(pulse, pulse);
                ctx.translate(-(this.x + 8), -(this.y + 8));
            } else {
                ctx.shadowColor = '#00aaff';
                ctx.shadowBlur = 10;
            }
            ctx.drawImage(this.image, Math.floor(this.x), Math.floor(this.y + (this.renderYOffset || 0)), this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + 8, this.y + 8 + (this.renderYOffset || 0), 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
