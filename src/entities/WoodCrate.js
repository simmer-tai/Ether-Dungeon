import { Entity, getCachedImage } from '../utils.js';

export class WoodCrate extends Entity {
    constructor(game, x, y) {
        super(game, x, y, 40, 40, '#8B4513', 1);
        this.image = getCachedImage('assets/wood_crate.png');
        this.isPassive = true; // Don't block room clears
        this.isSolid = true;   // Block movement
        this.hp = 1;
        this.maxHp = 1;
    }

    takeDamage(amount, damageColor, aetherGain = 0, isCrit = false) {
        // Simple destruction for crates
        this.hp -= amount;

        // Wood splinter particles
        for (let i = 0; i < 8; i++) {
            this.game.animations.push({
                type: 'particle',
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                w: 4 + Math.random() * 6,
                h: 2 + Math.random() * 4,
                life: 0.4 + Math.random() * 0.4,
                maxLife: 0.8,
                color: '#A0522D', // Wood brown
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                rotation: Math.random() * Math.PI * 2,
                update: function (dt) {
                    this.life -= dt;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vy += 400 * dt; // Gravity
                    this.rotation += 5 * dt;
                }
            });
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            // Louder break sound or bigger burst?
            this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 10, '#8B4513');
            if (this.game.camera) this.game.camera.shake(0.1, 3);
        }
    }

    update(dt) {
        // Crates are static, no need for complex update
    }

    draw(ctx) {
        if (this.image.complete && this.image.naturalWidth !== 0) {
            // Keep aspect ratio
            const aspectRatio = this.image.naturalHeight / this.image.naturalWidth;
            const drawWidth = this.width;
            const drawHeight = this.width * aspectRatio;

            // Align bottom of image with bottom of the hitbox (tile grid)
            const offsetY = drawHeight - this.height;
            ctx.drawImage(this.image, Math.floor(this.x), Math.floor(this.y - offsetY), drawWidth, drawHeight);
        } else {
            // Placeholder: Brown box with a vertical perspective look
            // Top face (square)
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

            // Front face (rectangle below, or just a darker shade at bottom)
            ctx.fillStyle = '#5D2E0B';
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y + this.height * 0.7), this.width, this.height * 0.3);

            ctx.strokeStyle = '#3D1E07';
            ctx.lineWidth = 2;
            ctx.strokeRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        }
    }
}
