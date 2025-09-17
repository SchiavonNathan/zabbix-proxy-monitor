document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('network-map');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    
    // Funções para gerenciar layouts salvos
    const LAYOUT_STORAGE_KEY = 'zabbix_proxy_positions';
    const LAYOUT_LIST_KEY = 'zabbix_saved_layouts';
    
    function saveCurrentLayout(layoutName) {
        if (!positions || !positions.proxies || !Array.isArray(positions.proxies)) {
            alert('Não há proxies para salvar!');
            return false;
        }
        
        try {
            // Criar um objeto com nomes de proxies como chaves e posições como valores
            const positionData = {};
            positions.proxies.forEach(proxy => {
                positionData[proxy.name] = {
                    x: proxy.x / width,  // Armazenar como percentuais para ser responsivo
                    y: proxy.y / height
                };
            });
            
            // Obter a lista de layouts salvos
            const savedLayouts = getSavedLayoutsList();
            
            // Adicionar ou atualizar este layout na lista
            savedLayouts[layoutName] = {
                name: layoutName,
                timestamp: new Date().toISOString(),
                proxyCount: positions.proxies.length
            };
            
            // Salvar a lista atualizada
            localStorage.setItem(LAYOUT_LIST_KEY, JSON.stringify(savedLayouts));
            
            // Salvar o layout atual
            localStorage.setItem(`${LAYOUT_STORAGE_KEY}_${layoutName}`, JSON.stringify(positionData));
            
            return true;
        } catch (e) {
            console.error('Erro ao salvar layout:', e);
            return false;
        }
    }
    
    function loadLayout(layoutName) {
        try {
            const layoutKey = `${LAYOUT_STORAGE_KEY}_${layoutName}`;
            const savedLayout = localStorage.getItem(layoutKey);
            
            if (!savedLayout) {
                alert(`Layout "${layoutName}" não encontrado!`);
                return false;
            }
            
            // Definir este layout como o atual
            localStorage.setItem(LAYOUT_STORAGE_KEY, savedLayout);
            
            // Aplicar o layout diretamente sem recarregar a página
            const savedPositions = JSON.parse(savedLayout);
            
            // Atualizar as posições dos nós
            if (positions && positions.proxies && Array.isArray(positions.proxies)) {
                positions.proxies.forEach(proxy => {
                    if (savedPositions[proxy.name]) {
                        proxy.x = savedPositions[proxy.name].x * width;
                        proxy.y = savedPositions[proxy.name].y * height;
                    }
                });
                
                // Redesenhar o mapa com as novas posições
                drawMap();
                console.log(`Layout "${layoutName}" aplicado com sucesso!`);
                return true;
            } else {
                console.error('Erro ao aplicar layout: posições não inicializadas');
                return false;
            }
        } catch (e) {
            console.error('Erro ao carregar layout:', e);
            return false;
        }
    }
    
    function deleteLayout(layoutName) {
        try {
            // Remover o layout específico
            localStorage.removeItem(`${LAYOUT_STORAGE_KEY}_${layoutName}`);
            
            // Atualizar a lista de layouts
            const savedLayouts = getSavedLayoutsList();
            delete savedLayouts[layoutName];
            localStorage.setItem(LAYOUT_LIST_KEY, JSON.stringify(savedLayouts));
            
            return true;
        } catch (e) {
            console.error('Erro ao excluir layout:', e);
            return false;
        }
    }
    
    function getSavedLayoutsList() {
        try {
            const savedLayouts = localStorage.getItem(LAYOUT_LIST_KEY);
            return savedLayouts ? JSON.parse(savedLayouts) : {};
        } catch (e) {
            console.error('Erro ao carregar lista de layouts:', e);
            return {};
        }
    }
    
    function saveProxyPositions() {
        try {
            if (!positions || !positions.proxies || !Array.isArray(positions.proxies) || positions.proxies.length === 0) {
                console.warn('Não há proxies para salvar');
                return;
            }
            
            // Criar um objeto com nomes de proxies como chaves e posições como valores
            const positionData = {};
            positions.proxies.forEach(proxy => {
                positionData[proxy.name] = {
                    x: proxy.x / width,  // Armazenar como percentuais para ser responsivo
                    y: proxy.y / height
                };
            });
            
            // Salvar no localStorage
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(positionData));
        } catch (e) {
            console.error('Erro ao salvar posições dos proxies:', e);
        }
    }
    
    function loadProxyPositions() {
        try {
            const savedPositions = localStorage.getItem(LAYOUT_STORAGE_KEY);
            return savedPositions ? JSON.parse(savedPositions) : {};
        } catch (e) {
            console.error('Erro ao carregar posições dos proxies:', e);
            return {};
        }
    }

    window.addEventListener('resize', function() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
        drawMap();
    });

    const proxyDataElement = document.getElementById('proxy-data');
    if (!proxyDataElement) return;
    
    const proxyData = JSON.parse(proxyDataElement.getAttribute('data-proxies'));
    
    const colors = {
        background: '#001f3f',
        lines: '#00b894',
        server: '#ffffff',
        proxyActive: '#10b981',
        proxyWarning: '#f59e0b',
        proxyDanger: '#ef4444',
        text: '#ffffff',
        cloud: '#ffffff'
    };

    function calculatePositions() {
        const centerX = width / 2;
        const centerY = height / 2;
        
        const radiusX = width * 0.40;
        const radiusY = height * 0.40;
        
        const serverNode = {
            x: centerX,
            y: centerY,
            radius: 35, 
            type: 'server',
            name: 'Zabbix Server'
        };
        
        const proxyNodes = [];
        const nodeRadius = 24; 
        const minDistanceBetweenNodes = nodeRadius * 2.8;
        
        // Carregar posições salvas
        const savedPositions = loadProxyPositions();
        const hasSavedPositions = Object.keys(savedPositions).length > 0;
        
        console.log('Posições salvas carregadas:', hasSavedPositions ? 'Sim' : 'Não', savedPositions);
        
        proxyData.forEach((proxy, index) => {
            let x, y;
            
            // Verificar se tem posição salva para este proxy
            if (hasSavedPositions && savedPositions[proxy.name]) {
                // Usar posições salvas (convertendo de percentual para pixels)
                x = savedPositions[proxy.name].x * width;
                y = savedPositions[proxy.name].y * height;
                console.log(`Usando posição salva para ${proxy.name}: (${x}, ${y})`);
            } else {
                // Calcular posição padrão se não tiver posição salva
                const baseAngleStep = (2 * Math.PI) / proxyData.length;
                const angle = index * baseAngleStep;
                
                const maxDistanceFactor = 0.9;
                const distanceFactor = Math.min(0.65 + (index / proxyData.length) * 0.35, maxDistanceFactor);
                
                x = centerX + radiusX * distanceFactor * Math.cos(angle);
                y = centerY + radiusY * distanceFactor * Math.sin(angle);
                
                const checkOverlap = () => {
                    const distToServer = Math.sqrt(
                        Math.pow(x - serverNode.x, 2) + 
                        Math.pow(y - serverNode.y, 2)
                    );
                    
                    if (distToServer < serverNode.radius + nodeRadius + 10) {
                        return true; 
                    }
                    
                    return proxyNodes.some(existingNode => {
                        const dist = Math.sqrt(
                            Math.pow(x - existingNode.x, 2) + 
                            Math.pow(y - existingNode.y, 2)
                        );
                        return dist < minDistanceBetweenNodes;
                    });
                };
                
                const checkOutOfBounds = () => {
                    const padding = nodeRadius * 1.2; 
                    return (
                        x < padding || 
                        x > width - padding || 
                        y < padding || 
                        y > height - padding
                    );
                };
                
                if (checkOverlap() || checkOutOfBounds()) {
                    for (let attempt = 1; attempt <= 10; attempt++) {
                        const maxAdjustment = 0.05 * attempt;
                        const adjustedDistanceFactor = Math.min(
                            distanceFactor + maxAdjustment,
                            0.85
                        );
                        
                        x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle);
                        y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle);
                        
                        if (!checkOverlap() && !checkOutOfBounds()) {
                            break; 
                        }
                        
                        if (attempt > 5) {
                            const angleAdjust = (attempt - 5) * 0.03;
                            x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle + angleAdjust);
                            y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle + angleAdjust);
                            
                            if (!checkOverlap() && !checkOutOfBounds()) {
                                break;
                            }
                            
                            x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle - angleAdjust);
                            y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle - angleAdjust);
                            
                            if (!checkOverlap() && !checkOutOfBounds()) {
                                break;
                            }
                        }
                    }
                }
            }
            
            // Garantir que o nó está dentro dos limites do canvas
            x = Math.max(nodeRadius, Math.min(width - nodeRadius, x));
            y = Math.max(nodeRadius, Math.min(height - nodeRadius, y));
            
            proxyNodes.push({
                x: x,
                y: y,
                radius: nodeRadius,
                type: 'proxy',
                name: proxy.name,
                status: proxy.status_color,
                hosts: proxy.hosts_count,
                mode: proxy.mode,
                lastAccess: proxy.last_access
            });
        });
        
        return {
            server: serverNode,
            proxies: proxyNodes
        };
    }

    function drawNode(node) {
        if (node.type === 'proxy') {
            const gradient = ctx.createLinearGradient(
                positions.server.x, positions.server.y, 
                node.x, node.y
            );
            
            gradient.addColorStop(0, 'rgba(0, 184, 148, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 184, 148, 0.4)');
            
            ctx.beginPath();
            ctx.moveTo(positions.server.x, positions.server.y);
            ctx.lineTo(node.x, node.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(positions.server.x, positions.server.y);
            ctx.lineTo(node.x, node.y);
            ctx.strokeStyle = 'rgba(0, 184, 148, 0.1)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        if (node.type === 'server') {
            drawCloud(node.x, node.y, node.radius * 2);
        } else {
            let statusColor;
            if (node.status === 'success') {
                statusColor = '#10b981';
            } else if (node.status === 'warning') {
                statusColor = '#f59e0b';
            } else {
                statusColor = '#ef4444';
            }
            
            const glowRadius = node.radius * 1.3;
            
            const glow = ctx.createRadialGradient(
                node.x, node.y, node.radius * 0.6,
                node.x, node.y, glowRadius
            );
            glow.addColorStop(0, statusColor);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            
            const gradient = ctx.createRadialGradient(
                node.x, node.y - node.radius * 0.3, node.radius * 0.2,
                node.x, node.y, node.radius
            );
            gradient.addColorStop(0, statusColor);
            gradient.addColorStop(1, statusColor);
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(node.x - node.radius * 0.5, node.y - node.radius * 0.3);
            ctx.lineTo(node.x + node.radius * 0.5, node.y - node.radius * 0.3);
            ctx.lineTo(node.x + node.radius * 0.5, node.y + node.radius * 0.3);
            ctx.lineTo(node.x - node.radius * 0.5, node.y + node.radius * 0.3);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fill();
            
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(node.x - node.radius * 0.4, node.y - node.radius * 0.2 + (i * node.radius * 0.15));
                ctx.lineTo(node.x + node.radius * 0.4, node.y - node.radius * 0.2 + (i * node.radius * 0.15));
                ctx.strokeStyle = 'rgba(0, 31, 63, 0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = colors.text;
            ctx.font = 'bold 14px Roboto';
            ctx.textAlign = 'center';
            ctx.fillText(node.name, node.x, node.y + node.radius + 18);
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            const badgeRadius = 14;
            const badgeX = node.x + node.radius * 0.8;
            const badgeY = node.y - node.radius * 0.8;
            
            const badgeGradient = ctx.createRadialGradient(
                badgeX, badgeY, 0,
                badgeX, badgeY, badgeRadius
            );
            badgeGradient.addColorStop(0, '#5b9eed');
            badgeGradient.addColorStop(1, '#3b82f6');
            
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fillStyle = badgeGradient;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = colors.text;
            ctx.font = 'bold 12px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.hosts, badgeX, badgeY);
            ctx.textBaseline = 'alphabetic';
        }
    }
    
    function drawHostPoints(node) {
        const hostCount = node.hosts;
        
        let statusColor;
        if (node.status === 'success') {
            statusColor = '#10b981';
        } else if (node.status === 'warning') {
            statusColor = '#f59e0b';
        } else {
            statusColor = '#ef4444';
        }
        
        const maxDisplayPoints = 15;
        const pointsToDisplay = Math.min(hostCount, maxDisplayPoints);
        
        if (pointsToDisplay <= 0) return;
        
        const distributionRadius = node.radius * 1.8;
        
        const angleStep = (2 * Math.PI) / pointsToDisplay;
        
        const timeOffset = Date.now() * 0.001;
        
        for (let i = 0; i < pointsToDisplay; i++) {
            const angle = i * angleStep + (Math.sin(timeOffset + i * 0.2) * 0.1);
            const distance = distributionRadius * (0.9 + Math.random() * 0.2);
            const x = node.x + distance * Math.cos(angle);
            const y = node.y + distance * Math.sin(angle);
            
            const pulsePhase = (timeOffset + i * 0.5) % 3;
            const pulseScale = 0.6 + (pulsePhase < 1 ? pulsePhase : (3 - pulsePhase) * 0.5);
            const pointSize = 4 * pulseScale;
            
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            const pointGradient = ctx.createRadialGradient(
                x, y, 0,
                x, y, pointSize
            );
            pointGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            pointGradient.addColorStop(0.5, statusColor);
            pointGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(x, y, pointSize, 0, Math.PI * 2);
            ctx.fillStyle = pointGradient;
            ctx.fill();
        }
        
        if (hostCount > maxDisplayPoints) {
            const angle = Math.PI * 0.25;
            const x = node.x + distributionRadius * 1.2 * Math.cos(angle);
            const y = node.y + distributionRadius * 1.2 * Math.sin(angle);
            
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+' + (hostCount - maxDisplayPoints), x, y);
            ctx.textBaseline = 'alphabetic';
        }
    }

    function drawCloud(x, y, size) {
        ctx.beginPath();
        
        ctx.save();
        
        ctx.translate(x, y);
        const scale = size / 100;
        ctx.scale(scale, scale);
        
        ctx.moveTo(-25, 10);
        ctx.bezierCurveTo(-45, 15, -50, -15, -25, -20);
        ctx.bezierCurveTo(-15, -50, 25, -50, 35, -20);
        ctx.bezierCurveTo(65, -35, 80, 5, 45, 20);
        ctx.bezierCurveTo(55, 45, 20, 55, 5, 30);
        ctx.bezierCurveTo(-25, 45, -45, 25, -25, 10);
        
        const cloudGradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
        cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        cloudGradient.addColorStop(1, 'rgba(220, 230, 255, 0.7)');
        
        ctx.fillStyle = cloudGradient;
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.rect(-15, -12, 30, 24);
        ctx.fillStyle = '#001f3f';
        ctx.fill();
        
        for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-12, -8 + (i * 6));
            ctx.lineTo(12, -8 + (i * 6));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        const glowGradient = ctx.createRadialGradient(0, 0, 30, 0, 0, 60);
        glowGradient.addColorStop(0, 'rgba(0, 184, 148, 0.2)');
        glowGradient.addColorStop(1, 'rgba(0, 184, 148, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fill();
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Zabbix Server', 0, 45);
        
        ctx.restore();
    }

    function drawMap() {
        ctx.clearRect(0, 0, width, height);
        
        drawBackgroundPattern();
        
        positions.proxies.forEach(proxy => {
            if (proxy.type === 'proxy') {
                const gradient = ctx.createLinearGradient(
                    positions.server.x, positions.server.y, 
                    proxy.x, proxy.y
                );
                
                gradient.addColorStop(0, 'rgba(0, 184, 148, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 184, 148, 0.4)');
                
                ctx.beginPath();
                ctx.moveTo(positions.server.x, positions.server.y);
                ctx.lineTo(proxy.x, proxy.y);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        drawNode(positions.server);
        
        positions.proxies.forEach(proxy => {
            drawNode(proxy);
        });
        
        setTimeout(() => requestAnimationFrame(drawMap), 5000);
    }
    
    function drawBackgroundPattern() {
        const bgGradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.8
        );
        bgGradient.addColorStop(0, '#002b59');
        bgGradient.addColorStop(1, '#001f3f');
        
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        const noiseIntensity = 0.02;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() * 2 - 1) * noiseIntensity * 255;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 8; i++) {
            const radius = Math.min(width, height) * 0.08 * i;
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        
        for (let i = 0; i < height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            
            for (let j = 0; j < width; j += 5) {
                const amplitude = 8;
                const y = i + Math.sin(j * 0.01) * amplitude;
                ctx.lineTo(j, y);
            }
            
            ctx.stroke();
        }
        
        for (let i = 0; i < width; i += 80) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            
            for (let j = 0; j < height; j += 5) {
                const amplitude = 10;
                const phase = i * 0.01;
                const x = i + Math.sin(j * 0.01 + phase) * amplitude;
                ctx.lineTo(x, j);
            }
            
            ctx.stroke();
        }
    }
    
    const positions = calculatePositions();
    requestAnimationFrame(drawMap);
    
    let isDragging = false;
    let draggedNode = null;
    let offsetX = 0;
    let offsetY = 0;
    let lastHoveredNode = null;
    
    function getNodeUnderCursor(x, y) {
        const dx = x - positions.server.x;
        const dy = y - positions.server.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= positions.server.radius) {
            return positions.server;
        }
        
        for (const proxy of positions.proxies) {
            const dx = x - proxy.x;
            const dy = y - proxy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= proxy.radius) {
                return proxy;
            }
        }
        
        return null;
    }
    
    function handleMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (isDragging && draggedNode && draggedNode.type === 'proxy') {
            const tooltip = document.getElementById('map-tooltip');
            tooltip.style.display = 'none';
            
            draggedNode.x = x - offsetX;
            draggedNode.y = y - offsetY;
            
            draggedNode.x = Math.max(draggedNode.radius, Math.min(width - draggedNode.radius, draggedNode.x));
            draggedNode.y = Math.max(draggedNode.radius, Math.min(height - draggedNode.radius, draggedNode.y));
            
            drawMap();
            return;
        }
        
        const hoveredNode = getNodeUnderCursor(x, y);
        
        if (hoveredNode && hoveredNode.type === 'proxy') {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
        
        const tooltip = document.getElementById('map-tooltip');
        
        if (hoveredNode) {
            lastHoveredNode = hoveredNode;
            
            tooltip.style.display = 'block';
            tooltip.style.left = (event.clientX + 5) + 'px';
            tooltip.style.top = (event.clientY + 5) + 'px';
            
            if (hoveredNode.type === 'server') {
                tooltip.innerHTML = `
                    <div class="tooltip-header server">
                        <i class="bi bi-cloud-fill me-2"></i>
                        Zabbix Server
                    </div>
                    <div class="tooltip-body">
                        <div class="tooltip-row">
                            <span>Monitoramento central</span>
                        </div>
                    </div>
                `;
            } else {
                let statusIcon = 'bi-check-circle-fill';
                let statusText = 'Online';
                
                if (hoveredNode.status === 'warning') {
                    statusIcon = 'bi-exclamation-triangle-fill';
                    statusText = 'Atraso na atualização';
                } else if (hoveredNode.status === 'danger') {
                    statusIcon = 'bi-x-circle-fill';
                    statusText = 'Offline';
                }
                
                tooltip.innerHTML = `
                    <div class="tooltip-header ${hoveredNode.status}">
                        <i class="bi bi-hdd-network-fill me-2"></i>
                        ${hoveredNode.name}
                    </div>
                    <div class="tooltip-body">
                        <div class="tooltip-row">
                            <span class="tooltip-label">Status:</span>
                            <span class="tooltip-value ${hoveredNode.status}">
                                <i class="bi ${statusIcon} me-1"></i>${statusText}
                            </span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Modo:</span>
                            <span class="tooltip-value">${hoveredNode.mode}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Último acesso:</span>
                            <span class="tooltip-value">${hoveredNode.lastAccess}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Hosts:</span>
                            <span class="tooltip-value">
                                <i class="bi bi-pc-display me-1"></i>${hoveredNode.hosts}
                            </span>
                        </div>
                        <div class="tooltip-hint mt-2">
                            <i class="bi bi-arrows-move me-1"></i>
                            Clique e arraste para mover
                        </div>
                    </div>
                `;
            }
            
            if (hoveredNode.type === 'proxy') {
                canvas.setAttribute('data-highlighted-node', JSON.stringify({
                    x: hoveredNode.x,
                    y: hoveredNode.y
                }));
            } else {
                canvas.removeAttribute('data-highlighted-node');
            }
        } else {
            lastHoveredNode = null;
            tooltip.style.display = 'none';
            canvas.removeAttribute('data-highlighted-node');
        }
    }
    
    function handleMouseDown(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const node = getNodeUnderCursor(x, y);
        
        if (node && node.type === 'proxy') {
            isDragging = true;
            draggedNode = node;
            offsetX = x - node.x;
            offsetY = y - node.y;
            canvas.style.cursor = 'grabbing';
            
            const tooltip = document.getElementById('map-tooltip');
            tooltip.style.display = 'none';
        }
    }
    
    function handleMouseUp() {
        if (isDragging) {
            canvas.style.cursor = lastHoveredNode ? 'grab' : 'default';
            isDragging = false;
            draggedNode = null;
            
            drawMap();
        }
    }
    
    function handleMouseLeave() {
        const tooltip = document.getElementById('map-tooltip');
        tooltip.style.display = 'none';
        
        if (isDragging) {
            isDragging = false;
            draggedNode = null;
            canvas.style.cursor = 'default';
        }
    }
    
    function handleMouseUp() {
        if (isDragging) {
            canvas.style.cursor = lastHoveredNode ? 'grab' : 'default';
            isDragging = false;
            draggedNode = null;
            
            // Salvar posições após arrastar e soltar
            saveProxyPositions();
            
            drawMap();
        }
    }
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Implementar os controles de gerenciamento de layout
    const layoutModal = document.getElementById('layout-modal');
    const layoutButton = document.getElementById('map-layout-button');
    const layoutCloseBtn = document.getElementById('layout-modal-close');
    const layoutCloseBtn2 = document.getElementById('layout-close-btn');
    const layoutNameInput = document.getElementById('layout-name');
    const layoutSaveBtn = document.getElementById('layout-save-btn');
    const layoutResetBtn = document.getElementById('layout-reset-btn');
    const layoutList = document.getElementById('layout-list');
    
    // Função para abrir modal
    function openLayoutModal() {
        layoutModal.style.display = 'flex';
        refreshLayoutList();
        layoutNameInput.focus();
    }
    
    // Função para fechar modal
    function closeLayoutModal() {
        layoutModal.style.display = 'none';
    }
    
    // Função para renderizar a lista de layouts
    function refreshLayoutList() {
        const layouts = getSavedLayoutsList();
        layoutList.innerHTML = '';
        
        if (Object.keys(layouts).length === 0) {
            layoutList.innerHTML = '<div class="layout-empty">Nenhum layout salvo ainda</div>';
            return;
        }
        
        Object.values(layouts).forEach(layout => {
            const date = new Date(layout.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            const layoutItem = document.createElement('div');
            layoutItem.className = 'layout-item';
            layoutItem.innerHTML = `
                <div class="layout-item-content">
                    <div class="layout-item-name">${layout.name}</div>
                    <div class="layout-item-info">
                        <i class="bi bi-clock-history me-1"></i>${formattedDate} 
                        <i class="bi bi-hdd-network ms-2 me-1"></i>${layout.proxyCount} proxies
                    </div>
                </div>
                <div class="layout-item-actions">
                    <button class="layout-action-btn load" title="Carregar layout">
                        <i class="bi bi-box-arrow-in-down"></i>
                    </button>
                    <button class="layout-action-btn delete" title="Excluir layout">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            
            const loadBtn = layoutItem.querySelector('.load');
            loadBtn.addEventListener('click', () => {
                if (confirm(`Carregar o layout "${layout.name}"? As posições atuais serão substituídas.`)) {
                    loadLayout(layout.name);
                }
            });
            
            const deleteBtn = layoutItem.querySelector('.delete');
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Excluir o layout "${layout.name}"? Esta ação não pode ser desfeita.`)) {
                    deleteLayout(layout.name);
                    refreshLayoutList();
                }
            });
            
            layoutList.appendChild(layoutItem);
        });
    }
    
    // Função para resetar posições (remover posições salvas)
    function resetPositions() {
        if (confirm('Resetar as posições dos proxies para o padrão? Esta ação não pode ser desfeita.')) {
            localStorage.removeItem(LAYOUT_STORAGE_KEY);
            location.reload();
        }
    }
    
    // Event listeners para controles de layout
    if (layoutButton) {
        layoutButton.addEventListener('click', openLayoutModal);
    }
    
    if (layoutCloseBtn) {
        layoutCloseBtn.addEventListener('click', closeLayoutModal);
    }
    
    if (layoutCloseBtn2) {
        layoutCloseBtn2.addEventListener('click', closeLayoutModal);
    }
    
    if (layoutSaveBtn) {
        layoutSaveBtn.addEventListener('click', () => {
            const layoutName = layoutNameInput.value.trim();
            
            if (!layoutName) {
                alert('Por favor, digite um nome para o layout.');
                layoutNameInput.focus();
                return;
            }
            
            const layouts = getSavedLayoutsList();
            if (layouts[layoutName] && !confirm(`Já existe um layout chamado "${layoutName}". Deseja sobrescrever?`)) {
                return;
            }
            
            if (saveCurrentLayout(layoutName)) {
                alert(`Layout "${layoutName}" salvo com sucesso!`);
                layoutNameInput.value = '';
                refreshLayoutList();
            } else {
                alert('Erro ao salvar o layout. Por favor, tente novamente.');
            }
        });
    }
    
    if (layoutResetBtn) {
        layoutResetBtn.addEventListener('click', resetPositions);
    }
    
    // Fechar modal clicando fora
    window.addEventListener('click', (event) => {
        if (event.target === layoutModal) {
            closeLayoutModal();
        }
    });
});