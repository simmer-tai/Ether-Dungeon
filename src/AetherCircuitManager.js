import { chipsDB } from '../data/chips_db.js';

/**
 * Manages the Aether Circuit (mod system).
 * Handles equipped chips, capacity, and stat calculations.
 */
export class AetherCircuitManager {
    constructor(player) {
        this.player = player;
        // 5x5 grid. Initialization: null for empty, 'core' for the center.
        this.grid = Array.from({ length: 5 }, () => new Array(5).fill(null));
        this.grid[2][2] = 'core';

        this.ownedChips = []; // All chips in collection
        this.maxCapacity = 20; // Initial base capacity

        // Cache for performance
        this._needsRefresh = true;
        this._bonusesCache = null;
        this._usedCapacityCache = null;

        this.updateCapacity();
    }

    /**
     * Calculates current capacity based on level (example).
     */
    updateCapacity() {
        let base = 20 + (this.player.game.currentFloor * 2);
        if (this.player.game.debugMode) {
            base = 100;
        }

        // Add bonus from active Storage chips
        let storageBonus = 0;
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (chip && chip !== 'core' && chip.isActive && chip.isStorage) {
                    storageBonus += chip.data.ranks[0].value; // +5
                }
            }
        }

        this.maxCapacity = base + storageBonus;
    }

    invalidateCache() {
        this._needsRefresh = true;
        this._bonusesCache = null;
        this._usedCapacityCache = null;
    }

    /**
     * Recalculates which chips are connected to the core.
     * Starts BFS from core (2,2).
     */
    refreshConnections() {
        if (!this._needsRefresh) return;
        this._needsRefresh = false;

        // 1. Reset all state
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (chip && chip !== 'core') {
                    chip.isActive = false;
                    chip.activeNodes = { up: 0, down: 0, left: 0, right: 0 };
                }
            }
        }

        // 2. BFS to identify active chips
        const queue = [{ x: 2, y: 2 }];
        const visited = new Set(['2,2']);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [
                { nx: current.x, ny: current.y - 1, dir: 'up', opp: 'down' },
                { nx: current.x, ny: current.y + 1, dir: 'down', opp: 'up' },
                { nx: current.x - 1, ny: current.y, dir: 'left', opp: 'right' },
                { nx: current.x + 1, ny: current.y, dir: 'right', opp: 'left' }
            ];

            for (const { nx, ny, dir, opp } of neighbors) {
                if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
                const neighborChip = this.grid[ny][nx];
                if (!neighborChip || neighborChip === 'core' || visited.has(`${nx},${ny}`)) continue;
                
                // Only consider deployed chips (or the core) for connections
                const effectivelyDeployed = this.player.game.currentFloor === 0 || neighborChip.isDeployed;
                if (!effectivelyDeployed) continue;

                // Check if connection exists
                const currentChip = this.grid[current.y][current.x];
                let connected = false;

                // Helper to check if a connection is valid
                const isConnectionValid = (nodeA, nodeB) => {
                    if (nodeA === 'universal' && nodeB > 0) return true;
                    if (nodeB === 'universal' && nodeA > 0) return true;
                    if (nodeA === 'universal' && nodeB === 'universal') return true;
                    return nodeA > 0 && nodeA === nodeB;
                };

                if (currentChip === 'core') {
                    if (neighborChip.nodes[opp] > 0 || neighborChip.nodes[opp] === 'universal') connected = true;
                } else {
                    if (isConnectionValid(currentChip.nodes[dir], neighborChip.nodes[opp])) {
                        connected = true;
                    }
                }

                if (connected) {
                    neighborChip.isActive = true;
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny });
                }
            }
        }

        // 3. Mark ALL valid glowing nodes (between any two active entities)
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (!chip || chip === 'core' || !chip.isActive) continue;

                const check = [
                    { nx: x, ny: y - 1, dir: 'up', opp: 'down' },
                    { nx: x, ny: y + 1, dir: 'down', opp: 'up' },
                    { nx: x - 1, ny: y, dir: 'left', opp: 'right' },
                    { nx: x + 1, ny: y, dir: 'right', opp: 'left' }
                ];

                const isConnectionValid = (nodeA, nodeB) => {
                    if (nodeA === 'universal' && nodeB > 0) return true;
                    if (nodeB === 'universal' && nodeA > 0) return true;
                    if (nodeA === 'universal' && nodeB === 'universal') return true;
                    return nodeA > 0 && nodeA === nodeB;
                };

                for (const { nx, ny, dir, opp } of check) {
                    if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
                    const neighbor = this.grid[ny][nx];
                    if (!neighbor) continue;

                    if (neighbor === 'core' || neighbor.isActive) {
                        if (neighbor === 'core') {
                            if (chip.nodes[dir] > 0 || chip.nodes[dir] === 'universal') {
                                chip.activeNodes[dir] = chip.nodes[dir] === 'universal' ? 3 : chip.nodes[dir];
                            }
                        } else {
                            if (isConnectionValid(chip.nodes[dir], neighbor.nodes[opp])) {
                                chip.activeNodes[dir] = chip.nodes[dir] === 'universal' ? neighbor.nodes[opp] : chip.nodes[dir];
                                if (chip.nodes[dir] === 'universal' && neighbor.nodes[opp] === 'universal') chip.activeNodes[dir] = 3;
                            }
                        }
                    }
                }
            }
        }

        // After refreshing connections, update the capacity limits
        this.updateCapacity();
    }

    get usedCapacity() {
        if (this._usedCapacityCache !== null) return this._usedCapacityCache;
        this.refreshConnections();
        let total = 0;

        const isConnectionValid = (nodeA, nodeB) => {
            if (nodeA === 'universal' && nodeB > 0) return true;
            if (nodeB === 'universal' && nodeA > 0) return true;
            if (nodeA === 'universal' && nodeB === 'universal') return true;
            return nodeA > 0 && nodeA === nodeB;
        };

        const getConnectionCost = (nodeA, nodeB) => {
            // How much capacity does this connection cost?
            // Usually it's the number of nodes (which are equal). 
            // If one is universal, it costs the other's node count.
            // If both are universal, let's say it costs 3.
            if (nodeA === 'universal' && nodeB === 'universal') return 3;
            if (nodeA === 'universal') return nodeB;
            if (nodeB === 'universal') return nodeA;
            return nodeA; // They are equal
        };

        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const current = this.grid[y][x];
                if (!current || (current !== 'core' && !current.isActive)) continue;

                // Check Right (x+1)
                if (x < 4) {
                    const right = this.grid[y][x + 1];
                    if (right && (right === 'core' || right.isActive)) {
                        const isCurrentSpecial = current !== 'core' && current.isSpecial;
                        const isRightSpecial = right !== 'core' && right.isSpecial;

                        if (!isCurrentSpecial && !isRightSpecial) {
                            if (current === 'core') {
                                if (right.nodes.left > 0 || right.nodes.left === 'universal') {
                                    total += right.nodes.left === 'universal' ? 3 : right.nodes.left;
                                }
                            } else if (right === 'core') {
                                if (current.nodes.right > 0 || current.nodes.right === 'universal') {
                                    total += current.nodes.right === 'universal' ? 3 : current.nodes.right;
                                }
                            } else if (isConnectionValid(current.nodes.right, right.nodes.left)) {
                                total += getConnectionCost(current.nodes.right, right.nodes.left);
                            }
                        }
                    }
                }

                // Check Down (y+1)
                if (y < 4) {
                    const down = this.grid[y + 1][x];
                    if (down && (down === 'core' || down.isActive)) {
                        const isCurrentSpecial = current !== 'core' && current.isSpecial;
                        const isDownSpecial = down !== 'core' && down.isSpecial;

                        if (!isCurrentSpecial && !isDownSpecial) {
                            if (current === 'core') {
                                if (down.nodes.up > 0 || down.nodes.up === 'universal') {
                                    total += down.nodes.up === 'universal' ? 3 : down.nodes.up;
                                }
                            } else if (down === 'core') {
                                if (current.nodes.down > 0 || current.nodes.down === 'universal') {
                                    total += current.nodes.down === 'universal' ? 3 : current.nodes.down;
                                }
                            } else if (isConnectionValid(current.nodes.down, down.nodes.up)) {
                                total += getConnectionCost(current.nodes.down, down.nodes.up);
                            }
                        }
                    }
                }
            }
        }
        this._usedCapacityCache = total;
        return total;
    }

    /**
     * Equips a chip to a specific grid coordinate.
     * Returns true if successful, or an object { duplicatePos: {x, y} } if rejected due to duplication.
     */
    equipChip(chipInstance, x, y) {
        this.invalidateCache();
        if (x < 0 || x >= 5 || y < 0 || y >= 5) return false;
        if (this.grid[y][x] === 'core') return false;

        // 1. Check for duplicate chips of the same type (excluding the one being moved)
        // [FIX] Skip duplication check for Special chips (Storage, Connector)
        if (!chipInstance.isSpecial) {
            for (let gy = 0; gy < 5; gy++) {
                for (let gx = 0; gx < 5; gx++) {
                    const existing = this.grid[gy][gx];
                    if (existing && existing !== 'core' && existing !== chipInstance) {
                        if (existing.data.id === chipInstance.data.id) {
                            return { duplicatePos: { x: gx, y: gy } };
                        }
                    }
                }
            }
        }

        // Save current position for rollback
        const oldPos = { x: -1, y: -1 };
        for (let gy = 0; gy < 5; gy++) {
            for (let gx = 0; gx < 5; gx++) {
                if (this.grid[gy][gx] === chipInstance) {
                    oldPos.x = gx; oldPos.y = gy;
                }
            }
        }

        const prevInTarget = this.grid[y][x];

        // Trial placement
        if (oldPos.x !== -1) this.grid[oldPos.y][oldPos.x] = null;
        this.grid[y][x] = chipInstance;

        // Check capacity
        if (this.usedCapacity > this.maxCapacity) {
            console.warn("Aether Circuit: Over capacity!");
            // Rollback
            this.grid[y][x] = prevInTarget;
            if (oldPos.x !== -1) this.grid[oldPos.y][oldPos.x] = chipInstance;
            return false;
        }

        this.player.saveAetherData();
        return true;
    }

    unequipChip(x, y) {
        if (x >= 0 && x < 5 && y >= 0 && y < 5) {
            const chip = this.grid[y][x];
            if (chip && chip !== 'core') {
                this.invalidateCache();
                chip.isActive = false;
                chip.isDeployed = false; // Undeploy when unequipped
                chip.activeNodes = { up: 0, down: 0, left: 0, right: 0 };
                this.grid[y][x] = null;
                this.player.saveAetherData();
            }
        }
    }

    /**
     * Checks if a chip at the given coordinates can be deployed.
     * It must be adjacent to the core or an already deployed chip.
     */
    canDeployChip(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x >= 5 || y < 0 || y >= 5) return false;
        const chip = this.grid[y][x];
        if (!chip || chip === 'core' || chip.isDeployed) return false;

        const neighbors = [
            { nx: x, ny: y - 1, dir: 'up', opp: 'down' },
            { nx: x, ny: y + 1, dir: 'down', opp: 'up' },
            { nx: x - 1, ny: y, dir: 'left', opp: 'right' },
            { nx: x + 1, ny: y, dir: 'right', opp: 'left' }
        ];

        // Ensure we check connection compatibility with the deployed neighbor
        const isConnectionValid = (nodeA, nodeB) => {
            if (nodeA === 'universal' && nodeB > 0) return true;
            if (nodeB === 'universal' && nodeA > 0) return true;
            if (nodeA === 'universal' && nodeB === 'universal') return true;
            return nodeA > 0 && nodeA === nodeB;
        };

        for (const { nx, ny, dir, opp } of neighbors) {
            if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
            const neighbor = this.grid[ny][nx];

            if (neighbor === 'core') {
                if (chip.nodes[dir] > 0 || chip.nodes[dir] === 'universal') return true;
            } else if (neighbor && neighbor.isDeployed) {
                // To deploy from another valid chip, their nodes must actually match
                if (isConnectionValid(chip.nodes[dir], neighbor.nodes[opp])) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Attempts to deploy a chip using Aether Resonance points.
     */
    deployChip(x, y) {
        if (!this.canDeployChip(x, y)) return false;
        
        const chip = this.grid[y][x];
        const cost = chip.getCurrentCost() * 10; // e.g., CONFIG.RESONANCE.COST_PER_NODE = 10; imported from config? Better use dynamic or hardcode for now. 
        // We'll calculate it safely:
        let trueCost = 50; // default baseline if undefined
        if (chip.isSpecial) trueCost = 30; // Special chips are cheaper or free depending on design. Let's say 30.
        else trueCost = chip.getConnectedNodeCount() * 10; // e.g., 3 nodes = 30 points

        if (this.player.aetherResonance >= trueCost) {
            this.player.aetherResonance -= trueCost;
            chip.isDeployed = true;
            this.invalidateCache();
            this.player.saveAetherData();
            return true;
        }
        return false;
    }

    /**
     * Recalculates all bonuses from active chips, providing both current and potential totals.
     */
    getDetailedBonuses() {
        if (this._bonusesCache !== null) return this._bonusesCache;
        this.refreshConnections();
        const stats = {
            damageMult: { current: 0, potential: 0 },
            maxHp: { current: 0, potential: 0 },
            speedMult: { current: 0, potential: 0 },
            aetherChargeMult: { current: 0, potential: 0 },
            fireDamageMult: { current: 0, potential: 0 },
            critRateAdd: { current: 0, potential: 0 },
            critDamageAdd: { current: 0, potential: 0 },
            onHitDamageBuff: { current: 0, potential: 0 },
            onHitDamageBuffCooldown: { current: 999, potential: 999 },
            thunderDamageMult: { current: 0, potential: 0 },
            iceDamageMult: { current: 0, potential: 0 },
            bloodDamageMult: { current: 0, potential: 0 },
            takenDamageMult: { current: 0, potential: 0 },
            trainingKillBuff: { current: 0, potential: 0, fullPotency: 0 },
            bossDamageMult: { current: 0, potential: 0 },
            inertiaScaling: { current: 0, potential: 0 },
            ukemiChance: { current: 0, potential: 0 },
            accelerationScaling: { current: 0, potential: 0 },
            damageRandomRange: { current: 0, potential: 0 },
            poisonDamageMult: { current: 0, potential: 0 }
        };

        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (chip && chip !== 'core' && chip.isActive) {
                    const currentEffect = chip.getCurrentEffect();
                    const potentialEffect = chip.getPotentialValue('nodeScaling');
                    const et = chip.data?.effectType;
                    if (!et) continue;

                    if (et === 'damage_mult') {
                        stats.damageMult.current += currentEffect;
                        stats.damageMult.potential += potentialEffect;
                    }
                    if (et === 'max_hp') {
                        stats.maxHp.current += currentEffect;
                        stats.maxHp.potential += potentialEffect;
                    }
                    if (et === 'speed_mult') {
                        stats.speedMult.current += currentEffect;
                        stats.speedMult.potential += potentialEffect;
                    }
                    if (et === 'aether_charge_mult') {
                        stats.aetherChargeMult.current += currentEffect;
                        stats.aetherChargeMult.potential += potentialEffect;
                    }
                    if (et === 'fire_damage_mult') {
                        stats.fireDamageMult.current += currentEffect;
                        stats.fireDamageMult.potential += potentialEffect;
                    }
                    if (et === 'crit_rate_add') {
                        stats.critRateAdd.current += currentEffect;
                        stats.critRateAdd.potential += potentialEffect;
                    }
                    if (et === 'crit_damage_add') {
                        stats.critDamageAdd.current += currentEffect;
                        stats.critDamageAdd.potential += potentialEffect;
                    }
                    if (et === 'on_hit_damage_buff') {
                        stats.onHitDamageBuff.current += currentEffect;
                        stats.onHitDamageBuff.potential += potentialEffect;
                        const cdCurr = chip.getScaledValue('cooldownScaling');
                        const cdPot = chip.getPotentialValue('cooldownScaling');
                        if (cdCurr > 0) stats.onHitDamageBuffCooldown.current = Math.min(stats.onHitDamageBuffCooldown.current, cdCurr);
                        if (cdPot > 0) stats.onHitDamageBuffCooldown.potential = Math.min(stats.onHitDamageBuffCooldown.potential, cdPot);
                    }
                    if (et === 'thunder_damage_mult') {
                        stats.thunderDamageMult.current += currentEffect;
                        stats.thunderDamageMult.potential += potentialEffect;
                    }
                    if (et === 'ice_damage_mult') {
                        stats.iceDamageMult.current += currentEffect;
                        stats.iceDamageMult.potential += potentialEffect;
                    }
                    if (et === 'blood_damage_mult') {
                        stats.bloodDamageMult.current += currentEffect;
                        stats.bloodDamageMult.potential += potentialEffect;
                    }
                    if (et === 'berserker') {
                        stats.damageMult.current += currentEffect;
                        stats.damageMult.potential += potentialEffect;
                        stats.takenDamageMult.current += chip.getScaledValue('takenDamageScaling');
                        stats.takenDamageMult.potential += chip.getPotentialValue('takenDamageScaling');
                    }
                    if (et === 'training_kill_buff') {
                        stats.trainingKillBuff.current += currentEffect;
                        stats.trainingKillBuff.potential += potentialEffect;
                        // Calculation for 100 kills (max stack) assuming potential unit effect
                        stats.trainingKillBuff.fullPotency += potentialEffect * 100;
                    }
                    if (et === 'boss_damage_mult') {
                        stats.bossDamageMult.current += currentEffect;
                        stats.bossDamageMult.potential += potentialEffect;
                    }
                    if (et === 'inertia_scaling') {
                        stats.inertiaScaling.current += currentEffect;
                        stats.inertiaScaling.potential += potentialEffect;
                    }
                    if (et === 'ukemi_chance') {
                        stats.ukemiChance.current += currentEffect;
                        stats.ukemiChance.potential += potentialEffect;
                    }
                    if (et === 'acceleration_scaling') {
                        stats.accelerationScaling.current += currentEffect;
                        stats.accelerationScaling.potential += potentialEffect;
                    }
                    if (et === 'damage_random_range') {
                        stats.damageRandomRange.current += currentEffect;
                        stats.damageRandomRange.potential += potentialEffect;
                    }
                    if (et === 'poison_damage_mult') {
                        stats.poisonDamageMult.current += currentEffect;
                        stats.poisonDamageMult.potential += potentialEffect;
                    }
                }
            }
        }

        if (stats.onHitDamageBuffCooldown.current === 999) stats.onHitDamageBuffCooldown.current = 10;
        if (stats.onHitDamageBuffCooldown.potential === 999) stats.onHitDamageBuffCooldown.potential = 10;

        this._bonusesCache = stats;
        return stats;
    }

    getBonuses() {
        const detailed = this.getDetailedBonuses();
        const bonuses = {};
        Object.keys(detailed).forEach(key => {
            bonuses[key] = detailed[key].current;
        });
        return bonuses;
    }

    deserialize(data) {
        if (!data) return;

        this.ownedChips = (data.ownedChips || []).map(chipData => {
            const chip = new ChipInstance(chipData.id, chipData.level, chipData.isIdentified !== false, chipData.instanceId);
            if (chipData.nodes) chip.nodes = chipData.nodes;
            return chip;
        }).filter(chip => chip.data !== undefined);

        // Load grid placement
        if (data.gridData) {
            data.gridData.forEach(entry => {
                const chip = this.ownedChips.find(c => c.instanceId === entry.instanceId);
                if (chip && entry.x >= 0 && entry.x < 5 && entry.y >= 0 && entry.y < 5) {
                    if (this.grid[entry.y][entry.x] !== 'core') {
                        this.grid[entry.y][entry.x] = chip;
                    }
                }
            });
        }
        this.invalidateCache();
    }

    serialize() {
        const gridData = [];
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const item = this.grid[y][x];
                if (item && item !== 'core') {
                    gridData.push({ x, y, instanceId: item.instanceId });
                }
            }
        }
        return {
            ownedChips: this.ownedChips.map(c => c.serialize()),
            gridData: gridData
        };
    }

    getActiveFusions() {
        const FUSION_EFFECT_MAP = {
            corrosion:      ['fire_damage_mult',    'poison_damage_mult'],
            frostbolt:      ['ice_damage_mult',     'thunder_damage_mult'],
            sanguine:       ['blood_damage_mult',   'fire_damage_mult'],
            voltbleed:      ['thunder_damage_mult', 'blood_damage_mult'],
            frostpoison:    ['ice_damage_mult',     'poison_damage_mult'],
            stormfire:      ['fire_damage_mult',    'thunder_damage_mult'],
            blood_crit:     ['crit_rate_add',       'blood_damage_mult'],
            storm_speed:    ['speed_mult',          'thunder_damage_mult'],
            unyield_bleed:  ['ukemi_chance',        'blood_damage_mult'],
            mastery_strike: ['training_kill_buff',  'damage_mult'],
            mad_gambler:    ['damage_random_range', 'berserker'],
        };

        const activeChips = [];
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (chip && chip !== 'core' && chip.isActive && chip.data) {
                    activeChips.push(chip);
                }
            }
        }

        const activeFusions = [];
        for (const [fusionType, requiredTypes] of Object.entries(FUSION_EFFECT_MAP)) {
            const foundChips = requiredTypes.map(type => {
                if (fusionType === 'storm_speed' && type === 'speed_mult') {
                    return activeChips.find(c => c.data?.effectType === 'speed_mult' || c.data?.effectType === 'acceleration_scaling');
                }
                return activeChips.find(c => c.data?.effectType === type);
            });

            if (foundChips.every(c => c !== undefined)) {
                activeFusions.push({
                    fusionType: fusionType,
                    requiredEffectTypes: requiredTypes,
                    activeChipNames: foundChips.map(c => c.data?.name || 'Unknown')
                });
            }
        }
        return activeFusions;
    }

    isSynergyActive(fusionType) {
        return this.getActiveFusions().some(f => f.fusionType === fusionType);
    }

    getNearFusions() {
        const FUSION_EFFECT_MAP = {
            corrosion:      ['fire_damage_mult',    'poison_damage_mult'],
            frostbolt:      ['ice_damage_mult',     'thunder_damage_mult'],
            sanguine:       ['blood_damage_mult',   'fire_damage_mult'],
            voltbleed:      ['thunder_damage_mult', 'blood_damage_mult'],
            frostpoison:    ['ice_damage_mult',     'poison_damage_mult'],
            stormfire:      ['fire_damage_mult',    'thunder_damage_mult'],
            blood_crit:     ['crit_rate_add',       'blood_damage_mult'],
            storm_speed:    ['speed_mult',          'thunder_damage_mult'],
            unyield_bleed:  ['ukemi_chance',        'blood_damage_mult'],
            mastery_strike: ['training_kill_buff',  'damage_mult'],
            mad_gambler:    ['damage_random_range', 'berserker'],
        };

        const activeChips = [];
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const chip = this.grid[y][x];
                if (chip && chip !== 'core' && chip.isActive) {
                    activeChips.push(chip);
                }
            }
        }

        const nearFusions = [];
        for (const [fusionType, requiredTypes] of Object.entries(FUSION_EFFECT_MAP)) {
            const foundChips = requiredTypes.map(type => {
                if (fusionType === 'storm_speed' && type === 'speed_mult') {
                    return activeChips.find(c => c.data?.effectType === 'speed_mult' || c.data?.effectType === 'acceleration_scaling');
                }
                return activeChips.find(c => c.data?.effectType === type);
            });
            const missingCount = foundChips.filter(c => c === undefined).length;
            
            if (missingCount === 1) {
                const missingIndex = foundChips.findIndex(c => c === undefined);
                const missingType = requiredTypes[missingIndex];
                
                // For missingChipName, we need to find a chip that HAS this effectType in ownedChips or chipsDB
                const representativeChip = chipsDB.find(c => c.effectType === missingType);
                const missingName = representativeChip ? representativeChip.name : missingType;

                nearFusions.push({
                    fusionType: fusionType,
                    requiredEffectTypes: requiredTypes,
                    activeChipNames: foundChips.filter(c => c !== undefined).map(c => c.data?.name || 'Unknown'),
                    missingChipName: missingName
                });
            }
        }
        return nearFusions;
    }
}

