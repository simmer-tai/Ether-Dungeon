
export const STATUS_TYPES = {
    BLEED: 'bleed',
    SLOW: 'slow',
    BURN: 'burn',
    WET: 'wet'
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
                    this.owner.takeDamage(dmg, '#ff6600', 0); // Orange color, no aether gain
                    this.showStatusText('burn_tick', dmg);
                }
            }

            if (effect.timer <= 0) {
                this.effects.delete(type);
            }
        }
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
        let text = '';
        let color = '#fff';

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
            text = `-${value}`; // Just show damage value for ticks
            color = '#ff6600';
        } else if (type === 'neutralized') {
            text = value; // "Steam!" or "Evaporate!"
            color = '#aae6ff';
        }

        if (this.owner.game) {
            this.owner.game.animations.push({
                type: 'text',
                text: text,
                x: this.owner.x + this.owner.width / 2,
                y: this.owner.y - 10,
                vx: 0,
                vy: -50,
                life: 0.5,
                maxLife: 0.5,
                color: color,
                font: '12px sans-serif'
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
