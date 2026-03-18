import { Entity, getCachedImage, getCachedJson } from './utils.js';
import { SkillType, spawnAetherExplosion, spawnProjectile, createSkill } from './skills/index.js';
import { SaveManager } from './SaveManager.js';
import { skillsDB } from '../data/skills_db.js';
import { chipsDB } from '../data/chips_db.js';
import { AetherCircuitManager, ChipInstance } from './AetherCircuitManager.js';
import { CONFIG } from './config.js';
import { STATUS_TYPES } from './status_effects.js';

export class Player extends Entity {
    constructor(game, x, y) {
        super(game, x, y, 20, 20, '#4488ff', CONFIG.PLAYER.BASE_MAX_HP);
        this.baseMaxHp = CONFIG.PLAYER.BASE_MAX_HP;
        this.speed = CONFIG.PLAYER.BASE_SPEED; // Increased by 30% from 200
        this.facing = 'right';
        this.isDashing = false;
        this.isCasting = false; // Added flag
        this.dashVx = 0;
        this.dashVy = 0;

        this.dashCooldown = CONFIG.PLAYER.DASH_COOLDOWN;
        this.dashTimer = 0;
        this.canDash = true;
        this.dashDuration = CONFIG.PLAYER.DASH_DURATION;
        this.dashSpeed = CONFIG.PLAYER.DASH_SPEED;

        this.inventory = [];
        this.equippedSkills = {
            [SkillType.NORMAL]: null,
            'primary1': null,
            'primary2': null,
            [SkillType.SECONDARY]: null,
            [SkillType.ULTIMATE]: null
        };

        // Charge State
        this.chargingSkillSlot = null;
        this.chargeTimer = 0;
        this.maxChargeTime = 0;
        this.isCharging = false;

        this.scale = 1.0;
        this.baseScale = 1.0;
        this.animTimer = 0;
        this.rotation = 0;
        this.alpha = 1.0;

        this.width = 30; // Reduce collision box slightly
        this.height = 30;

        // Directional Sprite Sheets
        this.sprites = {
            yoko: { img: getCachedImage('assets/player/player_run_yoko.png'), data: null },
            sita: { img: getCachedImage('assets/player/player_run_sita.png'), data: null },
            ue: { img: getCachedImage('assets/player/player_run_ue.png'), data: null },
            idol_yoko: { img: getCachedImage('assets/player/player_idol_yoko.png'), data: null },
            idol_sita: { img: getCachedImage('assets/player/player_idol_sita.png'), data: null },
            idol_ue: { img: getCachedImage('assets/player/player_idol_ue.png'), data: null }
        };

        // Load JSON Data
        const loadJson = (key, path) => {
            getCachedJson(path).then(data => {
                if (data) {
                    this.sprites[key].data = data;
                    console.log(`Player ${key} sprite data loaded`);
                }
            }).catch(err => console.error(`Failed to load ${key} JSON:`, err));
        };
        loadJson('yoko', 'assets/player/player_run_yoko.json');
        loadJson('sita', 'assets/player/player_run_sita.json');
        loadJson('ue', 'assets/player/player_run_ue.json');
        loadJson('idol_yoko', 'assets/player/player_idol_yoko.json');
        loadJson('idol_sita', 'assets/player/player_idol_sita.json');
        loadJson('idol_ue', 'assets/player/player_idol_ue.json');

        // Fallback or Initial Image (for backward compatibility or fast loading)
        this.image = this.sprites.yoko.img;

        // Sprite animation properties
        this.frameX = 0;
        this.frameCounter = 0;
        this.maxFrames = 36;
        this.frameTimer = 0;
        this.frameInterval = 0.04; // Adjust for 36 frames loop

        this.damageColor = '#ff3333'; // Player takes red damage text


        // Currency & Materials
        this.aetherShards = 0;   // Persistent Lab Material (for Upgrade/Appraisal)
        this.aetherFragments = 0; // Persistent Lab Material (for Upgrade/Appraisal)
        this.dungeonCoins = 0;   // Dungeon-only Currency (for Shop, resets every run)
        this.aetherResonance = 0; // Run-only Currency (for deploying Circuit Chips)

        // Aether Rush System
        this.aetherGauge = 0;
        this.maxAetherGauge = 100;
        this.isAetherRush = false;
        this.aetherRushDuration = CONFIG.PLAYER.AETHER_RUSH_DURATION;
        this.aetherRushTimer = 0;

        this.bloodBlessings = [];

        this.bloodBlessings = [];
        this.voltDriveTimer = 0;
        this.enrageCooldownTimer = 0;
        this.voltDriveParams = null;
        this.isCheatInvincible = false;
        this.slowTimer = 0;
        this.enrageTimer = 0;
        this.enrageBonus = 0;

        // Aether Circuit System
        this.circuit = new AetherCircuitManager(this);
        this.loadAetherCircuit();

        // Sync HP after chips are loaded to include bonuses
        this.hp = this.maxHp;
        this.killCount = 0;
        this.accelerationTime = 0; // Cumulative movement time for "Acceleration" chip
    }

    loadAetherCircuit() {
        const saveData = SaveManager.getSaveData();
        if (saveData) {
            this.aetherShards = saveData.aetherShards || saveData.gold || 0; // Migration support
            this.aetherFragments = saveData.aetherFragments || 0;

            if (saveData.aetherCircuit) {
                if (saveData.aetherCircuit.ownedChips) {
                    this.circuit.deserialize(saveData.aetherCircuit);
                } else if (saveData.aetherCircuit.ownedChipIds) {
                    // Initialize from IDs for new players
                    saveData.aetherCircuit.ownedChipIds.forEach(id => {
                        const chip = new ChipInstance(id);
                        this.circuit.ownedChips.push(chip);
                    });
                }
            }
        }
    }