/**
 * Instance of a chip in the inventory.
 */
export class ChipInstance {
    constructor(id, level = 1, isIdentified = true, instanceId = null) {
        this.data = chipsDB.find(c => c.id === id);
        this.instanceId = instanceId || Math.random().toString(36).substr(2, 9);
        this.level = level;
        this.isIdentified = isIdentified;
        this.isDeployed = false; // New: is it actively deployed in the current run?

        // Node data: { up: 0-3, down: 0-3, left: 0-3, right: 0-3 }
        this.nodes = { up: 0, down: 0, left: 0, right: 0 };
        this.generateNodes();
    }

    get isSpecial() {
        return this.data && this.data.isSpecial === true;
    }

    get isStorage() {
        return this.data && this.data.id === 'storage';
    }

    generateNodes() {
        const sides = ['up', 'down', 'left', 'right'];
        this.nodes = { up: 0, down: 0, left: 0, right: 0 };

        if (this.isSpecial) {
            if (this.data.id === 'storage') {
                // Storage: 1 to 3 nodes on a SINGLE random side
                const side = sides[Math.floor(Math.random() * sides.length)];
                this.nodes[side] = Math.floor(Math.random() * 3) + 1; // 1-3 nodes
            } else if (this.data.id === 'connector') {
                // Connector: Universal node ('all' or specifically handle as 99) on TWO random sides
                const shuffledSides = [...sides].sort(() => Math.random() - 0.5);
                this.nodes[shuffledSides[0]] = 'universal';
                this.nodes[shuffledSides[1]] = 'universal';
            }
            return;
        }

        // 1. Roll rarity based on weights
        const roll = Math.random() * 100;
        let targetRange = { min: 1, max: 3 }; // common

        if (roll < 0.5) targetRange = { min: 10, max: 12 };       // legendary (0.5%)
        else if (roll < 5.5) targetRange = { min: 7, max: 9 };   // epic (5%)
        else if (roll < 30.0) targetRange = { min: 4, max: 6 };  // rare (24.5%)
        // common (70%)

        let totalNodes = Math.floor(Math.random() * (targetRange.max - targetRange.min + 1)) + targetRange.min;

        // 2. Distribute totalNodes across sides (max 3 per side, total 4 sides)
        // Ensure we don't end up with more nodes than the sides can hold
        totalNodes = Math.min(totalNodes, 12);

        let remaining = totalNodes;

        // Randomize side order for distribution
        const shuffledSides = [...sides].sort(() => Math.random() - 0.5);

        // First pass: give each side 0-3 nodes
        for (const side of shuffledSides) {
            const take = Math.min(3, remaining);
            if (take > 0) {
                const amount = Math.floor(Math.random() * take) + 1;
                this.nodes[side] = amount;
                remaining -= amount;
            }
        }

        // Second pass: if we still have remaining nodes, fill up the gaps
        if (remaining > 0) {
            for (const side of shuffledSides) {
                const space = 3 - this.nodes[side];
                const add = Math.min(space, remaining);
                this.nodes[side] += add;
                remaining -= add;
                if (remaining <= 0) break;
            }
        }

        // Final fallback: Ensure at least one node exists (should already be true)
        if (this.getConnectedNodeCount() === 0) {
            this.nodes[shuffledSides[0]] = 1;
        }
    }

