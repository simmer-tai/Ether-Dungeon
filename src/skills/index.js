import { Skill } from './core.js';
import { projectileBehaviors } from './behaviors/projectile_behaviors.js';
import { meleeBehaviors } from './behaviors/melee_behaviors.js';
import { areaBehaviors } from './behaviors/area_behaviors.js';

import { barrageBehaviors } from './behaviors/barrage_behaviors.js';

// Aggregate all behaviors
const behaviors = {
    ...projectileBehaviors,
    ...meleeBehaviors,
    ...areaBehaviors,
    ...barrageBehaviors
};

export { SkillType, Skill } from './core.js';
export { spawnProjectile, spawnLightningBurst, spawnAetherExplosion } from './common.js';

export function createSkill(data) {
    const behaviorFn = behaviors[data.behavior];
    if (!behaviorFn) {
        console.warn(`Behavior ${data.behavior} not found for skill ${data.id}`);
        return null; // Return null effectively disables the skill without crashing
    }

    // Create skill instance
    const maxStacks = data.maxStacks || 1;
    const skill = new Skill(data.id, data.name, data.type, data.cooldown, null, data.icon, maxStacks);
    // Expose metadata for Player checks
    skill.chargeable = data.params.chargeable || false;
    skill.chargeTime = data.params.chargeTime || 1.0;
    skill.description = data.description || '';
    skill.params = data.params; // Expose for inventory display
    skill.aetherRushDesc = data.aetherRushDesc || null; // Expose for inventory display

    // Initialize state if needed (for reverse slash)
    if (data.behavior === 'arc_slash') {
        skill.state = { reverse: false };
    }

    // Bind the effect function to the skill instance so 'this' works
    skill.effect = function (user, game, extraParams = {}) {
        let finalParams = { ...data.params };

        // Allow overriding Aether Charge (e.g. for Ultimate Reset)
        if (extraParams.aetherCharge !== undefined) {
            finalParams.aetherCharge = extraParams.aetherCharge;
        }

        // Handle Charge Scaling
        if (extraParams.chargeRatio !== undefined && data.params.chargeable) {
            const ratio = extraParams.chargeRatio; // 0.0 to 1.0

            // Scale Damage
            if (data.params.minDamage && data.params.maxDamage) {
                finalParams.damage = data.params.minDamage + (data.params.maxDamage - data.params.minDamage) * ratio;
            }

            // Scale Size (Width/Height)
            // We assume width/height usually aspect ratio lock, or we just scale both if provided sizes
            if (data.params.minSize && data.params.maxSize) {
                const size = data.params.minSize + (data.params.maxSize - data.params.minSize) * ratio;
                finalParams.width = size;
                finalParams.height = size / 2; // Keep aspect ratio 2:1 for fireball? 
                // Original fireball was w:64, h:32 (2:1). 
                // Let's stick to the database params if possible, but we introduced minSize/maxSize as a single scalar.
                // Let's assume minSize is Width, and Height is derived or scaled similarly.

                // Better approach: Scale based on ratio relative to original?
                // Or just use the calculated size.
                finalParams.width = size;
                finalParams.height = size * (data.params.height / data.params.width); // Maintain Aspect Ratio
            }

            // Scale Speed
            if (data.params.minSpeed && data.params.maxSpeed) {
                finalParams.speed = data.params.minSpeed + (data.params.maxSpeed - data.params.minSpeed) * ratio;
            }

            console.log(`Charged Cast: Ratio ${ratio.toFixed(2)}, Dmg ${finalParams.damage}, Size ${finalParams.width}`);
        }

        // Apply Blood Blessings / Damage Multipliers
        if (user && user.damageMultiplier !== undefined) {
            if (finalParams.damage !== undefined) finalParams.damage *= user.damageMultiplier;
            if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.damageMultiplier;
            if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.damageMultiplier;

            // Apply Element Bonus (e.g. Fire Damage Chip)
            if (data.element === 'fire' && user.fireDamageMultiplier !== undefined) {
                if (finalParams.damage !== undefined) finalParams.damage *= user.fireDamageMultiplier;
                if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.fireDamageMultiplier;
                if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.fireDamageMultiplier;
            }
            if ((data.element === 'lightning' || data.element === 'thunder') && user.thunderDamageMultiplier !== undefined) {
                if (finalParams.damage !== undefined) finalParams.damage *= user.thunderDamageMultiplier;
                if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.thunderDamageMultiplier;
                if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.thunderDamageMultiplier;
            }
            if (data.element === 'ice' && user.iceDamageMultiplier !== undefined) {
                if (finalParams.damage !== undefined) finalParams.damage *= user.iceDamageMultiplier;
                if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.iceDamageMultiplier;
                if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.iceDamageMultiplier;
            }
            if (data.element === 'blood' && user.bloodDamageMultiplier !== undefined) {
                if (finalParams.damage !== undefined) finalParams.damage *= user.bloodDamageMultiplier;
                if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.bloodDamageMultiplier;
                if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.bloodDamageMultiplier;
            }
            if (data.element === 'poison' && user.poisonDamageMultiplier !== undefined) {
                if (finalParams.damage !== undefined) finalParams.damage *= user.poisonDamageMultiplier;
                if (finalParams.minDamage !== undefined) finalParams.minDamage *= user.poisonDamageMultiplier;
                if (finalParams.maxDamage !== undefined) finalParams.maxDamage *= user.poisonDamageMultiplier;
            }

            // Apply Critical Rate Bonus (Multiplicative / Percentage Increase)
            if (user.critRateBonus !== undefined && finalParams.critChance !== undefined) {
                finalParams.critChance *= (1 + user.critRateBonus);
            }
        }

        behaviorFn.call(skill, user, game, finalParams);
    };

    return skill;
}
