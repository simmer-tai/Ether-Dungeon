export class RoomConnector {
    constructor(map) {
        this.map = map;
    }

    getValidRoomPoint(room) {
        // Try the geometric center first
        const cx = room.x + Math.floor(room.w / 2);
        const cy = room.y + Math.floor(room.h / 2);
        if (this.map.tiles[cy][cx] === 0) return { x: cx, y: cy };

        // Spiral search or simple scan for a valid floor tile
        for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
            for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
                if (this.map.tiles[y][x] === 0) {
                    return { x, y };
                }
            }
        }
        return { x: cx, y: cy }; // Fallback
    }

    checkConnectivity() {
        if (this.map.rooms.length === 0) return { success: false, unreachable: [] };

        const startRoom = this.map.rooms[0];
        const startPoint = this.getValidRoomPoint(startRoom);

        const queue = [startPoint];
        const visited = new Set();
        visited.add(`${startPoint.x},${startPoint.y}`);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [
                { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }
            ];

            for (let n of neighbors) {
                if (n.x < 0 || n.x >= this.map.width || n.y < 0 || n.y >= this.map.height) continue;
                const tile = this.map.tiles[n.y][n.x];
                if (tile !== 0 && tile !== 2) continue;

                const key = `${n.x},${n.y}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(n);
                }
            }
        }

        const unreachable = [];
        for (let room of this.map.rooms) {
            const pt = this.getValidRoomPoint(room);
            // Even if the point is different, if the room is connected, this point should be reachable
            if (!visited.has(`${pt.x},${pt.y}`)) {
                unreachable.push(room);
            }
        }

        if (unreachable.length > 0) {
            return { success: false, unreachable: unreachable };
        }
        return { success: true, unreachable: [] };
    }

    forceConnectivity(unreachableRooms) {
        if (!unreachableRooms || unreachableRooms.length === 0) return;

        console.log(`Forcing connections for ${unreachableRooms.length} rooms to nearest paths...`);
        const startRoom = this.map.rooms[0];
        const startPoint = this.getValidRoomPoint(startRoom);

        const queue = [startPoint];
        const visited = new Set();
        visited.add(`${startPoint.x},${startPoint.y}`);
        const accessibleTiles = [startPoint];

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [
                { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }
            ];

            for (let n of neighbors) {
                if (n.x < 0 || n.x >= this.map.width || n.y < 0 || n.y >= this.map.height) continue;
                const tile = this.map.tiles[n.y][n.x];
                if (tile !== 0 && tile !== 2) continue;

                const key = `${n.x},${n.y}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(n);
                    accessibleTiles.push(n);
                }
            }
        }

        for (let room of unreachableRooms) {
            const roomPt = this.getValidRoomPoint(room);
            const cx = roomPt.x;
            const cy = roomPt.y;

            let bestTile = null;
            let minDst = Infinity;

            for (let tile of accessibleTiles) {
                const dst = Math.abs(cx - tile.x) + Math.abs(cy - tile.y);
                if (dst < minDst) {
                    minDst = dst;
                    bestTile = tile;
                }
            }

            if (bestTile) {
                const tx = bestTile.x;
                const ty = bestTile.y;
                const setTile = (tx, ty) => {
                    if (tx >= 0 && tx < this.map.width && ty >= 0 && ty < this.map.height)
                        this.map.tiles[ty][tx] = 0;
                };

                const xDir = tx > cx ? 1 : -1;
                for (let x = cx; x !== tx; x += xDir) {
                    setTile(x, cy);
                    setTile(x, cy + 1);
                }
                const yDir = ty > cy ? 1 : -1;
                for (let y = cy; y !== ty; y += yDir) {
                    setTile(tx, y);
                    setTile(tx + 1, y);
                }
                setTile(tx, cy); setTile(tx, cy + 1);
                setTile(tx + 1, cy); setTile(tx + 1, cy + 1);
            }
        }
    }

    connectRooms() {
        const connectedPairs = new Set();
        const getPairId = (r1, r2) => {
            const id1 = Math.min(r1.id, r2.id);
            const id2 = Math.max(r1.id, r2.id);
            return `${id1}-${id2}`;
        };

        for (let i = 0; i < this.map.rooms.length - 1; i++) {
            const r1 = this.map.rooms[i];
            const r2 = this.map.rooms[i + 1];
            const pairId = getPairId(r1, r2);
            if (!connectedPairs.has(pairId)) {
                this.connectTwoRooms(r1, r2);
                connectedPairs.add(pairId);
            }
        }

        for (let i = 0; i < this.map.rooms.length; i++) {
            if (Math.random() < 0.1) {
                const rA = this.map.rooms[i];
                const rB = this.map.rooms[Math.floor(Math.random() * this.map.rooms.length)];
                if (rA !== rB) {
                    const pairId = getPairId(rA, rB);
                    if (!connectedPairs.has(pairId)) {
                        this.connectTwoRooms(rA, rB);
                        connectedPairs.add(pairId);
                    }
                }
            }
        }

        for (let room of this.map.rooms) {
            for (let c of room.connectors) {
                if (!c.used) {
                    let bestRoom = null;
                    let minDistance = Infinity;

                    for (let other of this.map.rooms) {
                        if (room === other) continue;
                        const dist = Math.abs(room.x - other.x) + Math.abs(room.y - other.y);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestRoom = other;
                        }
                    }

                    if (bestRoom) {
                        this.connectTwoRooms(room, bestRoom, c);
                    }

                    if (!c.used) {
                        this.forceConnectConnector(room, c);
                    }
                }
            }
        }
    }

    forceConnectConnector(room, connector) {
        const rayDist = 20;
        let targetDist = -1;

        for (let d = 1; d <= rayDist; d++) {
            const tx = connector.x + connector.dir.x * d;
            const ty = connector.y + connector.dir.y * d;

            if (tx <= 0 || tx >= this.map.width - 1 || ty <= 0 || ty >= this.map.height - 1) break;

            const rId = this.map.roomGrid[ty][tx];
            const tile = this.map.tiles[ty][tx];

            if (rId !== -1 && rId !== room.id) break;

            if (tile === 0 || tile === 2) {
                let density = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (this.map.isValid(tx + dx, ty + dy)) {
                            const t = this.map.tiles[ty + dy][tx + dx];
                            const r = this.map.roomGrid[ty + dy][tx + dx];
                            if (t === 0 || t === 2 || r !== -1) density++;
                        }
                    }
                }

                if (density >= 5) {
                    targetDist = d;
                    break;
                } else {
                    break;
                }
            }
        }

        if (targetDist !== -1) {
            let safe = true;
            for (let d = 1; d <= targetDist; d++) {
                const tx = connector.x + connector.dir.x * d;
                const ty = connector.y + connector.dir.y * d;
                for (let by = ty - 1; by <= ty + 2; by++) {
                    for (let bx = tx - 1; bx <= tx + 2; bx++) {
                        if (!this.map.isValid(bx, by)) continue;
                        const rId = this.map.roomGrid[by][bx];
                        if (rId === room.id) continue;
                        if (rId !== -1) {
                            if (d < targetDist - 2) {
                                safe = false;
                                break;
                            }
                        }
                    }
                    if (!safe) break;
                }
                if (!safe) break;
            }

            if (safe) {
                connector.used = true;
                this.map.tiles[connector.y][connector.x] = 0;
                if (connector.dir.x === 0) {
                    if (this.map.isValid(connector.x + 1, connector.y)) {
                        this.map.tiles[connector.y][connector.x + 1] = 0;
                    }
                } else {
                    if (this.map.isValid(connector.x, connector.y + 1)) {
                        this.map.tiles[connector.y + 1][connector.x] = 0;
                    }
                }

                let cx = connector.x;
                let cy = connector.y;
                for (let d = 0; d < targetDist; d++) {
                    cx += connector.dir.x;
                    cy += connector.dir.y;
                    this.map.tiles[cy][cx] = 0;

                    if (connector.dir.x === 0) {
                        if (d >= targetDist - 1) this.map.tiles[cy][cx + 1] = 0;
                        else this.map.tiles[cy][cx + 1] = 0;
                    } else {
                        if (d >= targetDist - 1) this.map.tiles[cy + 1][cx] = 0;
                        else this.map.tiles[cy + 1][cx] = 0;
                    }
                }
                return;
            }
        }

        let bestTile = null;
        let minDst = Infinity;
        const searchRadius = 40;
        const cx = connector.x;
        const cy = connector.y;
        for (let sy = Math.max(1, cy - searchRadius); sy < Math.min(this.map.height - 1, cy + searchRadius); sy++) {
            for (let sx = Math.max(1, cx - searchRadius); sx < Math.min(this.map.width - 1, cx + searchRadius); sx++) {
                const tile = this.map.tiles[sy][sx];
                const rId = this.map.roomGrid[sy][sx];
                if ((tile === 0 || tile === 2) && rId !== room.id) {
                    const dst = Math.abs(cx - sx) + Math.abs(cy - sy);
                    if (dst < minDst) {
                        minDst = dst;
                        bestTile = { x: sx, y: sy };
                    }
                }
            }
        }

        if (bestTile) {
            const leadDist = 3;
            let currentX = connector.x;
            let currentY = connector.y;
            let validLead = true;
            for (let i = 0; i < leadDist; i++) {
                const nextX = currentX + connector.dir.x;
                const nextY = currentY + connector.dir.y;
                if (nextX > 0 && nextX < this.map.width - 1 && nextY > 0 && nextY < this.map.height - 1) {
                    currentX = nextX;
                    currentY = nextY;
                } else {
                    validLead = false;
                    break;
                }
            }

            if (!validLead) return;

            const startNode = { x: currentX, y: currentY };
            const path = this.map.pathfinder.findRobustPath(startNode, bestTile, room.id);

            if (path) {
                connector.used = true;
                this.map.tiles[connector.y][connector.x] = 0;
                if (connector.dir.x === 0) {
                    if (this.map.isValid(connector.x + 1, connector.y)) {
                        this.map.tiles[connector.y][connector.x + 1] = 0;
                    }
                } else {
                    if (this.map.isValid(connector.x, connector.y + 1)) {
                        this.map.tiles[connector.y + 1][connector.x] = 0;
                    }
                }

                let lx = connector.x;
                let ly = connector.y;
                for (let i = 0; i < leadDist; i++) {
                    lx += connector.dir.x;
                    ly += connector.dir.y;
                    this.map.tiles[ly][lx] = 0;
                    if (connector.dir.x === 0) {
                        if (this.map.isValid(lx + 1, ly)) {
                            this.map.tiles[ly][lx + 1] = 0;
                        }
                    } else {
                        if (this.map.isValid(lx, ly + 1)) {
                            this.map.tiles[ly + 1][lx] = 0;
                        }
                    }
                }

                for (let node of path) {
                    this.map.tiles[node.y][node.x] = 0;
                    if (this.map.isValid(node.x + 1, node.y)) {
                        this.map.tiles[node.y][node.x + 1] = 0;
                    }
                    if (this.map.isValid(node.x, node.y + 1)) {
                        this.map.tiles[node.y + 1][node.x] = 0;
                    }
                    if (this.map.isValid(node.x + 1, node.y + 1)) {
                        this.map.tiles[node.y + 1][node.x + 1] = 0;
                    }
                }

                // Re-open the connector entrance (direction-aware) to guarantee 2-tile width
                // The fill2x2 above may not align for W/N-facing connectors
                this.map.tiles[connector.y][connector.x] = 0;
                if (connector.dir.x === 0) {
                    // N/S: 2nd tile is at x+1
                    if (this.map.isValid(connector.x + 1, connector.y))
                        this.map.tiles[connector.y][connector.x + 1] = 0;
                } else {
                    // E/W: 2nd tile is at y+1
                    if (this.map.isValid(connector.x, connector.y + 1))
                        this.map.tiles[connector.y + 1][connector.x] = 0;
                }
            }
        }
    }

    connectTwoRooms(r1, r2, forceStartConnector = null) {
        let bestPair = null;
        let minScore = Infinity;
        const startConnectors = forceStartConnector ? [forceStartConnector] : r1.connectors;

        for (let c1 of startConnectors) {
            for (let c2 of r2.connectors) {
                const dist = Math.abs(c1.x - c2.x) + Math.abs(c1.y - c2.y);
                let score = dist;
                if (c1.x === c2.x || c1.y === c2.y) score -= 50;
                if (score < minScore) {
                    minScore = score;
                    bestPair = { start: c1, end: c2 };
                }
            }
        }

        if (bestPair) {
            let path = this.map.pathfinder.findPath(bestPair.start, bestPair.end, r1, r2, false);
            if (!path) {
                path = this.map.pathfinder.findPath(bestPair.start, bestPair.end, r1, r2, true);
            }
            if (path) {
                this.map.renderer.drawPath(path);

                // Explicitly open the 2-tile entrance at each connector (direction-aware).
                // drawPath's fill2x2 always expands +x/+y, which can miss one entrance tile
                // when the path approaches from a perpendicular direction.
                const openConnector = (c) => {
                    this.map.tiles[c.y][c.x] = 0;
                    if (c.dir.x === 0) {
                        // N/S connector: entrance is side-by-side horizontally (x and x+1)
                        if (this.map.isValid(c.x + 1, c.y)) this.map.tiles[c.y][c.x + 1] = 0;
                    } else {
                        // E/W connector: entrance is stacked vertically (y and y+1)
                        if (this.map.isValid(c.x, c.y + 1)) this.map.tiles[c.y + 1][c.x] = 0;
                    }
                };
                openConnector(bestPair.start);
                openConnector(bestPair.end);

                bestPair.start.used = true;
                bestPair.end.used = true;
            }
        }
    }
}
