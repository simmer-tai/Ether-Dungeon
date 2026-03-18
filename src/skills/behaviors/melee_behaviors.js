
export const meleeBehaviors = {
    'arc_slash': (user, game, params) => {
        const hit = user.getHitBox(params.range, params.range * 1.2, params.range * 1.2);

        // Define sweep angles based on facing
        let startAngle = params.angleStart;
        let endAngle = params.angleEnd;

        // Hardcoded facing logic matches the robust implementation we had
        if (user.facing === 'right') { startAngle = -Math.PI / 3; endAngle = Math.PI / 3; }
        else if (user.facing === 'left') { startAngle = 4 * Math.PI / 3; endAngle = 2 * Math.PI / 3; }
        else if (user.facing === 'up') { startAngle = 7 * Math.PI / 6; endAngle = 11 * Math.PI / 6; }
        else if (user.facing === 'down') { startAngle = Math.PI / 6; endAngle = 5 * Math.PI / 6; }
        else if (user.facing === 'up-right') { startAngle = -7 * Math.PI / 12; endAngle = -Math.PI / 12; }
        else if (user.facing === 'up-left') { startAngle = 13 * Math.PI / 12; endAngle = 19 * Math.PI / 12; }
        else if (user.facing === 'down-right') { startAngle = Math.PI / 12; endAngle = 7 * Math.PI / 12; }
        else if (user.facing === 'down-left') { startAngle = 5 * Math.PI / 12; endAngle = 11 * Math.PI / 12; }

        // Randomly reverse the slash direction
        if (Math.random() < 0.5) {
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;
        }

        game.animations.push({
            type: 'slash',
            x: user.x + user.width / 2,
            y: user.y,
            radius: params.radius,
            startAngle: startAngle,
            endAngle: endAngle,
            life: params.duration,
            maxLife: params.duration,
            color: params.color
        });

        game.enemies.forEach(enemy => {
            if (hit.x < enemy.x + enemy.width && hit.x + hit.w > enemy.x &&
                hit.y < enemy.y + enemy.height && hit.y + hit.h > enemy.y) {
                const currentMult = user.getDamageMultiplier(enemy);
                const baseDamage = params.damage;
                const isCrit = params.critChance > 0 && Math.random() < params.critChance;
                const critMult = (params.critMultiplier || 1.5) + user.critDamageBonus;
                const finalDamage = isCrit ? (baseDamage * currentMult) * critMult : (baseDamage * currentMult);

                // Knockback
                let kx = 0, ky = 0;
                if (params.knockback) {
                    const dx = (enemy.x + enemy.width / 2) - (user.x + user.width / 2);
                    const dy = (enemy.y + enemy.height / 2) - (user.y + user.height / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    kx = (dx / dist) * params.knockback;
                    ky = (dy / dist) * params.knockback;
                }

                enemy.takeDamage(finalDamage, params.damageColor, params.aetherCharge, isCrit, kx, ky);

                // Apply Status
                if (params.statusEffect && (!params.statusChance || Math.random() < params.statusChance)) {
                    if (enemy.statusManager) {
                        enemy.statusManager.applyStatus(params.statusEffect, 5.0, params.damage);
                    }
                }
                const particleColor = isCrit ? '#FFD700' : 'red';
                game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, isCrit ? 10 : 5, particleColor);
            }
        });
    },

    'venom_strike': (user, game, params) => {
        const range = params.range || 60;
        const hit = user.getHitBox(range, range * 1.5, range * 1.5);
        
        // Slash visual (Purple)
        game.animations.push({
            type: 'slash',
            x: user.x + user.width / 2,
            y: user.y,
            radius: range,
            startAngle: -Math.PI/4,
            endAngle: Math.PI/4,
            life: 0.2,
            maxLife: 0.2,
            color: '#800080'
        });

        game.enemies.forEach(enemy => {
            if (hit.x < enemy.x + enemy.width && hit.x + hit.w > enemy.x &&
                hit.y < enemy.y + enemy.height && hit.y + hit.h > enemy.y) {
                
                const isCrit = params.critChance > 0 && Math.random() < params.critChance;
                const critMult = (params.critMultiplier || 1.8) + user.critDamageBonus;
                const finalDamage = isCrit ? params.damage * critMult : params.damage;

                enemy.takeDamage(finalDamage, '#800080', params.aetherCharge, isCrit);
                if (enemy.statusManager) {
                    enemy.statusManager.applyStatus('poison', 10.0, params.damage, 20); // Longer duration, higher max stacks
                }
                game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 8, '#BF40BF');
            }
        });
    },

    'spiral_out': (user, game, params) => {
        const center = { x: user.x + user.width / 2, y: user.y };
        const count = params.count || 8;
        const speed = params.speed || 200;
        const rotationSpeed = params.rotationSpeed || 5;

        for (let i = 0; i < count; i++) {
            const startAngle = (i / count) * Math.PI * 2;

            game.projectiles.push({
                x: center.x,
                y: center.y,
                baseX: center.x, // Store origin
                baseY: center.y,
                w: 10, h: 10,
                angle: startAngle,
                radius: 10, // Start slightly out
                life: params.duration,
                color: params.color,
                damage: params.damage,
                aetherCharge: params.aetherCharge,
                update: function (dt) {
                    this.life -= dt;

                    // Spiral logic
                    this.radius += speed * dt; // Expand radius
                    this.angle += rotationSpeed * dt; // Rotate

                    this.x = this.baseX + Math.cos(this.angle) * this.radius;
                    this.y = this.baseY + Math.sin(this.angle) * this.radius;

                    // Trail
                    if (Math.random() < 0.3) {
                        game.animations.push({
                            type: 'particle',
                            x: this.x, y: this.y,
                            w: 4, h: 4,
                            life: 0.3, maxLife: 0.3,
                            color: this.color,
                            vx: 0, vy: 0
                        });
                    }
                }
            });
        }
    }
};
