import { Entity } from '../utils.js';
import { getCachedImage } from '../utils.js';
import { generateSkillStock } from '../../data/shop_items.js';

const RARITY_COLORS = {
    common: '#aaaaaa',
    rare: '#4488ff',
    epic: '#cc44ff'
};

const TYPE_NAMES = {
    normal: '通常スキル',
    primary: 'メインスキル',
    secondary: 'サブスキル',
    ultimate: 'アルティメットスキル'
};

export class ShopNPC extends Entity {
    constructor(game, x, y) {
        super(game, x - 20, y - 30, 40, 60, '#ffd700', 1);
        this.showPrompt = false;
        this.stock = [];
        this._stockReady = false;
        this.image = getCachedImage('assets/entities/shop_npc.png');
        this.hoveredItemIndex = -1;

        // Offset positions for 3 items in front of the merchant
        this.itemOffsets = [
            { dx: -65, dy: 45 },
            { dx: 0, dy: 55 },
            { dx: 65, dy: 45 }
        ];

        this.itemHoverProgress = [0, 0, 0]; // 0 to 1 for each slot

        this._loadStock();
    }

    async _loadStock() {
        this.stock = await generateSkillStock(3); // Increased to 3

        // Easy mode: Halve prices
        if (this.game.difficulty === 'easy') {
            this.stock.forEach(item => {
                item.price = Math.max(1, Math.ceil(item.price * 0.5));
            });
        }

        this._stockReady = true;
    }

    update(dt) {
        if (!this._stockReady) return;

        const px = this.game.player.x + this.game.player.width / 2;
        const py = this.game.player.y + this.game.player.height / 2;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        let nearestIdx = -1;
        let minDist = 45; // Interaction radius per item

        this.itemOffsets.forEach((off, idx) => {
            const ix = cx + off.dx;
            const iy = cy + off.dy;
            const dist = Math.sqrt((px - ix) ** 2 + (py - iy) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearestIdx = idx;
            }
        });

        this.hoveredItemIndex = nearestIdx;

        // Update animation timers
        const animSpeed = 8; // Adjust for faster/slower animation
        this.itemHoverProgress.forEach((p, idx) => {
            if (idx === this.hoveredItemIndex && this.stock[idx] && !this.stock[idx].sold) {
                this.itemHoverProgress[idx] = Math.min(1, p + dt * animSpeed);
            } else {
                this.itemHoverProgress[idx] = Math.max(0, p - dt * animSpeed);
            }
        });
        // The global showPrompt in main.js is based on distance to the NPC itself.
        // We might need to adjust main.js to allow interaction with these specific points.
        // However, if the player is near any item, they are likely near the NPC (~80px in main.js).
    }

    draw(ctx, alpha = 1) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;
        const cx = interpX + this.width / 2;
        const cy = interpY + this.height / 2;

        // Determine if player is to the left
        const px = this.game.player.prevX + (this.game.player.x - this.game.player.prevX) * alpha + this.game.player.width / 2;
        const facingLeft = px < cx;

