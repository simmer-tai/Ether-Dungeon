
import { getCachedImage } from './utils.js';

export const statusIcons = {
    bleed: getCachedImage('assets/skills/icons/icon_bleed.png'),
    slow: getCachedImage('assets/skills/icons/icon_slow.png'),
    burn: getCachedImage('assets/skills/icons/icon_burn.png'),
    wet: getCachedImage('assets/skills/icons/icon_wet.png'),
    poison: getCachedImage('assets/skills/icons/icon_poison.png'),
    shock: getCachedImage('assets/skills/icons/shock.png') // Fixed name from icon_shock.png
};

export const STATUS_TYPES = {
    BLEED: 'bleed',
    SLOW: 'slow',
    BURN: 'burn',
    WET: 'wet',
    POISON: 'poison',
    SHOCK: 'shock',
    PANDEMIC: 'pandemic'
};

export class StatusManager {
    constructor(owner) {
        this.owner = owner;
        this.effects = new Map(); // Map<type, { stacks, timer, duration }>
    }

    applyStatus(type, duration, magnitude = null, maxStacks = 10) {
        // --- Elemental Interactions (Neutralization) ---
        if (type === STATUS_TYPES.WET && this.effects.has(STATUS_TYPES.BURN)) {
            this.effects.delete(STATUS_TYPES.BURN);
            this.showStatusText('neutralized', 'Steam!');
            return; // Water puts out fire, consumes the water shot too
        }
        if (type === STATUS_TYPES.BURN && this.effects.has(STATUS_TYPES.WET)) {
            this.effects.delete(STATUS_TYPES.WET);
            this.showStatusText('neutralized', 'Evaporate!');
            return; // Fire evaporates water, consumes the fire shot too
        }

        if (!this.effects.has(type)) {
            this.effects.set(type, {
                stacks: 1,
                timer: duration,
                duration: duration,
                magnitude: magnitude // Added custom magnitude
            });
            this.showStatusText(type, 1);
        } else {
            const effect = this.effects.get(type);
            effect.timer = duration; // Reset timer
            if (magnitude !== null) effect.magnitude = magnitude; // Update magnitude if provided

            // Limit stacks (Special case for Burn/Wet: effectively unlimited for duration refresh, but stacks matter)
            const limit = (type === STATUS_TYPES.BURN || type === STATUS_TYPES.WET) ? 999 : maxStacks;

            if (effect.stacks < limit) {
                effect.stacks++;
                this.showStatusText(type, effect.stacks);
            }
        }
    }

    update(dt) {
        for (const [type, effect] of this.effects) {
            effect.timer -= dt;

            // Handle Damage Over Time (BURN)
            if (type === STATUS_TYPES.BURN) {
                effect.tickTimer = (effect.tickTimer || 0) + dt;
                if (effect.tickTimer >= 1.0) { // Tick every 1 second
                    effect.tickTimer -= 1.0;
                    const dmg = effect.stacks * 2; // 2 damage per stack
                    this.owner.takeDamage(dmg, '#ff6600', 0, false, 0, 0, 0, true); // Orange color, no aether gain, silent
                    this.showStatusText('burn_tick', dmg);
                }
            }

            // Handle Damage Over Time (POISON)
            if (type === STATUS_TYPES.POISON) {
                effect.tickTimer = (effect.tickTimer || 0) + dt;
                if (effect.tickTimer >= 1.0) { // Tick every 1 second
                    effect.tickTimer -= 1.0;
                    const dmg = effect.stacks * 2; // 2 damage per stack (same as burn)
                    this.owner.takeDamage(dmg, '#800080', 0, false, 0, 0, 0, true); // Purple color, no aether gain, silent
                    this.showStatusText('poison_tick', dmg);
                }
            }

            // Handle PANDEMIC (Forced Poison refresh)
            if (type === STATUS_TYPES.PANDEMIC) {
                // Ensure target always has high-stack Poison while in Pandemic
                this.applyStatus(STATUS_TYPES.POISON, effect.timer, null, 20);
                
                // Visual effect: purple sparks/bubble particles
                if (Math.random() < 0.2) {
                    const px = this.owner.x + Math.random() * this.owner.width;
                    const py = this.owner.y + Math.random() * this.owner.height;
                    this.owner.game.spawnParticles(px, py, 1, '#800080', 0, -20);
                }
            }

            if (effect.timer <= 0) {
                this.effects.delete(type);
            }
        }
    }

