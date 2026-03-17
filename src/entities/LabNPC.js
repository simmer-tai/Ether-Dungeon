import { Entity, getCachedImage } from '../utils.js';
import { LabUI } from '../ui/LabUI.js';

export class LabNPC extends Entity {
    constructor(game, x, y) {
        super(game, x - 20, y - 30, 40, 60, '#00ffff', 1);
        this.image = getCachedImage('assets/entities/shop_npc.png'); // Placeholder image
        this.showPrompt = false;
    }

    update(dt) {
        // NPC is static
    }

    draw(ctx, alpha = 1) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();
            // Optional: Filter to distinguish from Shop NPC
            ctx.filter = 'hue-rotate(180deg)'; 
            ctx.drawImage(this.image, interpX, interpY, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(interpX, interpY, this.width, this.height);
        }
    }

    getInteractPrompt() {
        return "[SPACE] アップグレード";
    }

    interact() {
        this.use();
    }

    use() {
        LabUI.open();
    }
}
