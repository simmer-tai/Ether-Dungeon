export class MapRenderer {
    constructor(map) {
        this.map = map;
    }

    draw(ctx, camera, player, debugMode = false) {
        const startX = Math.floor(camera.x / this.map.tileSize);
        const startY = Math.floor(camera.y / this.map.tileSize);
        const endX = startX + Math.ceil(camera.width / this.map.tileSize) + 1;
        const endY = startY + Math.ceil(camera.height / this.map.tileSize) + 1;

        for (let y = Math.max(0, startY); y < Math.min(this.map.height, endY); y++) {
            for (let x = Math.max(0, startX); x < Math.min(this.map.width, endX); x++) {
                if (this.map.tiles[y][x] === 1 || this.map.tiles[y][x] === 2) {
                    const tx = Math.floor(x * this.map.tileSize);
                    const ty = Math.floor(y * this.map.tileSize);
                    const ts = this.map.tileSize;

                    // Step 1: Default to solid black for any wall interior
                    ctx.fillStyle = '#000';
                    ctx.fillRect(tx, ty, ts, ts);

                    // Step 2: Neighbor check (Cardinal floor check + Map edges)
                    const isFloorS = y === this.map.height - 1 || this.map.tiles[y + 1][x] === 0;
                    const isFloorN = y === 0 || this.map.tiles[y - 1][x] === 0;
                    const isFloorW = x === 0 || this.map.tiles[y][x - 1] === 0;
                    const isFloorE = x === this.map.width - 1 || this.map.tiles[y][x + 1] === 0;

                    // Diagonals for special corner rims (only if cardinally surrounded by walls)
                    const isFloorSW = y < this.map.height - 1 && x > 0 && this.map.tiles[y + 1][x - 1] === 0;
                    const isFloorSE = y < this.map.height - 1 && x < this.map.width - 1 && this.map.tiles[y + 1][x + 1] === 0;
                    const isAllWall = !isFloorN && !isFloorS && !isFloorW && !isFloorE;

                    // Step 3: Render Southern Face (The main front texture)
                    if (isFloorS && y < this.map.height - 1 && this.map.tiles[y + 1][x] === 0) {
                        if (this.map.wallImage.complete && this.map.wallImage.naturalWidth !== 0) {
                            ctx.drawImage(this.map.wallImage, tx, ty, ts, ts);
                        } else {
                            ctx.fillStyle = '#666'; // Fallback highlight
                            ctx.fillRect(tx, ty, ts, ts);
                        }
                    }

                    // Step 4: Add Gradient "Rims" for all exposed directions
                    const rimSize = 10;
                    // Side rims are suppressed on front-facing walls (isFloorS)
                    // Exception: Draw side rim if surrounded by walls but has diagonal floor floor (inner corner)
                    const hasWestRim = (isFloorW && !isFloorS) || (isAllWall && isFloorSW);
                    const hasEastRim = (isFloorE && !isFloorS) || (isAllWall && isFloorSE);

                    // North rim (Mitered) - Highlight/Thickness for the top edge
                    if (isFloorN) {
                        // Back-facing wall (Floor is to the North) - Draw inside
                        const grad = ctx.createLinearGradient(tx, ty, tx, ty + rimSize);
                        grad.addColorStop(0, '#555');
                        grad.addColorStop(1, '#000');
                        ctx.fillStyle = grad;

                        const offsetW = hasWestRim ? rimSize : 0;
                        const offsetE = hasEastRim ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(tx + ts, ty);
                        ctx.lineTo(tx + ts - offsetE, ty + rimSize);
                        ctx.lineTo(tx + offsetW, ty + rimSize);
                        ctx.closePath();
                        ctx.fill();
                    } else if (isFloorS) {
                        // Front-facing wall (Floor to the South) - Draw ABOVE the tile for thickness
                        const grad = ctx.createLinearGradient(tx, ty - rimSize, tx, ty);
                        grad.addColorStop(0, '#000'); // Darkest at the very top edge
                        grad.addColorStop(1, '#555'); // Brighter at the wall face junction
                        ctx.fillStyle = grad;

                        // No side miters needed as side rims are suppressed on standard front walls
                        ctx.fillRect(tx, ty - rimSize, ts, rimSize);
                    }

                    // West rim (Mitered)
                    if (hasWestRim) {
                        const grad = ctx.createLinearGradient(tx, ty, tx + rimSize, ty);
                        grad.addColorStop(0, '#555');
                        grad.addColorStop(1, '#000');
                        ctx.fillStyle = grad;

                        const offsetN = isFloorN ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(tx, ty);
                        ctx.lineTo(tx + rimSize, ty + offsetN);
                        ctx.lineTo(tx + rimSize, ty + ts);
                        ctx.lineTo(tx, ty + ts);
                        ctx.closePath();
                        ctx.fill();
                    }

                    // East rim (Mitered)
                    if (hasEastRim) {
                        const grad = ctx.createLinearGradient(tx + ts, ty, tx + ts - rimSize, ty);
                        grad.addColorStop(0, '#555');
                        grad.addColorStop(1, '#000');
                        ctx.fillStyle = grad;

                        const offsetN = isFloorN ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(tx + ts, ty);
                        ctx.lineTo(tx + ts, ty + ts);
                        ctx.lineTo(tx + ts - rimSize, ty + ts);
                        ctx.lineTo(tx + ts - rimSize, ty + offsetN);
                        ctx.closePath();
                        ctx.fill();
                    }

                    // Step 5: Special handling for Type 2 (Locked Doors) red X
                    if (this.map.tiles[y][x] === 2) {
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(tx + 5, ty + 5);
                        ctx.lineTo(tx + ts - 5, ty + ts - 5);
                        ctx.moveTo(tx + ts - 5, ty + 5);
                        ctx.lineTo(tx + 5, ty + ts - 5);
                        ctx.stroke();
                        ctx.strokeRect(tx, ty, ts, ts);
                    }
                }
                else {
                    const px = Math.floor(x * this.map.tileSize);
                    const py = Math.floor(y * this.map.tileSize);

                    if (this.map.floorImage.complete && this.map.floorImage.naturalWidth !== 0) {
                        ctx.drawImage(this.map.floorImage, px, py, this.map.tileSize, this.map.tileSize);
                    } else {
                        ctx.fillStyle = '#222';
                        ctx.fillRect(px, py, this.map.tileSize, this.map.tileSize);
                        ctx.strokeStyle = '#2a2a2a';
                        ctx.strokeRect(px, py, this.map.tileSize, this.map.tileSize);
                    }
                }
            }
        }

        for (const room of this.map.rooms) {
            if (room.type === 'staircase') {
                if (room.x * this.map.tileSize > endX * this.map.tileSize || (room.x + room.w) * this.map.tileSize < startX * this.map.tileSize ||
                    room.y * this.map.tileSize > endY * this.map.tileSize || (room.y + room.h) * this.map.tileSize < startY * this.map.tileSize) {
                    continue;
                }

                const centerX = room.x + Math.floor(room.w / 2);
                const centerY = room.y + Math.floor(room.h / 2);
                const centerPixelX = (centerX) * this.map.tileSize;
                const centerPixelY = (centerY) * this.map.tileSize;

                if (room.currentPortalScale === undefined) room.currentPortalScale = 0.3;
                let targetScale = 0.3;
                if (player) {
                    const dist = Math.sqrt((player.x + player.width / 2 - centerPixelX) ** 2 + (player.y + player.height / 2 - centerPixelY) ** 2);
                    if (dist < 100) targetScale = 1.5;
                }
                room.currentPortalScale += (targetScale - room.currentPortalScale) * 0.02;

                if (this.map.stairsImage.complete && this.map.stairsImage.naturalWidth !== 0) {
                    ctx.save();
                    ctx.translate(centerPixelX, centerPixelY);
                    ctx.scale(room.currentPortalScale, room.currentPortalScale);
                    ctx.rotate(performance.now() * 0.0005);
                    ctx.drawImage(this.map.stairsImage, -this.map.tileSize, -this.map.tileSize, this.map.tileSize * 2, this.map.tileSize * 2);
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.translate(centerPixelX, centerPixelY);
                    ctx.scale(room.currentPortalScale, room.currentPortalScale);
                    ctx.fillStyle = '#4488ff';
                    ctx.fillRect(-this.map.tileSize, -this.map.tileSize, this.map.tileSize * 2, this.map.tileSize * 2);
                    ctx.restore();
                }
            }
        }

        if (debugMode) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '10px sans-serif';
            for (let y = Math.max(0, startY); y < Math.min(this.map.height, endY); y++) {
                for (let x = Math.max(0, startX); x < Math.min(this.map.width, endX); x++) {
                    if (this.map.tiles[y][x] === 0 && this.map.roomGrid[y][x] === -1) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.fillText('Path', x * this.map.tileSize + this.map.tileSize / 2, y * this.map.tileSize + this.map.tileSize / 2);
                    }
                }
            }
            for (let room of this.map.rooms) {
                if (room.x + room.w < startX || room.x > endX || room.y + room.h < startY || room.y > endY) continue;
                ctx.fillStyle = 'white';
                ctx.font = '14px sans-serif';
                ctx.fillText(`Room ${room.id}`, (room.x + room.w / 2) * this.map.tileSize, (room.y + room.h / 2) * this.map.tileSize);
                ctx.font = '10px sans-serif';
                ctx.fillStyle = '#00ff00';
                for (let c of room.connectors) {
                    ctx.fillText('Door', c.x * this.map.tileSize + this.map.tileSize / 2, c.y * this.map.tileSize + this.map.tileSize / 2);
                }
            }
        }
    }

    drawPath(path) {
        if (!path || path.length < 2) return;
        const fill2x2 = (x, y) => {
            if (y >= 0 && y < this.map.height && x >= 0 && x < this.map.width) this.map.tiles[y][x] = 0;
            if (y >= 0 && y < this.map.height && x + 1 >= 0 && x + 1 < this.map.width) this.map.tiles[y][x + 1] = 0;
            if (y + 1 >= 0 && y + 1 < this.map.height && x >= 0 && x < this.map.width) this.map.tiles[y + 1][x] = 0;
            if (y + 1 >= 0 && y + 1 < this.map.height && x + 1 >= 0 && x + 1 < this.map.width) this.map.tiles[y + 1][x + 1] = 0;
        };

        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            fill2x2(p.x, p.y);

            if (i > 0) {
                const prev = path[i - 1];
                if (Math.abs(p.x - prev.x) === 1 && Math.abs(p.y - prev.y) === 1) {
                    fill2x2(prev.x, p.y);
                    fill2x2(p.x, prev.y);
                }
            }
        }

        let startIndex = 0;
        let p0 = path[0], p1 = path[1];
        let currentDir = { x: Math.sign(p1.x - p0.x), y: Math.sign(p1.y - p0.y) };

        for (let i = 2; i < path.length; i++) {
            const pPrev = path[i - 1], pCurr = path[i];
            const dir = { x: Math.sign(pCurr.x - pPrev.x), y: Math.sign(pCurr.y - pPrev.y) };
            if (dir.x !== currentDir.x || dir.y !== currentDir.y) {
                this.checkAndAddCrossroad(path, startIndex, i - 1, currentDir);
                startIndex = i - 1;
                currentDir = dir;
            }
        }
        this.checkAndAddCrossroad(path, startIndex, path.length - 1, currentDir);
    }

    checkAndAddCrossroad(path, startIndex, endIndex, dir) {
        const length = endIndex - startIndex;
        if (length >= 30) {
            const idealMidIndex = startIndex + Math.floor(length / 2);
            const crossLen = 3;
            for (let offset = 0; offset <= 5; offset++) {
                const candidates = [idealMidIndex + offset];
                if (offset > 0) candidates.push(idealMidIndex - offset);
                for (let idx of candidates) {
                    if (idx <= startIndex + 2 || idx >= endIndex - 2) continue;
                    const node = path[idx];
                    let canCarve = true;
                    const tilesToCarve = [];
                    if (dir.y === 0) {
                        for (let k = -crossLen; k <= crossLen; k++) {
                            tilesToCarve.push({ x: node.x, y: node.y + k });
                            tilesToCarve.push({ x: node.x + 1, y: node.y + k });
                        }
                    } else {
                        for (let k = -crossLen; k <= crossLen; k++) {
                            tilesToCarve.push({ x: node.x + k, y: node.y });
                            tilesToCarve.push({ x: node.x + k, y: node.y + 1 });
                        }
                    }
                    for (let t of tilesToCarve) {
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (!this.map.isValid(t.x + dx, t.y + dy)) continue;
                                if (this.map.roomGrid[t.y + dy][t.x + dx] !== -1) {
                                    canCarve = false;
                                    break;
                                }
                            }
                            if (!canCarve) break;
                        }
                        if (!canCarve) break;
                    }
                    if (canCarve) {
                        for (let t of tilesToCarve) {
                            if (this.map.isValid(t.x, t.y)) this.map.tiles[t.y][t.x] = 0;
                        }
                        return;
                    }
                }
            }
        }
    }
}
