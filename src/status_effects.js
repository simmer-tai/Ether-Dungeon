
import { getCachedImage } from './utils.js';

export const statusIcons = {
    bleed: getCachedImage('assets/skills/icons/icon_bleed.png'),
    slow: getCachedImage('assets/skills/icons/icon_slow.png'),
    burn: getCachedImage('assets/skills/icons/icon_burn.png'),
    wet: getCachedImage('assets/skills/icons/icon_wet.png'),
    poison: getCachedImage('assets/skills/icons/icon_poison.png'),
    shock: getCachedImage('assets/skills/icons/shock.png'), // Fixed name from icon_shock.png
    corrosion: getCachedImage('assets/skills/icons/icon_corrosion.png'),
    frostbolt: getCachedImage('assets/skills/icons/icon_frostbolt.png'),
    sanguine: getCachedImage('assets/skills/icons/icon_sanguine.png'),
    voltbleed: getCachedImage('assets/skills/icons/icon_voltbleed.png'),
    frostpoison: getCachedImage('assets/skills/icons/icon_frostpoison.png'),
    stormfire: getCachedImage('assets/skills/icons/icon_stormfire.png'),
    freeze: getCachedImage('assets/skills/icons/icon_freeze.png')
};

export const STATUS_TYPES = {
    BLEED: 'bleed',
    SLOW: 'slow',
    BURN: 'burn',
    WET: 'wet',
    POISON: 'poison',
    SHOCK: 'shock',
    PANDEMIC: 'pandemic',
    FREEZE: 'freeze',
    CORROSION: 'corrosion',
    FROSTBOLT: 'frostbolt',
    SANGUINE: 'sanguine',
    VOLTBLEED: 'voltbleed',
    FROSTPOISON: 'frostpoison',
    STORMFIRE: 'stormfire'
};

export const FUSION_TABLE = [
    { requires: [STATUS_TYPES.BURN,   STATUS_TYPES.POISON],  result: STATUS_TYPES.CORROSION  },
    { requires: [STATUS_TYPES.FREEZE, STATUS_TYPES.SHOCK],   result: STATUS_TYPES.FROSTBOLT  },
    { requires: [STATUS_TYPES.BLEED,  STATUS_TYPES.BURN],    result: STATUS_TYPES.SANGUINE   },
    { requires: [STATUS_TYPES.SHOCK,  STATUS_TYPES.BLEED],   result: STATUS_TYPES.VOLTBLEED  },
    { requires: [STATUS_TYPES.FREEZE, STATUS_TYPES.POISON],  result: STATUS_TYPES.FROSTPOISON},
    { requires: [STATUS_TYPES.BURN,   STATUS_TYPES.SHOCK],   result: STATUS_TYPES.STORMFIRE  },
];

export class StatusManager {
    constructor(owner) {
        this.owner = owner;
        this.effects = new Map(); // Map<type, { stacks, timer, duration }>
    }

    applyStatus(type, duration, skillDamage = null, maxStacks = 10) {
        // --- Elemental Interactions (Neutralization) ---
        if (type === STATUS_TYPES.WET && this.effects.has(STATUS_TYPES.BURN)) {
            this.effects.delete(STATUS_TYPES.BURN);
            this.showStatusText('neutralized', '蒸発！');
            return; // Water puts out fire, consumes the water shot too
        }
        if (type === STATUS_TYPES.BURN && this.effects.has(STATUS_TYPES.WET)) {
            this.effects.delete(STATUS_TYPES.WET);
            this.showStatusText('neutralized', '消滅！');
            return; // Fire evaporates water, consumes the fire shot too
        }

        if (type === STATUS_TYPES.FREEZE && this.effects.has(STATUS_TYPES.BURN)) {
            this.effects.delete(STATUS_TYPES.BURN);
            this.showStatusText('neutralized', '消火！');
            return;
        }

        if (!this.effects.has(type)) {
            const dotValues = [];
            if ((type === STATUS_TYPES.BURN || type === STATUS_TYPES.POISON) && skillDamage !== null) {
                dotValues.push(skillDamage * 0.1);
            }
            this.effects.set(type, {
                stacks: 1,
                timer: duration,
                duration: duration,
                dotValues: dotValues, // Store 10% of skill damage per stack
                magnitude: skillDamage // Keep for legacy/other status
            });
            this.showStatusText(type, 1);
        } else {
            const effect = this.effects.get(type);
            effect.timer = duration; // Reset timer

            // Limit stacks
            const limit = (type === STATUS_TYPES.BURN || type === STATUS_TYPES.WET) ? 999 : maxStacks;

            if (effect.stacks < limit) {
                effect.stacks++;
                if ((type === STATUS_TYPES.BURN || type === STATUS_TYPES.POISON) && skillDamage !== null) {
                    if (!effect.dotValues) effect.dotValues = [];
                    effect.dotValues.push(skillDamage * 0.1);
                }
                this.showStatusText(type, effect.stacks);
            } else if ((type === STATUS_TYPES.BURN || type === STATUS_TYPES.POISON) && skillDamage !== null) {
                // Replace oldest stack damage if at limit (only for DOTs)
                if (effect.dotValues && effect.dotValues.length > 0) {
                    effect.dotValues.shift();
                    effect.dotValues.push(skillDamage * 0.1);
                }
            }
        }

        this.checkFusion(this.owner.game);
    }