    unlockAllSkills() {
        // Setting currency (Debug) - Reduced to prevent extreme persistence
        this.aetherShards = 9999;
        this.dungeonCoins = 9999;
        this.aetherFragments = 9999;
        this.aetherResonance = 9999;

        // Clear existing inventory to avoid duplicates
        this.inventory = [];

        // Generate and add all skills from database
        skillsDB.forEach(skillData => {
            const skillInstance = createSkill(skillData);
            if (skillInstance) {
                this.inventory.push(skillInstance);
            }
        });

        console.log(`Debug Mode: Unlocked ${this.inventory.length} skills.`);

        // Auto-equip powerful sets
        const findAndEquip = (id, slot) => {
            const s = this.inventory.find(item => item.id === id);
            if (s) this.equippedSkills[slot] = s;
        };

        // Standard Debug Loadout
        findAndEquip('flame_fan', SkillType.NORMAL);
        findAndEquip('fireball', 'primary1');
        findAndEquip('magma_spear', 'primary2');
        findAndEquip('dash', SkillType.SECONDARY);
        findAndEquip('volt_drive', SkillType.ULTIMATE);

        // Unlock all Aether Chips
        if (this.circuit) {
            const existingIds = this.circuit.ownedChips.map(c => c.data.id);
            chipsDB.forEach((chipData, idx) => {
                if (!existingIds.includes(chipData.id)) {
                    // Mix identified and unidentified for testing in debug
                    const isIdentified = idx % 3 !== 0;
                    this.circuit.ownedChips.push(new ChipInstance(chipData.id, 1, isIdentified));
                }
            });
            console.log(`Debug Mode: Unlocked ${this.circuit.ownedChips.length} Aether Chips.`);
        }
    }

    // Base multiplier for UI/General display (no target context)
    get damageMultiplier() {
        return this.getDamageMultiplier(null);
    }

    /**
     * Calculates the full damage multiplier based on target context (e.g., Boss)
     */
    getDamageMultiplier(target = null) {
        let mult = 1.0;
        if (this.bloodBlessings) {
            for (const b of this.bloodBlessings) {
                if (b.buff && b.buff.damageMult) mult *= b.buff.damageMult;
            }
        }
        if (this.isAetherRush) mult *= 1.2;

        // Aether Circuit Bonus
        if (this.circuit) {
            const bonuses = this.circuit.getBonuses();
            let chipDamageMult = bonuses.damageMult;

            // MASTERY_STRIKE: Double skill damage if 50+ kills AND synergy active
            if (this.killCount >= 50 && this.circuit.isSynergyActive('mastery_strike')) {
                chipDamageMult *= 2;
            }

            mult += chipDamageMult;
            if (this.enrageTimer > 0) {
                mult += this.enrageBonus;
            }
            // Training Chip: Every kill gives bonuses.trainingKillBuff % damage
            if (bonuses.trainingKillBuff > 0) {
                const stacks = Math.min(100, this.killCount || 0);
                mult += bonuses.trainingKillBuff * stacks;
            }
            // Inertia Chip: Skill damage per 1% speed increase
            if (bonuses.inertiaScaling > 0) {
                const speedBonus = bonuses.speedMult || 0;
                // speedMult is a multiplier (e.g., 0.3 for 30%). 1% = 0.01.
                const speedPercent = speedBonus * 100;
                mult += speedPercent * bonuses.inertiaScaling;
            }

            // Move Courage (Boss Damage) to Additive Group A
            if (target && (target.isBoss || target.data?.isBoss) && bonuses.bossDamageMult > 0) {
                mult += bonuses.bossDamageMult;
            }
        }

        return mult;
    }

    get fireDamageMultiplier() {
        let mult = 1.0;
        if (this.circuit) {
            mult += this.circuit.getBonuses().fireDamageMult;
        }
        return mult;
    }

    get thunderDamageMultiplier() {
        let mult = 1.0;
        if (this.circuit) {
            mult += this.circuit.getBonuses().thunderDamageMult;
        }
        return mult;
    }

    get iceDamageMultiplier() {
        let mult = 1.0;
        if (this.circuit) {
            mult += this.circuit.getBonuses().iceDamageMult;
        }
        return mult;
    }

    get bloodDamageMultiplier() {
        let mult = 1.0;
        if (this.circuit) {
            mult += this.circuit.getBonuses().bloodDamageMult;
        }
        return mult;
    }

    get takenDamageMultiplier() {
        let mult = 1.0;
        if (this.circuit) {
            mult += this.circuit.getBonuses().takenDamageMult;
        }
        return mult;
    }

    get critRateBonus() {
        let bonus = 0;
        if (this.circuit) {
            bonus += this.circuit.getBonuses().critRateAdd;
        }
        return bonus;
    }

    get critDamageBonus() {
        let bonus = 0;
        if (this.circuit) {
            bonus += this.circuit.getBonuses().critDamageAdd;
        }
        return bonus;
    }

    get actualSpeed() {
        let mult = 1.0;
        if (this.bloodBlessings) {
            for (const b of this.bloodBlessings) {
                if (b.buff && b.buff.speedMult) mult *= b.buff.speedMult;
            }
        }
        if (this.voltDriveTimer > 0 && this.voltDriveParams) {
            mult *= (this.voltDriveParams.speedMult || 1.8);
        }
        if (this.slowTimer > 0) {
            mult *= 0.5; // 50% slow
        }

        // Aether Circuit Bonus
        if (this.circuit) {
            const bonuses = this.circuit.getBonuses();
            mult += bonuses.speedMult;

            // Acceleration Chip Bonus
            const maxAccelBonus = bonuses.accelerationScaling || 0;
            if (maxAccelBonus > 0 && this.accelerationTime > 0) {
                // Reaches max bonus after N seconds of continuous movement
                mult += (this.accelerationTime / CONFIG.PLAYER.ACCELERATION_MAX_TIME) * maxAccelBonus;
            }
        }

        return this.speed * mult;
    }

    get maxHp() {
        let bonus = 0;
        if (this.circuit) {
            bonus = this.circuit.getBonuses().maxHp;
        }
        return (this.baseMaxHp || 100) + bonus;
    }

    set maxHp(val) {
        this.baseMaxHp = val;
    }

    get aetherMultiplier() {
        let mult = 1.0;
        if (this.bloodBlessings) {
            for (const b of this.bloodBlessings) {
                if (b.buff && b.buff.aetherGainMult) mult *= b.buff.aetherGainMult;
            }
        }
        if (this.circuit) {
            mult += this.circuit.getBonuses().aetherChargeMult;
        }
        return mult;
    }

    addDungeonCoins(amount) {
        this.dungeonCoins += amount;
    }

    addAetherShards(amount) {
        let finalAmount = amount;
        if (this.game.difficulty === 'easy') {
            finalAmount = Math.ceil(amount * 0.5);
        }
        this.aetherShards += finalAmount;
        console.log(`[Player] Shards added: ${finalAmount} (Total in session: ${this.aetherShards})`);
        // saveAetherData removed to delay persistence until Game Over
    }

    addAetherFragments(amount) {
        this.aetherFragments += amount;
        console.log(`[Player] Fragments added: ${amount} (Total in session: ${this.aetherFragments})`);
        // saveAetherData removed to delay persistence until Game Over
    }

