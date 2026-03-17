export const skillsDB = [
    {
        id: 'flame_fan',
        name: 'フレイムファン', // Flame Fan
        type: 'normal',
        element: 'fire',
        icon: 'assets/skills/icons/icon_flame_fan.png', // Dedicated icon
        cooldown: 0.8,
        behavior: 'fan_projectile',
        description: '前方に扇状の炎を撒き散らす。わずかに敵を押し戻す。',
        params: {
            knockback: 50,
            count: 6, // Number of pellets
            angleSpread: 45, // Spread in degrees
            damage: 5,
            speed: 600,
            randomSpeed: 150, // Variation in speed
            life: 0.3, // Short range (increased from 0.233)
            width: 14,
            height: 14,
            // shape: 'orb', // REMOVE procedural shape
            spriteSheet: 'assets/skills/vfx/flame_fan.png', // Use the new pixel art
            frames: 1, // Single frame for now
            fixedOrientation: true, // Don't rotate sprite automatically (unless round)

            color: '#ff6600', // Orange Fire (still good for lighting/damage)
            trailColor: 'rgba(255, 100, 0, 0.5)',
            damageColor: '#ff6600',
            statusEffect: 'burn',
            statusChance: 0.2,
            aetherCharge: 2.7, // Calculated: 5.0 / (1.5 hits / 0.8s)
            critChance: 0.15,      // 8% -> 15% (連射型)
            critMultiplier: 1.2,   // 2.0 -> 1.2 (連射型)
            noShake: true // Bypass universal hit shake in main.js
        }
    },
    {
        id: 'slash',
        name: 'スラッシュ', // Restore original name if needed, or keep backup if user preferred
        type: 'normal',
        element: 'blood',
        icon: 'assets/skills/icons/icon_slash.png',
        cooldown: 0.5,
        behavior: 'crimson_slash_single',
        description: '前方に鋭い斬撃を放つ。クリティカル率が高く、敵をノックバックさせる。',
        params: {
            knockback: 150,
            damage: 10,
            speed: 0,
            life: 0.12, // Reduced from 0.2 for faster animation
            width: 120, // Crimson Cross scale
            height: 120,
            forwardOffset: 35,
            shape: 'slash',
            color: 'rgba(255, 255, 255, 1.0)', // Pure White (Slash theme)
            trailColor: 'rgba(220, 255, 255, 0.6)',
            damageColor: '#ffffff',
            pierce: 999,
            ignoreWallDestruction: true,
            aetherCharge: 2.0,
            critChance: 0.35,      // 30% -> 35%
            critMultiplier: 1.3    // 1.5 -> 1.3
        }
    },
    {
        id: 'crimson_cross',
        name: 'クリムゾン・クロス', // Crimson Cross
        type: 'normal',
        element: 'blood',
        icon: 'assets/skills/icons/icon_blood_scythe.png',
        cooldown: 0.3,
        behavior: 'crimson_cross',
        description: '前方に十文字の斬撃を放ち、敵を出血させる。',
        params: {
            damage: 4,
            speed: 0,
            life: 0.2, // Adjusted to 0.2s
            width: 84, // 120 * 0.7
            height: 84, // 120 * 0.7
            forwardOffset: 35, // Centered better on player
            shape: 'slash',
            color: '#800000', // Deep Dark Red
            trailColor: 'rgba(128, 0, 0, 0.4)',
            damageColor: '#cc0000', // Brighter Blood Red for visibility
            statusEffect: 'bleed',
            statusChance: 0.4,
            pierce: 1, // Hit only one enemy per strike
            ignoreWallDestruction: true, // Don't vanish on walls
            aetherCharge: 2.0,
            critChance: 0.25,      // 10% -> 25%
            critMultiplier: 1.3    // 1.5 -> 1.3
        }
    },

    {
        id: 'ice_signal',
        name: 'アイスシグナル', // Ice Signal
        type: 'normal',
        element: 'ice',
        icon: 'assets/skills/icons/icon_ice.png', // Placeholder
        cooldown: 0.09, // 2x slower (was 0.045)
        behavior: 'projectile',
        description: '目の前に氷の針を一瞬だけ出現させる超高速の突き攻撃。',
        params: {
            damage: 3,
            speed: 600, // 2x Speed
            width: 14,
            height: 50,
            life: 0.15, // Slightly longer visible life
            pierce: 2,
            statusEffect: 'slow',
            statusChance: 0.3,
            statusDuration: 2.0,
            spriteSheet: 'assets/skills/vfx/ice_spike.png',
            frames: 1,
            rotationOffset: Math.PI / 2, // 90 degrees to point Right
            fixedOrientation: true, // Prevent auto-swap of W/H
            forwardOffset: 30, // Distance from player center
            heightOffset: -10, // Slight upward visual offset
            trailColor: 'rgba(255, 255, 255, 0.5)',
            shape: 'triangle', // Fallback
            damageColor: '#00ffff', // Cyan (Ice)
            aetherCharge: 0.18, // Calculated: 5.0 / (1 hit / 0.035s)
            critChance: 0.15,      // 5% -> 15% (超高速)
            critMultiplier: 1.2    // 2.0 -> 1.2
        }
    },
    {
        id: 'lightning_needle',
        name: 'ライトニングニードル', // Lightning Needle
        type: 'normal',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_needle.png',
        cooldown: 0.3,
        behavior: 'projectile',
        description: '前方に極細の電気の針を飛ばす。弾速が非常に速い。',
        params: {
            damage: 5, // 5 damage per tick
            tickCount: 3, // 3 hits total
            tickInterval: 0.1, // 0.1s interval (0.5s duration)
            range: 600,
            speed: 1500, // 3x Speed
            width: 70, // Longer
            height: 6, // Sharp/Thin
            life: 0.17, // 1/3 Life (Same range)
            color: '#FFFFFF', // White
            shape: 'triangle', // Sharp needle shape
            fixedOrientation: true, // Follow movement direction
            // spriteSheet: 'assets/skills/vfx/lightning_part_01.png', // REMOVED: Use shape for needle
            crackle: true, // Asset Lightning Effect enabled
            crackleColor: '#FFFF00', // Yellow
            noTrail: true, // Disable orange trail
            onHitEffect: 'lightning_burst', // New param to trigger burst
            // Homing Parameters
            homing: true,
            homingRange: 200, // 5 tiles * 40px
            homingStrength: 0.15,
            damageColor: '#ffff00', // Yellow (Electric)
            statusEffect: 'shock',
            statusChance: 0.3,
            aetherCharge: 0.5, // Calculated: 5.0 / (3 hits / 0.3s)
            critChance: 0.25,      // 20% -> 25%
            critMultiplier: 1.3    // 2.0 -> 1.3
        },
    },
    {
        id: 'fireball',
        name: 'ファイアボール', // Fireball
        type: 'primary',
        element: 'fire',
        icon: 'assets/skills/icons/icon_fireball.png',
        cooldown: 3.0,
        behavior: 'projectile',
        description: '前方に火の玉を発射する。着弾時に爆発し、敵を大きく吹き飛ばす。',
        params: {
            knockback: 400,
            damage: 15,
            speed: 550,
            width: 64, // 32 * 2
            height: 32, // 16 * 2
            life: 2.0,
            color: '#ff8800',
            trailColor: 'rgba(255, 150, 0, 1)',
            trailShape: 'circle', // New param for circular trails
            damageColor: '#ff8800', // Orange (Fire)
            onHitEffect: 'explosion', // Grand Explosion Effect
            shakeIntensity: 0.8,
            noShake: true,
            spriteSheet: 'assets/skills/vfx/fireball_sheet.png',
            spriteData: 'assets/skills/vfx/fireball_sheet.json',
            frames: 4,
            frameRate: 0.05, // 0.1 / 2 (2x Speed)
            // Charge Params
            chargeable: true,
            chargeTime: 1.0,
            minDamage: 15, // Uncharged
            maxDamage: 30, // Fully Charged
            minSize: 48, // Uncharged (Small)
            maxSize: 128, // Fully Charged (Large) (64*2)
            maxSpeed: 700,
            statusEffect: 'burn',
            statusChance: 0.5,
            aetherCharge: 15.0, // Calculated: 15.0 / (1 hit / 3.0s) = 5.0/s
            critChance: 0.15,      // 30% -> 15% (チャージ)
            critMultiplier: 1.5    // 2.0 -> 1.5
        }
    },
    {
        id: 'thunder_burst',
        name: 'サンダーバースト', // Thunder Burst
        type: 'primary',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_thunder_burst.png',
        cooldown: 3.0,
        behavior: 'area_blast',
        description: '周囲に電撃を帯びた爆発を起こし、敵を弾き飛ばす。',
        params: {
            knockback: 500,
            damage: 7, // Increased damage (5 -> 7)
            range: 100, // +25% range (was 80)
            duration: 1.0, // Lasts 1 second
            interval: 0.1, // Damage every 0.1s (10 ticks total = 100 dmg)
            color: '#ffff00', // Yellow
            particleCount: 20,
            particleColor: '#ffff00', // Yellow sparks
            damageColor: '#ffff00', // Yellow (Electric)
            // Visual Animation
            spriteSheet: 'assets/skills/vfx/thunder_burst.png',
            spriteData: null, // No JSON for single image
            width: 200, // Match range * 2
            height: 200,
            frames: 1, // Single frame
            frameRate: 0.1, // Not used for single frame but good practice
            // scale: 1.0, // Force Fit to 160x160 instead
            randomRotation: true, // Rotate randomly each frame
            statusEffect: 'shock',
            statusChance: 0.3,
            aetherCharge: 0.75, // Halved since CD is halved (6.0 -> 3.0)
            critChance: 0.20,      // 10% -> 20%
            critMultiplier: 1.5    // 2.0 -> 1.5 (奥義)
        }
    },
    {
        id: 'bounce_spark',
        name: 'バウンスパーク', // Bounce Spark
        type: 'primary',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_bounce.png', // Placeholder
        cooldown: 2.5,
        behavior: 'bouncing_projectile',
        description: '壁に反射する電気の弾を前方に5発扇状に発射する。',
        params: {
            damage: 3, // Base damage per tick
            count: 5, // Projectile Count
            angleSpread: 15, // Degrees between projectiles
            tickCount: 5, // Total hits per projectile
            tickInterval: 0.1, // Time between hits
            speed: 400,
            width: 15, // 15px
            height: 15,
            life: 60.0, // Long life (effectively infinite)
            maxBounces: 3,
            color: '#ffff00',
            trailColor: 'rgba(255, 255, 0, 0.5)',
            damageColor: '#ffff00', // Yellow (Electric)
            // Lightning Burst Params
            burstCount: 8, // More segments
            burstSize: 80, // Larger area
            burstSpeed: 150, // Speed for diffusion
            statusEffect: 'shock',
            statusChance: 0.3,
            aetherCharge: 2.5, // Calculated: 2.5 / (1 hit / 2.5s) = 1.0/s
            critChance: 0.25,      // 15% -> 25%
            critMultiplier: 1.3    // 2.0 -> 1.3
        }
    },

    {
        id: 'ember_strike',
        name: 'エンバーストライク', // Ember Strike
        type: 'ultimate',
        element: 'fire',
        icon: 'assets/skills/icons/icon_ember_strike.png',
        cooldown: 13.0,
        behavior: 'barrage',
        description: '８つの火の玉を連射する奥義。',
        params: {
            waves: 10,
            perWave: 1,
            interval: 0.07,
            spacing: 20,
            angleSpread: 10,
            damage: 8,
            speed: 550,
            width: 32,
            height: 16,
            life: 2.0,
            shape: 'circle',
            color: '#ff8800',
            trailColor: 'rgba(255, 100, 0, 0.8)',
            damageColor: '#ff8800', // Orange (Fire)
            onHitEffect: 'explosion', // Grand Explosion Effect
            shakeIntensity: 0.3,
            noShake: true,
            spriteSheet: 'assets/skills/vfx/fireball_sheet.png',
            spriteData: 'assets/skills/vfx/fireball_sheet.json',
            frames: 4,
            frameRate: 0.1,
            statusEffect: 'burn',
            statusChance: 0.3,
            aetherCharge: 3.0, // Ultimate (Normal Mode Gain)
            critChance: 0.30,      // 15% -> 30%
            critMultiplier: 1.5    // 2.0 -> 1.5
        },
        aetherRushDesc: '連射数が10発→20発になる。'
    },

    {
        id: 'blood_scythe',
        name: 'ブラッドサイス', // Blood Scythe
        type: 'primary',
        element: 'blood',
        icon: 'assets/skills/icons/icon_blood_scythe.png', // Updated icon path
        cooldown: 2.0,
        behavior: 'blood_scythe',
        description: '血濡れた鎌を投げ、加速しながら前進し続ける。触れた敵に連続ダメージ。',
        params: {
            damage: 5, // Reduced base damage
            speed: 800, // High start speed
            acceleration: -1200, // Decelerate on way out
            returnSpeed: 1500, // Speed on return
            range: 800, // Max distance safety
            width: 96,
            height: 96,
            color: '#ff0000', // Red
            trailColor: 'rgba(255, 0, 0, 0.5)',
            rotationSpeed: -45, // Reversed and 3x Speed
            spriteSheet: 'assets/skills/vfx/blood_scythe.png',
            frames: 1,
            pierce: 999, // Infinite pierce
            tickInterval: 0.1, // Damage every 0.1s
            statusEffect: 'bleed',
            statusChance: 0.3, // 30% chance per tick
            damageColor: '#880000', // Dark Red (Blood)
            aetherCharge: 0.5, // Calculated: 5.0 / (5 ticks / 2.0s)
            critChance: 0.25,      // 12% -> 25%
            critMultiplier: 1.3    // 1.5 -> 1.3
        }
    },
    {
        id: 'ice_spike',
        name: 'アイススパイク', // Ice Spike
        type: 'primary',
        element: 'ice',
        icon: 'assets/skills/icons/icon_ice_spike.png', // Updated icon path
        // actually, let's use a placeholder or the sprite sheet as icon if logic allows, but usually icon is separate.
        // For now, null is fine or we can reuse `icon_ice.png` if it exists (from ice_signal).
        // icon: 'assets/icon_ice_spike.png', // Placeholder name
        cooldown: 3.5,
        behavior: 'ice_spike',
        description: '前方に氷の棘を突き上げる。5秒間持続し、上にいる敵にダメージを与え続ける。',
        params: {
            damage: 3, // Initial Hit
            duration: 5.0,
            tickInterval: 0.5,
            count: 30, // Increased count to 30
            spacing: 30, // Much wider spacing per user request
            width: 20, // 10 * 2
            height: 92, // 46 * 2
            spriteSheet: 'assets/skills/vfx/ice_spike.png',
            frames: 1,
            damageColor: '#00ffff', // Cyan (Ice)
            pierce: 999,
            aetherCharge: 1.25, // Calculated: 1.25 / (1 hit / 3.5s) = 0.35/s
            critChance: 0.20,      // 10% -> 20%
            critMultiplier: 1.3    // 1.5 -> 1.3
        }
    },
    {
        id: 'ice_garden',
        name: 'アイスガーデン', // Ice Garden
        type: 'ultimate',
        element: 'ice',
        icon: 'assets/skills/icons/icon_ice_garden.png', // Placeholder
        cooldown: 10.0,
        behavior: 'ice_garden',
        description: '範囲内の敵を減速させ、足元から氷の棘で攻撃するエリアを10秒間展開する。',
        params: {
            damage: 5, // Damage per spike
            duration: 10.0,
            radius: 150, // 200 * 0.75
            tickInterval: 0.5, // Spill interval
            tickInterval: 0.5, // Spill interval
            visualSpikeCount: 60, // Dense visual spikes
            damageColor: '#00ffff', // Cyan (Ice)
            aetherCharge: 0.5, // Ultimate (Normal Mode Gain)
            critChance: 0.25,      // 10% -> 25%
            critMultiplier: 1.5    // 2.0 -> 1.5
        },
        aetherRushDesc: '全敵対象に氷棘が展開され、範囲が拡大する。'
    },
    {
        id: 'tornado',
        name: 'トルネード', // Tornado
        type: 'primary',
        icon: 'assets/skills/icons/icon_wind.png', // Placeholder or use generic
        cooldown: 4.0,
        behavior: 'tornado',
        description: '前方に竜巻を発生させる。触れた敵を連続ヒットさせながら継続的にノックバックさせる。',
        params: {
            damage: 5, // Low damage per tick
            tickInterval: 0.2, // 5 hits per second
            speed: 800, // Very Fast
            width: 90,
            height: 90,
            life: 5.0, // Lasts 5 seconds
            knockback: 300, // Push speed
            color: '#88ccff',
            shape: 'tornado',
            damageColor: '#ffffff', // White (Wind) - User requested White for Wind
            aetherCharge: 0.8, // Calculated: 0.8 / (25 hits / 4.0s) = 0.2/s
            critChance: 0.20,      // 8% -> 20%
            critMultiplier: 1.2    // 2.0 -> 1.2 (連射)
        }
    },
    {
        id: 'chain_lightning',
        name: 'チェーンライトニング', // Chain Lightning
        type: 'primary',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_chain.png',
        cooldown: 2.5,
        behavior: 'chain_lightning',
        description: '敵から敵へと連鎖する雷撃を放つ。',
        params: {
            damage: 8,
            speed: 1000,
            width: 40,
            height: 8,
            life: 1.0,
            color: '#ffff00',
            trailColor: 'rgba(255, 255, 0, 0.5)',
            damageColor: '#ffff00', // Yellow
            chainCount: 4, // 4 Jumps (Initial launch parameter, logic uses per-enemy limit now)
            chainRange: 500,
            crackle: true,
            crackleColor: '#ffff00',
            statusEffect: 'shock',
            statusChance: 0.3,
            aetherCharge: 12.5, // Calculated: 12.5 / (1 hit / 2.5s) = 5.0/s
            critChance: 0.35,      // 25% -> 35%
            critMultiplier: 1.3    // 2.0 -> 1.3
        }
    },
    {
        id: 'thunderfall',
        name: 'サンダーフォール', // Thunderfall
        type: 'primary', // Active skill
        element: 'lightning',
        icon: 'assets/skills/icons/icon_thunder_fall.png', // Placeholder
        cooldown: 4.0,
        behavior: 'thunderfall_storm',
        description: '一定時間、周囲の敵に対してランダムに落雷を発生させる。',
        params: {
            damage: 8,
            count: 12, // User requested 12
            interval: 0.03, // Fast
            spacing: 25, // User requested 25
            zigzagWidth: 30, // Zigzag offset
            damageColor: '#ffff00', // Yellow
            statusEffect: 'shock',
            statusChance: 0.3,
            aetherCharge: 1.625, // Calculated: 1.625 / (12 hits / 4.0s) = 0.4/s
            critChance: 0.25,      // 15% -> 25%
            critMultiplier: 1.3    // 2.0 -> 1.3
        }
    },
    {
        id: 'thunder_god_wrath',
        name: 'サンダー・ラス', // Thunder Wrath
        type: 'ultimate',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_thunder_god.png', // Placeholder
        cooldown: 15.0,
        behavior: 'global_strike',
        description: '上下左右の4方向に、3連続の雷槌を落とす。',
        params: {
            damage: 20, // High single hit
            count: 3, // Waves per direction
            damageColor: '#ffff00', // Yellow
            statusEffect: 'shock',
            statusChance: 0.5, // Ultimate
            aetherCharge: 0, // Ultimate (No gain)
            critChance: 0.35,      // 30% -> 35%
            critMultiplier: 1.5    // 2.0 -> 1.5
        },
        aetherRushDesc: '上下左右に加え、斜め方向を含む8方向に雷槌を落とす。'
    },
    {
        id: 'glacial_lotus',
        name: 'グラシアル・ロータス', // Glacial Lotus
        type: 'ultimate',
        element: 'ice',
        icon: 'assets/skills/icons/icon_glacial_lotus.png',
        cooldown: 15.0,
        behavior: 'glacial_lotus',
        description: '周囲に巨大な氷の蓮を展開し、一斉に射出する奥義。',
        params: {
            damage: 15, // Reduced for balance with pierce/scatter
            petalCount: 16, // Number of petals
            bloomRadius: 45,
            bloomDuration: 0, // Time until burst
            burstSpeed: 900,
            burstLife: 1.2,
            width: 18,
            height: 45,
            spriteSheet: 'assets/skills/vfx/ice_spike.png',
            damageColor: '#00ffff', // Cyan (Ice)
            fixedOrientation: true,
            rotationOffset: Math.PI / 2,
            aetherCharge: 0, // Ultimate (No gain)
            critChance: 0.30,      // 25% -> 30%
            critMultiplier: 1.5    // 2.0 -> 1.5
        },
        aetherRushDesc: '花弁数が16→32枚に増加し、射出速度が加速する。'
    },
    {
        id: 'lunatic_snicker',
        name: 'ルナティックスニッカー', // Lunatic Snicker
        type: 'ultimate',
        element: 'blood',
        icon: 'assets/skills/icons/icon_blood_scythe.png', // Temporary, same as crimson_cross
        cooldown: 15.0,
        behavior: 'lunatic_snicker_strike',
        description: '画面内の全ての敵をターゲットし、狂気の如き深紅の十文字を刻み込む奥義。',
        params: {
            damage: 12,
            life: 0.3, // Slightly longer than normal for impact
            width: 140, // Larger than normal
            height: 140,
            shape: 'slash',
            color: '#800000', // Deep Dark Red
            trailColor: 'rgba(128, 0, 0, 0.5)',
            damageColor: '#cc0000', // Brighter Blood Red
            statusEffect: 'bleed',
            statusChance: 1.0, // Guaranteed bleed per hit
            pierce: 999,
            ignoreWallDestruction: true,
            aetherCharge: 0, // Ultimate (No gain)
            critChance: 0.30,      // 20% -> 30%
            critMultiplier: 1.5    // 2.0 -> 1.5
        },
        aetherRushDesc: '画面内の全敵を対象に発動し、ダメージが2倍になる。'
    },
    {
        id: 'phoenix_dive',
        name: 'フェニックス・ダイブ', // Phoenix Dive
        type: 'primary',
        element: 'fire',
        icon: 'assets/skills/icons/icon_phoenix_dive.png',
        cooldown: 4.0,
        behavior: 'phoenix_dive',
        description: '炎の鳥となって突撃し、進路上の敵を激しく弾き飛ばす。敵を倒すと即座に再使用可能。',
        params: {
            knockback: 1000,
            speed: 1200,
            duration: 0.4,
            damage: 25,
            aetherCharge: 1.0,
            puddleInterval: 0.01,
            puddleDamage: 5,
            puddleLife: 3.0,
            spriteSheet: 'assets/skills/vfx/phoenix_aura.png',
            spriteData: 'assets/skills/vfx/phoenix_aura.json',
            frames: 4
        }
    },
    {
        id: 'magma_spear',
        name: 'マグマスピア', // Magma Spear
        type: 'primary',
        element: 'fire',
        icon: 'assets/skills/icons/icon_magma_spear.png',
        cooldown: 3.0,
        behavior: 'magma_spear',
        description: '着弾時に大爆発を起こす槍を放ち、敵を力強くノックバックさせる。',
        params: {
            knockback: 800,
            damage: 20, // Increased direct damage since it no longer pierces/bounces
            speed: 900, // Slightly faster for impact feel
            life: 2.0,
            puddleDamage: 5,
            puddleLife: 4.0,
            puddleInterval: 0.2,
            slowMultiplier: 0.5,
            width: 128, // Visually bigger
            spriteSheet: 'assets/skills/vfx/magma_spear.png',
            color: '#ff4400',
            trailColor: '#ffbb00',
            aetherCharge: 1.5,
            puddleAetherCharge: 0.5,
            critChance: 0.15,
            critMultiplier: 2.0,
            statusEffect: 'burn',
            statusChance: 0.6
        }
    },
    {
        id: 'magma_core',
        name: 'マグマコア', // Magma Core
        type: 'ultimate',
        element: 'fire',
        icon: 'assets/skills/icons/icon_magma_core.png',
        cooldown: 10.0,
        behavior: 'magma_core',
        description: '自身の周囲を回転する２つのマグマの核を12秒間生成する。核が敵に触れるとその足元に激しい噴火を引き起こし、周囲を焼き尽くす。',
        params: {
            damage: 7,
            duration: 12.0,
            orbitRadius: 80,
            coreRadius: 18,
            rotationSpeed: 7.0,
            spriteSheet: 'assets/skills/vfx/magma_core.png',
            puddleDamage: 3,
            puddleLife: 3.0,
            damageColor: '#ff4400',
            aetherCharge: 0.5,
            puddleAetherCharge: 0.2,
            critChance: 0.1,
            critMultiplier: 2.0,
            statusEffect: 'burn',
            statusChance: 0.2
        },
        aetherRushDesc: '核の数が２つから４つに増加し、回転速度と範囲が強化される。'
    },
    {
        id: 'volt_drive',
        name: 'ボルト・ドライブ', // Volt Drive
        type: 'ultimate',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_volt_drive.png', // Placeholder
        cooldown: 20.0,
        behavior: 'volt_drive',
        description: '雷光と化して6秒間、戦場を疾駆する奥義。移動速度が大幅に上昇し、ダッシュで敵を貫き、周囲に自動で雷撃を放つ。',
        params: {
            duration: 6.0,
            speedMult: 1.5,
            autoLightningInterval: 0.6,
            damage: 8,
            dashDamage: 15,
            chainCount: 3,
            chainRange: 150,
            damageColor: '#ffff00',
            statusEffect: 'shock',
            statusChance: 0.5, // Ultimate
            aetherCharge: 0,
            critChance: 0.2,
            critMultiplier: 2.0
        },
        aetherRushDesc: '効果時間が12秒に延長され、自動雷撃の間隔が短縮、さらに回避の無敵時間が延長される。'
    },
    {
        id: 'starfall',
        name: 'スターフォール',
        type: 'ultimate',
        element: 'fire',
        icon: 'assets/skills/icons/icon_starfall.png',
        cooldown: 20.0,
        behavior: 'starfall_storm',
        description: '広範囲に巨大な隕石を大量に降らせる奥義。着弾地点で大爆発と噴火を引き起こす。',
        params: {
            damage: 10, // Significantly reduced due to high burst density
            duration: 1.0,
            rushDuration: 1.7,
            radius: 180,
            count: 10,
            rushCount: 17,
            perStrike: 3,
            starSpeed: 1000,
            starLife: 0.6,
            statusEffect: 'burn',
            statusChance: 0.8,
            spriteSheet: 'assets/skills/vfx/meteor_rock1.png', // Corrected path
            width: 48,
            height: 96,
            color: '#ff4400',
            trailColor: 'rgba(255, 68, 0, 0.6)',
            damageColor: '#ff8800',
            aetherCharge: 10.0,
            critChance: 0.2,
            critMultiplier: 1.5,
            puddleDamage: 4,
            puddleLife: 4.0,
            puddleAetherCharge: 1.0,
            shakeIntensity: 0.3
        },
        aetherRushDesc: '隕石の落下速度が上がり、着弾時の噴火数と持続時間が大幅に強化される。'
    },
    {
        id: 'fate_dealer',
        name: 'フェイト・ディール', // Fate Dealer
        type: 'primary',
        element: 'none',
        icon: 'assets/skills/icons/icon_fate_dealer.png', // Placeholder icon
        cooldown: 1.5,
        behavior: 'fate_dealer_behavior',
        description: '前方に5枚のトランプを投げ、柄に応じて状態異常（クローバー:毒、ハート:火炎、スペード:出血、ダイヤ:鈍足）を確率で付与する。',
        params: {
            damage: 5,
            speed: 700,
            count: 5,
            statusChance: 0.3,
            rushCount: 5,
            angleSpread: 30,
            life: 0.8,
            width: 16,
            height: 24,
            rotationOffset: Math.PI / 2,
            spriteSheet: 'assets/skills/vfx/card_projectile.png', // Placeholder sprite
            frames: 1,
            damageColor: '#ffffff',
            aetherCharge: 1.5,
            critChance: 0.2,
            critMultiplier: 1.5
        },
        aetherRushDesc: 'カード全てに貫通と爆発効果が付与される。さらに、命中のたびに全4種の状態異常を同時に付与する。'
    },
    {
        id: 'lightning_ray',
        name: 'ライトニングレイ', // Lightning Ray
        type: 'ultimate',
        element: 'lightning',
        icon: 'assets/skills/icons/icon_volt_drive.png', // Temporary, reuse or suggest new
        cooldown: 20.0,
        behavior: 'lightning_ray',
        description: '７秒のチャージの後、広範囲にわたる極太の電撃ビームを５秒間放ち続ける。フルチャージ時のみ発動可能。',
        params: {
            damage: 15,
            duration: 5.0,
            tickInterval: 0.1,
            range: 800,
            width: 120, // Thick beam
            color: '#ffff00',
            damageColor: '#ffff00',
            statusEffect: 'shock',
            statusChance: 0.5,
            chargeable: true,
            chargeTime: 7.0,
            onlyFullCharge: true,
            aetherCharge: 0,
            critChance: 0.3,
            critMultiplier: 2.0
        },
        aetherRushDesc: 'ビームの威力が２倍になり、攻撃範囲がさらに拡大する。'
    },
    {
        id: 'poison_lake',
        name: 'ポイズンレイク',
        type: 'normal',
        element: 'poison',
        icon: 'assets/skills/icons/icon_poison.png',
        cooldown: 0.1, // 連射式
        behavior: 'projectile',
        description: '前方に細い毒針を連射する。命中した敵に毒を付与するが、弾道に多少のばらつきがある。',
        params: {
            damage: 3, // ダメージを3に
            speed: 1200,
            width: 20,
            height: 6,
            life: 0.6,
            shape: 'triangle',
            fixedOrientation: true,
            angleSpread: 15, // 射撃精度の誤差
            color: '#32CD32',
            trailColor: 'rgba(50, 205, 50, 0.5)',
            damageColor: '#800080',
            statusEffect: 'poison',
            statusChance: 0.5,
            statusDuration: 5.0,
            aetherCharge: 1.5,
            critChance: 0.1,
            critMultiplier: 1.5
        }
    },
    {
        id: 'miasma_cloud',
        name: 'ミアズマ・クラウド',
        type: 'primary',
        element: 'poison',
        icon: 'assets/skills/icons/icon_poison.png',
        cooldown: 4.0,
        behavior: 'poison_cloud',
        description: '6秒間持続する毒ガスを生成し、範囲内の敵を毒状態にする。',
        params: {
            damage: 2,
            range: 120,
            duration: 6.0,
            interval: 0.5,
            damageColor: '#800080',
            aetherCharge: 2.0,
            statusEffect: 'poison'
        }
    },

    {
        id: 'pandemic',
        name: 'パンデミック',
        type: 'ultimate',
        element: 'poison',
        icon: 'assets/skills/icons/icon_poison.png',
        cooldown: 25.0,
        behavior: 'projectile',
        description: '伝染性の疫病を放つ。感染した敵が死亡すると、周囲の敵へ次々に感染が広がる。',
        params: {
            damage: 30,
            speed: 800,
            width: 40,
            height: 40,
            life: 2.0,
            color: '#BF40BF',
            trailColor: 'rgba(191, 64, 191, 0.6)',
            damageColor: '#BF40BF',
            statusEffect: 'pandemic',
            statusDuration: 10.0,
            pierce: 1,
            aetherCharge: 0,
            critChance: 0.2,
            critMultiplier: 1.5
        },
        aetherRushDesc: '感染範囲と拡散する胞子の数が増加し、さらに起爆効果が付与される。'
    }
];
