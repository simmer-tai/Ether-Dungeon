import { ChipInstance } from './AetherCircuitManager.js';
import { chipsDB } from '../data/chips_db.js';
import { SaveManager } from './SaveManager.js';
/**
 * Handles the logic for the Aether Lab.
 */
export class AetherLabManager {
    static getModifyCost(chip) {
        const rarity = chip.getRarity();
        const nodeCount = chip.getConnectedNodeCount();
        if (!chip.data) return { gold: 0, fragments: 0 };
        const baseGold = 50 + (chip.data.baseCost * 10);
        const baseFragments = 5 + (rarity === 'rare' ? 5 : rarity === 'epic' ? 15 : rarity === 'legendary' ? 30 : 0);

        return {
            gold: baseGold + (nodeCount * 100),
            fragments: baseFragments + (nodeCount * 10)
        };
    }


    static getDismantleYield(chip) {
        // Returns 50% of upgrade shards spent + base yield
        if (!chip.data) return { shards: 0 };
        return {
            shards: Math.floor(chip.data.baseCost * 5) + (chip.level - 1) * 10
        };
    }

    static canModify(player, chip) {
        const cost = this.getModifyCost(chip);
        return player.aetherShards >= cost.gold && player.aetherFragments >= cost.fragments;
    }

    static modifyChip(player, chip) {
        if (!this.canModify(player, chip)) return false;
        if (chip.getConnectedNodeCount() >= 12) return false;

        const cost = this.getModifyCost(chip);
        player.aetherShards -= cost.gold;
        player.aetherFragments -= cost.fragments;

        // Add a random node (reuse logic from synthesizeNode)
        const sides = ['up', 'down', 'left', 'right'];
        const availableSides = sides.filter(side => chip.nodes[side] < 3);

        if (availableSides.length > 0) {
            const side = availableSides[Math.floor(Math.random() * availableSides.length)];
            chip.nodes[side]++;
        }

        player.saveAetherData();
        return true;
    }


    static dismantleChip(player, chip) {
        const yieldData = this.getDismantleYield(chip);
        player.aetherShards += yieldData.shards;
        player.saveAetherData();

        // Remove from inventory
        const index = player.circuit.ownedChips.indexOf(chip);
        if (index !== -1) {
            player.circuit.ownedChips.splice(index, 1);
        }

        // Ensure it's unequipped from the grid
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                if (player.circuit.grid[y][x] === chip) {
                    player.circuit.unequipChip(x, y);
                }
            }
        }

        return true;
    }

    static canSynthesizeRankUp(player, materials) {
        if (!materials || materials.length !== 5) return false;

        const firstRarity = materials[0].getRarity();
        // All must be same rarity
        for (const mat of materials) {
            if (!mat) return false;
            if (mat.getRarity() !== firstRarity) return false;
        }
        return true;
    }

    /**
     * Synthesizes a new chip of higher rarity using 5 material chips.
     */
    static synthesizeRankUp(player, materials) {
        if (!this.canSynthesizeRankUp(player, materials)) return false;

        const materialRarity = materials[0].getRarity();

        // 1. Determine new rarity
        let newRarity = materialRarity;
        if (materialRarity === 'common') newRarity = 'rare';
        else if (materialRarity === 'rare') newRarity = 'epic';
        else if (materialRarity === 'epic' || materialRarity === 'legendary') newRarity = 'legendary';

        // 2. Determine effect inheritance
        if (!materials[0].data) return false;
        const firstEffect = materials[0].data.effectType;
        const allSameEffect = materials.every(m => m.data && m.data.effectType === firstEffect);

        // 3. Select target chip ID
        let pool = chipsDB;
        if (allSameEffect) {
            pool = chipsDB.filter(c => c.effectType === firstEffect);
        }

        // If for some reason pool is empty (should not happen with chipsDB), fallback to full pool
        if (pool.length === 0) pool = chipsDB;

        const selectedData = pool[Math.floor(Math.random() * pool.length)];

        // 4. Consume materials
        materials.forEach(mat => {
            const index = player.circuit.ownedChips.indexOf(mat);
            if (index !== -1) {
                player.circuit.ownedChips.splice(index, 1);
            }
        });

        // 5. Create new chip with appropriate node count for the new rarity
        const newChip = new ChipInstance(selectedData.id, 1, true);

        // Ensure new chip has node count matching the new rarity
        // ChipInstance.generateNodes uses weighted random based on ALL rarities.
        // We want to FORCE it to be in the range of the newRarity.
        let targetRange = { min: 1, max: 3 }; // common
        if (newRarity === 'legendary') targetRange = { min: 10, max: 12 };
        else if (newRarity === 'epic') targetRange = { min: 7, max: 9 };
        else if (newRarity === 'rare') targetRange = { min: 4, max: 6 };

        const totalNodes = Math.floor(Math.random() * (targetRange.max - targetRange.min + 1)) + targetRange.min;

        // Distribute nodes randomly
        newChip.nodes = { up: 0, down: 0, left: 0, right: 0 };
        let remaining = totalNodes;
        const sides = ['up', 'down', 'left', 'right'].sort(() => Math.random() - 0.5);

        for (const side of sides) {
            const take = Math.min(3, remaining);
            const amount = Math.floor(Math.random() * (take + 1));
            newChip.nodes[side] = amount;
            remaining -= amount;
        }
        // Fill remaining
        if (remaining > 0) {
            for (const side of sides) {
                const space = 3 - newChip.nodes[side];
                const add = Math.min(space, remaining);
                newChip.nodes[side] += add;
                remaining -= add;
            }
        }
        // Ensure at least 1 node if it was rare+ (though range min handles it)
        if (newChip.getConnectedNodeCount() === 0) newChip.nodes[sides[0]] = 1;

        player.circuit.ownedChips.push(newChip);

        // 6. 3% chance to get a special utility chip
        if (Math.random() < 0.03) {
            const specialId = Math.random() < 0.5 ? 'storage' : 'connector';
            const specialChip = new ChipInstance(specialId, 1, true);
            player.circuit.ownedChips.push(specialChip);
            // We could return an array or flag to indicate bonus drop, 
            // but just adding it to inventory is fine.
        }

        player.saveAetherData();
        return true;
    }

    static getRandomChipByWeightedRarity() {
        // Special chip check: 3% chance to intercept normal drop
        if (Math.random() < 0.03) {
            const specialId = Math.random() < 0.5 ? 'storage' : 'connector';
            return new ChipInstance(specialId, 1, true);
        }

        // Pick a random normal chip ID from the DB
        const normalChips = chipsDB.filter(c => !c.isSpecial);
        const selected = normalChips[Math.floor(Math.random() * normalChips.length)];
        // The ChipInstance constructor calls generateNodes(), which now handles the weighted rarity roll.
        return new ChipInstance(selected.id, 1, true);
    }

    static getSkillResearchCost(skillData) {
        const typeCosts = {
            normal: 100,
            primary: 250,
            secondary: 500,
            ultimate: 1000
        };
        return typeCosts[skillData.type] || 250;
    }

    static canResearchSkill(player, skillData) {
        const cost = this.getSkillResearchCost(skillData);
        return player.aetherShards >= cost;
    }

    static researchSkill(player, skillData) {
        if (!this.canResearchSkill(player, skillData)) return false;

        const cost = this.getSkillResearchCost(skillData);
        player.aetherShards -= cost;
        player.saveAetherData();

        SaveManager.unlockStartingSkill(skillData.id);
        return true;
    }
}
