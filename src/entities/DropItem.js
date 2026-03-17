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
            this.width = 20;
            this.height = 20;
            this.image = getCachedImage('assets/ui/aether_shard.png'); // Placeholder icon for chip, icons drawn over it
            this.chipInstance = value; // The ChipInstance object
            const rarity = this.chipInstance.getRarity() || 'common';
            const colors = {
                common: { bg: '#444', border: '#555' },
                rare: { bg: '#1a3a5a', border: '#0088ff' },
                epic: { bg: '#3b1a5a', border: '#aa00ff' },
                legendary: { bg: '#5a4a1a', border: '#ffcc00' },
                special: { bg: '#2a1a1f', border: '#ff66aa' }
            };
            const theme = colors[rarity] || colors.common;
            this.color = theme.border;
            this.bgColor = theme.bg;
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
                // label = `COINS x ${this.value}`; // Hidden as requested
            } else if (this.type === 'fragments') {
                this.game.player.addAetherFragments(this.value);
                label = `エーテルフラグメント x ${this.value}`;
            } else if (this.type === 'chip') {
                this.game.player.circuit.ownedChips.push(this.chipInstance);
                this.game.logToScreen(`CHIP GET: ${this.chipInstance.data.name}`, this.color);
                this.game.player.saveAetherData();
                label = `${this.chipInstance.data.name} x 1`;
            } else {
                this.game.player.addAetherShards(this.value);
                label = `エーテルシャード x ${this.value}`;
            }

            // Spawn floating text above player
            if (label) {
                this.game.spawnFloatingText(
                    label,
                    this.game.player.x + this.game.player.width / 2,
                    this.game.player.y - 30,
                    this.color,
                    { font: "bold 8px sans-serif" }
                );
            }

            this.markedForDeletion = true;
        }
    }

    draw(ctx, alpha = 1) {
        if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
            ctx.save();
            
            // Interpolated Position
            const interpX = this.prevX + (this.x - this.prevX) * alpha;
            const interpY = this.prevY + (this.y - this.prevY) * alpha;

            if (this.type === 'chip') {
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 15;

                const drawX = interpX;
                const drawY = interpY + (this.renderYOffset || 0);

                // Rotation/pulse
                const pulse = 1 + Math.sin(this.floatTimer * 2) * 0.05;
                ctx.translate(drawX + this.width / 2, drawY + this.height / 2);
                ctx.scale(pulse, pulse);
                ctx.translate(-(drawX + this.width / 2), -(drawY + this.height / 2));

                // 1. Chip Body
                ctx.fillStyle = this.bgColor;
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1.5;
                // Rounded rect
                const r = 3;
                ctx.beginPath();
                ctx.moveTo(drawX + r, drawY);
                ctx.lineTo(drawX + this.width - r, drawY);
                ctx.quadraticCurveTo(drawX + this.width, drawY, drawX + this.width, drawY + r);
                ctx.lineTo(drawX + this.width, drawY + this.height - r);
                ctx.quadraticCurveTo(drawX + this.width, drawY + this.height, drawX + this.width - r, drawY + this.height);
                ctx.lineTo(drawX + r, drawY + this.height);
                ctx.quadraticCurveTo(drawX, drawY + this.height, drawX, drawY + this.height - r);
                ctx.lineTo(drawX, drawY + r);
                ctx.quadraticCurveTo(drawX, drawY, drawX + r, drawY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 2. Chip Icon (Small Silhouette)
                const iconPath = this.chipInstance.data.icon;
                const iconImg = getCachedImage(iconPath);
                if (iconImg && iconImg.complete) {
                    ctx.save();
                    // Apply silhouette filter (similar to CSS grayscale(1) brightness(2))
                    ctx.filter = 'grayscale(1) brightness(2)';
                    const iconSize = this.width * 0.7;
                    ctx.drawImage(iconImg, drawX + (this.width - iconSize) / 2, drawY + (this.height - iconSize) / 2, iconSize, iconSize);
                    ctx.restore();
                }

                // 3. Node Indicators
                const drawNode = (side, count) => {
                    if (count === 0) return;
                    ctx.fillStyle = '#00ffff';
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 4;

                    const isUniversal = count === 'universal';
                    const nodeCount = isUniversal ? 1 : count;
                    const nodeSpacing = 3;
                    const nodeW = (side === 'up' || side === 'down') ? 3 : 5;
                    const nodeH = (side === 'up' || side === 'down') ? 5 : 3;

                    for (let i = 0; i < nodeCount; i++) {
                        let nx, ny;
                        const totalW = nodeCount * nodeW + (nodeCount - 1) * nodeSpacing;
                        if (side === 'up') {
                            nx = drawX + (this.width - totalW) / 2 + i * (nodeW + nodeSpacing);
                            ny = drawY - 2;
                        } else if (side === 'down') {
                            nx = drawX + (this.width - totalW) / 2 + i * (nodeW + nodeSpacing);
                            ny = drawY + this.height - 3;
                        } else if (side === 'left') {
                            nx = drawX - 2;
                            ny = drawY + (this.height - totalW) / 2 + i * (nodeH + nodeSpacing);
                        } else if (side === 'right') {
                            nx = drawX + this.width - 3;
                            ny = drawY + (this.height - totalW) / 2 + i * (nodeH + nodeSpacing);
                        }

                        if (isUniversal) {
                            // Draw a longer bar
                            const barW = (side === 'up' || side === 'down') ? 12 : 3;
                            const barH = (side === 'up' || side === 'down') ? 3 : 12;
                            ctx.fillRect(drawX + (this.width - barW) / 2, drawY + (this.height - barH) / 2, barW, barH); // Needs offset to edges
                        } else {
                            ctx.fillRect(nx, ny, nodeW, nodeH);
                        }
                    }
                };

                // Repositioned node draw for universal and normal
                const drawNodeFixed = (side) => {
                    const count = this.chipInstance.nodes[side];
                    if (!count) return;

                    ctx.fillStyle = '#00ffff';
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 5;

                    if (count === 'universal') {
                        const barW = (side === 'up' || side === 'down') ? 12 : 2;
                        const barH = (side === 'up' || side === 'down') ? 2 : 12;
                        let nx = drawX + (this.width - barW) / 2;
                        let ny = drawY + (this.height - barH) / 2;
                        if (side === 'up') ny = drawY - 1;
                        if (side === 'down') ny = drawY + this.height - 1;
                        if (side === 'left') nx = drawX - 1;
                        if (side === 'right') nx = drawX + this.width - 1;
                        ctx.fillRect(nx, ny, barW, barH);
                    } else {
                        const dotW = (side === 'up' || side === 'down') ? 2 : 4;
                        const dotH = (side === 'up' || side === 'down') ? 4 : 2;
                        const spacing = 2;
                        const totalDim = count * (side === 'up' || side === 'down' ? dotW : dotH) + (count - 1) * spacing;

                        for (let i = 0; i < count; i++) {
                            let nx, ny;
                            if (side === 'up' || side === 'down') {
                                nx = drawX + (this.width - totalDim) / 2 + i * (dotW + spacing);
                                ny = (side === 'up') ? drawY - 2 : drawY + this.height - 2;
                            } else {
                                nx = (side === 'left') ? drawX - 2 : drawX + this.width - 2;
                                ny = drawY + (this.height - totalDim) / 2 + i * (dotH + spacing);
                            }
                            ctx.fillRect(nx, ny, dotW, dotH);
                        }
                    }
                };

                drawNodeFixed('up');
                drawNodeFixed('down');
                drawNodeFixed('left');
                drawNodeFixed('right');

            } else {
                if (this.type === 'coins') {
                    ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
                    ctx.shadowBlur = 4;
                } else if (this.type === 'fragments') {
                    ctx.shadowColor = '#00ffff';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.shadowColor = '#00aaff';
                    ctx.shadowBlur = 10;
                }
                ctx.drawImage(this.image, Math.floor(this.x), Math.floor(this.y + (this.renderYOffset || 0)), this.width, this.height);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + 8, this.y + 8 + (this.renderYOffset || 0), 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