    handleTakeDamage(amount, isChain = false) {
        if (isChain) return; // Prevent infinite loops
        if (!this.effects.has(STATUS_TYPES.SHOCK)) return;

        const effect = this.effects.get(STATUS_TYPES.SHOCK);
        const stacks = effect.stacks;
        const chainDamage = Math.floor(amount * (stacks * 0.02));

        if (chainDamage <= 0) return;

        const game = this.owner.game;
        if (!game) return;

        // 4 tiles range (assuming 32px tiles = 128px)
        const range = (game.map ? game.map.tileSize : 32) * 4;
        const centerX = this.owner.x + this.owner.width / 2;
        const centerY = this.owner.y + this.owner.height / 2;

        // Visual feedback at the source
        if (Math.random() < 0.3) {
            game.spawnParticles(centerX, centerY, 5, '#ffff00');
        }

        game.enemies.forEach(enemy => {
            if (enemy === this.owner || enemy.hp <= 0) return;

            const dx = (enemy.x + enemy.width / 2) - centerX;
            const dy = (enemy.y + enemy.height / 2) - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= range) {
                // Apply chain damage.
                // takeDamage params: amount, color, aetherGain, isCrit, knockbackX, knockbackY, stunDuration, silent
                // Set silent = false so the damage number shows up
                enemy.takeDamage(chainDamage, '#ffff00', 0, false, 0, 0, 0.2, false);
                
                // Visual feedback: Lightning Bolt connection
                game.animations.push({
                    type: 'lightning_bolt',
                    x1: centerX,
                    y1: centerY,
                    x2: enemy.x + enemy.width / 2,
                    y2: enemy.y + enemy.height / 2,
                    color: '#ffff00',
                    width: 3,
                    life: 0.15,
                    maxLife: 0.15
                });

                // Visual feedback: small bolt sparks
                if (game.spawnLightningBurst) {
                    // Just a small burst or particle
                    game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 3, '#ffff00');
                }
            }
        });
    }

    getDamageMultiplier(baseDamage) {
        let multiplier = 1.0;

        // BLEED: +3% damage taken per stack
        if (this.effects.has(STATUS_TYPES.BLEED)) {
            const stacks = this.effects.get(STATUS_TYPES.BLEED).stacks;
            multiplier += stacks * 0.03;
        }

        return multiplier;
    }

    getSpeedMultiplier() {
        let multiplier = 1.0;

        // SLOW: 50% slow or custom magnitude
        if (this.effects.has(STATUS_TYPES.SLOW)) {
            const effect = this.effects.get(STATUS_TYPES.SLOW);
            // Default to 0.5 if no magnitude (50% speed)
            const m = effect.magnitude !== null ? effect.magnitude : 0.5;
            multiplier *= m;
        }

        return multiplier;
    }

    // Helper for visual feedback
    showStatusText(type, value) {
        // If this is a status application, try to attach to the last damage animation
        if (this.owner.lastDamageAnim && this.owner.lastDamageAnim.life > 0.5) {
            const icon = statusIcons[type];
            if (icon) {
                if (!this.owner.lastDamageAnim.icons) this.owner.lastDamageAnim.icons = [];
                // Avoid duplicate icons for the same status in one damage pop
                if (!this.owner.lastDamageAnim.icons.includes(icon)) {
                    this.owner.lastDamageAnim.icons.push(icon);
                }
                return;
            }
        }

        // Fallback for cases where there's no recent damage (e.g. tick damage or pure status application)
        let text = '';
        let color = '#fff';
        let icon = statusIcons[type];

        if (type === STATUS_TYPES.BLEED) {
            text = `Bleed ${value}`;
            color = '#ff0000';
        } else if (type === STATUS_TYPES.BURN) {
            text = `Burn ${value}`;
            color = '#ff6600';
        } else if (type === STATUS_TYPES.WET) {
            text = `Wet ${value}`;
            color = '#00aaff';
        } else if (type === 'burn_tick') {
            text = value; // Just show damage value for ticks, like normal damage
            color = '#ffffff';
        } else if (type === STATUS_TYPES.POISON) {
            text = `Poison ${value}`;
            color = '#800080';
        } else if (type === STATUS_TYPES.SLOW) {
            text = `Slow ${value}`;
            color = '#00ffff';
        } else if (type === 'poison_tick') {
            text = value; // Like normal damage
            color = '#ffffff';
        } else if (type === STATUS_TYPES.SHOCK) {
            text = `Shock ${value}`;
            color = '#ffff00';
        } else if (type === 'neutralized') {
            text = value; // "Steam!" or "Evaporate!"
            color = '#aae6ff';
        } else if (type === STATUS_TYPES.PANDEMIC) {
            text = 'PANDEMIC';
            color = '#BF40BF';
        }

        if (this.owner.game) {
            this.owner.game.animations.push({
                type: 'text',
                isDamageText: true,
                text: text,
                x: this.owner.x + this.owner.width / 2,
                y: this.owner.y - 10,
                vx: (Math.random() - 0.5) * 100, // Increased horizontal spread
                vy: -100, // Status texts bounce slightly less than pure damage
                life: 0.8,
                maxLife: 0.8,
                color: color,
                font: '14px sans-serif',
                icons: icon ? [icon] : []
            });
        }
    }

    getActiveEffects() {
        const active = [];
        for (const [type, effect] of this.effects) {
            active.push({ type, stacks: effect.stacks });
        }
        return active;
    }
}