        // NPC image
        if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();
            if (facingLeft) {
                ctx.translate(cx, 0);
                ctx.scale(-1, 1);
                ctx.translate(-cx, 0);
            }
            ctx.drawImage(this.image, interpX, interpY, this.width, this.height);
            ctx.restore();
        }

        // Draw In-World Items
        if (this._stockReady) {
            this.stock.forEach((item, idx) => {
                const off = this.itemOffsets[idx];
                const ix = cx + off.dx;
                const iy = cy + off.dy;

                this._drawItemSlot(ctx, item, ix, iy, idx === this.hoveredItemIndex);
            });
        }

        // Info Window (Specific to hovered item)
        if (this.hoveredItemIndex !== -1 && this._stockReady) {
            const item = this.stock[this.hoveredItemIndex];
            if (!item.sold) {
                // Draw Info Windows
                this.stock.forEach((item, idx) => {
                    const progress = this.itemHoverProgress[idx];
                    if (progress > 0) {
                        const off = this.itemOffsets[idx];
                        this._drawInfoWindow(ctx, item, cx + off.dx, cy + off.dy - 50, progress);
                    }
                });
            }
        }
    }

    getInteractPrompt() {
        if (!this._stockReady) return "準備中...";
        if (this.hoveredItemIndex !== -1) {
            const item = this.stock[this.hoveredItemIndex];
            if (!item.sold) {
                const canAfford = this.game.player.dungeonCoins >= item.price;
                return canAfford ? `[SPACE] ${item.name} を購入` : "エーテルコイン不足";
            }
        }
        return "[SPACE] ショップを見る";
    }

    interact() {
        this.use();
    }

    _drawItemSlot(ctx, item, x, y, isHovered) {
        const size = 32;
        const sold = item.sold;
        const playerCurrency = this.game.player.dungeonCoins;
        const canAfford = playerCurrency >= item.price;

        ctx.save();

        // Ground shadow/circle
        ctx.fillStyle = isHovered ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 10, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        if (sold) {
            ctx.globalAlpha = 0.3;
        }

        // Skill Icon
        if (item.icon) {
            const img = getCachedImage(item.icon);
            if (img.complete && img.naturalWidth !== 0) {
                ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
            } else {
                // Fallback box
                ctx.fillStyle = '#444';
                ctx.fillRect(x - size / 2, y - size / 2, size, size);
            }
        }

        // Highlight if hovered
        if (isHovered && !sold) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4);
        }

        // Price Tag
        if (!sold) {
            ctx.globalAlpha = 1.0;
            // Insufficient funds -> Red, otherwise White
            ctx.fillStyle = canAfford ? 'white' : '#ff4444';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 3;

            // Draw Aether Coin Icon
            const shardImg = getCachedImage('assets/ui/aether_coin.png');
            const iconSize = 16;
            const priceText = `${item.price}`;
            const textWidth = ctx.measureText(priceText).width;
            const totalWidth = iconSize + 4 + textWidth;
            const startX = x - totalWidth / 2;

            if (shardImg.complete && shardImg.naturalWidth !== 0) {
                ctx.drawImage(shardImg, startX, y + 12, iconSize, iconSize);
            }

            ctx.fillText(priceText, startX + iconSize + 4 + textWidth / 2, y + 25);

            // Purchase Prompt / Insufficient Funds Text
            if (isHovered) {
                ctx.font = 'bold 12px sans-serif';
                if (canAfford) {
                    ctx.fillStyle = 'white';
                    ctx.fillText('[スペース]で購入', x, y + 42);
                } else {
                    ctx.fillStyle = '#ff4444';
                    ctx.fillText('エーテルコインが不足しています', x, y + 42);
                }
            }
        } else {
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SOLD', x, y + 0);
        }

        ctx.restore();
    }

    _drawInfoWindow(ctx, item, x, y, progress) {
        // progress: 0.0 to 1.0 (Ease out cubic for smooth pop)
        const t = progress;
        const easedP = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // OutQuartish

        const padding = 10;

        // Use attribute/theme color if available, fallback to rarity
        const skillParams = item._skillData.params || {};
        const themeColor = skillParams.damageColor || skillParams.color || RARITY_COLORS[item.rarity] || '#fff';
        const typeName = TYPE_NAMES[item._skillData.type] || item._skillData.type;

        // Extract Stats
        const params = item._skillData.params || {};
        const stats = [];
        if (params.damage !== undefined) stats.push({ label: 'ダメージ', value: params.damage });
        if (params.critChance !== undefined) stats.push({ label: 'クリティカル率', value: (params.critChance * 100).toFixed(0) + '%' });
        if (item._skillData.cooldown !== undefined) stats.push({ label: 'クールダウン', value: item._skillData.cooldown + '秒' });

        // Content Measurement for Dynamic Width
        const largeIconSize = 40;
        const iconPadding = 10;
        const textOffsetX = largeIconSize + iconPadding + 8;

        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        const nameWidth = ctx.measureText(item.name).width + textOffsetX + padding;
        ctx.font = '10px sans-serif';
        const typeWidth = ctx.measureText(typeName).width + textOffsetX + padding;

        let maxStatsWidth = 0;
        ctx.font = '11px sans-serif';
        stats.forEach(s => {
            const rowWidth = ctx.measureText(s.label).width + ctx.measureText(s.value).width + padding * 2 + 30;
            if (rowWidth > maxStatsWidth) maxStatsWidth = rowWidth;
        });
        ctx.restore();

        // Calculate final width (with constraints)
        const width = Math.max(190, Math.min(320, Math.max(nameWidth, typeWidth, maxStatsWidth)));

        // Split description into lines (using 11px for compact look)
        const desc = item.description || '';
        const lines = this._wrapText(ctx, desc, width - padding * 2, '11px sans-serif');

        const lineImgHeight = 14;
        const statsCount = stats.length;
        const statsRowHeight = 16;
        const statsTotalHeight = statsCount * statsRowHeight;
        const height = 75 + statsTotalHeight + lines.length * lineImgHeight;

        ctx.save();
        // Animation: Slide up and fade in
        const bloomY = (1 - easedP) * 15;
        ctx.translate(x - width / 2, y - height - bloomY);
        ctx.globalAlpha = easedP;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, 0, 0, width, height, 6);
        ctx.fill();
        ctx.stroke();

        // Skill Icon in Window
        if (item.icon) {
            const img = getCachedImage(item.icon);
            if (img.complete && img.naturalWidth !== 0) {
                ctx.drawImage(img, iconPadding, iconPadding, largeIconSize, largeIconSize);
            }
        }

        // Title (Name)
        ctx.fillStyle = themeColor;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.name, textOffsetX, padding + 12);

        // Type (Under Name)
        ctx.fillStyle = '#999';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${typeName}`, textOffsetX, padding + 26);

        // Separator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const sep1Y = Math.max(padding + 32, iconPadding + largeIconSize + 4);
        ctx.moveTo(padding, sep1Y);
        ctx.lineTo(width - padding, sep1Y);
        ctx.stroke();

        // Stats rows
        if (stats.length > 0) {
            ctx.font = '11px sans-serif';
            stats.forEach((s, idx) => {
                const rowY = sep1Y + 16 + idx * statsRowHeight;
                ctx.fillStyle = '#888';
                ctx.textAlign = 'left';
                ctx.fillText(s.label, padding, rowY);

                ctx.fillStyle = '#fff';
                ctx.textAlign = 'right';
                ctx.fillText(s.value, width - padding, rowY);
            });
        }

        // Secondary Separator
        const sep2Y = sep1Y + 10 + statsTotalHeight;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(padding, sep2Y);
        ctx.lineTo(width - padding, sep2Y);
        ctx.stroke();

        // Description
        ctx.fillStyle = '#eee';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, padding, sep2Y + 16 + i * lineImgHeight);
        });

        ctx.restore();
    }

    // Helper: Wrap text
    _wrapText(ctx, text, maxWidth, font) {
        ctx.font = font;
        const words = text.split(''); // Char by char for JP
        let lines = [];
        let currentLine = '';

        for (let n = 0; n < words.length; n++) {
            let testLine = currentLine + words[n];
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                lines.push(currentLine);
                currentLine = words[n];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    // Helper: Rounded Rect
    _roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    use() {
        if (this.game.gameState !== 'PLAYING') return;
        if (!this._stockReady) return;

        if (this.hoveredItemIndex === -1) return;

        const item = this.stock[this.hoveredItemIndex];
        if (item.sold) return;

        if (this.game.player.dungeonCoins < item.price) {
            // Optional: Message saying not enough coins
            this.game.logToScreen("エーテルコインが足りません！");
            return;
        }

        // Buy logic
        this.game.player.dungeonCoins -= item.price;
        item.sold = true;
        item.apply(this.game);

        this.game.logToScreen(`${item.name} を購入しました！`);
    }
}