    getConnectedNodeCount() {
        // Sum of all nodes on the chip. Treat 'universal' as 3 for estimation.
        const val = (n) => n === 'universal' ? 3 : (n || 0);
        return val(this.nodes.up) + val(this.nodes.down) + val(this.nodes.left) + val(this.nodes.right);
    }

    getCurrentCost() {
        if (this.isSpecial) return 0; // Special chips (Storage, Connector) are free
        // In the new system, cost is based on nodes. 
        // We'll keep the level-based cost interpolation for now if needed, 
        // but the spec says "Capacity is consumed by the number of connected nodes".
        return this.getConnectedNodeCount();
    }

    getRarity() {
        if (this.isSpecial) return 'special';
        const count = this.getConnectedNodeCount();
        if (count >= 10) return 'legendary';
        if (count >= 7) return 'epic';
        if (count >= 4) return 'rare';
        return 'common';
    }

    getActiveNodeCount() {
        // Sum of nodes that are actually connected and glowing
        return (this.activeNodes?.up || 0) +
            (this.activeNodes?.down || 0) +
            (this.activeNodes?.left || 0) +
            (this.activeNodes?.right || 0);
    }

    getScaledValue(propName) {
        if (!this.data || !this.data[propName]) return 0;
        const config = this.data[propName];
        const activeCount = Math.min(this.getActiveNodeCount(), 12);
        // Exponential (quadratic) scaling: min + (max - min) * (t^2)
        const t = activeCount / 12;
        return config.min + (config.max - config.min) * Math.pow(t, 2);
    }

    getPotentialValue(propName) {
        if (!this.data || !this.data[propName]) return 0;
        const config = this.data[propName];
        const totalCount = Math.min(this.getConnectedNodeCount(), 12);
        const t = totalCount / 12;
        return config.min + (config.max - config.min) * Math.pow(t, 2);
    }

    getCurrentEffect() {
        return this.getScaledValue('nodeScaling');
    }

    serialize() {
        return {
            id: this.data.id,
            level: this.level,
            instanceId: this.instanceId,
            isIdentified: this.isIdentified,
            nodes: this.nodes,
            isDeployed: this.isDeployed // Persist deployment state
        };
    }
}