    checkFusion(game) {
        // --- Sanguine (Bleed + Burn) ---
        if (this.effects.has(STATUS_TYPES.BLEED) && this.effects.has(STATUS_TYPES.BURN)) {
            const bleedStacks = this.effects.get(STATUS_TYPES.BLEED).stacks;
            const burnStacks  = this.effects.get(STATUS_TYPES.BURN).stacks;
            const totalStacks = bleedStacks + burnStacks;

            this.effects.delete(STATUS_TYPES.BLEED);
            this.effects.delete(STATUS_TYPES.BURN);

            const skillDmg = this.owner.lastSkillDamage || 100;
            const dmg = Math.round(skillDmg * totalStacks * 0.4);
            if (dmg > 0) {
                this.owner.takeDamage(dmg, '#FF6644', 0, false, 0, 0, 0, false, null, 1.0);
                this.showStatusText('sanguine_burst', dmg);
            }
            return;
        }

        // --- Frostpoison (Freeze + Poison) ---
        if (this.effects.has(STATUS_TYPES.FREEZE) && this.effects.has(STATUS_TYPES.POISON)) {
            const poisonEffect = this.effects.get(STATUS_TYPES.POISON);
            const poisonStacks = poisonEffect.stacks;

            const dotPerSec = poisonEffect.dotValues
                ? poisonEffect.dotValues.reduce((a, b) => a + b, 0)
                : poisonStacks * 2;

            this.effects.delete(STATUS_TYPES.POISON);

            const dmg = Math.round(dotPerSec * poisonStacks);
            if (dmg > 0) {
                this.owner.takeDamage(dmg, '#97C459', 0, false, 0, 0, 0, false, null, 0.25);
                this.showStatusText('frostpoison_burst', dmg);
            }
            return;
        }

        // --- Frostbolt (Freeze + Shock) ---
        if (this.effects.has(STATUS_TYPES.FREEZE) && this.effects.has(STATUS_TYPES.SHOCK)) {
            const freezeStacks = this.effects.get(STATUS_TYPES.FREEZE).stacks;
            const shockStacks  = this.effects.get(STATUS_TYPES.SHOCK).stacks;
            const totalStacks  = freezeStacks + shockStacks;

            this.effects.delete(STATUS_TYPES.FREEZE);
            this.effects.delete(STATUS_TYPES.SHOCK);

            const stunDuration = Math.min(3.5, 0.5 + totalStacks * 0.15);
            const nextHitMult  = Math.min(6.5, 1.5 + totalStacks * 0.25);

            this.owner.stunTimer = stunDuration;
            this.owner.frostboltNextHitMult = nextHitMult;

            this.applyStatus(STATUS_TYPES.FROSTBOLT, stunDuration, null, 1);
            return;
        }
    }

    _consumeStack(type) {
        const effect = this.effects.get(type);
        if (!effect) return;
        effect.stacks -= 1;
        if (effect.stacks <= 0) this.effects.delete(type);
    }

