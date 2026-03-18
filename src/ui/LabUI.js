import { AetherLabManager } from '../AetherLabManager.js';
import { getFormattedEffect } from '../ui.js';
import { SaveManager } from '../SaveManager.js';
import { skillsDB } from '../../data/skills_db.js';
import { statusIcons } from '../status_effects.js';

export class LabUI {
    static init(game) {
        this.game = game;
        this.currentTab = 'build';
        this.selectedChip = null;
        this.selectedGridCell = null; // {x, y}
        this.selectedSynthesisTarget = null;
        this.selectedSynthesisMaterials = [];
        this.buildSubTab = 'circuit';

        const modal = document.getElementById('lab-modal');
        const closeBtn = document.getElementById('btn-close-lab');
        const executeBtn = document.getElementById('btn-lab-execute');

        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        if (executeBtn) {
            executeBtn.onclick = () => this.executeAction();
        }


        const tabBtns = modal.querySelectorAll('.stage-tab-btn');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab === 'upgrade' ? 'modify' : btn.dataset.tab;
                this.selectedChip = null;
                this.selectedSynthesisTarget = null;
                this.selectedSynthesisMaterials = [];
                this.render();
            };
        });

        this.createGlobalTooltip();
    }

    static createGlobalTooltip() {
        if (document.getElementById('lab-global-tooltip')) return;
        const tt = document.createElement('div');
        tt.id = 'lab-global-tooltip';
        tt.className = 'chip-tooltip'; // Use existing base styles
        tt.style.position = 'fixed';
        tt.style.display = 'none';
        tt.style.zIndex = '50000'; // Higher than modal
        tt.style.pointerEvents = 'none';
        tt.style.opacity = '1';
        tt.style.transition = 'none';
        tt.style.whiteSpace = 'normal';
        tt.style.maxWidth = '200px';
        document.body.appendChild(tt);
        this.globalTooltip = tt;

        // Hide tooltip on resize to prevent it from floating out of place
        window.addEventListener('resize', () => this.hideTooltip());
    }

    static showTooltip(chip, x, y, rawTitle = null, rawDesc = null, deployText = '') {
        if (!this.globalTooltip) return;

        const title = rawTitle || (chip ? chip.data.name : '');
        const desc = rawDesc || (chip ? this.formatDescription(chip) : '');

        this.globalTooltip.innerHTML = `
            <div class="tooltip-title">${title}</div>
            <div class="tooltip-desc">${desc}${deployText}</div>
            <div class="tooltip-note" style="font-size: 8px; color: #888; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 2px;">
                ※最大値はそのチップの全ノードを接続した時の効果量です
            </div>
        `;
        this.globalTooltip.style.display = 'block';
        const zoom = (window._gameInstance && window._gameInstance.zoom) ? window._gameInstance.zoom : 1.0;

        // Position it centered above the point
        this.globalTooltip.style.left = `${x}px`;
        this.globalTooltip.style.top = `${y - 12 * zoom}px`;
        this.globalTooltip.style.transform = `translate(-50%, -100%) scale(${zoom})`;
    }

    static hideTooltip() {
        if (this.globalTooltip) {
            this.globalTooltip.style.display = 'none';
        }
    }


    static open() {
        const modal = document.getElementById('lab-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.toggleTitleUI(false);
            if (this.game) {
                this.game.isHUDVisible = false; // hide gameplay HUD when circuit opens mid-run
            }
            this.currentTab = 'build'; // Default
            this.selectedChip = null;
            
            // Hide specific tabs if we are in the dungeon
            const tabBtns = modal.querySelectorAll('.stage-tab-btn');
            tabBtns.forEach(btn => {
                if (this.game.currentFloor > 0 && btn.dataset.tab !== 'build') {
                    btn.style.display = 'none';
                } else {
                    btn.style.display = '';
                }
            });

            this.render();
        }
    }

    static toggleTitleUI(show) {
        const menu = document.querySelector('.title-menu');
        const header = document.querySelector('.title-header');
        const sideMenu = document.querySelector('.title-side-menu');

        const isTitle = (window.gameInstance && window.gameInstance.gameState === 'TITLE');

        if (menu) menu.style.display = show ? 'flex' : 'none';
        if (header) header.style.display = show ? 'flex' : 'none';
        
        // Only show side menu if we are actually on the title screen
        if (sideMenu) {
            sideMenu.style.display = (show && isTitle) ? 'flex' : 'none';
        }
    }

    static close() {
        const modal = document.getElementById('lab-modal');
        if (modal) {
            modal.style.display = 'none';
            this.toggleTitleUI(true);
            if (this.game) {
                this.game.isHUDVisible = true;
            }
        }
    }

    static formatDescription(chip) {
        const getDisplay = (prop) => {
            const current = getFormattedEffect(chip, prop);
            const potentialValue = chip.getPotentialValue(prop);
            const activeValue = chip.getScaledValue(prop);

            if (activeValue !== potentialValue) {
                const potential = getFormattedEffect(chip, prop, potentialValue);
                return `${current} <span style="font-size: 0.8em; color: #888;">(最大:${potential})</span>`;
            }
            return current;
        };

        let desc = chip.data.description;
        if (desc.includes('{value}')) {
            desc = desc.replace('{value}', getDisplay('nodeScaling'));
        }
        if (desc.includes('{value2}')) {
            desc = desc.replace('{value2}', getDisplay('takenDamageScaling'));
        }

        if (!chip.isSpecial && !chip.data.description.includes('{value}') && !chip.data.description.includes('{value2}')) {
            desc += getDisplay('nodeScaling');
        }
        return desc;
    }

    static renderChip(chip, isEquipped = false, isSelected = false) {
        let activeNodes = chip.activeNodes;

        // If not equipped but we have a grid cell selected, show "virtual" connectivity
        if (!isEquipped && this.selectedGridCell) {
            activeNodes = this.getVirtualActiveNodes(chip, this.selectedGridCell.x, this.selectedGridCell.y);
        }

        const isAnyNodeActive = activeNodes && Object.values(activeNodes).some(v => v > 0);

        let classes = `grid-cell chip-item rarity-${chip.getRarity()}`;
        if (isEquipped) {
            if (this.game.currentFloor === 0) {
                // In Lobby, everything equipped is visually active
                classes += chip.isActive ? ' active' : ' inactive';
            } else {
                // In Dungeon, respect the deployed state
                classes += chip.isDeployed ? ' active' : ' inactive undeployed';
            }
        } else if (isAnyNodeActive) {
            // Inventory chip that would be active if placed
            classes += ' active virtual-active';
        }

        if (isSelected) {
            classes += isEquipped ? ' selected-chip' : ' selected';
        }

        // Add visual indicator for deployable chips during a run
        if (isEquipped && this.game.currentFloor > 0 && !chip.isDeployed && typeof chip.gridX === 'number' && typeof chip.gridY === 'number' && this.game.player.circuit.canDeployChip(chip.gridX, chip.gridY)) { 
             // We can just rely on the parent container or add a visual pulse in renderBuildTab
        }

        return `
            <div class="${classes}" draggable="true">
                <img src="${chip.data.icon}" class="chip-icon ${isEquipped ? 'mini' : ''}" onerror="this.style.display='none'">
                ${this.renderNodeIndicators(chip, activeNodes)}
            </div>
        `;
    }

    static render() {
        this.updateMaterialDisplay();
        this.renderTabContent();
        this.renderFocusArea();
    }

    static updateMaterialDisplay() {
        const shardEl = document.getElementById('lab-shard-value');
        const fragmentEl = document.getElementById('lab-fragment-value');
        
        // Let's ensure aetherResonance is also displayed if we are in a run
        let resonanceText = '';
        if (this.game.currentFloor > 0) {
            resonanceText = `<span style="color:#00ffff; margin-right:15px;" title="エーテル共鳴点 (ダンジョン内専用)">共鳴: ${this.game.player.aetherResonance}</span>`;
        }

        if (shardEl) shardEl.innerHTML = `${resonanceText}${this.game.player.aetherShards}`;
        if (fragmentEl) fragmentEl.textContent = this.game.player.aetherFragments;
    }

    static renderTabContent() {
        const container = document.getElementById('lab-tab-content');
        if (!container) return;
        container.innerHTML = '';
        // Reset overflow for non-build tabs
        container.style.overflowY = 'auto';

        if (this.currentTab === 'build') {
            this.renderBuildTab(container);
            return;
        }

        if (this.currentTab === 'research') {
            this.renderResearchTab(container);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'lab-item-grid';
        grid.style.display = 'grid'; // Ensure grid is used for these categories
        grid.style.gridTemplateColumns = 'repeat(8, 46px)';
        grid.style.gridAutoRows = '46px';
        grid.style.gap = '12px';
        grid.style.padding = '10px';
        grid.style.justifyContent = 'center';
        grid.style.overflowY = 'auto'; // Let the grid itself scroll

        let chips = [];
        const circuit = this.game.player.circuit;

        if (this.currentTab === 'modify' || this.currentTab === 'dismantle') {
            chips = circuit.ownedChips.filter(chip => {
                if (!chip.isIdentified) return false;
                // Filter out chips equipped on the grid
                for (let gy = 0; gy < 5; gy++) {
                    if (circuit.grid[gy].includes(chip)) return false;
                }
                return true;
            });
        } else if (this.currentTab === 'synthesis') {
            this.renderSynthesisOptions(grid);
            container.appendChild(grid);
            return;
        }

        if (chips.length === 0) {
            container.innerHTML = `<div class="detail-placeholder">対象のチップがありません</div>`;
            return;
        }

        // Render slots (at least 24 slots, multiple of 8)
        const slotCount = Math.max(24, Math.ceil(chips.length / 8) * 8);
        for (let i = 0; i < slotCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            const chip = chips[i];
            if (chip) {
                const html = this.renderChip(chip, false, this.selectedChip === chip);
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const card = temp.firstChild;

                card.onmouseenter = (e) => {
                    const rect = card.getBoundingClientRect();
                    this.showTooltip(chip, rect.left + rect.width / 2, rect.top);
                };
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = (e) => {
                    e.stopPropagation();
                    this.selectedChip = chip;
                    this.render();
                };

                cell.appendChild(card);
            }

            grid.appendChild(cell);
        }

        container.appendChild(grid);
    }

    static getVirtualActiveNodes(chip, x, y) {
        const circuit = this.game.player.circuit;
        const virtualActive = { up: 0, down: 0, left: 0, right: 0 };

        const neighbors = [
            { nx: x, ny: y - 1, dir: 'up', opp: 'down' },
            { nx: x, ny: y + 1, dir: 'down', opp: 'up' },
            { nx: x - 1, ny: y, dir: 'left', opp: 'right' },
            { nx: x + 1, ny: y, dir: 'right', opp: 'left' }
        ];

        for (const { nx, ny, dir, opp } of neighbors) {
            if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
            const neighbor = circuit.grid[ny][nx];
            if (!neighbor) continue;

            if (neighbor === 'core') {
                if (chip.nodes[dir] > 0) virtualActive[dir] = chip.nodes[dir];
            } else if (neighbor.isActive) {
                // neighbor's side facing the center is `opp`, chip's side facing the neighbor is `dir`
                if (neighbor.nodes[opp] > 0 && neighbor.nodes[opp] === chip.nodes[dir]) {
                    virtualActive[dir] = chip.nodes[dir];
                }
            }
        }
        return virtualActive;
    }

    static getChipConnectivityScore(chip, x, y) {
        const circuit = this.game.player.circuit;
        let score = 0;

        const neighbors = [
            { nx: x, ny: y - 1, dir: 'up', opp: 'down' },
            { nx: x, ny: y + 1, dir: 'down', opp: 'up' },
            { nx: x - 1, ny: y, dir: 'left', opp: 'right' },
            { nx: x + 1, ny: y, dir: 'right', opp: 'left' }
        ];

        for (const { nx, ny, dir, opp } of neighbors) {
            if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
            const neighbor = circuit.grid[ny][nx];
            if (!neighbor) continue;

            if (neighbor === 'core') {
                // If adjacent to core, chip needs AT LEAST 1 node facing the core (`dir`) to connect
                if (chip.nodes[dir] > 0) score += 10;
            } else {
                // If adjacent to another chip, node counts must match EXACTLY (and be > 0)
                // neighbor's node facing the center is `opp`, chip's node facing the neighbor is `dir`
                if (neighbor.nodes[opp] > 0 && neighbor.nodes[opp] === chip.nodes[dir]) {
                    score += 5;
                    // If the neighbor is already active, this is even better
                    if (neighbor.isActive) score += 5;
                }
            }
        }

        return score;
    }

    static renderBuildTab(container) {
        // Prevent vertical scrolling while allowing horizontal overflow for glows
        container.style.overflowY = 'hidden';
        container.style.overflowX = 'visible';

        const circuit = this.game.player.circuit;

        // Capacity Gauge
        const percent = Math.min((circuit.usedCapacity / circuit.maxCapacity) * 100, 100);
        const header = document.createElement('div');
        header.className = 'circuit-header';
        header.innerHTML = `
            <div class="capacity-gauge-container">
                <span style="font-size: 9px; font-weight: bold; color: #fff;">容量出力: ${circuit.usedCapacity} / ${circuit.maxCapacity}</span>
                <div class="capacity-bar-track" style="height: 6px; background: #222; border-radius: 3px; overflow: hidden;">
                    <div class="capacity-bar-fill" style="width: ${percent}%; height: 100%; background: ${percent > 100 ? '#ff4444' : '#00ffff'}; transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        container.appendChild(header);

        const main = document.createElement('div');
        main.className = 'circuit-main';
        main.style.display = 'flex';
        main.style.flexDirection = 'row';
        main.style.alignItems = 'flex-start';
        main.style.gap = '24px';
        main.style.padding = '0';
        main.style.flex = '1'; // Stretch to fill container
        main.style.minHeight = '0'; // Essential for flex-child with overflow

        // Left Section: Circuit Grid or Status View
        const leftColumn = document.createElement('div');
        leftColumn.className = 'circuit-left-column';
        if (this.buildSubTab === 'circuit') {
            leftColumn.style.flex = '0 0 260px'; // 現状維持
        } else {
            leftColumn.style.flex = '1'; // 全幅
        }

        // Sub-tabs Header
        const subTabHeader = document.createElement('div');
        subTabHeader.className = 'build-subtabs';
        subTabHeader.style.display = 'flex';
        subTabHeader.style.width = '100%';
        subTabHeader.style.gap = '8px';
        subTabHeader.style.marginBottom = '8px';
        subTabHeader.style.borderBottom = '1px solid rgba(0, 255, 255, 0.2)';
        subTabHeader.style.paddingBottom = '4px';

        const activeFusions = circuit.getActiveFusions();
        const tabs = [
            { id: 'circuit', label: 'エーテル回路' },
            { id: 'status', label: 'ステータス' },
            { id: 'synergy', label: activeFusions.length > 0 ? 'シナジー ●' : 'シナジー' }
        ];

        tabs.forEach(tab => {
            const btn = document.createElement('div');
            btn.className = `subtab-btn ${this.buildSubTab === tab.id ? 'active' : ''}`;
            btn.textContent = tab.label;
            btn.style.fontSize = '11px';
            btn.style.fontWeight = 'bold';
            btn.style.padding = '4px 12px';
            btn.style.cursor = 'pointer';
            btn.style.color = this.buildSubTab === tab.id ? '#00ffff' : '#888';
            btn.style.borderBottom = this.buildSubTab === tab.id ? '2px solid #00ffff' : 'none';
            btn.style.transition = 'all 0.2s';
            btn.onclick = () => {
                this.buildSubTab = tab.id;
                this.render();
            };
            subTabHeader.appendChild(btn);
        });
        container.appendChild(subTabHeader);

        if (this.buildSubTab === 'status') {
            this.renderStatusView(leftColumn);
        } else if (this.buildSubTab === 'synergy') {
            this.renderSynergyView(leftColumn);
        } else {
            const gridSection = document.createElement('div');
            gridSection.className = 'circuit-grid-container';
            gridSection.innerHTML = '<div class="grid-label" style="display:none">エーテル回路 (5x5)</div>';

            const gridTable = document.createElement('div');
            gridTable.className = 'circuit-grid';

            for (let y = 0; y < 5; y++) {
                for (let x = 0; x < 5; x++) {
                    const item = circuit.grid[y][x];
                    let cell;

                    if (item === 'core') {
                        cell = document.createElement('div');
                        cell.className = 'grid-cell core-cell';
                        cell.innerHTML = '<div class="core-icon">CORE</div>';
                    } else if (item) {
                        const chip = item;
                        chip.gridX = x; // Temporary assign for tooltip/render logic if needed
                        chip.gridY = y;
                        const html = this.renderChip(chip, true, this.selectedChip === chip);
                        const temp = document.createElement('div');
                        temp.innerHTML = html.trim();
                        cell = temp.firstChild;

                        // Check if deployable (Only during run)
                        const canDeploy = this.game.currentFloor > 0 && circuit.canDeployChip(x, y);
                        if (this.game.currentFloor > 0 && !chip.isDeployed && canDeploy) {
                            cell.classList.add('deployable'); // Add CSS class for pulse effect
                        }

                        cell.onmouseenter = (e) => {
                            const rect = cell.getBoundingClientRect();
                            let deployText = '';
                            if (this.game.currentFloor > 0 && !chip.isDeployed) {
                                let trueCost = chip.isSpecial ? 30 : chip.getConnectedNodeCount() * 10;
                                if (canDeploy) {
                                   deployText = `<br><span style="color:#00ffff; font-size:10px;">ダブルクリックで再構築 (コスト: ${trueCost}共鳴点)</span>`;
                                } else {
                                   deployText = `<br><span style="color:#ff4444; font-size:10px;">※起動条件を満たしていません (コアへの接続が必要)</span>`;
                                }
                            }
                            this.showTooltip(chip, rect.left + rect.width / 2, rect.top, null, null, deployText);
                        };
                        cell.onmouseleave = () => this.hideTooltip();
                        cell.ondragstart = (e) => {
                            this.hideTooltip();
                            e.dataTransfer.setData('text/plain', chip.instanceId);
                            e.dataTransfer.setData('source-pos', JSON.stringify({ x, y }));
                            this.selectedChip = chip;
                            cell.classList.add('dragging');
                            if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(cell, 19, 19);
                            }
                        };
                        cell.ondragend = () => {
                            cell.classList.remove('dragging');
                        };
                        cell.oncontextmenu = (e) => {
                            e.preventDefault();
                            circuit.unequipChip(x, y);
                            this.render();
                        };
                        cell.onclick = (e) => {
                            e.stopPropagation();
                            if (this.selectedGridCell && this.selectedGridCell.x === x && this.selectedGridCell.y === y) {
                                this.selectedChip = null;
                                this.selectedGridCell = null;
                            } else {
                                this.selectedChip = chip;
                                this.selectedGridCell = { x, y };
                            }
                            this.render();
                        };
                        cell.ondblclick = (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (this.game.currentFloor > 0 && !chip.isDeployed && circuit.canDeployChip(x, y)) {
                                if (circuit.deployChip(x, y)) {
                                     // Optional: Add a visual blast/sound effect here
                                     this.render();
                                }
                            }
                        };
                    } else {
                        cell = document.createElement('div');
                        cell.className = 'grid-cell empty-cell';
                        if (this.selectedGridCell && this.selectedGridCell.x === x && this.selectedGridCell.y === y) {
                            cell.classList.add('selected');
                        }
                        cell.onclick = () => {
                            if (this.selectedGridCell && this.selectedGridCell.x === x && this.selectedGridCell.y === y) {
                                this.selectedGridCell = null;
                            } else {
                                this.selectedGridCell = { x, y };
                            }
                            this.render();
                        };
                    }

                    // Common drag-over for all cells (except core)
                    if (item !== 'core') {
                        cell.ondragover = (e) => {
                            e.preventDefault();
                            cell.classList.add('drag-over');
                        };
                        cell.ondragleave = () => {
                            cell.classList.remove('drag-over');
                        };
                        cell.ondrop = (e) => {
                            e.preventDefault();
                            cell.classList.remove('drag-over');
                            const instanceId = e.dataTransfer.getData('text/plain');
                            const chip = circuit.ownedChips.find(c => c.instanceId === instanceId);
                            if (chip) {
                                const result = circuit.equipChip(chip, x, y);
                                if (result === true) {
                                    this.selectedChip = chip;
                                    this.selectedGridCell = { x, y };
                                    this.render();
                                } else if (result && result.duplicatePos) {
                                    // Visual feedback for duplication
                                    const { x: dx, y: dy } = result.duplicatePos;
                                    // Correctly map grid coordinates to DOM element index (y * 5 + x)
                                    const gridEl = document.querySelector('.circuit-grid');
                                    if (gridEl) {
                                        const duplicateCell = gridEl.children[dy * 5 + dx];
                                        // The cell itself is the chip-item when equipped
                                        const chipIcon = (duplicateCell?.classList.contains('chip-item')) ? duplicateCell : duplicateCell?.querySelector('.chip-item');

                                        if (chipIcon) {
                                            chipIcon.classList.remove('duplicate-flash');
                                            void chipIcon.offsetWidth; // Force reflow
                                            chipIcon.classList.add('duplicate-flash');

                                            // Remove class after animation finishes (1s)
                                            setTimeout(() => {
                                                chipIcon.classList.remove('duplicate-flash');
                                            }, 1000);
                                        }
                                    }
                                }
                            }
                        };
                    }

                    gridTable.appendChild(cell);
                }
            }
            gridSection.appendChild(gridTable);
            leftColumn.appendChild(gridSection);
        }

        main.appendChild(leftColumn);

        // Inventory
        const invSection = document.createElement('div');
        const isSortedByConnection = this.selectedGridCell !== null;
        invSection.innerHTML = `<div class="grid-label">未装着のチップ${isSortedByConnection ? ' <span style="color:#00ffff; font-size:9px;">(接続順)</span>' : ''}</div>`;
        const invGrid = document.createElement('div');
        invGrid.className = 'chip-list vertical-inventory';
        
        // Hide inventory during a run
        if (this.game.currentFloor > 0) {
            invSection.innerHTML = `<div class="grid-label">未装着のチップ (ダンジョン内では変更不可)</div>`;
            invGrid.style.opacity = '0.5';
            invGrid.style.pointerEvents = 'none';
        }
        invGrid.style.gridTemplateColumns = 'repeat(4, 38px)';

        invGrid.ondragover = (e) => e.preventDefault();
        invGrid.ondrop = (e) => {
            e.preventDefault();
            const sourcePosStr = e.dataTransfer.getData('source-pos');
            if (sourcePosStr) {
                const sourcePos = JSON.parse(sourcePosStr);
                circuit.unequipChip(sourcePos.x, sourcePos.y);
                this.render();
            }
        };

        let inventoryChips = circuit.ownedChips.filter(chip => {
            for (let gy = 0; gy < 5; gy++) {
                if (circuit.grid[gy].includes(chip)) return false;
            }
            return true;
        });

        // Sort by connectivity if a cell is selected
        if (this.selectedGridCell) {
            const { x, y } = this.selectedGridCell;
            inventoryChips.sort((a, b) => {
                const scoreA = this.getChipConnectivityScore(a, x, y);
                const scoreB = this.getChipConnectivityScore(b, x, y);
                return scoreB - scoreA; // Descending
            });
        }

        const slotCount = Math.max(24, Math.ceil(inventoryChips.length / 4) * 4);
        for (let i = 0; i < slotCount; i++) {
            const chip = inventoryChips[i];
            let cell;

            if (chip) {
                const html = this.renderChip(chip, false, this.selectedChip === chip);
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                cell = temp.firstChild;

                cell.onmouseenter = (e) => {
                    const rect = cell.getBoundingClientRect();
                    this.showTooltip(chip, rect.left + rect.width / 2, rect.top);
                };
                cell.onmouseleave = () => this.hideTooltip();
                cell.ondragstart = (e) => {
                    this.hideTooltip();
                    e.dataTransfer.setData('text/plain', chip.instanceId);
                    this.selectedChip = chip;
                    cell.classList.add('dragging');
                    if (e.dataTransfer.setDragImage) {
                        e.dataTransfer.setDragImage(cell, 19, 19);
                    }
                };
                cell.ondragend = () => {
                    cell.classList.remove('dragging');
                };
                cell.onclick = (e) => {
                    e.stopPropagation();
                    if (this.selectedChip === chip && !this.selectedGridCell) {
                        this.selectedChip = null;
                    } else {
                        this.selectedChip = chip;
                        this.selectedGridCell = null;
                    }
                    this.render();
                };
            } else {
                cell = document.createElement('div');
                cell.className = 'grid-cell empty-cell';
            }

            invGrid.appendChild(cell);
        }
        invSection.appendChild(invGrid);
        if (this.buildSubTab === 'circuit') {
            main.appendChild(invSection);
        }

        container.appendChild(main);
    }

    static renderNodeIndicators(chip, forcedActiveNodes = null) {
        const activeNodes = forcedActiveNodes || chip.activeNodes || { up: 0, down: 0, left: 0, right: 0 };

        const renderSide = (side) => {
            const count = chip.nodes[side];
            const isActive = activeNodes[side] > 0;
            const isUniversal = count === 'universal';

            let content = '';
            if (isUniversal) {
                content = '<span class="node-universal-bar"></span>';
            } else {
                content = Array.from({ length: count }).map(() => '<span class="node-dot"></span>').join('');
            }

            return `<div class="node-indicator ${side} ${isActive ? 'active' : ''} ${isUniversal ? 'universal' : ''}">${content}</div>`;
        };

        return `
            ${renderSide('up')}
            ${renderSide('down')}
            ${renderSide('left')}
            ${renderSide('right')}
        `;
    }

    static renderSynthesisOptions(grid) {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = '10px';
        grid.style.width = '100%';
        grid.style.boxSizing = 'border-box';
        grid.style.overflowX = 'hidden';
        grid.style.justifyContent = 'flex-start'; // Override CSS class vertical centering
        grid.style.paddingTop = '5px'; // Tighten top margin

        // 1. Slots Area (Target + 3 Materials)
        const slotsArea = document.createElement('div');
        slotsArea.style.display = 'flex';
        slotsArea.style.gap = '10px'; // Reduced gap to save horizontal space
        slotsArea.style.justifyContent = 'center';
        slotsArea.style.padding = '5px';
        slotsArea.style.background = 'rgba(0,0,0,0.3)';
        slotsArea.style.borderRadius = '8px';
        slotsArea.style.boxSizing = 'border-box';
        slotsArea.style.width = '100%';
        slotsArea.style.maxWidth = '100%';

        // Helper to render a slot
        const createSlot = (chip, label, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '5px';

            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = '46px';
            cell.style.height = '46px';

            if (chip) {
                const html = this.renderChip(chip, false, false);
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const card = temp.firstChild;

                card.onmouseenter = (e) => {
                    const rect = card.getBoundingClientRect();
                    this.showTooltip(chip, rect.left + rect.width / 2, rect.top);
                };
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = () => {
                    this.selectedSynthesisMaterials.splice(index, 1);
                    this.render();
                };
                cell.appendChild(card);
            } else {
                cell.innerHTML = '<span style="color:#333; font-size:20px;">+</span>';
            }

            const lbl = document.createElement('div');
            lbl.style.fontSize = '8px';
            lbl.style.color = '#888';
            lbl.textContent = label;

            wrapper.appendChild(cell);
            wrapper.appendChild(lbl);
            return wrapper;
        };

        for (let i = 0; i < 5; i++) {
            slotsArea.appendChild(createSlot(this.selectedSynthesisMaterials[i], `素材 ${i + 1}`, i));
        }
        grid.appendChild(slotsArea);

        // 2. Filtered Chip List
        const listTitle = document.createElement('div');
        listTitle.style.fontSize = '10px';
        listTitle.style.color = '#aaa';
        listTitle.textContent = '同じレアリティのチップを5枚選択してください';
        grid.appendChild(listTitle);

        const listContainer = document.createElement('div');
        listContainer.className = 'lab-item-grid';
        listContainer.style.background = 'rgba(0,0,0,0.2)';
        listContainer.style.borderRadius = '4px';
        listContainer.style.height = '140px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.overflowX = 'hidden';
        listContainer.style.boxSizing = 'border-box';
        listContainer.style.width = '100%';
        listContainer.style.display = 'grid';
        listContainer.style.gridTemplateColumns = 'repeat(8, 46px)';
        listContainer.style.gridAutoRows = '46px';
        listContainer.style.gap = '12px';
        listContainer.style.padding = '10px';
        listContainer.style.justifyContent = 'center';

        const circuit = this.game.player.circuit;
        let availableChips = circuit.ownedChips.filter(chip => {
            // Cannot synthesize special chips
            if (chip.isSpecial) return false;
            // Not equipped
            for (let gy = 0; gy < 5; gy++) {
                if (circuit.grid[gy].includes(chip)) return false;
            }
            // Not already picked for synthesis
            if (this.selectedSynthesisMaterials.includes(chip)) return false;
            return true;
        });

        if (this.selectedSynthesisMaterials.length > 0) {
            const targetRarity = this.selectedSynthesisMaterials[0].getRarity();
            availableChips = availableChips.filter(chip =>
                chip.getRarity() === targetRarity
            );
        }

        // Render slots for selection (at least 16 slots, multiple of 8)
        const displayCount = Math.max(16, Math.ceil(availableChips.length / 8) * 8);
        for (let i = 0; i < displayCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = '46px';
            cell.style.height = '46px';

            const chip = availableChips[i];
            if (chip) {
                const html = this.renderChip(chip, false, false);
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const card = temp.firstChild;

                card.onmouseenter = (e) => {
                    const rect = card.getBoundingClientRect();
                    this.showTooltip(chip, rect.left + rect.width / 2, rect.top);
                };
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = () => {
                    if (this.selectedSynthesisMaterials.length < 5) {
                        this.selectedSynthesisMaterials.push(chip);
                    }
                    this.render();
                };
                cell.appendChild(card);
            }
            listContainer.appendChild(cell);
        }
        grid.appendChild(listContainer);
    }

    static renderResearchTab(container) {
        const grid = document.createElement('div');
        grid.className = 'lab-item-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(8, 46px)';
        grid.style.gridAutoRows = '46px';
        grid.style.gap = '12px';
        grid.style.padding = '10px';
        grid.style.justifyContent = 'center';
        grid.style.overflowY = 'auto';

        // Filter skills that are in collection but NOT in starting skills
        const researchableSkills = skillsDB.filter(s => {
            return SaveManager.isSkillUnlocked(s.id) && !SaveManager.isStartingSkillUnlocked(s.id);
        });

        if (researchableSkills.length === 0) {
            container.innerHTML = `<div class="detail-placeholder">研究可能な新しいスキルがありません。<br><span style="font-size: 0.8em; color: #888;">(ダンジョンで新しいスキルを見つけるとここに出現します)</span></div>`;
            return;
        }

        const slotCount = Math.max(24, Math.ceil(researchableSkills.length / 8) * 8);
        for (let i = 0; i < slotCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            const skill = researchableSkills[i];
            if (skill) {
                const card = document.createElement('div');
                card.className = `grid-cell chip-item rarity-common`; // Use chip styles for consistency
                if (this.selectedChip === skill) card.classList.add('selected');

                card.innerHTML = `<img src="${skill.icon}" class="chip-icon" onerror="this.style.display='none'">`;

                card.onmouseenter = (e) => {
                    const rect = card.getBoundingClientRect();
                    this.showTooltip(null, rect.left + rect.width / 2, rect.top, skill.name, skill.description);
                };
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = () => {
                    this.selectedChip = skill;
                    this.render();
                };
                cell.appendChild(card);
            }
            grid.appendChild(cell);
        }
        container.appendChild(grid);
    }

    static renderFocusArea() {
        const container = document.getElementById('lab-focus-area');
        const executeBtn = document.getElementById('btn-lab-execute');
        if (!container) return;
        container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'lab-focus-content';

        if (this.currentTab === 'research') {
            const skill = this.selectedChip;
            if (!skill || !skill.id) {
                content.innerHTML = `<div class="detail-placeholder" style="margin-top: 40px;">解析するスキルを<br>選択してください</div>`;
                if (executeBtn) executeBtn.style.display = 'none';
            } else {
                const cost = AetherLabManager.getSkillResearchCost(skill);
                const canAfford = this.game.player.aetherShards >= cost;

                content.innerHTML = `
                    <div class="lab-focus-title rarity-rarity-epic" style="color:#00ffff;">${skill.name}</div>
                    <div class="lab-focus-desc">${skill.description}</div>
                    <div class="lab-cost-display">
                        <div style="font-size: 8px; color: #888; margin-bottom: 5px;">研究コスト</div>
                        <div class="cost-row ${canAfford ? 'sufficient' : 'insufficient'}">
                            <div class="cost-label-with-icon">
                                <img src="assets/ui/aether_shard.png" class="currency-icon">
                            </div>
                            <span>${cost}</span>
                        </div>
                    </div>
                    <div style="margin-top:15px; font-size:9px; color:#00ffff; line-height:1.4;">
                        解析を完了すると、初期装備として<br>永続的に選択可能になります。
                    </div>
                `;
                if (executeBtn) {
                    executeBtn.style.display = 'block';
                    executeBtn.textContent = '解析を開始';
                    executeBtn.disabled = !canAfford;
                    executeBtn.style.opacity = canAfford ? '1' : '0.5';
                }
            }
            container.appendChild(content);
            return;
        }

        if (this.currentTab === 'synthesis') {
            this.renderSynthesisFocus(content);
            if (executeBtn) {
                executeBtn.textContent = '合成する';
                executeBtn.style.display = 'block';
            }
        } else if (this.selectedChip) {
            this.renderItemFocus(content);
            if (executeBtn) {
                if (this.currentTab === 'build') {
                    let equippedPos = null;
                    for (let y = 0; y < 5; y++) {
                        for (let x = 0; x < 5; x++) {
                            if (this.game.player.circuit.grid[y][x] === this.selectedChip) equippedPos = { x, y };
                        }
                    }

                    if (equippedPos) {
                        // Removed Unequip button - now handled by drag-to-inventory or right-click
                        executeBtn.style.display = 'none';
                    } else if (this.selectedGridCell) {
                        // Removed Equip button - now handled by drag-and-drop
                        executeBtn.style.display = 'none';
                    } else {
                        executeBtn.style.display = 'none';
                    }
                } else if (this.currentTab === 'modify') {
                    if (this.selectedChip.isSpecial) {
                        content.innerHTML += `<div style="color:red; font-size:10px; margin-top:5px;">特殊チップは改造できません。</div>`;
                        executeBtn.style.display = 'none';
                    } else {
                        executeBtn.textContent = '改造する';
                        executeBtn.style.display = 'block';
                    }
                } else if (this.currentTab === 'dismantle') {
                    if (this.selectedChip.isSpecial) {
                        content.innerHTML += `<div style="color:red; font-size:10px; margin-top:5px;">特殊チップは分解できません。</div>`;
                        executeBtn.style.display = 'none';
                    } else {
                        executeBtn.textContent = '分解する';
                        executeBtn.style.display = 'block';
                    }
                }
            }
        } else {
            content.innerHTML = `<div class="detail-placeholder">項目を選択してください</div>`;
            if (executeBtn) executeBtn.style.display = 'none';
        }

        container.appendChild(content);
    }

    static renderItemFocus(content) {
        const chip = this.selectedChip;
        const title = document.createElement('div');
        title.className = `lab-focus-title rarity-${chip.getRarity()}`;
        title.textContent = chip.data.name;
        content.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'lab-focus-desc';
        desc.innerHTML = this.formatDescription(chip);
        content.appendChild(desc);

        if (this.currentTab === 'build') {
            const stats = document.createElement('div');
            stats.className = 'lab-cost-display';
            stats.innerHTML = `<div style="font-size: 8px; color: #888; margin-bottom: 5px;">チップ詳細</div>
                <div class="cost-row">
                    <span>カテゴリー:</span>
                    <span class="rarity-${chip.getRarity()}">${chip.data.category}</span>
                </div>`;
            content.appendChild(stats);
            return;
        }

        // Costs
        if (chip.isSpecial && (this.currentTab === 'modify' || this.currentTab === 'dismantle')) {
            return; // We already showed the warning message above, no need to show costs
        }

        let costLabel = '';
        let costData = { gold: 0, fragments: 0 };
        if (this.currentTab === 'modify') {
            costLabel = '強化コスト (ノード追加)';
            costData = AetherLabManager.getModifyCost(chip);
        } else if (this.currentTab === 'dismantle') {
            costLabel = '分解報酬';
            costData = AetherLabManager.getDismantleYield(chip);
        }

        const costDisplay = document.createElement('div');
        costDisplay.className = 'lab-cost-display';
        costDisplay.innerHTML = `<div style="font-size: 8px; color: #888; margin-bottom: 5px;">${costLabel}</div>`;

        if (this.currentTab === 'dismantle') {
            costDisplay.innerHTML += `
                <div class="cost-row sufficient">
                    <div class="cost-label-with-icon">
                        <img src="assets/ui/aether_shard.png" class="currency-icon"> 報酬
                    </div>
                    <span>+${costData.shards}</span>
                </div>
            `;
        } else {
            const goldOk = this.game.player.aetherShards >= costData.gold;
            const shardOk = this.game.player.aetherFragments >= costData.fragments;

            costDisplay.innerHTML += `
                <div class="cost-row ${goldOk ? 'sufficient' : 'insufficient'}">
                    <div class="cost-label-with-icon">
                        <img src="assets/ui/aether_shard.png" class="currency-icon">
                    </div>
                    <span>${costData.gold}</span>
                </div>
                <div class="cost-row ${shardOk ? 'sufficient' : 'insufficient'}">
                    <div class="cost-label-with-icon">
                        <img src="assets/ui/aether_fragment.png" class="currency-icon">
                    </div>
                    <span>${costData.fragments}</span>
                </div>
            `;
        }
        content.appendChild(costDisplay);
    }

    static renderSynthesisFocus(content) {
        const title = document.createElement('div');
        title.className = 'lab-focus-title';
        title.textContent = 'ランクアップ合成';
        content.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'lab-focus-desc';
        desc.innerHTML = `
            同じレアリティのチップ5枚を合成し、<br>
            ワンランク上のランダムなチップを獲得します。<br>
            <span style="color: #666; font-size: 8px;">※5枚のチップ効果が全て同じ場合、完成品も同じ効果になります。</span>
        `;
        content.appendChild(desc);

        if (this.selectedSynthesisMaterials.length === 5) {
            const status = document.createElement('div');
            status.className = 'lab-cost-display';
            const canSyn = AetherLabManager.canSynthesizeRankUp(this.game.player, this.selectedSynthesisMaterials);

            const matRarity = this.selectedSynthesisMaterials[0].getRarity();
            let nextRarity = matRarity === 'common' ? 'rare' : matRarity === 'rare' ? 'epic' : 'legendary';
            if (matRarity === 'legendary') nextRarity = 'legendary';

            status.innerHTML = `
                <div style="font-size: 8px; color: ${canSyn ? '#00ff88' : '#ff4444'}; margin-bottom: 5px;">
                    ${canSyn ? `合成結果予想: <span class="rarity-${nextRarity}">${nextRarity.toUpperCase()}</span> チップ` : 'レアリティが一致しません'}
                </div>
            `;
            content.appendChild(status);
        } else {
            const status = document.createElement('div');
            status.className = 'lab-cost-display';
            status.innerHTML = `
                <div style="font-size: 8px; color: #888; margin-bottom: 5px;">
                    同じレアリティのチップを5枚選択してください
                </div>
            `;
            content.appendChild(status);
        }
    }

    static executeAction() {
        const player = this.game.player;
        let success = false;

        if (this.currentTab === 'build' && this.selectedChip) {
            const circuit = player.circuit;
            let equippedPos = null;
            for (let y = 0; y < 5; y++) {
                for (let x = 0; x < 5; x++) {
                    if (circuit.grid[y][x] === this.selectedChip) equippedPos = { x, y };
                }
            }

            if (equippedPos) {
                circuit.unequipChip(equippedPos.x, equippedPos.y);
                success = true;
            } else if (this.selectedGridCell) {
                success = circuit.equipChip(this.selectedChip, this.selectedGridCell.x, this.selectedGridCell.y);
                if (success) this.selectedGridCell = null;
            }
        } else if (this.currentTab === 'modify' && this.selectedChip) {
            success = AetherLabManager.modifyChip(player, this.selectedChip);
        } else if (this.currentTab === 'dismantle' && this.selectedChip) {
            success = AetherLabManager.dismantleChip(player, this.selectedChip);
            if (success) this.selectedChip = null;
        } else if (this.currentTab === 'synthesis') {
            success = AetherLabManager.synthesizeRankUp(player, this.selectedSynthesisMaterials);
            if (success) {
                this.selectedSynthesisMaterials = [];
            }
        } else if (this.currentTab === 'research' && this.selectedChip) {
            success = AetherLabManager.researchSkill(player, this.selectedChip);
            if (success) {
                this.selectedChip = null;
            }
        }

        if (success) {
            this.render();
        } else {
            console.warn("Lab Action Failed: Insufficient resources or no item selected.");
        }
    }
    static renderStatusView(container) {
        const statusView = document.createElement('div');
        statusView.className = 'circuit-status-view';
        statusView.style.padding = '10px';
        statusView.style.background = 'rgba(0, 0, 0, 0.4)';
        statusView.style.borderRadius = '4px';
        statusView.style.height = '184px'; // Match grid height
        statusView.style.overflowY = 'auto';
        statusView.style.border = '1px solid rgba(0, 255, 255, 0.1)';

        const bonuses = this.game.player.circuit.getDetailedBonuses();

        const labels = {
            damageMult: 'スキルダメージ',
            maxHp: '最大HP',
            speedMult: '移動速度',
            aetherChargeMult: 'エーテル充填速度',
            fireDamageMult: '火属性ダメージ',
            thunderDamageMult: '雷属性ダメージ',
            iceDamageMult: '氷属性ダメージ',
            bloodDamageMult: '血属性ダメージ',
            critRateAdd: 'クリティカル率',
            critDamageAdd: '会心倍率',
            onHitDamageBuff: '逆上(力)',
            takenDamageMult: '被ダメージ軽減',
            trainingKillBuff: '鍛錬(1体毎)',
            bossDamageMult: 'ボスダメージ',
            inertiaScaling: '慣性(移動速度1%毎)',
            ukemiChance: '受け身(発動率)',
            accelerationScaling: '加速(最大)',
            damageRandomRange: '一発逆転(変動幅)',
            poisonDamageMult: '毒属性ダメージ'
        };

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '6px';

        let hasAnyBonus = false;

        Object.keys(labels).forEach(key => {
            const data = bonuses[key];
            const curr = data.current;
            const pot = data.potential;

            if (curr === 0 || Math.abs(curr) < 0.0001) return;

            hasAnyBonus = true;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = key === 'trainingKillBuff' ? 'flex-start' : 'center'; // Align top if multiline
            row.style.fontSize = '12px';
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            row.style.paddingBottom = '4px';

            const label = document.createElement('div');
            label.textContent = labels[key];
            label.style.color = '#888';

            const valContainer = document.createElement('div');
            valContainer.style.textAlign = 'right';

            const value = document.createElement('div');
            value.style.fontWeight = 'bold';

            // Formatting
            const isPercentage = !['maxHp', 'critDamageAdd'].includes(key);
            const formatValue = (v) => {
                if (key === 'critDamageAdd') return `+${(v).toFixed(2)}x`;
                if (isPercentage) {
                    const percent = (v * 100).toFixed(2);
                    return `${v >= 0 ? '+' : ''}${percent}%`;
                }
                return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
            };

            const getColor = (v) => {
                const isPositiveGood = key !== 'takenDamageMult';
                const isGood = v >= 0 ? isPositiveGood : !isPositiveGood;
                return isGood ? '#00ffff' : '#ff4444';
            };

            value.textContent = formatValue(curr);
            value.style.color = getColor(curr);
            valContainer.appendChild(value);

            // Special handling for Training: 100 kills potency
            if (key === 'trainingKillBuff') {
                const maxRow100 = document.createElement('div');
                maxRow100.style.fontSize = '9px';
                maxRow100.style.color = '#00ffff';
                maxRow100.style.opacity = '0.7';
                maxRow100.textContent = `(100体撃破時:${formatValue(data.fullPotency)})`;
                valContainer.appendChild(maxRow100);
            }

            row.appendChild(label);
            row.appendChild(valContainer);
            list.appendChild(row);
        });

        if (!hasAnyBonus) {
            const empty = document.createElement('div');
            empty.textContent = '有効なバフがありません。回路を接続してください。';
            empty.style.fontSize = '12px';
            empty.style.color = '#555';
            empty.style.textAlign = 'center';
            empty.style.marginTop = '40px';
            list.appendChild(empty);
        }

        statusView.appendChild(list);
        container.appendChild(statusView);
    }

    static renderSynergyView(container) {
        const circuit = this.game.player.circuit;
        const activeList = circuit.getActiveFusions();
        const nearList = circuit.getNearFusions();

        const synergyView = document.createElement('div');
        synergyView.className = 'circuit-synergy-view';
        synergyView.style.padding = '10px';
        synergyView.style.background = 'rgba(0, 0, 0, 0.4)';
        synergyView.style.borderRadius = '4px';
        synergyView.style.height = '184px';
        synergyView.style.overflowY = 'auto';
        synergyView.style.border = '1px solid rgba(0, 255, 255, 0.1)';
        synergyView.style.fontSize = '11px';

        const STATUS_INLINE_ICONS = {
            '炎上':     statusIcons.burn,
            '中毒':     statusIcons.poison,
            '出血':     statusIcons.bleed,
            '感電':     statusIcons.shock,
            '凍結':     statusIcons.freeze,
            '鈍足':     statusIcons.slow,
            '湿潤':     statusIcons.wet,
            '腐食':     statusIcons.corrosion,
            '極電':     statusIcons.frostbolt,
            '血炎':     statusIcons.sanguine,
            '感電爆血': statusIcons.voltbleed,
            '凍毒':     statusIcons.frostpoison,
            '烈火雷鳴': statusIcons.stormfire,
        };

        function renderTextWithStatusIcons(container, text) {
            const names = Object.keys(STATUS_INLINE_ICONS).sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${names.join('|')})`, 'g');
            const parts = text.split(regex);

            parts.forEach(part => {
                const icon = STATUS_INLINE_ICONS[part];
                if (icon && icon.src) {
                    const img = document.createElement('img');
                    img.src = icon.src;
                    img.style.width = '13px';
                    img.style.height = '13px';
                    img.style.objectFit = 'contain';
                    img.style.verticalAlign = 'middle';
                    img.style.marginRight = '1px';
                    img.style.marginLeft = '2px';
                    img.style.flexShrink = '0';
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = part;
                    nameSpan.style.verticalAlign = 'middle';
                    container.appendChild(nameSpan);
                    container.appendChild(img);
                } else {
                    container.appendChild(document.createTextNode(part));
                }
            });
        }

        const FUSION_DISPLAY = {
            corrosion: {
                name: '腐食',
                effect: '複合状態異常「腐食」をアンロック\n炎上と中毒を各1スタック以上付与することで腐食状態異常が発生する\n炎上と中毒のスタック合計数に応じて、敵の防御力を最大40%ダウンさせる。',
            },
            frostbolt: {
                name: '極電',
                effect: '複合状態異常「極電」をアンロック\n凍結と感電を各1スタック以上付与することで極電状態異常が発生する\n消費したスタック合計数に応じてスタン時間（最大3.5秒）と次に受けるダメージの倍率（最大6.5倍）が増加する。',
            },
            sanguine: {
                name: '血炎',
                effect: '複合状態異常「血炎」をアンロック\n出血と炎上を各1スタック以上付与することで血炎状態異常が発生する\n出血と炎上の全スタックを消費して即時爆発。消費スタック合計 × スキルダメージ40%の爆発ダメージを与える。',
            },
            voltbleed: {
                name: '感電爆血',
                effect: '複合状態異常「感電爆血」をアンロック\n感電と出血を各1スタック以上付与することで感電爆血状態異常が発生する\n両方が乗っている間、被ダメージのたびに周囲の敵へ連鎖する。連鎖量は感電スタック × 2% ＋ 出血スタック × 3%。',
            },
            frostpoison: {
                name: '凍毒',
                effect: '複合状態異常「凍毒」をアンロック\n凍結と中毒を各1スタック以上付与することで凍毒状態異常が発生する\n凍結中に中毒の全スタックを消費して即時一括ダメージを発生させる。凍結はそのまま残る。',
            },
            stormfire: {
                name: '烈火雷鳴',
                effect: '複合状態異常「烈火雷鳴」をアンロック\n炎上と感電を各1スタック以上付与することで烈火雷鳴状態異常が発生する\n感電が乗っている間、炎上のDoTが感電スタック数 × 15%ずつ強化される（10スタックで+150%）。',
            },
            blood_crit: {
                name: '血の会心',
                effect: 'クリティカル発生時に確定で「出血」を1スタック付与する。',
            },
            storm_speed: {
                name: '疾風雷鳴',
                effect: '「感電」の連鎖範囲が移動速度の上昇量に応じて拡大する。',
            },
            unyield_bleed: {
                name: '不屈の出血',
                effect: '「受け身」発動時に周囲の敵に「出血」を3スタック付与する。',
            },
            mastery_strike: {
                name: '鍛錬の極意',
                effect: '撃破スタックが50以上のときスキルダメージ上昇の効果が2倍になる。',
            },
            mad_gambler: {
                name: '狂賭博師',
                effect: '変動幅で最大ダメージ付近（0.75以上）を引いた際、全状態異常（燃焼、出血、感電、毒、凍結）を同時に付与する。',
            },
        };

        const findChipByEffectType = (circuit, effectType) => {
            for (let y = 0; y < 5; y++) {
                for (let x = 0; x < 5; x++) {
                    const chip = circuit.grid[y][x];
                    if (chip && chip !== 'core' && chip.data.effectType === effectType) return chip;
                }
            }
            // Also check owned chips that are not equipped but might be active (e.g. from other sources)
            for (const chip of circuit.ownedChips) {
                if (chip.data.effectType === effectType) return chip;
            }
            return null;
        };

        const renderChipIcons = (chipIds, activeChipIds, circuit) => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '4px';
            wrap.style.marginBottom = '6px';

            chipIds.forEach((effectType, i) => {
                const chip = findChipByEffectType(circuit, effectType);
                const isActive = activeChipIds.includes(effectType);

                const img = document.createElement('img');
                img.style.width = '22px';
                img.style.height = '22px';
                img.style.objectFit = 'contain';
                img.style.borderRadius = '3px';
                img.style.border = '1px solid';
                img.style.padding = '2px';
                img.style.background = '#111';

                if (chip) {
                    img.src = chip.data.icon;
                    img.title = chip.data.name;
                    img.style.borderColor = isActive ? '#00ffff44' : '#333';
                    img.style.filter = isActive ? 'none' : 'grayscale(1) brightness(0.5)';
                } else {
                    img.src = 'assets/ui/chips/icon_unknown.png';
                    img.style.borderColor = '#333';
                    img.style.filter = 'grayscale(1) brightness(0.4)';
                    img.title = '未入手';
                }

                img.onerror = () => {
                    img.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.textContent = chip ? chip.data.name : '?';
                    fallback.style.fontSize = '9px';
                    fallback.style.color = isActive ? '#00ffff' : '#ccc';
                    wrap.insertBefore(fallback, img.nextSibling);
                };

                wrap.appendChild(img);

                if (i < chipIds.length - 1) {
                    const plus = document.createElement('span');
                    plus.textContent = '＋';
                    plus.style.fontSize = '11px';
                    plus.style.color = '#555';
                    wrap.appendChild(plus);
                }
            });
            return wrap;
        };

        const createCard = (fusionType, type, fusionData = {}) => {
            const display = FUSION_DISPLAY[fusionType];
            if (!display) return null;

            const card = document.createElement('div');
            card.style.border = '1px solid #333';
            card.style.borderRadius = '4px';
            card.style.padding = '7px 10px';
            card.style.cursor = 'default';
            card.style.transition = 'border-color 0.15s';
            card.style.background = 'rgba(255,255,255,0.03)';

            let accentColor = '#555';
            let badgeText = '-';
            let status = 'inactive';

            if (type === 'active') {
                accentColor = '#00ffff';
                badgeText = 'ACTIVE';
                status = 'active';
            } else if (type === 'near') {
                accentColor = '#ff6666';
                badgeText = 'あと1枚';
                status = 'near';
            } else if (type === 'all') {
                accentColor = '#555';
                badgeText = '未発動';
                status = 'inactive';
            }

            card.innerHTML = `
                <div class="synergy-card-header" style="display: flex; align-items: center; gap: 6px;">
                    <div class="synergy-dot" style="width: 7px; height: 7px; border-radius: 50%; background: ${accentColor}; ${status === 'active' ? 'animation: deployable-pulse 1.5s infinite;' : ''}"></div>
                    <div class="synergy-name" style="font-size: 12px; font-weight: bold; flex: 1; color: ${status === 'active' ? '#fff' : '#aaa'};">${display.name}</div>
                    <div class="synergy-badge" style="font-size: 9px; color: ${accentColor};">${badgeText}</div>
                </div>
                <div class="synergy-detail" style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #222; max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.25s ease, opacity 0.2s ease;">
                    <div class="synergy-pills-container" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                    <div class="synergy-effect" style="font-size: 10px; color: #ccc; line-height: 1.6; margin-top: 6px;"></div>
                </div>
            `;

            const detail = card.querySelector('.synergy-detail');
            const pillsContainer = card.querySelector('.synergy-pills-container');
            const effectEl = card.querySelector('.synergy-effect');

            display.effect.split('\n').forEach(line => {
                const lineEl = document.createElement('div');
                lineEl.style.display = 'flex';
                lineEl.style.alignItems = 'center';
                lineEl.style.flexWrap = 'wrap';
                lineEl.style.gap = '0px';
                renderTextWithStatusIcons(lineEl, line);
                effectEl.appendChild(lineEl);
            });

            const reqTypes = fusionData.requiredEffectTypes || (fusionType === 'corrosion' ? ['fire_damage_mult', 'poison_damage_mult'] : 
                                                               fusionType === 'frostbolt' ? ['ice_damage_mult', 'thunder_damage_mult'] :
                                                               fusionType === 'sanguine' ? ['blood_damage_mult', 'fire_damage_mult'] :
                                                               fusionType === 'voltbleed' ? ['thunder_damage_mult', 'blood_damage_mult'] :
                                                               fusionType === 'frostpoison' ? ['ice_damage_mult', 'poison_damage_mult'] :
                                                               fusionType === 'stormfire' ? ['fire_damage_mult', 'thunder_damage_mult'] : []);
            
            let activeChipIds = [];
            if (type === 'active') {
                activeChipIds = [...reqTypes];
            } else {
                activeChipIds = reqTypes.filter(et => {
                    const chip = findChipByEffectType(circuit, et);
                    return chip && chip.isActive;
                });
            }
            
            pillsContainer.appendChild(renderChipIcons(reqTypes, activeChipIds, circuit));

            if (type === 'near' && fusionData.missingChipName) {
                const hint = document.createElement('div');
                hint.style.fontSize = '9px';
                hint.style.color = '#ff6666';
                hint.style.marginTop = '4px';
                hint.style.opacity = '0.8';
                hint.textContent = `→ 「${fusionData.missingChipName}」を起動で発動`;
                detail.appendChild(hint);
            }

            card.onmouseenter = () => {
                card.style.borderColor = accentColor;
                detail.style.maxHeight = '200px';
                detail.style.opacity = '1';
            };
            card.onmouseleave = () => {
                card.style.borderColor = '#333';
                detail.style.maxHeight = '0';
                detail.style.opacity = '0';
            };

            return card;
        };

        const createSection = (title, items, type) => {
            if (items.length === 0 && type === 'near') return null;

            const section = document.createElement('div');
            section.style.marginBottom = '12px';

            const header = document.createElement('div');
            header.style.color = '#00ffff';
            header.style.fontSize = '10px';
            header.style.marginBottom = '8px';
            header.style.borderBottom = '1px solid rgba(0,255,255,0.2)';
            header.textContent = title;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            grid.style.gap = '6px';
            grid.style.alignItems = 'start';

            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = '#555';
                empty.style.fontSize = '10px';
                empty.style.gridColumn = 'span 2';
                empty.textContent = title === '発動中' ? '現在発動中のシナジーはありません' : 'なし';
                grid.appendChild(empty);
            } else {
                items.forEach(item => {
                    const card = createCard(item.fusionType, type, item);
                    if (card) grid.appendChild(card);
                });
            }

            section.appendChild(grid);
            return section;
        };

        // 1. Active
        synergyView.appendChild(createSection('発動中', activeList, 'active'));

        // 2. Near
        const nearSection = createSection('あと1枚で発動', nearList, 'near');
        if (nearSection) synergyView.appendChild(nearSection);

        // 3. All List
        const allHeader = document.createElement('div');
        allHeader.style.color = '#666';
        allHeader.style.fontSize = '10px';
        allHeader.style.marginBottom = '8px';
        allHeader.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        allHeader.style.marginTop = '10px';
        allHeader.textContent = '全シナジー一覧';
        synergyView.appendChild(allHeader);

        const allGrid = document.createElement('div');
        allGrid.style.display = 'grid';
        allGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        allGrid.style.gap = '6px';
        allGrid.style.alignItems = 'start';

        Object.keys(FUSION_DISPLAY).forEach(key => {
            const isActive = activeList.some(a => a.fusionType === key);
            const isNear = nearList.some(n => n.fusionType === key);
            
            let type = 'all';
            let data = {};
            if (isActive) {
                type = 'active';
                data = activeList.find(a => a.fusionType === key);
            } else if (isNear) {
                type = 'near';
                data = nearList.find(n => n.fusionType === key);
            }

            const card = createCard(key, type, data);
            if (card) allGrid.appendChild(card);
        });
        synergyView.appendChild(allGrid);

        container.appendChild(synergyView);
    }
}
