import { SkillType } from '../skills/index.js';
import { getCachedImage } from '../utils.js';

export class InventoryUI {
    static game = null;
    static selectedSkill = null;
    static selectedSlot = null; // The HUD slot we are currently assigning to (e.g. 'primary1')
    static currentFilter = 'all';

    static init(gameInstance) {
        this.game = gameInstance;
        this.cacheDOM();
        this.bindEvents();
    }

    static cacheDOM() {
        this.modal = document.getElementById('inventory-modal');

        // Focus Area
        this.focusName = document.getElementById('inventory-selected-name');
        this.focusType = document.getElementById('inventory-selected-type');
        this.focusDesc = document.getElementById('inventory-selected-desc');
        this.statContainer = document.getElementById('inventory-selected-stats');

        // Stats
        this.statCooldown = document.getElementById('stat-cooldown');
        this.statCritRate = document.getElementById('stat-crit-rate');
        this.statCritMult = document.getElementById('stat-crit-mult');
        this.statStatusRate = document.getElementById('stat-status-rate');

        // Actions
        this.btnClose = document.getElementById('btn-inventory-close');

        // Backpack
        this.backpackGrid = document.getElementById('inventory-backpack-grid');
        this.filters = document.querySelectorAll('.filter-btn');
    }

    static bindEvents() {
        if (!this.modal) return;
        // Guard: only bind once to avoid accumulating duplicate listeners on init() re-calls
        if (this._bound) return;
        this._bound = true;

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.close());
        }

        this.filters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filters.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                // Also update selectedSlot so clicking an item equips to the selected tab's slot
                // (Since tabs now 1:1 map to slot keys: normal, primary1, primary2, secondary, ultimate)
                this.selectedSlot = this.currentFilter;
                this.renderBackpack();
            });
        });
    }

    static openForSlot(slotKey) {
        if (!this.modal || !this.game?.player) return;
        this.game.isPaused = true;
        this.selectedSkill = null;
        this.selectedSlot = slotKey;

        // Auto-set the filter based on the slot to guide the user
        this.currentFilter = slotKey; // Map exact key like 'primary1'

        // Update Filter Buttons UI
        if (this.filters) {
            this.filters.forEach(f => {
                f.classList.remove('active');
                if (f.dataset.filter === this.currentFilter) {
                    f.classList.add('active');
                } else if (!Array.from(this.filters).find(b => b.dataset.filter === this.currentFilter)) {
                    // Fallback to 'normal' if the exact slot key doesn't have a button (though it should)
                    if (f.dataset.filter === 'normal') f.classList.add('active');
                }
            });
        }

        this.render();
        this.updateFocusArea();

        this.modal.style.display = 'flex';
        this.modal.style.animation = 'fadeInModal 0.2s forwards';
    }

    static open() {
        if (!this.modal || !this.game?.player) return;
        this.game.isPaused = true;
        this.selectedSkill = null;
        this.currentFilter = 'normal'; // Default to normal now that 'all' is gone
        this.selectedSlot = this.currentFilter; // Match the default tab
        if (this.filters) {
            this.filters.forEach(f => f.classList.remove('active'));
            const defaultFilter = Array.from(this.filters).find(f => f.dataset.filter === 'normal');
            if (defaultFilter) defaultFilter.classList.add('active');
        }
        this.render();
        this.updateFocusArea();

        this.modal.style.display = 'flex';
        this.modal.style.animation = 'fadeInModal 0.2s forwards';
    }

    static close() {
        if (!this.modal) return;
        this.modal.style.animation = 'fadeOutModal 0.2s forwards';
        setTimeout(() => {
            this.modal.style.display = 'none';
            this.modal.style.animation = '';
            if (this.game) this.game.isPaused = false;
        }, 200);
    }

    static render() {
        this.renderBackpack();
    }

    static renderBackpack() {
        if (!this.game?.player) return;
        this.backpackGrid.innerHTML = '';

        const inventory = this.game.player.inventory || [];

        // Find equipped skills to mark them
        const eqSkills = Object.values(this.game.player.equippedSkills).filter(s => s !== null);
        const eqIds = eqSkills.map(s => s.id);

        inventory.forEach(skill => {
            if (!skill) return; // Skip null skills if any

            // Apply filter based on currentFilter (which can be a slotKey or a skill type)
            if (this.currentFilter === 'primary1' || this.currentFilter === 'primary2') {
                if (skill.type !== SkillType.PRIMARY) return;
            } else if (this.currentFilter === 'secondary') {
                if (skill.type !== SkillType.SECONDARY) return;
            } else if (this.currentFilter === 'ultimate') {
                if (skill.type !== SkillType.ULTIMATE) return;
            } else if (this.currentFilter === 'normal') {
                if (skill.type !== SkillType.NORMAL) return;
            }

            const item = document.createElement('div');
            item.className = 'inv-backpack-item';

            if (eqIds.includes(skill.id)) {
                item.classList.add('equipped');
            }

            if (this.selectedSkill && this.selectedSkill.id === skill.id) {
                item.classList.add('selected');
            }

            if (skill.icon) {
                const img = document.createElement('img');
                img.src = skill.icon;
                item.appendChild(img);
            } else {
                item.textContent = skill.name.charAt(0);
            }

            item.addEventListener('mouseenter', () => {
                this.selectedSkill = skill;
                this.updateFocusArea();
            });

            item.addEventListener('click', () => {
                const isEquippedIn = Object.keys(this.game.player.equippedSkills).find(
                    slot => this.game.player.equippedSkills[slot] && this.game.player.equippedSkills[slot].id === skill.id
                );

                if (isEquippedIn) {
                    // Toggle Off
                    this.game.player.unequipSkill(isEquippedIn);
                } else {
                    // Toggle On
                    let targetSlot = this.selectedSlot || skill.type;
                    
                    // Logic to ensure correct slot for PRIMARY
                    if (skill.type === SkillType.PRIMARY) {
                        if (!targetSlot || !targetSlot.startsWith('primary')) {
                           targetSlot = !this.game.player.equippedSkills['primary1'] ? 'primary1' : 'primary2';
                        }
                    } else {
                        targetSlot = skill.type;
                    }
                    
                    this.game.player.equipSkill(skill, targetSlot);
                }
                
                this.renderBackpack();
                this.updateFocusArea();
            });

            this.backpackGrid.appendChild(item);
        });
    }

    static updateFocusArea() {
        if (!this.selectedSkill) {
            this.focusName.textContent = 'スキルを選択してください';
            this.focusName.style.color = '#aaa';
            this.focusType.textContent = '-';
            this.focusDesc.textContent = '';

            // Stats Hide
            if (this.statContainer) this.statContainer.style.display = 'none';
            return;
        }

        // Stats Show
        if (this.statContainer) this.statContainer.style.display = 'flex';
        this.focusName.textContent = this.selectedSkill.name;
        this.focusName.style.color = '#ffd700';

        const typeMap = {
            normal: '通常スキル',
            primary: 'メインスキル',
            secondary: 'サブスキル',
            ultimate: 'アルティメット'
        };
        this.focusType.textContent = typeMap[this.selectedSkill.type] || this.selectedSkill.type;
        this.focusDesc.textContent = this.selectedSkill.description || '説明がありません。';

        // Update Stats
        const p = this.selectedSkill.params || {};
        this.statCooldown.textContent = `${this.selectedSkill.cooldown.toFixed(2)}s`;

        const critRate = p.critChance !== undefined ? Math.round(p.critChance * 100) : 0;
        this.statCritRate.textContent = `${critRate}%`;

        const critMult = p.critMultiplier !== undefined ? p.critMultiplier.toFixed(1) : '1.0';
        this.statCritMult.textContent = `x${critMult}`;

        const statusRate = p.statusChance !== undefined ? Math.round(p.statusChance * 100) : 0;
        this.statStatusRate.textContent = `${statusRate}%`;
    }
}
