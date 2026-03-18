import { LabUI } from './LabUI.js';

export class DungeonCircuitUI {
    static buildSubTab = 'circuit';
    static init(game) {
        this.game = game;
        
        const closeBtn = document.getElementById('btn-close-dungeon-circuit');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }
    }

    static open() {
        const modal = document.getElementById('dungeon-circuit-modal');
        if (modal) {
            modal.style.display = 'flex';
            if (this.game) {
                this.game.isHUDVisible = false; // hide gameplay HUD
            }
            this.render();
        }
    }

    static close() {
        const modal = document.getElementById('dungeon-circuit-modal');
        if (modal) {
            modal.style.display = 'none';
            if (this.game) {
                this.game.isHUDVisible = true;
            }
            // Hide tooltip if left open
            LabUI.hideTooltip();
        }
    }

    static render() {
        if (!this.game || !this.game.player) return;

        // Update Resonance Points
        const resElement = document.getElementById('dungeon-circuit-resonance');
        if (resElement) {
            resElement.textContent = this.game.player.aetherResonance;
        }

        const gridContainer = document.getElementById('dungeon-circuit-grid');
        if (!gridContainer) return;

        // Sub-tabs Header (Step 3-1)
        let header = document.getElementById('dungeon-circuit-tabs');
        if (!header) {
            header = document.createElement('div');
            header.id = 'dungeon-circuit-tabs';
            header.className = 'build-subtabs';
            header.style.display = 'flex';
            header.style.gap = '10px';
            header.style.justifyContent = 'center';
            header.style.padding = '8px';
            header.style.borderTop = '1px solid rgba(0, 255, 255, 0.2)';
            header.style.marginTop = '10px';
            
            // Insert below gridContainer
            gridContainer.parentNode.insertBefore(header, gridContainer.nextSibling);
        }

        header.innerHTML = '';
        const tabs = [
            { id: 'circuit', label: '回路' },
            { id: 'synergy', label: 'シナジー' }
        ];

        tabs.forEach(tab => {
            const btn = document.createElement('div');
            btn.className = `subtab-btn ${this.buildSubTab === tab.id ? 'active' : ''}`;
            btn.textContent = tab.label;
            btn.style.fontSize = '11px';
            btn.style.cursor = 'pointer';
            btn.style.color = this.buildSubTab === tab.id ? '#00ffff' : '#888';
            btn.style.padding = '4px 12px';
            btn.style.borderBottom = this.buildSubTab === tab.id ? '2px solid #00ffff' : 'none';
            btn.onclick = () => {
                this.buildSubTab = tab.id;
                this.render();
            };
            header.appendChild(btn);
        });

        gridContainer.innerHTML = '';
        const circuit = this.game.player.circuit;

        // Synergy View (Step 3-2)
        if (this.buildSubTab === 'synergy') {
            LabUI.renderSynergyView(gridContainer);
            return;
        }

        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const item = circuit.grid[y][x];
                
                if (item === 'core') {
                    const core = document.createElement('div');
                    core.className = 'grid-cell core-cell';
                    core.innerHTML = `<div>CORE</div>`;
                    gridContainer.appendChild(core);
                } else if (item) {
                    // Render Chip
                    const temp = document.createElement('div');
                    temp.innerHTML = LabUI.renderChip(item, true, false).trim();
                    const cell = temp.firstChild;
                    
                    // Add deployable visual indicator if applicable
                    const canDeploy = circuit.canDeployChip(x, y);
                    if (!item.isDeployed && canDeploy) {
                        cell.classList.add('deployable');
                    }

                    // Tooltip
                    cell.onmouseenter = (e) => {
                        const rect = cell.getBoundingClientRect();
                        let deployText = '';
                        if (!item.isDeployed) {
                            let trueCost = item.isSpecial ? 30 : item.getConnectedNodeCount() * 10;
                            if (canDeploy) {
                               deployText = `<br><span style="color:#00ffff; font-size:10px;">ダブルクリックで再構築 (コスト: ${trueCost}共鳴点)</span>`;
                            } else {
                               deployText = `<br><span style="color:#ff4444; font-size:10px;">※起動条件を満たしていません (要コア接続)</span>`;
                            }
                        }
                        LabUI.showTooltip(item, rect.left + rect.width / 2, rect.top, null, null, deployText);
                    };
                    cell.onmouseleave = () => LabUI.hideTooltip();

                    // Double click to deploy
                    cell.ondblclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!item.isDeployed && circuit.canDeployChip(x, y)) {
                            if (circuit.deployChip(x, y)) {
                                 this.render(); // Re-render this specific modal
                            }
                        }
                    };

                    gridContainer.appendChild(cell);
                } else {
                    // Empty Cell
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    gridContainer.appendChild(cell);
                }
            }
        }
    }
}