    saveAetherData() {
        const data = SaveManager.getSaveData();
        data.aetherShards = this.aetherShards;
        data.aetherFragments = this.aetherFragments;
        data.aetherCircuit = this.circuit.serialize();
        SaveManager.saveData(data);
        console.log(`[Player] Aether data saved. Shards: ${this.aetherShards}`);
    }

    acquireSkill(skill) {
        if (!skill) return false;

        // Check for duplicates
        const exists = this.inventory.some(s => s.id === skill.id);
        if (exists) {
            console.log(`Skill already possessed: ${skill.name}`);
            return false;
        }

        this.inventory.push(skill);
        SaveManager.unlockSkill(skill.id);
        console.log(`Acquired new skill: ${skill.name}`);
        return true;
    }

    equipSkill(skill, slot) {
        if (skill.type === SkillType.PRIMARY) {
            // For primary, we need a specific slot (primary1 or primary2)
            if (slot === 'primary1' || slot === 'primary2') {
                this.equippedSkills[slot] = skill;
                console.log(`Equipped ${skill.name} to ${slot}`);
            } else {
                // Default to primary1 if undefined? Or find empty?
                if (!this.equippedSkills['primary1']) this.equippedSkills['primary1'] = skill;
                else if (!this.equippedSkills['primary2']) this.equippedSkills['primary2'] = skill;
                else this.equippedSkills['primary1'] = skill; // Overwrite 1
                console.log(`Auto-equipped ${skill.name} to Primary slot`);
            }
        } else if (Object.values(SkillType).includes(skill.type)) {
            this.equippedSkills[skill.type] = skill;
            console.log(`Equipped ${skill.name} to ${skill.type}`);
        }
    }

    unequipSkill(slot) {
        if (this.equippedSkills[slot]) {
            console.log(`Unequipped from ${slot}`);
            this.equippedSkills[slot] = null;
        }
    }

    update(dt) {
        if (this.invulnerable > 0) this.invulnerable -= dt;
        if (this.slowTimer > 0) this.slowTimer -= dt;
        if (this.enrageTimer > 0) {
            this.enrageTimer -= dt;
        } else if (this.enrageCooldownTimer > 0) {
            this.enrageCooldownTimer -= dt;
        }

        if (this.isDemo || this.game.isDungeonStarting || this.game.gameState === 'TITLE') {
            this.frameTimer += dt;
            if (this.frameTimer > this.frameInterval) {
                this.frameCounter++;
                if (this.frameCounter >= this.maxFrames) this.frameCounter = 0;
                this.frameTimer = 0;
            }
            return;
        }

        // 1. Reset Velocities (unless keepVelocity is set)
        if (!this.keepVelocity) {
            this.vx = 0;
            this.vy = 0;
        }
        this.keepVelocity = false;
        let moving = false;

        // 2. Movement Logic
        if (this.isDashing) {
            this.vx = this.dashVx;
            this.vy = this.dashVy;
            moving = true;

            this.dashElapsed = (this.dashElapsed || 0) + dt;

            // Volt Drive: Dash thru enemies
            if (this.voltDriveTimer > 0) {
                for (const e of this.game.enemies) {
                    if (this.checkCollision(this, e)) {
                        const hitKey = `volt_dash_${e.id}`;
                        this.voltHitList = this.voltHitList || new Set();
                        if (!this.voltHitList.has(hitKey)) {
                            const dmg = this.voltDriveParams.dashDamage || 20;
                            const isCrit = Math.random() < (this.voltDriveParams.critChance || 0);
                            const finalDmg = isCrit ? dmg * (this.voltDriveParams.critMultiplier || 2.0) : dmg;

                            // Phoenix Dive / Volt Drive Knockback
                            let kx = 0, ky = 0;
                            const kbValue = this.voltDriveParams.knockback || 400;
                            const dx = (e.x + e.width / 2) - (this.x + this.width / 2);
                            const dy = (e.y + e.height / 2) - (this.y + this.height / 2);
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            kx = (dx / dist) * kbValue;
                            ky = (dy / dist) * kbValue;

                            e.takeDamage(finalDmg, '#ffff00', 0, isCrit, kx, ky);
                            this.voltHitList.add(hitKey);
                            this.game.spawnParticles(e.x + e.width / 2, e.y + e.height / 2, 5, '#ffff00');
                        }
                    }
                }
            }

            if (this.dashElapsed >= this.dashDuration) {
                this.isDashing = false;
                this.dashVx = 0;
                this.dashVy = 0;
                this.dashElapsed = 0;
                if (this.voltHitList) this.voltHitList.clear();
            }
        } else if (this.isCasting) {
            moving = false;
        } else if (this.knockbackDuration > 0) {
            // Block normal movement input during knockback to make it "forced"
            moving = false;
        } else {
            const speed = this.actualSpeed;
            let moveX = 0;
            let moveY = 0;

            if (this.game.input.isDown('ArrowUp') || this.game.input.isDown('KeyW')) moveY -= 1;
            if (this.game.input.isDown('ArrowDown') || this.game.input.isDown('KeyS')) moveY += 1;
            if (this.game.input.isDown('ArrowLeft') || this.game.input.isDown('KeyA')) moveX -= 1;
            if (this.game.input.isDown('ArrowRight') || this.game.input.isDown('KeyD')) moveX += 1;

            if (moveX !== 0 || moveY !== 0) {
                moving = true;
                const dist = Math.sqrt(moveX * moveX + moveY * moveY);
                this.vx = (moveX / dist) * speed;
                this.vy = (moveY / dist) * speed;

                // Facing direction
                if (moveX > 0 && moveY === 0) this.facing = 'right';
                else if (moveX < 0 && moveY === 0) this.facing = 'left';
                else if (moveX === 0 && moveY > 0) this.facing = 'down';
                else if (moveX === 0 && moveY < 0) this.facing = 'up';
                else if (moveX > 0 && moveY > 0) this.facing = 'down-right';
                else if (moveX > 0 && moveY < 0) this.facing = 'up-right';
                else if (moveX < 0 && moveY > 0) this.facing = 'down-left';
                else if (moveX < 0 && moveY < 0) this.facing = 'up-left';
            }
        }

        if (this.knockbackDuration <= 0) {
            this.knockbackVx = 0;
            this.knockbackVy = 0;
        }

        // 4. Animation and Visuals
        this.frameTimer += dt;
        if (this.frameTimer > this.frameInterval) {
            this.frameCounter++;
            if (this.frameCounter >= this.maxFrames) this.frameCounter = 0;
            this.frameTimer = 0;
        }

        if (moving) {
            this.accelerationTime = Math.min(CONFIG.PLAYER.ACCELERATION_MAX_TIME, this.accelerationTime + dt);
        } else {
            // Gradually decrease (approx 2.6s to empty from full)
            this.accelerationTime = Math.max(0, this.accelerationTime - dt * 1.5);
        }

        // Reset scale and rotation to defaults as new 36-frame animations handle these
        this.scale = this.baseScale;
        this.rotation = 0;
        this.animTimer += dt;

        if (this.dashTimer > 0) this.dashTimer -= dt;

        // Aether / Volt / Effects
        if (this.isAetherRush) {
            this.aetherRushTimer -= dt;
            this.aetherGauge = (this.aetherRushTimer / this.aetherRushDuration) * this.maxAetherGauge;
            if (this.aetherRushTimer <= 0) this.endAetherRush();
            if (Math.random() < 0.3) this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 1, '#00ffff');
        }

