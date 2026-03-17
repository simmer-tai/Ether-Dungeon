import { Entity, getCachedImage } from '../utils.js';
import { showStageSettings } from '../ui.js';
import { skillsDB } from '../../data/skills_db.js';

export class SkillPedestal extends Entity {
    constructor(game, x, y) {
        super(game, x - 20, y - 20, 40, 40, '#adff2f', 1);
        this.showPrompt = false;
        // No specific asset yet, using a placeholder visual
    }

    update(dt) {
        // Static
    }

    draw(ctx, alpha = 1) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;
        const cx = interpX + this.width / 2;
        const cy = interpY + this.height / 2;

        // Draw a technological pedestal
        ctx.save();
        
        // Base
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(interpX, interpY + this.height);
        ctx.lineTo(interpX + this.width, interpY + this.height);
        ctx.lineTo(interpX + this.width - 5, interpY + 10);
        ctx.lineTo(interpX + 5, interpY + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing core
        const glow = 0.5 + Math.sin(Date.now() / 300) * 0.5;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + glow * 0.4})`;
        ctx.shadowBlur = 10 * glow;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(cx, interpY + 15, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getInteractPrompt() {
        return "[SPACE] スキル選択";
    }

    interact() {
        this.use();
    }

    use() {
        const allSkills = skillsDB; 
        showStageSettings(
            this.game,
            allSkills,
            (settings) => {
                this.game.showLoading();

                // Small delay to allow the loading screen to render
                setTimeout(() => {
                    // Determine if we are in the lobby (Floor 0) or starting from scratch
                    if (this.game.floor === 0) {
                        // Just update skills without re-init (teleport)
                        this.game.updateStartingSkills(settings.skills);
                    } else {
                        // Original behavior for non-lobby or explicit start
                        this.game.init(false, settings.difficulty, settings.skills, true);
                    }
                    
                    // Hide title screen just in case (though it should be hidden)
                    const titleScreen = document.getElementById('title-screen');
                    if (titleScreen) titleScreen.style.display = 'none';

                    this.game.hideLoading();
                }, 100);
            },
            () => {
                // Return to lobby (do nothing)
            }
        );
    }
}
