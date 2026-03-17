export class MapRenderer {
    constructor(map) {
        this.map = map;
    }

    draw(ctx, camera, player, debugMode = false) {
        const startX = Math.floor(camera.x / this.map.tileSize);
        const startY = Math.floor(camera.y / this.map.tileSize);
        const endX = startX + Math.ceil(camera.width / this.map.tileSize) + 1;
        const endY = startY + Math.ceil(camera.height / this.map.tileSize) + 1;

        const ts = this.map.tileSize;
        const rimSize = 10;

        // Pre-create gradient patterns relative to origin (0,0)
        // These will be translated per-tile to avoid object creation in the nested loop
        const gradN = ctx.createLinearGradient(0, 0, 0, rimSize);
        gradN.addColorStop(0, '#555');
        gradN.addColorStop(1, '#000');

        const gradS = ctx.createLinearGradient(0, -rimSize, 0, 0);
        gradS.addColorStop(0, '#000');
        gradS.addColorStop(1, '#555');

        const gradW = ctx.createLinearGradient(0, 0, rimSize, 0);
        gradW.addColorStop(0, '#555');
        gradW.addColorStop(1, '#000');

        const gradE = ctx.createLinearGradient(ts, 0, ts - rimSize, 0);
        gradE.addColorStop(0, '#555');
        gradE.addColorStop(1, '#000');

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
                        const seed = x * 31 + y * 17;
                        const isBlood = (seed % 100) < 30;
                        
                        let wallImg;
                        if (isBlood && this.map.bloodWallImages && this.map.bloodWallImages.length > 0) {
                            const bloodIdx = (x * 3 + y * 5) % this.map.bloodWallImages.length;
                            wallImg = this.map.bloodWallImages[bloodIdx];
                        } else {
                            const wallIdx = (x * 7 + y * 13) % this.map.wallImages.length;
                            wallImg = this.map.wallImages[wallIdx];
                        }

                        if (wallImg && wallImg.complete && wallImg.naturalWidth !== 0) {
                            ctx.drawImage(wallImg, tx, ty, ts, ts);
                        } else {
                            ctx.fillStyle = '#666'; // Fallback highlight
                            ctx.fillRect(tx, ty, ts, ts);
                        }

                        // Step 3.5: Draw Decorations (Vines)
                        let decoSeed = (x * 12347 + y * 67891) >>> 0;
                        // Better mixing to avoid linear patterns (natural clumps/gaps)
                        decoSeed = Math.imul(decoSeed ^ (decoSeed >>> 15), 0x85ebca6b);
                        decoSeed = (decoSeed ^ (decoSeed >>> 13)) >>> 0;

                        if (decoSeed % 100 < 25) { // 25% chance
                            const decoImages = this.map.decorationImages;
                            if (decoImages && decoImages.length > 0) {
                                const decoImg = decoImages[decoSeed % decoImages.length];
                                if (decoImg && decoImg.complete && decoImg.naturalWidth !== 0) {
                                    // Back to fixed grid placement
                                    ctx.drawImage(decoImg, tx, ty, ts, ts);

                                    // Step 3.6: Draw Overlay (nives4) with 30% chance if vines are present
                                    const overlaySeed = Math.imul(decoSeed, 0x12347) >>> 0;
                                    if (overlaySeed % 100 < 30) {
                                        const overlayImg = this.map.vinesOverlayImage;
                                        if (overlayImg && overlayImg.complete && overlayImg.naturalWidth !== 0) {
                                            ctx.drawImage(overlayImg, tx, ty, ts, ts);
                                        }
                                    }
                                }
                            }
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
                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.fillStyle = gradN;

                        const offsetW = hasWestRim ? rimSize : 0;
                        const offsetE = hasEastRim ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(ts, 0);
                        ctx.lineTo(ts - offsetE, rimSize);
                        ctx.lineTo(offsetW, rimSize);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    } else if (isFloorS) {
                        // Front-facing wall (Floor to the South) - Draw ABOVE the tile for thickness
                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.fillStyle = gradS;

                        // No side miters needed as side rims are suppressed on standard front walls
                        ctx.fillRect(0, -rimSize, ts, rimSize);
                        ctx.restore();
                    }

                    // West rim (Mitered)
                    if (hasWestRim) {
                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.fillStyle = gradW;

                        const offsetN = isFloorN ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(rimSize, offsetN);
                        ctx.lineTo(rimSize, ts);
                        ctx.lineTo(0, ts);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }

                    // East rim (Mitered)
                    if (hasEastRim) {
                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.fillStyle = gradE;

                        const offsetN = isFloorN ? rimSize : 0;

                        ctx.beginPath();
                        ctx.moveTo(ts, 0);
                        ctx.lineTo(ts, ts);
                        ctx.lineTo(ts - rimSize, ts);
                        ctx.lineTo(ts - rimSize, offsetN);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
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
                // If this floor has a boss, hide portal until defeated
                if (this.map.hasBoss && !this.map.bossDefeated) continue;

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
                        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)'; // Semi-transparent pink
                        ctx.fillRect(x * this.map.tileSize, y * this.map.tileSize, this.map.tileSize, this.map.tileSize);
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
