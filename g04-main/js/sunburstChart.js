class SunburstChart {
  constructor(config) {
    this.config = {
      parentElement: config.parentElement,
      width: config.width || 800,
      height: config.height || 800,
      margin: config.margin || { top: 20, right: 20, bottom: 20, left: 20 }
    };

    // Visualization constants
    this.innerRadius = 100;
    this.outerRadius = Math.min(this.config.width, this.config.height) / 2 - this.config.margin.top;
    this.ringWidth = (this.outerRadius - this.innerRadius) / 5;

    // Color scheme and chess piece symbols
    this.colors = {
      default: '#d3d3d3',
      inactive: '#f0f0f0',
      highlight: {
        'A': '#e41a1c',
        'B': '#377eb8',
        'C': '#4daf4a',
        'D': '#984ea3',
        'E': '#ff7f00'
      }
    };
    this.pieces = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    // D3 partition layout and arc generator
    this.partition = d3.partition()
      .size([2 * Math.PI, this.outerRadius - this.innerRadius])
      .padding(0.01);

    this.arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => Math.max(0, d.y0) + this.innerRadius)
      .outerRadius(d => Math.max(0, d.y1) + this.innerRadius)
      .padAngle(0.01)
      .padRadius(this.innerRadius);

    // Data storage
    this.rawData = null;
    this.processedData = null;

    // Initialize the visualization
    this.initVis();

    // Store the current ECO filter
    this.ecoFilter = null;
    this.bracketFilter = null;
    this.userHasSelectedEco = false; // Track if user has explicitly selected an ECO

    // Setup event listeners for linking with other views
    document.addEventListener('ecoFilter', (event) => {
      this.ecoFilter = event.detail.eco;
      this.bracketFilter = event.detail.bracket;
      this.updateVis();
    });
  }

  initVis() {
    const vis = this;
    // Set up SVG
    vis.svg = d3.select(vis.config.parentElement)
      .attr('width', vis.config.width)
      .attr('height', vis.config.height)
      .style('background-color', '#ffffff');

    // Main group, centered
    vis.g = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.width / 2}, ${vis.config.height / 2})`);

    // Sunburst group
    vis.sunburstGroup = vis.g.append('g')
      .attr('class', 'sunburst-group');
    vis.sunburstGroup.append('circle')
      .attr('r', vis.outerRadius)
      .attr('fill', 'none')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    // Draw the static chessboard
    vis.initializeChessboard();

    // Ensure no reset buttons exist at initialization
    vis.svg.selectAll('defs').remove();

    d3.select('.tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 8px rgba(0,0,0,0.2)')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('max-width', '200px')
      .style('z-index', 1000);

    // Start loading data
    this.loadData();
  }

  async loadData() {
    try {
      const response = await fetch('data/games_preprocessed.csv');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const csvText = await response.text();
      if (!csvText.trim()) throw new Error('Empty CSV file');

      let parsedData = d3.csvParse(csvText, d => {
        d.white_rating = +d.white_rating || 0;
        d.black_rating = +d.black_rating || 0;
        // Ensure necessary fields exist
        if (!d.opening_eco || !d.winner) return null;
        return d;
      }).filter(d => d !== null);

      // Filter out rows with missing first move
      parsedData = parsedData.filter(d => d.move_1 && d.move_1 !== '-1');

      if (parsedData.length === 0) throw new Error('No valid data after filtering');
      this.rawData = parsedData;

      // Once data is loaded, update the visualization
      this.updateVis();
    } catch (err) {
      console.error('Error during data load:', err);
      d3.select('#loading-error')
        .text(`Error: ${err.message}`)
        .style('display', 'block');
    }
  }

  updateVis() {
    const vis = this;
    // Read filters from DOM
    const ratingFilter = d3.select('#rating-filter').node();
    const selectedRating = ratingFilter ? ratingFilter.value : 'all';

    // Process the raw chess data into a 5-level hierarchy
    vis.processedData = vis.processChessData(vis.rawData, selectedRating);
    if (!vis.processedData.children || vis.processedData.children.length === 0) {
      console.error('No valid moves found');
      return;
    }

    // If there's an existing reset button, remove it (for backward compatibility)
    if (vis.resetButton) {
      vis.resetButton.remove();
      vis.svg.selectAll('defs').remove();
      vis.resetButton = null;
    }

    // Render the visualization
    vis.renderVis();
  }

  processChessData(rawData, selectedRating = 'all') {
    const rootNode = { name: 'root', children: [], value: 0, wins: 0, moves: '', gameIds: new Set() };

    if (!Array.isArray(rawData) || rawData.length === 0) return rootNode;

    // Get the selected player color once and use it consistently
    const colorRadio = d3.select('input[name="player-color"]:checked').node();
    const selectedColor = colorRadio ? colorRadio.value : 'white';
    
    // 1) Filter data based on selected player color and rating
    let filteredData = rawData;
    
    // Apply rating filter if a specific range is selected
    if (selectedRating !== 'all') {
      const [minRating, maxRating] = selectedRating.split('-').map(Number);
      filteredData = filteredData.filter(d => {
        const rating = (selectedColor === 'white') ? d.white_rating : d.black_rating;
        return rating >= minRating && rating <= maxRating;
      });
    }

    // Apply ECO filter if present
    if (this.ecoFilter) {
      filteredData = filteredData.filter(d => {
        return d.opening_eco.charAt(0) === this.ecoFilter;
      });
    }
    
    // 2) For each game row, walk through moves 1 to 5.
    filteredData.forEach((row, gameIndex) => {
      // Skip games where the selected player color didn't move first (for proper perspective)
      // White always moves first in chess, so for black's perspective, we need to adjust
      let movesArr;
      
      if (selectedColor === 'white') {
        // For white's perspective, use odd-numbered moves (white moves first)
        movesArr = [row.move_1, row.move_3, row.move_5, row.move_7, row.move_9].filter(move => move && move !== '-1');
        // Define win from white's perspective
        var isSelectedPlayerWin = (row.winner === 'white');
      } else if (selectedColor === 'black') {
        // For black's perspective, use even-numbered moves (black plays second)
        movesArr = [row.move_2, row.move_4, row.move_6, row.move_8, row.move_10].filter(move => move && move !== '-1');
        // Define win from black's perspective
        var isSelectedPlayerWin = (row.winner === 'black');
      } else {
        // For 'all' perspective, use all moves in sequence
        movesArr = [row.move_1, row.move_2, row.move_3, row.move_4, row.move_5].filter(move => move && move !== '-1');
        // For 'all', we'll use white's perspective for win rate
        var isSelectedPlayerWin = (row.winner === 'white');
      }
      
      // Skip if no valid moves for this perspective
      if (movesArr.length === 0) return;
      
      let currentNode = rootNode;
      // Add this game to the root node
      rootNode.gameIds.add(gameIndex);
      
      for (let i = 0; i < movesArr.length && i < 5; i++) {
        const move = movesArr[i];
        if (!move || move === '-1') break;

        // Check if a child with this move already exists.
        let child = currentNode.children.find(c => c.name === move);
        if (!child) {
          child = {
            name: move,
            label: move,
            gameIds: new Set(), // Track unique game IDs instead of a simple counter
            wins: 0,
            eco: row.opening_eco.charAt(0),
            opening_eco: row.opening_eco,
            opening_name: row.opening_name,
            children: [],
            // Build the sequence by appending to parent's moves.
            moves: currentNode.moves ? (currentNode.moves + " " + move).trim() : move
          };
          currentNode.children.push(child);
        }
        
        // Add this game ID to the child's set
        child.gameIds.add(gameIndex);
        if (isSelectedPlayerWin && !child.winGameIds) {
          child.winGameIds = new Set();
        }
        if (isSelectedPlayerWin) {
          child.winGameIds.add(gameIndex);
        }
        
        currentNode = child;
      }
    });

    // Convert game ID sets to counts
    function processCounts(node) {
      // Set value to the number of unique games
      node.value = node.gameIds.size;
      node.wins = node.winGameIds ? node.winGameIds.size : 0;
      
      // Clean up the temporary Sets to save memory
      delete node.gameIds;
      delete node.winGameIds;
      
      if (node.children) {
        node.children.forEach(child => processCounts(child));
      }
    }
    processCounts(rootNode);

    // 3) Recursively compute winRate at each node.
    function computeWinRates(node) {
      node.winRate = node.value > 0 ? node.wins / node.value : 0;
      if (node.children) {
        node.children.forEach(child => computeWinRates(child));
      }
    }
    computeWinRates(rootNode);

    return rootNode;
  }

  renderVis() {
    const vis = this;
    // Clear any previous arcs
    vis.sunburstGroup.selectAll('.arc-path').remove();

    // Optional debug circle
    vis.sunburstGroup.append('circle')
      .attr('class', 'debug-circle')
      .attr('r', vis.innerRadius)
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4,4');

    // Prepare hierarchy from processed data
    // Don't use .sum() which would double-count values across levels
    // Instead, keep the exact values we've already calculated
    const root = d3.hierarchy(vis.processedData, d => d.children)
      .eachBefore(d => {
        // Keep the exact value we already calculated, don't sum from children
        d.value = d.data.value || 0;
      })
      .sort((a, b) => b.value - a.value);
    vis.partition(root);

    // Depth rings
    const depthScale = d3.scaleLinear()
      .domain([0, root.height])
      .range([vis.innerRadius, vis.outerRadius]);
    const levels = d3.range(root.height + 1);
    vis.sunburstGroup.selectAll('.depth-level')
      .data(levels)
      .join('circle')
      .attr('class', 'depth-level')
      .attr('r', d => depthScale(d))
      .attr('fill', 'none')
      .attr('stroke', '#eee')
      .attr('stroke-width', 1);

    // Helper function to calculate tooltip position
    const calculateTooltipPosition = function(event) {
      // Get visualization dimensions and center point
      const svgBounds = vis.svg.node().getBoundingClientRect();
      const centerX = svgBounds.left + svgBounds.width / 2;
      const centerY = svgBounds.top + svgBounds.height / 2;
      
      // Calculate tooltip position based on cursor position relative to center
      let tooltipX, tooltipY;
      
      // Determine if cursor is on left or right side of visualization
      if (event.clientX < centerX) {
        // Left side - position tooltip to the left of cursor
        tooltipX = event.pageX - 160 + 'px'; // 160px is approx tooltip width
      } else {
        // Right side - position tooltip to the right of cursor
        tooltipX = event.pageX + 15 + 'px';
      }
      
      // Determine if cursor is on top or bottom half of visualization
      if (event.clientY < centerY) {
        // Top half - position tooltip above cursor
        tooltipY = event.pageY - 100 + 'px'; // 100px approx height
      } else {
        // Bottom half - position tooltip below cursor
        tooltipY = event.pageY + 15 + 'px';
      }
      
      return { x: tooltipX, y: tooltipY };
    };

    // Show tooltip and update chessboard
    const showTooltip = function(event, node) {
      if (node.data && node.data.moves) {
        const eco = node.data.eco;
        const games = node.value;
        const winRate = node.data.winRate ? (node.data.winRate * 100).toFixed(1) : 0;
        const movesText = node.data.moves; // full sequence
        const openingName = node.data.opening_name;
        const content = `
            <div style="font-weight: bold; margin-bottom: 8px;">${movesText}</div>
            <div style="margin-bottom: 4px;">${openingName} (ECO ${eco})</div>
            <div>Games: ${d3.format(',')(games)}</div>
            <div>Win Rate: ${winRate}%</div>
          `;

        // Get tooltip position using the shared helper function
        const tooltipPos = calculateTooltipPosition(event);
        
        d3.select('.tooltip').html(content)
          .style('display', 'block')
          .style('opacity', 1)
          .style('left', tooltipPos.x)
          .style('top', tooltipPos.y);
          
        vis.updateChessboard(node.data.moves);
      }
    };

    // Move tooltip with cursor
    const moveTooltip = function(event) {
      // Get tooltip position using the shared helper function
      const tooltipPos = calculateTooltipPosition(event);
      
      d3.select('.tooltip')
        .style('left', tooltipPos.x)
        .style('top', tooltipPos.y);
    };

    // Hide tooltip and reset chessboard
    const hideTooltip = function() {
      d3.select('.tooltip')
        .style('opacity', 0)
        .style('display', 'none');
      vis.updateChessboard('');
    };

    // Handle click on node to filter
    const handleClick = function(event, clickedNode) {
      if (clickedNode.data && clickedNode.data.eco) {
        const eco = clickedNode.data.eco;

        // Toggle selection - if the same ECO is clicked again, reset the filter
        if (vis.ecoFilter === eco) {
          // Reset the filter
          const resetEvent = new CustomEvent('ecoFilter', {
            detail: { eco: null, bracket: null, source: 'sunburst-reset' }
          });
          document.dispatchEvent(resetEvent);
          vis.ecoFilter = null;
          vis.userHasSelectedEco = false;
        } else {
          // Set new filter
          vis.userHasSelectedEco = true;

          // Dispatch an event for the stacked bar chart to respond to
          const ecoFilterEvent = new CustomEvent('ecoFilter', {
            detail: { eco: eco, bracket: null, source: 'sunburst' }
          });
          document.dispatchEvent(ecoFilterEvent);
        }
      }
    };

    const path = vis.sunburstGroup.selectAll('.arc-path')
      .data(root.descendants().slice(1))
      .join('path')
      .attr('class', 'arc-path')
      .attr('d', d => {
        if (Math.abs(d.x1 - d.x0) < 0.0001 || Math.abs(d.y1 - d.y0) < 0.0001) {
          return '';
        }
        return vis.arc(d) || '';
      })
      .style('fill', d => {
        const eco = d.data && d.data.eco;
        return eco && vis.colors.highlight[eco] ? vis.colors.highlight[eco] : vis.colors.default;
      })
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer');

    // Shared function to highlight arcs and labels
    const highlightNodes = function(hoveredNode) {
      path.style('fill', d2 => {
        if (!d2.data) return vis.colors.default;
        if (d2 === hoveredNode) {
          return vis.colors.highlight[d2.data.eco] || vis.colors.default;
        }
        if (hoveredNode.ancestors().includes(d2) || d2.ancestors().includes(hoveredNode)) {
          return vis.colors.highlight[d2.data.eco] || vis.colors.default;
        }
        return vis.colors.inactive;
      })
        .style('opacity', d2 => {
          if (d2 === hoveredNode) return 1;
          if (hoveredNode.ancestors().includes(d2) || d2.ancestors().includes(hoveredNode)) {
            return 0.9;
          }
          return 0.3;
        })
        .style('stroke-width', d2 => (d2 === hoveredNode ? 2 : 1));

      // Fade labels similarly
      labelSelection.style('opacity', labelNode => {
        if (labelNode === hoveredNode) return 1;
        if (hoveredNode.ancestors().includes(labelNode) || labelNode.ancestors().includes(hoveredNode)) {
          return 0.9;
        }
        return 0.3;
      });
    };

    // Create arc labels.
    const labelSelection = vis.createArcLabels(root, showTooltip, moveTooltip, hideTooltip, handleClick, highlightNodes);

    // Mouse events for the arcs
    path.on('mouseover', function (event, hoveredNode) {
      // Highlight arcs and labels
      highlightNodes(hoveredNode);
      
      // Show tooltip using shared function
      showTooltip(event, hoveredNode);
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', function () {
      // Reset arcs and labels
      path.style('fill', d2 => {
        if (!d2.data) return vis.colors.default;
        return vis.colors.highlight[d2.data.eco] || vis.colors.default;
      })
        .style('opacity', 1)
        .style('stroke-width', 1);
      labelSelection.style('opacity', 1);
      hideTooltip();
    })
    .on('click', handleClick);

    // Reset chessboard pieces
    vis.updateChessboard('');
  }

  canFitText(d, label) {
    const angle = d.x1 - d.x0;
    const midRadius = this.innerRadius + (d.y0 + d.y1) / 2;
    const arcLength = angle * midRadius;
    const textLength = label.length * 7;
    return arcLength > textLength;
  }

  createArcLabels(root, showTooltip, moveTooltip, hideTooltip, handleClick, highlightNodes) {
    const vis = this;
    vis.g.select('g.arc-label-group').remove();

    const nodesWithLabels = root.descendants().filter(d => {
      const label = d.data.label || '';
      return d.depth > 0 && label && vis.canFitText(d, label);
    });

    const labelGroup = vis.g.append('g').attr('class', 'arc-label-group');
    const labelSelection = labelGroup.selectAll('text')
      .data(nodesWithLabels)
      .enter()
      .append('text')
      .attr('class', 'arc-label')
      .attr('transform', d => {
        const angle = (d.x0 + d.x1) / 2;
        const radius = this.innerRadius + (d.y0 + d.y1) / 2;
        const rotate = angle * 180 / Math.PI - 90;
        const flip = (angle * 180 / Math.PI) < 180 ? 0 : 180;
        return `rotate(${rotate}) translate(${radius},0) rotate(${flip})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('cursor', 'pointer')
      .text(d => d.data.label || '')
      // Use the shared helper functions for events
      .on('mouseover', (event, node) => {
        // First highlight the nodes
        highlightNodes(node);
        // Then show tooltip
        showTooltip(event, node);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip)
      .on('click', (event, node) => handleClick(event, node));

    return labelSelection;
  }

  updateChessboard(moves) {
    const vis = this;
    const position = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
      [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
      [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
      [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    if (moves) {
      // Get current player color filter
      const colorRadio = d3.select('input[name="player-color"]:checked').node();
      const selectedColor = colorRadio ? colorRadio.value : 'all';
      
      const moveList = moves.split(' ');
      
      // Handle moves differently based on player perspective
      if (selectedColor === 'white') {
        let fullSequence = [];
        const startPos = JSON.parse(JSON.stringify(position));
        
        // Simulate a game with alternating moves, but only white's moves are user-selected
        for (let i = 0; i < moveList.length; i++) {
          // Add white's move (the one user selected)
          fullSequence.push(moveList[i]);
          
          // Apply white's move to get position
          this.parseMove(moveList[i], startPos, true);
          
          // If not the last move, add a dummy black response that maintains the position
          if (i < moveList.length - 1) {
            fullSequence.push('pass');
          }
        }
        
        // Now process the full sequence with alternating colors
        let isWhiteMove = true;
        for (let i = 0; i < Math.min(fullSequence.length, 10); i++) {
          const move = fullSequence[i];
          if (move && move !== '-1' && move !== 'pass') {
            this.parseMove(move, position, isWhiteMove);
          }
          isWhiteMove = !isWhiteMove;
        }
      } else if (selectedColor === 'black') {
        // For black's perspective, we are showing only black's moves
        // Similar approach as white but reversed
        let fullSequence = [];
        const startPos = JSON.parse(JSON.stringify(position));
        
        // First dummy white move to start
        fullSequence.push('pass');
        
        // Simulate a game with alternating moves, but only black's moves are user-selected
        for (let i = 0; i < moveList.length; i++) {
          // Add black's move (the one user selected)
          fullSequence.push(moveList[i]);
          
          // Apply black's move to get position
          this.parseMove(moveList[i], startPos, false);
          
          // If not the last move, add a dummy white move that maintains the position
          if (i < moveList.length - 1) {
            fullSequence.push('pass');
          }
        }
        
        // Now process the full sequence with alternating colors
        let isWhiteMove = true;
        for (let i = 0; i < Math.min(fullSequence.length, 10); i++) {
          const move = fullSequence[i];
          if (move && move !== '-1' && move !== 'pass') {
            this.parseMove(move, position, isWhiteMove);
          }
          isWhiteMove = !isWhiteMove;
        }
      } else {
        // For 'all' perspective, process moves as a normal game with alternating turns
        let isWhiteMove = true;
        // Process all moves in the sequence (up to 8 for typical opening sequences)
        for (let i = 0; i < Math.min(moveList.length, 8); i++) {
          const move = moveList[i];
          if (move && move !== '-1') {
            // Log the move being processed for debugging
            console.log(`Processing move ${i+1}: ${move} as ${isWhiteMove ? 'white' : 'black'}`);
            // Parse and apply the move to the position
            this.parseMove(move, position, isWhiteMove);
            // Toggle player color for next move
            isWhiteMove = !isWhiteMove;
          }
        }
      }
    }

    this.g.selectAll('.piece').remove();
    const boardScaleFactor = 1.6;
    const boardSize = this.innerRadius * boardScaleFactor;
    const squareSize = boardSize / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = position[row][col];
        if (piece !== ' ') {
          this.g.append('text')
            .attr('class', 'piece')
            .attr('x', -boardSize / 2 + col * squareSize + squareSize / 2)
            .attr('y', -boardSize / 2 + row * squareSize + squareSize / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', squareSize * 0.8)
            .attr('fill', piece === piece.toUpperCase() ? '#fff' : '#000')
            .style('filter', piece === piece.toUpperCase()
              ? 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))'
              : 'none'
            )
            .text(this.pieces[piece]);
        }
      }
    }
  }

  initializeChessboard() {
    const vis = this;
    const boardScaleFactor = 1.6;
    const boardSize = this.innerRadius * boardScaleFactor;
    const squareSize = boardSize / 8;
    const board = vis.g.append('g').attr('class', 'chessboard');

    board.append('circle')
      .attr('r', boardSize / 2)
      .attr('fill', '#fff')
      .attr('stroke', '#666')
      .attr('stroke-width', '1px');

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        board.append('rect')
          .attr('x', -boardSize / 2 + col * squareSize)
          .attr('y', -boardSize / 2 + row * squareSize)
          .attr('width', squareSize)
          .attr('height', squareSize)
          .attr('fill', (row + col) % 2 === 0 ? '#d0d0d0' : '#777')
          .attr('stroke', '#666')
          .attr('stroke-width', '0.5px');
      }
    }

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    files.forEach((file, i) => {
      board.append('text')
        .attr('x', -boardSize / 2 + i * squareSize + squareSize / 2)
        .attr('y', boardSize / 2 + 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#333')
        .attr('font-size', '12px')
        .text(file);
    });
    ranks.forEach((rank, i) => {
      board.append('text')
        .attr('x', -boardSize / 2 - 15)
        .attr('y', -boardSize / 2 + i * squareSize + squareSize / 2 + 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#333')
        .attr('font-size', '12px')
        .text(rank);
    });
  }

  findPiece(position, piece, targetRow, targetCol, sourceFile, sourceRank, isWhite, isCapture) {
    const pieceChar = isWhite ? piece.toUpperCase() : piece.toLowerCase();
    let candidates = [];
    if (piece === 'P') {
      // In chess board representation (0-7 array indices):
      // - For white pawns: moving UP means DECREASING row index (direction = -1)
      // - For black pawns: moving DOWN means INCREASING row index (direction = 1)
      const direction = isWhite ? -1 : 1;
      const startRank = isWhite ? 6 : 1; // Starting rank for pawns (row 6 for white, row 1 for black)
      
      // For pawn moves with explicit source file (like exd5)
      if (sourceFile !== undefined) {
        // Look one row behind the target in the direction of pawn movement
        const sourceRow = targetRow - direction;
        if (sourceRow >= 0 && sourceRow < 8 && position[sourceRow][sourceFile] === pieceChar) {
          candidates.push({ row: sourceRow, col: sourceFile });
        }
        return candidates.length > 0 ? candidates[0] : null;
      }
      
      // CASE 1: Normal one-square pawn move
      // Look one row behind the target in the direction of pawn movement
      const oneSquareSourceRow = targetRow - direction;
      if (oneSquareSourceRow >= 0 && oneSquareSourceRow < 8 && 
          position[oneSquareSourceRow][targetCol] === pieceChar) {
        candidates.push({ row: oneSquareSourceRow, col: targetCol });
      }
      
      // CASE 2: Two-square pawn move from starting position
      // This is only possible from the pawn's starting rank
      
      // For white: moving from rank 2 (row 6) to rank 4 (row 4)
      // For black: moving from rank 7 (row 1) to rank 5 (row 3)
      const isTwoSquareMove = (isWhite && targetRow === 4) || (!isWhite && targetRow === 3);
      
      if (isTwoSquareMove) {
        // Check if there's a pawn at the starting rank in this file
        if (position[startRank][targetCol] === pieceChar) {
          // Check that the path is clear - both the target square and intermediate square
          const intermediateRow = startRank + direction;
          if (position[intermediateRow][targetCol] === ' ' && position[targetRow][targetCol] === ' ') {
            candidates.push({ row: startRank, col: targetCol });
          }
        }
      }
      // CASE 3: Pawn captures (moving diagonally)
      if (isCapture) {
        // For captures, look one row behind in diagonal squares
        const sourceRow = targetRow - direction;
        if (sourceRow >= 0 && sourceRow < 8) {
          // Check both potential diagonal source squares (left and right)
          [-1, 1].forEach(fileOffset => {
            const sourceCol = targetCol + fileOffset;
            if (sourceCol >= 0 && sourceCol < 8 && position[sourceRow][sourceCol] === pieceChar) {
              candidates.push({ row: sourceRow, col: sourceCol });
            }
          });
        }
      }
      return candidates.length > 0 ? candidates[0] : null;
    }

    // Special checks for common opening moves
    // These special cases handle standard opening positions like the Philidor Defense
    if (piece === 'N') {
      // For standard openings like Nf3 in the Philidor Defense
      // Check if this is white's knight moving to f3 (row 5, col 5) in the opening
      if (isWhite && targetRow === 5 && targetCol === 5) {
        // Check if knights are in their starting positions
        if (position[7][1] === 'N' && position[7][6] === 'N') {
          // In standard openings, kingside knight (g1) develops first
          return { row: 7, col: 6 }; // g1 knight
        }
      }
    }
    
    if (piece === 'B') {
      // For standard openings like Bc4 in the Philidor Defense
      // Check if this is white's bishop moving to c4 (row 4, col 2) in the opening
      if (isWhite && targetRow === 4 && targetCol === 2) {
        // Check if bishops are in their starting positions
        if (position[7][2] === 'B' && position[7][5] === 'B') {
          // In standard openings, kingside bishop (f1) goes to c4
          return { row: 7, col: 5 }; // f1 bishop
        }
      }
    }

    // Generate candidates by checking all pieces of the right type
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (position[r][c] === pieceChar) {
          // Check if this piece can move to the target
          let canReach = false;
          
          if (piece === 'N') {
            // Knight moves in L shape
            const rowDiff = Math.abs(targetRow - r);
            const colDiff = Math.abs(targetCol - c);
            canReach = (rowDiff === 1 && colDiff === 2) || (rowDiff === 2 && colDiff === 1);
          } else if (piece === 'B') {
            // Bishop moves diagonally
            const rowDiff = Math.abs(targetRow - r);
            const colDiff = Math.abs(targetCol - c);
            if (rowDiff === colDiff) {
              // Check if path is clear
              canReach = true;
              const rowStep = (targetRow > r) ? 1 : -1;
              const colStep = (targetCol > c) ? 1 : -1;
              for (let i = 1; i < rowDiff; i++) {
                const checkRow = r + (i * rowStep);
                const checkCol = c + (i * colStep);
                if (position[checkRow][checkCol] !== ' ') {
                  canReach = false;
                  break;
                }
              }
            }
          } else {
            // For other pieces, just check if we have source file/rank info
            canReach = true;
          }
          
          if (canReach && (sourceFile === undefined || c === sourceFile) && 
              (sourceRank === undefined || r === sourceRank)) {
            candidates.push({ row: r, col: c });
          }
        }
      }
    }

    // Apply disambiguation rules for multiple candidates
    if (candidates.length > 1) {
      if (sourceFile !== undefined) {
        const fileMatch = candidates.find(c => c.col === sourceFile);
        if (fileMatch) return fileMatch;
      }
      if (sourceRank !== undefined) {
        const rankMatch = candidates.find(c => c.row === sourceRank);
        if (rankMatch) return rankMatch;
      }
    }
    
    return candidates.length > 0 ? candidates[0] : null;
  }

  parseMove(move, position, isWhite) {

    console.log(`Parsing move: ${move} for ${isWhite ? 'white' : 'black'}`);
    console.log('Current position:', JSON.parse(JSON.stringify(position)));

    if (!move) return;
    if (move === 'O-O') {
      const row = isWhite ? 7 : 0;
      position[row][4] = ' ';
      position[row][7] = ' ';
      position[row][6] = isWhite ? 'K' : 'k';
      position[row][5] = isWhite ? 'R' : 'r';
      return;
    }
    if (move === 'O-O-O') {
      const row = isWhite ? 7 : 0;
      position[row][4] = ' ';
      position[row][0] = ' ';
      position[row][2] = isWhite ? 'K' : 'k';
      position[row][3] = isWhite ? 'R' : 'r';
      return;
    }
    
    move = move.replace(/[+#]/, '');
    let piece = 'P';
    let sourceFile, sourceRank;
    const isCapture = move.includes('x');
    let promotionPiece;
    if (move.includes('=')) {
      const parts = move.split('=');
      move = parts[0];
      promotionPiece = parts[1];
    }
    if (/^[NBRQK]/.test(move)) {
      piece = move[0];
      move = move.slice(1);
    }
    if (move.length > 2 && move[0] >= 'a' && move[0] <= 'h') {
      sourceFile = move.charCodeAt(0) - 'a'.charCodeAt(0);
      move = move.slice(1);
    }
    if (move.length > 2 && move[0] >= '1' && move[0] <= '8') {
      sourceRank = 8 - parseInt(move[0]);
      move = move.slice(1);
    }
    move = move.replace('x', '');
    const targetFile = move.charCodeAt(0) - 'a'.charCodeAt(0);
    const targetRank = 8 - parseInt(move[1]);
    if (piece === 'P' && isCapture && sourceFile === undefined) {
      sourceFile = move.charCodeAt(0) - 'a'.charCodeAt(0);
    }
    const src = this.findPiece(position, piece, targetRank, targetFile, sourceFile, sourceRank, isWhite, isCapture);
    if (src) {
      position[src.row][src.col] = ' ';
      if (promotionPiece) {
        position[targetRank][targetFile] = isWhite ? promotionPiece : promotionPiece.toLowerCase();
      } else {
        position[targetRank][targetFile] = isWhite ? piece : piece.toLowerCase();
      }
    }
  }
}