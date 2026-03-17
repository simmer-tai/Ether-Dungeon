import { Entity, getCachedImage } from '../utils.js';
import { skillsDB } from '../../data/skills_db.js';

export class Chest extends Entity {
    constructor(game, x, y) {
        super(game, x, y, 30, 30, '#ffd700', 1); // Gold color
        this.opened = false;

        this.imageClosed = getCachedImage('assets/map/chest_closed.png');
        this.imageOpen = getCachedImage('assets/map/chest_open.png');
    }

    /**
     * 指定された座標が壁でないことを確認し、壁の場合は周囲の床タイルを探します。
     * @param {Game} game ゲームインスタンス
     * @param {number} x x座標
     * @param {number} y y座標
     * @returns {{x: number, y: number}} 安全な座標
     */
    static getSafeSpawnPosition(game, x, y) {
        const mw = game.map.width;
        const mh = game.map.height;
        const ts = game.map.tileSize;

        // 宝箱のサイズ (30x30)
        const cw = 30;
        const ch = 30;

        const isSafe = (px, py) => {
            // 4隅が壁でないかチェック
            return !game.map.isWall(px, py) &&
                   !game.map.isWall(px + cw, py) &&
                   !game.map.isWall(px, py + ch) &&
                   !game.map.isWall(px + cw, py + ch);
        };

        if (isSafe(x, y)) {
            return { x, y };
        }

        // 周囲を螺旋状に探索 (タイル単位)
        const tx = Math.floor(x / ts);
        const ty = Math.floor(y / ts);
        const maxDist = 5; // 最大5タイル分探索

        for (let d = 1; d <= maxDist; d++) {
            for (let dx = -d; dx <= d; dx++) {
                for (let dy = -d; dy <= d; dy++) {
                    if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;

                    const ntx = tx + dx;
                    const nty = ty + dy;

                    if (ntx < 0 || ntx >= mw || nty < 0 || nty >= mh) continue;

                    if (game.map.tiles[nty][ntx] === 0) {
                        // タイルの中心を候補とする
                        const nx = (ntx + 0.5) * ts - cw / 2;
                        const ny = (nty + 0.5) * ts - ch / 2;
                        if (isSafe(nx, ny)) {
                            return { x: nx, y: ny };
                        }
                    }
                }
            }
        }

        // 見つからない場合は元の位置を返す（フォールバック）
        return { x, y };
    }

    update(dt) {
        // Static entity, no movement
    }

    draw(ctx, alpha = 1) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;
        const img = this.opened ? this.imageOpen : this.imageClosed;

        if (img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, interpX, interpY, this.width, this.height);
        } else {
            // Fallback rendering
            ctx.fillStyle = this.opened ? '#8B4513' : this.color; // Brown if opened
            ctx.fillRect(interpX, interpY, this.width, this.height);

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(interpX, interpY, this.width, this.height);

            // Lock detail
            if (!this.opened) {
                ctx.fillStyle = '#000';
                ctx.fillRect(interpX + 12, interpY + 12, 6, 6);
            }
        }
    }

    getInteractPrompt() {
        if (this.opened) return null;
        return "[SPACE] 宝箱を開ける";
    }

    interact() {
        if (!this.opened) {
            this.open();
        }
    }

    open() {
        if (this.opened) return;
        this.opened = true;

        // Pick 3 random unique skills
        const shuffled = [...skillsDB].sort(() => 0.5 - Math.random());
        const selectedOptions = shuffled.slice(0, 3);

        this.game.triggerSkillSelection(selectedOptions);
    }
}
