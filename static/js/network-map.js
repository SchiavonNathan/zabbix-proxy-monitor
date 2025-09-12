// Network Map Visualization for Zabbix Proxies
document.addEventListener('DOMContentLoaded', function() {
    // Canvas setup
    const canvas = document.getElementById('network-map');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    // Handle window resize
    window.addEventListener('resize', function() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
        drawMap();
    });

    // Get proxy data from the data attribute
    const proxyDataElement = document.getElementById('proxy-data');
    if (!proxyDataElement) return;
    
    const proxyData = JSON.parse(proxyDataElement.getAttribute('data-proxies'));
    
    // Colors and styling
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

    // Calculate proxy positions with more natural distribution and prevent overlapping
    function calculatePositions() {
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Use a more contained area for distribution to keep nodes on screen
        // Reduced from 0.45 to 0.40 to ensure nodes stay within view
        const radiusX = width * 0.40;
        const radiusY = height * 0.40;
        
        // Server at center
        const serverNode = {
            x: centerX,
            y: centerY,
            radius: 35, // Slightly smaller server radius
            type: 'server',
            name: 'Zabbix Server'
        };
        
        // Position proxies with more deterministic layout to avoid overlaps
        const proxyNodes = [];
        const nodeRadius = 24; // Slightly smaller proxy radius for better spacing
        const minDistanceBetweenNodes = nodeRadius * 2.8; // Ensure adequate space between nodes
        const baseAngleStep = (2 * Math.PI) / proxyData.length;
        
        // Create a more uniform distribution
        proxyData.forEach((proxy, index) => {
            // More consistent angle distribution (less randomization)
            const angle = index * baseAngleStep;
            
            // Distance from center increases slightly for each node (spiral)
            // Limit the maximum distance factor to keep nodes from going off screen
            const maxDistanceFactor = 0.9;
            const distanceFactor = Math.min(0.65 + (index / proxyData.length) * 0.35, maxDistanceFactor);
            
            // Calculate initial position
            let x = centerX + radiusX * distanceFactor * Math.cos(angle);
            let y = centerY + radiusY * distanceFactor * Math.sin(angle);
            
            // Check if position would overlap with existing nodes
            const checkOverlap = () => {
                // First, check distance from server
                const distToServer = Math.sqrt(
                    Math.pow(x - serverNode.x, 2) + 
                    Math.pow(y - serverNode.y, 2)
                );
                
                if (distToServer < serverNode.radius + nodeRadius + 10) {
                    return true; // Too close to server
                }
                
                // Then check distance from all existing proxy nodes
                return proxyNodes.some(existingNode => {
                    const dist = Math.sqrt(
                        Math.pow(x - existingNode.x, 2) + 
                        Math.pow(y - existingNode.y, 2)
                    );
                    return dist < minDistanceBetweenNodes;
                });
            };
            
            // Check if position is within bounds of the canvas (with padding)
            const checkOutOfBounds = () => {
                const padding = nodeRadius * 1.2; // Add padding to keep nodes fully visible
                return (
                    x < padding || 
                    x > width - padding || 
                    y < padding || 
                    y > height - padding
                );
            };
            
            // If overlap detected or out of bounds, try to adjust position
            if (checkOverlap() || checkOutOfBounds()) {
                // Try different positions with carefully controlled distance
                for (let attempt = 1; attempt <= 10; attempt++) {
                    // Calculate adjusted distance factor, but cap it to prevent going off-screen
                    const maxAdjustment = 0.05 * attempt;
                    const adjustedDistanceFactor = Math.min(
                        distanceFactor + maxAdjustment,
                        0.85 // Maximum distance factor to stay on screen
                    );
                    
                    x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle);
                    y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle);
                    
                    if (!checkOverlap() && !checkOutOfBounds()) {
                        break; // Found a good position
                    }
                    
                    // If still problematic, try slight angle adjustment
                    if (attempt > 5) {
                        const angleAdjust = (attempt - 5) * 0.03;
                        x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle + angleAdjust);
                        y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle + angleAdjust);
                        
                        if (!checkOverlap() && !checkOutOfBounds()) {
                            break; // Found a good position
                        }
                        
                        // Try the opposite angle adjustment as last resort
                        x = centerX + radiusX * adjustedDistanceFactor * Math.cos(angle - angleAdjust);
                        y = centerY + radiusY * adjustedDistanceFactor * Math.sin(angle - angleAdjust);
                        
                        if (!checkOverlap() && !checkOutOfBounds()) {
                            break; // Found a good position
                        }
                    }
                }
                
                // Final safety check to ensure node is on screen
                x = Math.max(nodeRadius, Math.min(width - nodeRadius, x));
                y = Math.max(nodeRadius, Math.min(height - nodeRadius, y));
            }
            
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

    // Draw a node (server or proxy)
    function drawNode(node) {
        // Draw connection line to server for proxies without animation effect
        if (node.type === 'proxy') {
            // Create gradient for the connection line
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
            
            // Optional: add a subtle glow effect to the line (non-animated)
            ctx.beginPath();
            ctx.moveTo(positions.server.x, positions.server.y);
            ctx.lineTo(node.x, node.y);
            ctx.strokeStyle = 'rgba(0, 184, 148, 0.1)';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Animation removed - no more moving pulses
        }
        
        // Draw node based on type
        if (node.type === 'server') {
            // Draw cloud for server
            drawCloud(node.x, node.y, node.radius * 2);
        } else {
            // Get the exact color from our CSS legend definitions
            let statusColor;
            if (node.status === 'success') {
                statusColor = '#10b981'; // Same as .legend-active
            } else if (node.status === 'warning') {
                statusColor = '#f59e0b'; // Same as .legend-warning
            } else {
                statusColor = '#ef4444'; // Same as .legend-danger
            }
            
            // Create a stronger glow effect
            const glowRadius = node.radius * 1.3;
            
            // Draw stronger glow
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
            
            // Draw proxy node with solid color matching the legend
            const gradient = ctx.createRadialGradient(
                node.x, node.y - node.radius * 0.3, node.radius * 0.2,
                node.x, node.y, node.radius
            );
            gradient.addColorStop(0, statusColor); // Make the gradient more subtle
            gradient.addColorStop(1, statusColor);
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Add a ring around the node
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Add server icon inside node
            ctx.beginPath();
            ctx.moveTo(node.x - node.radius * 0.5, node.y - node.radius * 0.3);
            ctx.lineTo(node.x + node.radius * 0.5, node.y - node.radius * 0.3);
            ctx.lineTo(node.x + node.radius * 0.5, node.y + node.radius * 0.3);
            ctx.lineTo(node.x - node.radius * 0.5, node.y + node.radius * 0.3);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fill();
            
            // Add horizontal lines to represent server rack
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(node.x - node.radius * 0.4, node.y - node.radius * 0.2 + (i * node.radius * 0.15));
                ctx.lineTo(node.x + node.radius * 0.4, node.y - node.radius * 0.2 + (i * node.radius * 0.15));
                ctx.strokeStyle = 'rgba(0, 31, 63, 0.6)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Draw text label below the node with shadow for better readability
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = colors.text;
            ctx.font = 'bold 14px Roboto'; // Increased font size for node name
            ctx.textAlign = 'center';
            ctx.fillText(node.name, node.x, node.y + node.radius + 18); // Adjusted position
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw badge for hosts count (larger to match node size)
            const badgeRadius = 14;
            const badgeX = node.x + node.radius * 0.8;
            const badgeY = node.y - node.radius * 0.8;
            
            // Badge background with gradient
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
            
            // Add stroke to badge
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Badge text
            ctx.fillStyle = colors.text;
            ctx.font = 'bold 12px Roboto'; // Larger font for badge text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.hosts, badgeX, badgeY);
            ctx.textBaseline = 'alphabetic'; // Reset to default
        }
    }
    
    // Draw enhanced cloud shape for the server
    // Draw host points around a proxy node
    function drawHostPoints(node) {
        const hostCount = node.hosts;
        
        // Get the exact color from our CSS legend definitions
        let statusColor;
        if (node.status === 'success') {
            statusColor = '#10b981'; // Same as .legend-active
        } else if (node.status === 'warning') {
            statusColor = '#f59e0b'; // Same as .legend-warning
        } else {
            statusColor = '#ef4444'; // Same as .legend-danger
        }
        
        // Maximum number of points to display (if more, we'll show a representative sample)
        const maxDisplayPoints = 15;
        const pointsToDisplay = Math.min(hostCount, maxDisplayPoints);
        
        if (pointsToDisplay <= 0) return;
        
        // Calculate radius for points distribution (outside the node)
        const distributionRadius = node.radius * 1.8;
        
        // Calculate angle step between points
        const angleStep = (2 * Math.PI) / pointsToDisplay;
        
        // Animation offset based on time
        const timeOffset = Date.now() * 0.001;
        
        for (let i = 0; i < pointsToDisplay; i++) {
            // Calculate position with slight variation
            const angle = i * angleStep + (Math.sin(timeOffset + i * 0.2) * 0.1);
            const distance = distributionRadius * (0.9 + Math.random() * 0.2);
            const x = node.x + distance * Math.cos(angle);
            const y = node.y + distance * Math.sin(angle);
            
            // Calculate pulse effect (different for each point)
            const pulsePhase = (timeOffset + i * 0.5) % 3;
            const pulseScale = 0.6 + (pulsePhase < 1 ? pulsePhase : (3 - pulsePhase) * 0.5);
            const pointSize = 4 * pulseScale; // Increased point size
            
            // Draw connection line to the node (thinner)
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Draw the point with gradient
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
        
        // If there are more points than we're displaying, add an indicator
        if (hostCount > maxDisplayPoints) {
            const angle = Math.PI * 0.25; // Position at top-right
            const x = node.x + distributionRadius * 1.2 * Math.cos(angle);
            const y = node.y + distributionRadius * 1.2 * Math.sin(angle);
            
            // Draw more points indicator
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+' + (hostCount - maxDisplayPoints), x, y);
            ctx.textBaseline = 'alphabetic'; // Reset to default
        }
    }

    function drawCloud(x, y, size) {
        ctx.beginPath();
        
        // Save the current context state
        ctx.save();
        
        // Cloud shape using arcs
        ctx.translate(x, y);
        const scale = size / 100;
        ctx.scale(scale, scale);
        
        // Draw cloud shape with more complex curves for better appearance
        ctx.moveTo(-25, 10);
        ctx.bezierCurveTo(-45, 15, -50, -15, -25, -20);
        ctx.bezierCurveTo(-15, -50, 25, -50, 35, -20);
        ctx.bezierCurveTo(65, -35, 80, 5, 45, 20);
        ctx.bezierCurveTo(55, 45, 20, 55, 5, 30);
        ctx.bezierCurveTo(-25, 45, -45, 25, -25, 10);
        
        // Create a gradient for cloud
        const cloudGradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
        cloudGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        cloudGradient.addColorStop(1, 'rgba(220, 230, 255, 0.7)');
        
        // Fill the cloud
        ctx.fillStyle = cloudGradient;
        ctx.fill();
        
        // Add cloud border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add server icon inside cloud
        ctx.beginPath();
        ctx.rect(-15, -12, 30, 24);
        ctx.fillStyle = '#001f3f';
        ctx.fill();
        
        // Add horizontal lines to represent server
        for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-12, -8 + (i * 6));
            ctx.lineTo(12, -8 + (i * 6));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        // Add glow effect
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        const glowGradient = ctx.createRadialGradient(0, 0, 30, 0, 0, 60);
        glowGradient.addColorStop(0, 'rgba(0, 184, 148, 0.2)');
        glowGradient.addColorStop(1, 'rgba(0, 184, 148, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fill();
        
        // Add server label with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Zabbix Server', 0, 45);
        
        // Restore the context
        ctx.restore();
    }

    // Draw the complete map without animations
    function drawMap() {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw background pattern
        drawBackgroundPattern();
        
        // Draw connection lines first so they appear behind nodes
        positions.proxies.forEach(proxy => {
            if (proxy.type === 'proxy') {
                // Create gradient for the connection line
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
        
        // Draw server node
        drawNode(positions.server);
        
        // Draw proxy nodes (no animation)
        positions.proxies.forEach(proxy => {
            drawNode(proxy);
        });
        
        // Refresh much less frequently since we have no animations
        setTimeout(() => requestAnimationFrame(drawMap), 5000); // Only update every 5 seconds
    }
    
    // Draw an enhanced background pattern
    function drawBackgroundPattern() {
        // Create a gradient background
        const bgGradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.8
        );
        bgGradient.addColorStop(0, '#002b59');
        bgGradient.addColorStop(1, '#001f3f');
        
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add subtle noise texture
        const noiseIntensity = 0.02; // Reduced noise intensity for a cleaner look
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() * 2 - 1) * noiseIntensity * 255;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Draw concentric circles
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // Draw more subtle concentric circles
        for (let i = 1; i <= 8; i++) {
            const radius = Math.min(width, height) * 0.08 * i;
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw more interesting wavy grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        
        // Horizontal waves
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
        
        // Vertical waves
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
        
        // Removed the "subtle light spots" that were causing the blinking white lights in the background
    }
    
    // Initialize positions and start the animation loop
    const positions = calculatePositions();
    // Start the animation loop
    requestAnimationFrame(drawMap);
    
    // Variables for drag functionality
    let isDragging = false;
    let draggedNode = null;
    let offsetX = 0;
    let offsetY = 0;
    let lastHoveredNode = null;
    
    // Get node under cursor
    function getNodeUnderCursor(x, y) {
        // Check server node
        const dx = x - positions.server.x;
        const dy = y - positions.server.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= positions.server.radius) {
            return positions.server; // Server is not draggable, but we need to detect hover
        }
        
        // Check proxy nodes
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
    
    // Show tooltip and handle cursor style
    function handleMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // If currently dragging a node
        if (isDragging && draggedNode && draggedNode.type === 'proxy') {
            // Hide tooltip during drag
            const tooltip = document.getElementById('map-tooltip');
            tooltip.style.display = 'none';
            
            // Update node position
            draggedNode.x = x - offsetX;
            draggedNode.y = y - offsetY;
            
            // Keep node within bounds of the canvas
            draggedNode.x = Math.max(draggedNode.radius, Math.min(width - draggedNode.radius, draggedNode.x));
            draggedNode.y = Math.max(draggedNode.radius, Math.min(height - draggedNode.radius, draggedNode.y));
            
            // Redraw map
            drawMap();
            return;
        }
        
        // Get node under cursor
        const hoveredNode = getNodeUnderCursor(x, y);
        
        // Update cursor style
        if (hoveredNode && hoveredNode.type === 'proxy') {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
        
        // Handle tooltip display
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
                // Determine status icon based on status color
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
            
            // Highlight the connection
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
    
    // Start dragging
    function handleMouseDown(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if click is on a proxy node
        const node = getNodeUnderCursor(x, y);
        
        if (node && node.type === 'proxy') {
            isDragging = true;
            draggedNode = node;
            offsetX = x - node.x;
            offsetY = y - node.y;
            canvas.style.cursor = 'grabbing';
            
            // Hide tooltip while dragging
            const tooltip = document.getElementById('map-tooltip');
            tooltip.style.display = 'none';
        }
    }
    
    // End dragging
    function handleMouseUp() {
        if (isDragging) {
            canvas.style.cursor = lastHoveredNode ? 'grab' : 'default';
            isDragging = false;
            draggedNode = null;
            
            // Redraw map with final positions
            drawMap();
        }
    }
    
    // Mouse leave handler - stop dragging and hide tooltip
    function handleMouseLeave() {
        const tooltip = document.getElementById('map-tooltip');
        tooltip.style.display = 'none';
        
        // Also cancel any ongoing drag operation
        if (isDragging) {
            isDragging = false;
            draggedNode = null;
            canvas.style.cursor = 'default';
        }
    }
    
    // Register event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
});
