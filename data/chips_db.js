/**
 * Aether Chips Database
 * Categories:洞察 (Insight), 技巧 (Technique), 耐久 (Durability), 俊敏 (Agility)
 */
export const chipsDB = [
    {
        id: 'power_strike',
        name: '猛攻',
        category: '技巧',
        rarity: 'rare',
        description: 'スキルダメージ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.03, cost: 4 },
            { level: 2, value: 0.10, cost: 5 },
            { level: 3, value: 0.15, cost: 6 },
            { level: 4, value: 0.20, cost: 7 },
            { level: 5, value: 0.25, cost: 8 }
        ],
        effectType: 'damage_mult',
        icon: 'assets/ui/chips/icon_power_strike.png',
        nodeScaling: { min: 0.03, max: 0.30 }
    },
    {
        id: 'life_spark',
        name: '命の灯火',
        category: '耐久',
        rarity: 'common',
        description: '最大HP',
        baseCost: 3,
        ranks: [
            { level: 1, value: 5, cost: 3 },
            { level: 2, value: 10, cost: 4 },
            { level: 3, value: 15, cost: 5 },
            { level: 4, value: 20, cost: 6 },
            { level: 5, value: 50, cost: 7 }
        ],
        effectType: 'max_hp',
        icon: 'assets/ui/chips/icon_life_spark.png',
        nodeScaling: { min: 5, max: 50 }
    },
    {
        id: 'swift_step',
        name: '迅速',
        category: '俊敏',
        rarity: 'common',
        description: '移動速度',
        baseCost: 2,
        ranks: [
            { level: 1, value: 0.06, cost: 2 },
            { level: 2, value: 0.12, cost: 3 },
            { level: 3, value: 0.18, cost: 4 },
            { level: 4, value: 0.24, cost: 5 },
            { level: 5, value: 0.30, cost: 6 }
        ],
        effectType: 'speed_mult',
        icon: 'assets/ui/chips/icon_swift_step.png',
        nodeScaling: { min: 0.06, max: 0.30 }
    },
    {
        id: 'aether_boost',
        name: 'エーテル\n活性',
        category: '洞察',
        rarity: 'rare',
        description: 'エーテルチャージ増加率アップ',
        baseCost: 3,
        ranks: [
            { level: 1, value: 0.03, cost: 3 },
            { level: 2, value: 0.06, cost: 4 },
            { level: 3, value: 0.09, cost: 5 },
            { level: 4, value: 0.12, cost: 6 },
            { level: 5, value: 0.15, cost: 7 }
        ],
        effectType: 'aether_charge_mult',
        icon: 'assets/ui/chips/icon_aether_boost.png',
        nodeScaling: { min: 0.03, max: 0.20 }
    },
    {
        id: 'burning_heart',
        name: '燃える\n心臓',
        category: '技巧',
        rarity: 'rare',
        description: '火属性スキルダメージアップ',
        baseCost: 5,
        ranks: [
            { level: 1, value: 0.10, cost: 5 },
            { level: 2, value: 0.15, cost: 6 },
            { level: 3, value: 0.20, cost: 7 },
            { level: 4, value: 0.25, cost: 8 },
            { level: 5, value: 0.30, cost: 9 }
        ],
        effectType: 'fire_damage_mult',
        icon: 'assets/ui/chips/icon_burning_heart.png',
        nodeScaling: { min: 0.10, max: 0.50 }
    },
    {
        id: 'weakness_exposure',
        name: '弱点露出',
        category: '技巧',
        rarity: 'rare',
        description: 'クリティカル率が{value}アップ',
        baseCost: 3,
        ranks: [
            { level: 1, value: 0.10, cost: 3 },
            { level: 2, value: 0.25, cost: 4 },
            { level: 3, value: 0.50, cost: 5 },
            { level: 4, value: 0.75, cost: 6 },
            { level: 5, value: 1.00, cost: 7 }
        ],
        effectType: 'crit_rate_add',
        icon: 'assets/ui/chips/icon_weakness_exposure.png',
        nodeScaling: { min: 0.10, max: 1.00 }
    },
    {
        id: 'enrage',
        name: '逆上',
        category: '技巧',
        rarity: 'epic',
        description: '被ダメージ時、5秒間スキルダメージ',
        baseCost: 5,
        ranks: [
            { level: 1, value: 0.10, cost: 5 },
            { level: 2, value: 0.15, cost: 6 },
            { level: 3, value: 0.20, cost: 7 },
            { level: 4, value: 0.25, cost: 8 },
            { level: 5, value: 0.30, cost: 10 }
        ],
        effectType: 'on_hit_damage_buff',
        icon: 'assets/ui/chips/icon_enrage.png',
        nodeScaling: { min: 0.10, max: 0.50 },
        cooldownScaling: { min: 10, max: 10 }
    },
    {
        id: 'thunder_strike',
        name: '雷撃',
        category: '技巧',
        rarity: 'rare',
        description: '雷属性スキルダメージアップ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.05, cost: 4 },
            { level: 2, value: 0.15, cost: 5 },
            { level: 3, value: 0.25, cost: 6 },
            { level: 4, value: 0.35, cost: 7 },
            { level: 5, value: 0.50, cost: 8 }
        ],
        effectType: 'thunder_damage_mult',
        icon: 'assets/ui/chips/icon_thunder_strike.png',
        nodeScaling: { min: 0.05, max: 0.50 }
    },
    {
        id: 'frost_bite',
        name: '氷結',
        category: '技巧',
        rarity: 'rare',
        description: '氷属性スキルダメージアップ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.05, cost: 4 },
            { level: 2, value: 0.15, cost: 5 },
            { level: 3, value: 0.25, cost: 6 },
            { level: 4, value: 0.35, cost: 7 },
            { level: 5, value: 0.50, cost: 8 }
        ],
        effectType: 'ice_damage_mult',
        icon: 'assets/ui/chips/icon_frost_bite.png',
        nodeScaling: { min: 0.05, max: 0.50 }
    },
    {
        id: 'laceration',
        name: '裂傷',
        category: '技巧',
        rarity: 'rare',
        description: '血属性スキルダメージアップ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.05, cost: 4 },
            { level: 2, value: 0.15, cost: 5 },
            { level: 3, value: 0.25, cost: 6 },
            { level: 4, value: 0.35, cost: 7 },
            { level: 5, value: 0.50, cost: 8 }
        ],
        effectType: 'blood_damage_mult',
        icon: 'assets/ui/chips/icon_laceration.png',
        nodeScaling: { min: 0.05, max: 0.50 }
    },
    {
        id: 'berserker',
        name: '狂戦士',
        category: '技巧',
        rarity: 'epic',
        description: '被ダメージが{value2}増加するが、スキルダメージが{value}アップ',
        baseCost: 6,
        ranks: [
            { level: 1, value: 0.15, cost: 6 },
            { level: 2, value: 0.30, cost: 7 },
            { level: 3, value: 0.45, cost: 8 },
            { level: 4, value: 0.60, cost: 9 },
            { level: 5, value: 0.75, cost: 10 }
        ],
        effectType: 'berserker',
        icon: 'assets/ui/chips/icon_berserker.png',
        nodeScaling: { min: 0.15, max: 0.75 },
        takenDamageScaling: { min: 0.05, max: 0.30 }
    },
    {
        id: 'combat_mastery',
        name: '鍛錬',
        category: '技巧',
        rarity: 'epic',
        description: '敵を倒すごとに攻撃力が{value}アップ(最大100回)',
        baseCost: 5,
        ranks: [
            { level: 1, value: 0.0015, cost: 5 },
            { level: 2, value: 0.0020, cost: 6 },
            { level: 3, value: 0.0030, cost: 7 },
            { level: 4, value: 0.0040, cost: 8 },
            { level: 5, value: 0.0050, cost: 9 }
        ],
        effectType: 'training_kill_buff',
        icon: 'assets/ui/chips/icon_combat_mastery.png',
        nodeScaling: { min: 0.0015, max: 0.0050 }
    },
    {
        id: 'courage',
        name: '勇気',
        category: '技巧',
        rarity: 'rare',
        description: 'ボスに対してスキルダメージが{value}アップ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.20, cost: 4 },
            { level: 2, value: 0.40, cost: 5 },
            { level: 3, value: 0.60, cost: 6 },
            { level: 4, value: 0.80, cost: 7 },
            { level: 5, value: 1.00, cost: 8 }
        ],
        effectType: 'boss_damage_mult',
        icon: 'assets/ui/chips/icon_courage.png',
        nodeScaling: { min: 0.20, max: 1.00 }
    },
    {
        id: 'inertia',
        name: '慣性',
        category: '技巧',
        rarity: 'epic',
        description: 'プレイヤーの移動速度上昇1%につき、スキルダメージが{value}アップ',
        baseCost: 5,
        ranks: [
            { level: 1, value: 0.005, cost: 5 },
            { level: 2, value: 0.010, cost: 6 },
            { level: 3, value: 0.015, cost: 7 },
            { level: 4, value: 0.020, cost: 8 },
            { level: 5, value: 0.030, cost: 10 }
        ],
        effectType: 'inertia_scaling',
        icon: 'assets/ui/chips/icon_inertia.png',
        nodeScaling: { min: 0.005, max: 0.030 }
    },
    {
        id: 'ukemi',
        name: '受け身',
        category: '耐久',
        rarity: 'rare',
        description: '被ダメージ時、{value}の確率でダメージを半減する',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.10, cost: 4 },
            { level: 2, value: 0.20, cost: 5 },
            { level: 3, value: 0.30, cost: 6 },
            { level: 4, value: 0.40, cost: 7 },
            { level: 5, value: 0.50, cost: 8 }
        ],
        effectType: 'ukemi_chance',
        icon: 'assets/ui/chips/icon_ukemi.png',
        nodeScaling: { min: 0.10, max: 0.50 }
    },
    {
        id: 'precision',
        name: '会心',
        category: '技巧',
        rarity: 'rare',
        description: 'クリティカルダメージ倍率が{value}アップ',
        baseCost: 4,
        ranks: [
            { level: 1, value: 0.20, cost: 4 },
            { level: 2, value: 0.40, cost: 5 },
            { level: 3, value: 0.60, cost: 6 },
            { level: 4, value: 0.80, cost: 7 },
            { level: 5, value: 1.00, cost: 8 }
        ],
        effectType: 'crit_damage_add',
        icon: 'assets/ui/chips/icon_precision.png',
        nodeScaling: { min: 0.20, max: 1.00 }
    },
    {
        id: 'acceleration',
        name: '加速',
        category: '俊敏',
        rarity: 'rare',
        description: '移動を続けている間、移動速度がアップ(上昇量最大: {value})',
        baseCost: 3,
        ranks: [
            { level: 1, value: 0.10, cost: 3 },
            { level: 2, value: 0.20, cost: 4 },
            { level: 3, value: 0.30, cost: 5 },
            { level: 4, value: 0.40, cost: 6 },
            { level: 5, value: 0.50, cost: 7 }
        ],
        effectType: 'acceleration_scaling',
        icon: 'assets/ui/chips/icon_acceleration.png',
        nodeScaling: { min: 0.10, max: 0.50 }
    },
    {
        id: 'gambler_dice',
        name: '一発逆転',
        category: '技巧',
        rarity: 'unique',
        description: '与えるダメージが大幅に変動するようになる(変動幅: ±{value})',
        baseCost: 8,
        ranks: [
            { level: 1, value: 0.20, cost: 8 },
            { level: 2, value: 0.40, cost: 9 },
            { level: 3, value: 0.60, cost: 10 },
            { level: 4, value: 0.80, cost: 11 },
            { level: 5, value: 1.00, cost: 12 }
        ],
        effectType: 'damage_random_range',
        icon: 'assets/ui/chips/icon_gambler_dice.png',
        nodeScaling: { min: 0.20, max: 1.00 }
    },
    {
        id: 'storage',
        name: 'ストレージ',
        category: '特殊',
        rarity: 'special',
        isSpecial: true,
        description: 'エーテル回路の最大容量を +5 する。<br>合成・改造不可',
        baseCost: 0,
        ranks: [{ level: 1, value: 5, cost: 0 }],
        effectType: 'capacity_add',
        icon: 'assets/ui/chips/icon_storage.png',
        nodeScaling: { min: 5, max: 5 }
    },
    {
        id: 'connector',
        name: 'コネクター',
        category: '特殊',
        rarity: 'special',
        isSpecial: true,
        description: '任意のノード数と接続可能な「ユニバーサルノード」を持つ。<br>合成・改造不可',
        baseCost: 0,
        ranks: [{ level: 1, value: 0, cost: 0 }],
        effectType: 'none',
        icon: 'assets/ui/chips/icon_connector.png',
        nodeScaling: { min: 0, max: 0 }
    },
    {
        id: 'virulence',
        name: '猛毒',
        category: '技巧',
        rarity: 'rare',
        description: '毒属性スキルダメージアップ',
        baseCost: 4,
        ranks: [{ level: 1, value: 0.05, cost: 4 }, { level: 2, value: 0.15, cost: 5 },
                { level: 3, value: 0.25, cost: 6 }, { level: 4, value: 0.35, cost: 7 },
                { level: 5, value: 0.50, cost: 8 }],
        effectType: 'poison_damage_mult',
        icon: 'assets/ui/chips/icon_virulence.png',
        nodeScaling: { min: 0.05, max: 0.50 }
    }
];