        if (this.voltDriveTimer > 0) {
            this.voltDriveTimer -= dt;
            if (this.voltDriveTimer <= 0) { this.voltDriveTimer = 0; this.voltDriveParams = null; }
            
            // SHOCK-like Spark effect for Player during Volt Drive
            if (Math.random() < 0.2) {
                const px = this.x + Math.random() * this.width;
                const py = this.y + Math.random() * this.height;
                const partId = Math.floor(Math.random() * 10) + 1;
                const partStr = partId < 10 ? `0${partId}` : `${partId}`;
                
                spawnProjectile(this.game, px, py, 0, 0, {
                    visual: true,
                    spriteSheet: `assets/skills/vfx/lightning_part_${partStr}.png`,
                    frames: 1,
                    life: 0.15 + Math.random() * 0.1,
                    width: 28 + Math.random() * 28, // Slightly larger for player
                    height: 28 + Math.random() * 28,
                    rotation: Math.random() * Math.PI * 2,
                    color: '#ffff00',
                    filter: 'sepia(1) saturate(10) hue-rotate(0deg) brightness(1.2)',
                    blendMode: 'lighter'
                });
            }
        }

        // Ghost trail
        if (this.isAetherRush || this.voltDriveTimer > 0) {
            this.ghostTimer = (this.ghostTimer || 0) + dt;
            const ghostInterval = (this.voltDriveTimer > 0) ? 0.04 : 0.05;
            if (this.ghostTimer > ghostInterval) {
                this.ghostTimer = 0;
                this.createGhostEffect(); // Refactored to helper
            }
        }

        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        // 5. Physics and Skill Cooldowns
        // Move entity via Entity.update (handles collisions)
        // Note: super.update(dt) handles vx/vy application
        super.update(dt);

        // Calculate current bonus for UI display
        const bonuses = this.circuit.getBonuses();
        const maxAccelBonus = bonuses.accelerationScaling || 0;
        let accelBonus = 0;
        if (maxAccelBonus > 0 && this.accelerationTime > 0) {
            accelBonus = (this.accelerationTime / CONFIG.PLAYER.ACCELERATION_MAX_TIME) * maxAccelBonus;
        }

        for (let key in this.equippedSkills) {
            const skill = this.equippedSkills[key];
            if (!skill) continue;

            const wasReady = skill.isReady();
            skill.update(dt); // Removed attackSpeedMult (now applies to movement speed)
            const isReady = skill.isReady();

            // Notify user when a non-normal skill becomes ready
            if (!wasReady && isReady && skill.type !== SkillType.NORMAL) {
                this.triggerSkillReadyVisual(skill);
            }
        }
        this.currentAccelerationBonus = accelBonus; // Store for UI/VFX if needed

        // 6. Skill Input
        const inputMap = [
            { key: 'Space', slot: SkillType.NORMAL },
            { key: 'KeyQ', slot: 'primary1' },
            { key: 'KeyE', slot: 'primary2' },
            { key: 'KeyC', slot: SkillType.SECONDARY },
            { key: 'KeyX', slot: SkillType.ULTIMATE }
        ];

        for (const map of inputMap) {
            const skill = this.equippedSkills[map.slot];
            if (skill) {
                if (this.chargingSkillSlot === map.slot) {
                    if (this.game.input.isDown(map.key)) {
                        this.chargeTimer += dt;
                        if (this.chargeTimer > this.maxChargeTime) this.chargeTimer = this.maxChargeTime;
                    } else {
                        this.finishChargeAndFire();
                    }
                } else if (this.game.input.isDown(map.key) && !this.isCharging && !this.isDashing && !this.isCasting) {
                    if (skill.chargeable) {
                        this.startCharge(map.slot, skill);
                    } else if (this.game.input.isDown(map.key)) {
                        if (map.slot === SkillType.NORMAL && this.game.isInteracting) continue;
                        this.useSkill(map.slot);
                    }
                }
            }
        }