    _handleFusionInstantEffect(type) {
        const owner = this.owner;
        const game = owner.game;
        if (!game) return;

        if (type === STATUS_TYPES.FROSTBOLT) {
            // 付与された瞬間にstunフラグを0.5秒立てる＋次ダメージ×2の倍率バフを付与
            owner.stunDuration = Math.max(owner.stunDuration || 0, 0.5);
            owner.frostboltCharge = true; // takeDamageで消費するフラグ
        } else if (type === STATUS_TYPES.SANGUINE) {
            // 付与された瞬間に bleed の現スタック数×（スキルダメージ×0.3）の即時ダメージを与える
            const bleedEffect = this.effects.get(STATUS_TYPES.BLEED);
            const stacks = bleedEffect ? bleedEffect.stacks + 1 : 1;
            const skillDmg = owner.lastSkillDamage || 100; 
            const totalDmg = stacks * (skillDmg * 0.3);
            owner.takeDamage(totalDmg, '#ff0000', 0, false, 0, 0, 0, false);
        } else if (type === STATUS_TYPES.VOLTBLEED) {
            // 付与された瞬間に半径150px以内の別の敵にダメージ（スキルダメージ×0.5）を連鎖。最大3体
            const skillDmg = owner.lastSkillDamage || 100;
            const chainDmg = skillDmg * 0.5;
            let targets = 0;
            const range = 150;

            const enemies = game.enemies || [];
            for (const enemy of enemies) {
                if (enemy === owner || enemy.hp <= 0 || targets >= 3) continue;
                const dx = enemy.x - owner.x;
                const dy = enemy.y - owner.y;
                if (Math.sqrt(dx * dx + dy * dy) <= range) {
                    enemy.takeDamage(chainDmg, '#ffff00', 0, false, 0, 0, 0, false);
                    // Visual
                    game.animations.push({
                        type: 'lightning_bolt',
                        x1: owner.x + owner.width / 2,
                        y1: owner.y + owner.height / 2,
                        x2: enemy.x + enemy.width / 2,
                        y2: enemy.y + enemy.height / 2,
                        color: '#ff0000',
                        width: 2,
                        life: 0.2,
                        maxLife: 0.2
                    });
                    targets++;
                }
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
                    
                    let baseDmg = effect.dotValues ? effect.dotValues.reduce((a, b) => a + b, 0) : effect.stacks * 2;
                    
                    // STORMFIRE: 感電スタック数に応じて倍率アップ（スタック消費なし）
                    if (this.effects.has(STATUS_TYPES.SHOCK)) {
                        const shockStacks = this.effects.get(STATUS_TYPES.SHOCK).stacks;
                        baseDmg = Math.round(baseDmg * (1.0 + shockStacks * 0.15));
                    }

                    const dmg = Math.max(1, Math.round(baseDmg));
                    
                    this.owner.takeDamage(dmg, '#ff6600', 0, false, 0, 0, 0, true, null, 0.25); 
                    this.showStatusText('burn_tick', dmg);
                }
            }

            // Handle Damage Over Time (POISON)
            if (type === STATUS_TYPES.POISON) {
                effect.tickTimer = (effect.tickTimer || 0) + dt;
                
                // FROSTPOISON: poison の tick 間隔を 1.0秒→0.3秒に短縮
                const tickInterval = this.effects.has(STATUS_TYPES.FROSTPOISON) ? 0.3 : 1.0;

                if (effect.tickTimer >= tickInterval) {
                    effect.tickTimer -= tickInterval;
                    
                    const baseDmg = effect.dotValues ? effect.dotValues.reduce((a, b) => a + b, 0) : effect.stacks * 2;
                    const dmg = Math.max(1, Math.round(baseDmg));
                    
                    this.owner.takeDamage(dmg, '#800080', 0, false, 0, 0, 0, true, null, 0.50); // Poison ignores 50% defense
                    this.showStatusText('poison_tick', dmg);
                }
            }

            // CORROSION: 炎上と中毒の合計スタック数に応じて防御ダウン
            if (this.effects.has(STATUS_TYPES.BURN) && this.effects.has(STATUS_TYPES.POISON)) {
                const totalStacks = this.effects.get(STATUS_TYPES.BURN).stacks
                                  + this.effects.get(STATUS_TYPES.POISON).stacks;
                this.owner.corrosionDefenseDown = Math.min(0.40, totalStacks * 0.02);

                if (Math.random() < 0.1) {
                    this.owner.game.spawnParticles(this.owner.x + Math.random() * this.owner.width, this.owner.y + Math.random() * this.owner.height, 1, '#adff2f', 0, -10);
                }
            } else {
                this.owner.corrosionDefenseDown = 0;
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

        const game = this.owner.game;
        if (!game) return;

        const centerX = this.owner.x + this.owner.width / 2;
        const centerY = this.owner.y + this.owner.height / 2;
        let range = (game.map ? game.map.tileSize : 32) * 4;

        // STORM_SPEED Synergy: Increase range based on speed bonus
        if (game.player && game.player.circuit && game.player.circuit.isSynergyActive('storm_speed')) {
            const speedBonus = game.player.circuit.getBonuses().speedMult || 0;
            range *= (1 + speedBonus);
        }

        // SHOCK: 感電の連鎖処理
        if (this.effects.has(STATUS_TYPES.SHOCK)) {
            const effect = this.effects.get(STATUS_TYPES.SHOCK);
            const stacks = effect.stacks;
            const chainDamage = Math.floor(amount * (stacks * 0.02));

            if (chainDamage > 0) {
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
                        enemy.takeDamage(chainDamage, '#ffff00', 0, false, 0, 0, 0.2, false, null, 0, true);
                        
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

                        game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 3, '#ffff00');
                    }
                });
            }
        }

        // VOLTBLEED: 感電爆血の連鎖処理 (Shock + Bleed)
        if (!isChain && this.effects.has(STATUS_TYPES.SHOCK) && this.effects.has(STATUS_TYPES.BLEED)) {
            const shockStacks = this.effects.get(STATUS_TYPES.SHOCK).stacks;
            const bleedStacks = this.effects.get(STATUS_TYPES.BLEED).stacks;

            const chainRate = shockStacks * 0.02 + bleedStacks * 0.03;
            const voltChainDamage = Math.floor(amount * chainRate);

            if (voltChainDamage > 0) {
                if (Math.random() < 0.3) {
                    game.spawnParticles(centerX, centerY, 5, '#ff4444');
                }

                game.enemies.forEach(enemy => {
                    if (enemy === this.owner || enemy.hp <= 0) return;

                    const edx = (enemy.x + enemy.width / 2) - centerX;
                    const edy = (enemy.y + enemy.height / 2) - centerY;
                    const dist = Math.sqrt(edx * edx + edy * edy);

                    if (dist <= range) {
                        enemy.takeDamage(voltChainDamage, '#ff4444', 0, false, 0, 0, 0.2, false, null, 0, true);
                        game.animations.push({
                            type: 'lightning_bolt',
                            x1: centerX,
                            y1: centerY,
                            x2: enemy.x + enemy.width / 2,
                            y2: enemy.y + enemy.height / 2,
                            color: '#ff4444',
                            width: 3,
                            life: 0.15,
                            maxLife: 0.15
                        });
                        game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 3, '#ff4444');
                    }
                });
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

        if (this.effects.has(STATUS_TYPES.FREEZE)) {
            multiplier = 0; // 完全停止
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
            text = `出血 ${value}`;
            color = '#ff0000';
        } else if (type === STATUS_TYPES.BURN) {
            text = `炎上 ${value}`;
            color = '#ff6600';
        } else if (type === STATUS_TYPES.WET) {
            text = `湿潤 ${value}`;
            color = '#00aaff';
        } else if (type === 'burn_tick') {
            text = value; // Just show damage value for ticks, like normal damage
            color = '#ffffff';
        } else if (type === STATUS_TYPES.POISON) {
            text = `中毒 ${value}`;
            color = '#800080';
        } else if (type === STATUS_TYPES.SLOW) {
            text = `鈍足 ${value}`;
            color = '#00ffff';
        } else if (type === STATUS_TYPES.FREEZE) {
            text = `凍結 ${value}`;
            color = '#88ccff';
        } else if (type === 'poison_tick') {
            text = value; // Like normal damage
            color = '#ffffff';
        } else if (type === STATUS_TYPES.SHOCK) {
            text = `感電 ${value}`;
            color = '#ffff00';
        } else if (type === 'neutralized') {
            text = value; // "蒸発！" or "消滅！" (passed from applyStatus)
            color = '#aae6ff';
        } else if (type === STATUS_TYPES.PANDEMIC) {
            text = '疫病';
            color = '#BF40BF';
        } else if (type === STATUS_TYPES.CORROSION) {
            text = `腐食 ${value}`;
            color = '#adff2f';
        } else if (type === STATUS_TYPES.FROSTBOLT) {
            text = `極電 ${value}`;
            color = '#00ffff';
        } else if (type === STATUS_TYPES.SANGUINE) {
            text = `血炎 ${value}`;
            color = '#ff0000';
        } else if (type === STATUS_TYPES.VOLTBLEED) {
            text = `感電爆血 ${value}`;
            color = '#ff3333';
        } else if (type === STATUS_TYPES.FROSTPOISON) {
            text = `凍毒 ${value}`;
            color = '#8a2be2';
        } else if (type === STATUS_TYPES.STORMFIRE) {
            text = `烈火雷鳴 ${value}`;
            color = '#ff4500';
        } else if (type === 'sanguine_burst') {
            text = `血炎爆発 ${value}`;
            color = '#FF6644';
        } else if (type === 'frostpoison_burst') {
            text = `凍毒炸裂 ${value}`;
            color = '#97C459';
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
