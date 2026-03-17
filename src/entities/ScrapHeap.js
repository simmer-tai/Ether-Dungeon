import { Entity, getCachedImage } from '../utils.js';
import { DropItem } from './DropItem.js';
import { AetherLabManager } from '../AetherLabManager.js';

export class ScrapHeap extends Entity {
    constructor(game, x, y) {
        // Hitbox should be the "base" of the heap, not the full visual area
        // 70x40 at the bottom feels more natural for an 80px wide object
        super(game, x, y, 70, 40, '#555', 1);
        
        this.visualWidth = 80;
        this.image = getCachedImage('assets/entities/scrap_heap.png');
        this.isPassive = true; 
        this.isSolid = true;   
        this.hp = 3;
        this.maxHp = 3;
    }

    takeDamage(amount, damageColor, aetherGain = 0, isCrit = false) {
        if (this.markedForDeletion) return;
        this.hp -= amount;

        // Metal spark particles (spread over visual area)
        for (let i = 0; i < 12; i++) {
            this.game.animations.push({
                type: 'particle',
                x: this.x + this.width / 2 + (Math.random() - 0.5) * 40,
                y: this.y + this.height / 2 + (Math.random() - 0.5) * 40,
                w: 2 + Math.random() * 3,
                h: 2 + Math.random() * 3,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                color: Math.random() < 0.5 ? '#FFD700' : '#FFA500', // Gold/Orange sparks
                vx: (Math.random() - 0.5) * 250,
                vy: (Math.random() - 0.5) * 250,
                update: function (dt) {
                    this.life -= dt;
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.vy += 200 * dt; // Slight gravity
                }
            });
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 20, '#777');
            if (this.game.camera) this.game.camera.shake(0.15, 4);

            // Drop an Aether Chip
            const chipInstance = AetherLabManager.getRandomChipByWeightedRarity();
            if (chipInstance) {
                const chipDrop = new DropItem(this.game, this.x + this.width / 2, this.y + this.height / 2, chipInstance, 'chip');
                this.game.entities.push(chipDrop);
            }
        }
    }

    update(dt) {
        // Static object
    }

    draw(ctx, alpha = 1) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        if (this.image.complete && this.image.naturalWidth !== 0) {
            const aspectRatio = this.image.naturalHeight / this.image.naturalWidth;
            const drawWidth = this.visualWidth;
            const drawHeight = drawWidth * aspectRatio;
            
            // Center visually over the hitbox and align bottom
            const drawX = interpX + (this.width - drawWidth) / 2;
            const drawY = (interpY + this.height) - drawHeight;
            
            ctx.drawImage(this.image, drawX, drawY, drawWidth, drawHeight);
        } else {
            // Metallic block placeholder (using visual size for the dummy)
            const drawX = interpX + (this.width - this.visualWidth) / 2;
            ctx.fillStyle = '#444';
            ctx.fillRect(drawX, interpY, this.visualWidth, this.height);
            ctx.strokeStyle = '#222';
            ctx.strokeRect(drawX, interpY, this.visualWidth, this.height);
        }
    }
}