        // 7. RESTORED DASH INPUT
        if (this.game.input.isDown('ShiftLeft') || this.game.input.isDown('ShiftRight') || this.game.input.isPressed('ClickRight')) {
            if (this.isCharging) this.cancelCharge();
            this.performDash();
        }
    }

    createGhostEffect() {
        const moving = Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1;
        let spriteKey = 'yoko';
        if (moving) {
            if (this.facing.includes('up')) spriteKey = 'ue';
            else if (this.facing.includes('down')) spriteKey = 'sita';
        } else {
            if (this.facing.includes('up')) spriteKey = 'idol_ue';
            else if (this.facing.includes('down')) spriteKey = 'idol_sita';
            else spriteKey = 'idol_yoko';
        }

        const sheet = this.sprites[spriteKey];
        if (sheet && sheet.data && sheet.data.frames) {
            const frameNames = Object.keys(sheet.data.frames);
            const frameName = frameNames[this.frameCounter % frameNames.length];
            const frameEntry = sheet.data.frames[frameName];
            const frameData = frameEntry ? (frameEntry.frame || frameEntry) : null; 

            if (frameData) {
                const ratio = frameData.w / frameData.h;
                let baseDrawScale = 1.8;
                if (spriteKey === 'yoko') baseDrawScale = 1.8 * 1.25; 
                else if (spriteKey === 'ue') baseDrawScale = 1.8 * 1.10; 
                else if (spriteKey === 'sita') baseDrawScale = 1.8 * 0.9;
                else if (spriteKey === 'idol_ue') baseDrawScale = 1.8 * 0.78; 
                else if (spriteKey === 'idol_sita') baseDrawScale = 1.8 * 0.70; 

                const drawWidth = this.width * baseDrawScale;
                const drawHeight = drawWidth / ratio;
                const drawX = (this.width - drawWidth) / 2;
                const drawY = this.height - drawHeight;
                const isVolt = this.voltDriveTimer > 0;
                const isLeft = this.facing.includes('left');

                this.game.animations.push({
                    type: 'ghost',
                    x: this.x + drawX, y: this.y + drawY,
                    width: drawWidth, height: drawHeight,
                    image: sheet.img,
                    sx: frameData.x, sy: frameData.y,
                    sw: frameData.w, sh: frameData.h,
                    life: 0.3, maxLife: 0.3,
                    isVolt: isVolt,
                    isLeft: isLeft,
                    update: function (dt) { this.life -= dt; },
                    draw: function (ctx) {
                        ctx.save();
                        ctx.globalAlpha = (this.life / this.maxLife) * 0.6;
                        if (this.isVolt) ctx.filter = 'brightness(1.5) sepia(100%) saturate(1000%) hue-rotate(-20deg)';
                        else ctx.filter = 'brightness(2) grayscale(100%)';

                        ctx.translate(Math.floor(this.x + this.width / 2), Math.floor(this.y + this.height));
                        if (this.isLeft) ctx.scale(-1, 1);
                        ctx.drawImage(this.image, this.sx, this.sy, this.sw, this.sh, -Math.floor(this.width / 2), -Math.floor(this.height), Math.floor(this.width), Math.floor(this.height));
                        ctx.restore();
                    }
                });
            }
        }
    }

    startCharge(slot, skill) {
        this.isCharging = true;
        this.chargingSkillSlot = slot;
        this.chargeTimer = 0;
        this.maxChargeTime = skill.chargeTime || 1.0;
        this.isCasting = true; // Block movement
        console.log(`Started charging ${skill.name}`);
    }

    cancelCharge() {
        this.isCharging = false;
        this.chargingSkillSlot = null;
        this.chargeTimer = 0;
        this.isCasting = false;
        console.log("Charge Cancelled");
    }

    finishChargeAndFire() {
        const slot = this.chargingSkillSlot;
        const skill = this.equippedSkills[slot];
        if (skill) {
            const ratio = Math.min(1.0, this.chargeTimer / this.maxChargeTime);
            
            // Check for onlyFullCharge requirement
            if (skill.params.onlyFullCharge && ratio < 1.0) {
                console.log(`Failed to fire ${skill.name}: Needs full charge (Current: ${ratio.toFixed(2)})`);
                this.cancelCharge();
                return;
            }

            console.log(`Firing ${skill.name} with ratio ${ratio}`);

            // Prepare params
            const extraParams = { chargeRatio: ratio };
            let shouldResetAether = false;

            // Check if Ultimate Reset condition met
            if (skill.type === SkillType.ULTIMATE && this.isAetherRush) {
                extraParams.aetherCharge = 0;
                shouldResetAether = true;
            }

            // Pass the ratio to activate
            const finalSlot = slot; // Keep ref
            this.cancelCharge(); // Reset isCharging and isCasting first
            
            skill.activate(this, this.game, extraParams);

            // Reset Aether Rush AFTER activation so behaviors see the flag
            if (shouldResetAether) {
                spawnAetherExplosion(this.game, this.x + this.width / 2, this.y + this.height / 2); // Trigger Visual
                this.game.activateSlowMotion(1.0, 0.0);
                this.endAetherRush();
            }
        }
    }

    useSkill(slot) {
        const skill = this.equippedSkills[slot];
        if (skill) {
            const extraParams = {};
            let shouldResetAether = false;

            // Check if Ultimate Reset condition met
            if (skill.type === SkillType.ULTIMATE && this.isAetherRush) {
                extraParams.aetherCharge = 0;
                shouldResetAether = true;
            }

            skill.activate(this, this.game, extraParams);

            // Reset Aether Rush AFTER activation so behaviors see the flag
            if (shouldResetAether) {
                spawnAetherExplosion(this.game, this.x + this.width / 2, this.y + this.height / 2); // Trigger Visual
                this.game.activateSlowMotion(1.0, 0.0);
                this.endAetherRush();
            }
        }
    }

    // Helper to get hit box based on facing direction
    getHitBox(range, width, height) {
        let hitX = this.x;
        let hitY = this.y;
        let hitW = this.width;
        let hitH = this.height;

        if (this.facing === 'left') { hitX -= range; hitW = range; if (width) hitW = width; hitX = this.x - hitW; }
        else if (this.facing === 'right') { hitX += this.width; hitW = range; if (width) hitW = width; }
        else if (this.facing === 'up') { hitY -= range; hitH = range; if (height) hitH = height; hitY = this.y - hitH; }
        else if (this.facing === 'down') { hitY += this.height; hitH = range; if (height) hitH = height; }
        else if (this.facing === 'up-left') { hitX -= range * 0.7; hitY -= range * 0.7; hitW = range; hitH = range; }
        else if (this.facing === 'up-right') { hitX += this.width - range * 0.3; hitY -= range * 0.7; hitW = range; hitH = range; }
        else if (this.facing === 'down-left') { hitX -= range * 0.7; hitY += this.height - range * 0.3; hitW = range; hitH = range; }
        else if (this.facing === 'down-right') { hitX += this.width - range * 0.3; hitY += this.height - range * 0.3; hitW = range; hitH = range; }

        // Center alignment for perpendicular axis
        if (this.facing === 'left' || this.facing === 'right') {
            if (height) {
                hitY = this.y + (this.height - height) / 2;
                hitH = height;
            }
        } else {
            if (width) {
                hitX = this.x + (this.width - width) / 2;
                hitW = width;
            }
        }

        return { x: hitX, y: hitY, w: hitW, h: hitH };
    }

    triggerSkillReadyVisual(skill) {
        if (!skill.icon) return;
        const iconImg = getCachedImage(skill.icon);

        this.game.animations.push({
            type: 'custom',
            player: this,
            image: iconImg,
            life: 1.2,
            maxLife: 1.2,
            update: function (dt) {
                // Main.js handles life reduction
            },
            draw: function (ctx) {
                const progress = this.life / this.maxLife; // 1.0 -> 0.0
                const t = 1.0 - progress;
                // Fast fade in (0.2s), then fade out
                const alpha = Math.min(1.0, t * 5) * progress;

                // Position relative to player
                const px = this.player.x + this.player.width / 2;
                const py = this.player.y - 60;

                ctx.save();
                ctx.globalAlpha = alpha;

                // 2. Draw the icon
                if (this.image && this.image.complete && this.image.naturalWidth !== 0) {
                    const size = 24 * (1.0 + Math.sin(t * Math.PI) * 0.5); // Pop size
                    ctx.drawImage(this.image, px - size / 2, py - size / 2, size, size);
                    
                    // Add "Sparkle" on appearance - REMOVED PER USER REQUEST
                    /*
                    if (t < 0.1 && Math.random() < 0.5) {
                        this.player.game.spawnParticles(px, py, 2, '#fff');
                    }
                    */
                }

                ctx.restore();
            }
        });

        // Extra burst particles - REMOVED PER USER REQUEST
        // this.game.spawnParticles(this.x + this.width / 2, this.y - 20, 5, '#fff');
    }

    draw(ctx, alpha = 1) {
        // Interpolated Position for render and UI
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        // Find current direction sheet
        const moving = Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1;
        let spriteKey = moving ? 'yoko' : 'idol_yoko';
        if (moving) {
            if (this.facing.includes('up')) spriteKey = 'ue';
            else if (this.facing.includes('down')) spriteKey = 'sita';
        } else {
            if (this.facing.includes('up')) spriteKey = 'idol_ue';
            else if (this.facing.includes('down')) spriteKey = 'idol_sita';
        }

        let sheet = this.sprites[spriteKey];
        // Resilient fallback logic
        const isReady = (s) => s && s.img.complete && s.img.naturalWidth !== 0 && s.data;
        
        if (!isReady(sheet)) {
            // Priority fallbacks
            if (spriteKey.startsWith('idol')) {
                if (isReady(this.sprites['idol_yoko'])) sheet = this.sprites['idol_yoko'];
                else if (isReady(this.sprites['yoko'])) sheet = this.sprites['yoko'];
            } else {
                if (isReady(this.sprites['yoko'])) sheet = this.sprites['yoko'];
            }
        }

        if (isReady(sheet)) {
            const frameNames = Object.keys(sheet.data.frames);
            const frameName = frameNames[this.frameCounter % frameNames.length];
            const framesDict = sheet.data.frames;
            const frameEntry = framesDict[frameName];

            if (frameEntry) {
                const frameData = frameEntry.frame || frameEntry;
                // Calculate Aspect Ratio
                const ratio = frameData.w / frameData.h;
                let baseDrawScale = 1.8;
                if (spriteKey === 'yoko') baseDrawScale = 1.8 * 1.25; // Increase horizontal run by 25%
                else if (spriteKey === 'ue') baseDrawScale = 1.8 * 1.05; // Increase up run by 5%
                else if (spriteKey === 'sita') baseDrawScale = 1.8 * 0.9; // 10% reduction for down run
                else if (spriteKey === 'idol_ue') baseDrawScale = 1.8 * 0.80; // 20% reduction for up idle
                else if (spriteKey === 'idol_sita') baseDrawScale = 1.8 * 0.85; // 15% reduction for down idle

                const drawWidth = this.width * baseDrawScale;
                const drawHeight = drawWidth / ratio;

                // Anchor to Bottom Center
                const drawX = (this.width - drawWidth) / 2;
                const drawY = this.height - drawHeight;

                // Aether Aura Visual
                if (this.aetherGauge > 0) {
                    ctx.save();
                    const auraIntensity = this.isAetherRush ? 1.0 : (this.aetherGauge / this.maxAetherGauge);
                    ctx.globalAlpha = 0.3 * auraIntensity;
                    ctx.translate(interpX + this.width / 2, interpY + this.height / 2);
                    const auraSize = this.width * (1.2 + Math.sin(this.animTimer * 6) * 0.1);
                    
                    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, auraSize);
                    const auraColor = this.isAetherRush ? '0, 255, 255' : '100, 200, 255';
                    grad.addColorStop(0, `rgba(${auraColor}, 0.8)`);
                    grad.addColorStop(1, `rgba(${auraColor}, 0)`);
                    
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(0, 0, auraSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                ctx.save();
                ctx.globalAlpha *= this.alpha;
                ctx.translate(interpX + this.width / 2, interpY + this.height);
                ctx.scale(this.scale, this.scale);
                ctx.rotate(this.rotation);

                // Mirror for left direction
                if (this.facing.includes('left')) {
                    ctx.scale(-1, 1);
                }

                // Elemental Glow Foundation
                const primarySkill = this.equippedSkills['primary1'] || this.equippedSkills[SkillType.NORMAL];
                if (primarySkill && primarySkill.element) {
                    ctx.save();
                    const elementColors = {
                        'fire': '#ff4400',
                        'ice': '#0088ff',
                        'thunder': '#ffff00',
                        'blood': '#ff0000'
                    };
                    const glowColor = elementColors[primarySkill.element] || '#ffffff';
                    ctx.shadowBlur = 15 + Math.sin(this.animTimer * 5) * 5;
                    ctx.shadowColor = glowColor;
                    ctx.globalAlpha *= 0.5;
                    ctx.beginPath();
                    ctx.arc(0, -this.height / 2, this.width * 0.8, 0, Math.PI * 2);
                    ctx.fillStyle = glowColor;
                    ctx.fill();
                    ctx.restore();
                }

                if (this.hitFlashTimer > 0) {
                    ctx.filter = 'brightness(0) invert(1)';
                }

                // Draw the actual sprite
                ctx.drawImage(
                    sheet.img,
                    frameData.x, frameData.y, frameData.w, frameData.h,
                    drawX - this.width / 2, drawY - this.height, drawWidth, drawHeight
                );
                ctx.restore();
            } else {
                super.draw(ctx, alpha);
            }
        } else {
            super.draw(ctx, alpha);
        }

        // Draw Charge Gauge
        if (this.isCharging) {
            const barW = 40;
            const barH = 6;
            const barX = interpX + (this.width - barW) / 2;
            const barY = interpY - 15;

            // BG
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barW, barH);

            // Fill
            const ratio = Math.min(1.0, this.chargeTimer / this.maxChargeTime);
            if (ratio >= 1.0) ctx.fillStyle = '#ffcc00'; // Full charge gold
            else ctx.fillStyle = '#00ccff'; // Charging blue

            ctx.fillRect(barX + 1, barY + 1, (barW - 2) * ratio, barH - 2);
        }

        // Draw Direction Indicator (Triangle at feet)
        {
            const facingAngles = {
                'right': 0,
                'down-right': Math.PI / 4,
                'down': Math.PI / 2,
                'down-left': 3 * Math.PI / 4,
                'left': Math.PI,
                'up-left': -3 * Math.PI / 4,
                'up': -Math.PI / 2,
                'up-right': -Math.PI / 4,
            };

            const angle = facingAngles[this.facing] ?? 0;
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height + 6; // Slightly below feet
            const dist = 10; // Distance from feet center to tip
            const size = 5;  // Half-width of triangle base

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.beginPath();
            ctx.moveTo(dist + size, 0);      // Tip
            ctx.lineTo(dist - size, -size);  // Base top
            ctx.lineTo(dist - size, size);   // Base bottom
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // --- Screen Damage Flash (Radial Red Flare) ---
        if (this.hitFlashTimer > 0) {
            ctx.save();
            const alpha = Math.max(0, Math.min(0.4, (this.hitFlashTimer / 0.2) * 0.4));
            const grad = ctx.createRadialGradient(
                this.game.width / 2, this.game.height / 2, 0,
                this.game.width / 2, this.game.height / 2, this.game.width
            );
            grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
            grad.addColorStop(1, `rgba(255, 0, 0, ${alpha.toFixed(2)})`);
            ctx.fillStyle = grad;
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Overlay in screen space
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.restore();
        }
    }

    onEnemyKill() {
        this.killCount = (this.killCount || 0) + 1;
    }

    takeDamage(amount) {
        if (this.invulnerable > 0) return;

        let scaledDamage = amount;

        // Apply Berserker / Taken Damage Multiplier
        scaledDamage *= this.takenDamageMultiplier;

        if (this.game.difficulty === 'easy') {
            scaledDamage = Math.round(scaledDamage * 0.5);
        } else {
            scaledDamage = Math.round(scaledDamage);
        }

        // 1. Camera Shake (Intensity based on damage)
        if (this.game.camera) {
            const intensity = Math.min(15, 5 + scaledDamage / 2);
            this.game.camera.shake(0.2, intensity);
        }

        // Visual Polish: Damage Tilt and Scale
        this.rotation = (Math.random() - 0.5) * 0.4;
        this.scale = this.baseScale * 0.9;
        this.hitFlashTimer = 0.2; // Ensure flash is triggered

        // 2. Knockback Calculation (Away from nearest enemy or based on movement)
        const enemiesInRange = this.game.enemies.filter(e => {
            const dx = e.x - this.x;
            const dy = e.y - this.y;
            return Math.sqrt(dx * dx + dy * dy) < 100;
        });

        let kx = 0, ky = 0;
        if (enemiesInRange.length > 0) {
            const source = enemiesInRange[0];
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            kx = (dx / dist) * 400;
            ky = (dy / dist) * 400;
        } else {
            // Fallback: knockback opposite to facing
            const angles = { 'right': Math.PI, 'left': 0, 'up': Math.PI / 2, 'down': -Math.PI / 2 };
            const angle = angles[this.facing] || 0;
            kx = Math.cos(angle) * 300;
            ky = Math.sin(angle) * 300;
        }

        // Apply Ukemi (half damage chance)
        if (this.circuit && !this.isCheatInvincible) {
            const bonuses = this.circuit.getBonuses();
            if (bonuses.ukemiChance > 0 && Math.random() < bonuses.ukemiChance) {
                scaledDamage = Math.ceil(scaledDamage * 0.5);

                // UNYIELDING_BLEED Synergy: Apply 3 stacks of Bleed to nearby enemies
                if (this.circuit.isSynergyActive('unyield_bleed')) {
                    const radius = 150;
                    const enemies = this.game.enemies;
                    if (enemies) {
                        enemies.forEach(enemy => {
                            if (enemy.hp <= 0) return;
                            const edx = enemy.x - this.x;
                            const edy = enemy.y - this.y;
                            if (Math.sqrt(edx * edx + edy * edy) <= radius) {
                                if (enemy.statusManager) {
                                    // Apply 3 stacks
                                    for (let i = 0; i < 3; i++) {
                                        enemy.statusManager.applyStatus(STATUS_TYPES.BLEED, 5.0, null, 10);
                                    }
                                }
                            }
                        });
                    }
                }

                // Visual feedback for Ukemi (Icon animation similar to Enrage)
                this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 5, '#00ffcc');
                const ukemiIcon = getCachedImage('assets/ui/chips/icon_ukemi.png');
                const player = this;
                this.game.animations.push({
                    type: 'vfx',
                    x: player.x + player.width / 2,
                    y: player.y - 20,
                    life: 1.0,
                    maxLife: 1.0,
                    update: function (dt) {
                        this.life -= dt;
                        this.y -= 25 * dt; // Float up slightly faster than Enrage
                        this.x = player.x + player.width / 2;
                        this.renderY = player.y - 30 - (1.0 - this.life) * 25;
                    },
                    draw: function (ctx) {
                        if (!ukemiIcon || !ukemiIcon.complete) return;
                        ctx.save();
                        let alpha = 1.0;
                        const age = this.maxLife - this.life;
                        if (age < 0.2) alpha = age / 0.2;
                        else if (this.life < 0.3) alpha = this.life / 0.3;

                        ctx.globalAlpha = alpha * 0.9;
                        ctx.filter = 'drop-shadow(0 0 5px #00ffcc) brightness(1.2)';

                        const size = 32;
                        ctx.drawImage(ukemiIcon, this.x - size / 2, this.renderY - size / 2, size, size);
                        ctx.restore();
                    }
                });
            }
        }

        // Use base Entity.takeDamage to apply HP loss and KNOCKBACK
        // But if cheat invincible, we pass 0 damage to super.takeDamage for actual HP loss, 
        // while keeping the visual amount for other effects.
        const damageToApply = this.isCheatInvincible ? 0 : scaledDamage;
        super.takeDamage(damageToApply, this.damageColor, 0, false, kx, ky, 0.15, true);

        // Enrage (逆上) Chip Effect
        if (this.circuit && !this.isCheatInvincible && scaledDamage > 0) {
            const bonuses = this.circuit.getBonuses();
            if (bonuses.onHitDamageBuff > 0 && this.enrageTimer <= 0 && this.enrageCooldownTimer <= 0) {
                this.enrageTimer = 5.0; // 5 seconds duration
                this.enrageBonus = bonuses.onHitDamageBuff;
                this.enrageCooldownTimer = 10.0; // Fixed to 10s
                this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 5, '#ff4400');

                // Icon Fade-in/out Animation
                const enrageIcon = getCachedImage('assets/ui/chips/icon_enrage.png');
                const player = this;
                this.game.animations.push({
                    type: 'vfx',
                    x: player.x + player.width / 2,
                    y: player.y - 20,
                    life: 1.2,
                    maxLife: 1.2,
                    update: function (dt) {
                        this.life -= dt;
                        this.y -= 20 * dt; // Float up
                        this.x = player.x + player.width / 2; // Follow player x
                        // Keep y relative to player but with offset
                        this.renderY = player.y - 25 - (1.2 - this.life) * 20;
                    },
                    draw: function (ctx) {
                        if (!enrageIcon || !enrageIcon.complete) return;
                        ctx.save();
                        // 0.3s fade in, then stay, last 0.4s fade out
                        let alpha = 1.0;
                        const age = this.maxLife - this.life;
                        if (age < 0.3) alpha = age / 0.3;
                        else if (this.life < 0.4) alpha = this.life / 0.4;

                        ctx.globalAlpha = alpha * 0.8;
                        ctx.filter = 'drop-shadow(0 0 5px #ff0000) brightness(1.2)';

                        const size = 32;
                        ctx.drawImage(enrageIcon, this.x - size / 2, this.renderY - size / 2, size, size);
                        ctx.restore();
                    }
                });
                console.log(`Enrage Triggered! Cooldown: ${this.enrageCooldownTimer.toFixed(1)}s`);
            }
        }

        // Adjust invulnerability for player
        this.invulnerable = 0.6;
        this.hitFlashTimer = 0.2;

        // 3. Particles (Blood-like)
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            this.game.animations.push({
                type: 'particle',
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4,
                maxLife: 0.4,
                color: '#ff0000',
                update: function (dt) { this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt; },
                draw: function (ctx) {
                    ctx.fillStyle = this.color;
                    ctx.globalAlpha = this.life / this.maxLife;
                    ctx.fillRect(this.x, this.y, 4, 4);
                }
            });
        }

        // 4. Damage Text (Override font for player)
        this.game.spawnFloatingText(
            scaledDamage,
            this.x + this.width / 2,
            this.y - 20,
            '#ff3333',
            {
                vx: (Math.random() - 0.5) * 60,
                vy: -150,
                font: "bold 24px 'Press Start 2P', monospace"
            }
        );

        if (this.hp <= 0 && !this.isCheatInvincible) {
            this.hp = 0;
            this.game.gameState = 'GAME_OVER';
        }
    }

    performDash() {
        if (this.dashTimer > 0 || this.isDashing || this.isCasting) return;

        this.isDashing = true;
        this.dashTimer = this.dashCooldown;
        this.invulnerable = this.dashDuration + 0.1; // Slight invulnerability buffer

        // Dash Direction
        let dashMoveX = 0;
        let dashMoveY = 0;
        if (this.facing === 'left') dashMoveX = -1;
        else if (this.facing === 'right') dashMoveX = 1;
        else if (this.facing === 'up') dashMoveY = -1;
        else if (this.facing === 'down') dashMoveY = 1;
        else if (this.facing === 'up-left') { dashMoveX = -1; dashMoveY = -1; }
        else if (this.facing === 'up-right') { dashMoveX = 1; dashMoveY = -1; }
        else if (this.facing === 'down-left') { dashMoveX = -1; dashMoveY = 1; }
        else if (this.facing === 'down-right') { dashMoveX = 1; dashMoveY = 1; }

        const dist = Math.sqrt(dashMoveX * dashMoveX + dashMoveY * dashMoveY);
        this.dashVx = (dashMoveX / dist) * this.dashSpeed;
        this.dashVy = (dashMoveY / dist) * this.dashSpeed;

        console.log("Dash!", this.dashVx, this.dashVy);

        // Visual Polish: Dash Dust Cloud
        for (let i = 0; i < 5; i++) {
            this.game.spawnParticles(
                this.x + this.width / 2 + (Math.random() - 0.5) * 20,
                this.y + this.height,
                1,
                'rgba(255, 255, 255, 0.5)',
                { vx: -this.dashVx * 0.2 + (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 30, life: 0.4 }
            );
        }

        // Visual Effect (Ghost)
        const ghostInterval = 0.03; // Spawn ghost every 0.03s
        let timer = 0;

        // Add a temporary spawner animation to the game to create trails
        this.game.animations.push({
            type: 'spawner',
            life: this.dashDuration,
            update: (dt) => {
                timer += dt;
                if (timer >= ghostInterval) {
                    timer = 0;
                    // Create Ghost
                    // Calculate correct ghost visual dims
                    let ghostX = this.x;
                    let ghostY = this.y;
                    let ghostW = this.width;
                    let ghostH = this.height;

                    if (this.spriteData) {
                        const frameIndex = this.frameY * 4 + this.frameX;
                        if (this.spriteData.frames && this.spriteData.frames[frameIndex]) {
                            const frameData = this.spriteData.frames[frameIndex].frame;
                            const ratio = frameData.w / frameData.h;
                            ghostW = this.width * 1.05;
                            ghostH = ghostW / ratio;
                            ghostX = this.x + (this.width - ghostW) / 2;
                            ghostY = this.y + this.height - ghostH;
                        }
                    }

                    this.game.animations.push({
                        type: 'ghost',
                        x: ghostX, y: ghostY,
                        w: ghostW, h: ghostH,
                        life: 0.3, maxLife: 0.3,
                        color: 'rgba(100, 200, 255, 0.4)',
                        image: this.image,
                        frameX: this.frameX,
                        frameY: this.frameY,
                        spriteData: this.spriteData
                    });
                }
            }
        });

        // End Dash: use dt-based timer instead of setTimeout so it respects timeScale
        this.dashElapsed = 0;
    }

    addAether(amount) {
        if (this.isAetherRush) return; // Don't gain while active
        this.aetherGauge += amount * this.aetherMultiplier;
        if (this.aetherGauge >= this.maxAetherGauge) {
            this.aetherGauge = this.maxAetherGauge;
            this.triggerAetherRush();
        }
    }

    triggerAetherRush() {
        if (this.isAetherRush) return;
        this.isAetherRush = true;
        this.aetherRushTimer = this.aetherRushDuration;
        console.log("AETHER RUSH ACTIVATED!");

        // Reset Ultimate Cooldown
        if (this.equippedSkills[SkillType.ULTIMATE]) {
            const ult = this.equippedSkills[SkillType.ULTIMATE];
            ult.currentCooldown = 0;
            ult.stacks = ult.maxStacks;
            console.log("Ultimate Cooldown Reset!");
        }

        // Vfx (Simple flash or particle boost handled in update/draw)
        this.game.spawnParticles(this.x + this.width / 2, this.y + this.height / 2, 20, '#00ffff'); // Cyan burst
    }

    endAetherRush() {
        this.isAetherRush = false;
        this.aetherGauge = 0;
        this.aetherRushTimer = 0;
        console.log("Aether Rush Ended");
    }
}
