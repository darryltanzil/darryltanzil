class StackedBarChart {
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 800,
      containerHeight: _config.containerHeight || 500,
      margin: _config.margin || { top: 40, right: 80, bottom: 80, left: 75 }
    }
    this.data = _data;
    this.selectedECO = null; // Track selected ECO category

    // Listen for ECO selection events from the sunburst chart
    document.addEventListener('ecoFilter', (event) => {
      this.selectedECO = event.detail.eco; // Will be null when reset
      this.updateVis();

      // Log action for debugging
      if (event.detail.source === 'sunburst-reset') {
        console.log('Reset ECO filter in stacked bar chart');
      }
    });

    this.initVis();
  }

  // Initialize the visualization
  initVis() {
    let vis = this;

    // Set the width/height considering margins
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Initialize scales
    vis.xScale = d3.scaleBand()
      .range([0, vis.width])
      .padding(0.1); // Padding between bars

    vis.yScale = d3.scaleLinear()
      .range([vis.height, 0]);

    vis.colorScale = d3.scaleOrdinal()
      .domain(['A', 'B', 'C', 'D', 'E'])
      .range(['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00']);

    // Initialize axes
    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale);

    // Create SVG and append chart group
    vis.svg = d3.select(vis.config.parentElement)
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    // Append group element that will contain our actual chart 
    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Append X-axis
    vis.xAxisG = vis.chart.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.height})`);

    // Append Y-axis
    vis.yAxisG = vis.chart.append('g')
      .attr('class', 'axis y-axis');

    // Append X and Y axis lebels
    vis.chart.append('text')
      .attr('class', 'axis-label')
      .attr('id', 'x-axis-label')
      .attr('y', vis.height + 60)
      .attr('x', vis.width / 2)
      .style('text-anchor', 'middle')
      .text(vis.ratingType === 'black' ? 'Black ELO Rating' : 'White ELO Rating');

    vis.chart.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -vis.height / 2)
      .style('text-anchor', 'middle')
      .text('Number of Games Played');

    // Add legend with adjusted positioning
    const legend = vis.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${vis.width + vis.config.margin.left + 10}, ${vis.config.margin.top})`);

    const ecoGroups = ['A', 'B', 'C', 'D', 'E'];

    // Create a direct color map matching the sunburst chart colors
    // IMPORTANT: This must exactly match the sunburst chart colors
    vis.sunburstColors = {
      'A': '#e41a1c', // Red
      'B': '#377eb8', // Blue
      'C': '#4daf4a', // Green
      'D': '#984ea3', // Purple
      'E': '#ff7f00'  // Orange
    };

    // Debug the color mapping
    console.log('Sunburst Colors:', vis.sunburstColors);

    ecoGroups.forEach((group, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      legendRow.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', vis.sunburstColors[group]);

      legendRow.append('text')
        .attr('x', 15)
        .attr('y', 9)
        .text(`ECO ${group}`);
    });

    // Initialize rating type
    vis.ratingType = 'black';
  }

  // Process the data
  updateVis() {
    let vis = this;

    // Get current selected player color from UI
    const colorRadio = d3.select('input[name="player-color"]:checked').node();
    vis.ratingType = colorRadio ? colorRadio.value : 'black';

    // Update the label in the chart header
    d3.select('#rating-type-label').text(vis.ratingType.charAt(0).toUpperCase() + vis.ratingType.slice(1));
    d3.select('#rating-type-label2').text(vis.ratingType.charAt(0).toUpperCase() + vis.ratingType.slice(1));

    // Update x-axis label with the correct player color
    d3.select('#x-axis-label').text(`${vis.ratingType.charAt(0).toUpperCase() + vis.ratingType.slice(1)} ELO Rating`);

    // Create rating brackets
    const ratingBrackets = [];
    for (let i = 700; i <= 2500; i += 200) {
      ratingBrackets.push(`${i}-${i + 199}`);
    }

    // Process data
    let ratingField;
    if (vis.ratingType === 'black') {
      ratingField = 'black_rating';
    } else if (vis.ratingType === 'white') {
      ratingField = 'white_rating';
    } else {
      ratingField = 'combined_rating';
      
      // Create a combined rating field (average of black and white) for each game
      vis.data.forEach(d => {
        d.combined_rating = Math.round((d.black_rating + d.white_rating) / 2);
      });
    }

    // Get current selected rating from UI
    vis.selectedRating = d3.select('#rating-filter').node().value;

    // Group data by rating bracket and ECO group
    const groupedData = d3.group(vis.data,
      d => {
        const rating = d[ratingField];
        const bracket = Math.floor((rating - 700) / 200) * 200 + 700;
        return `${bracket}-${bracket + 199}`;
      },
      d => d.opening_eco.charAt(0)
    );

    // Convert grouped data to format needed for stacking
    const stackData = ratingBrackets.map(bracket => {
      const bracketData = groupedData.get(bracket) || new Map();
      return {
        bracket,
        A: (bracketData.get('A') || []).length,
        B: (bracketData.get('B') || []).length,
        C: (bracketData.get('C') || []).length,
        D: (bracketData.get('D') || []).length,
        E: (bracketData.get('E') || []).length
      };
    });

    // Define the ECO keys in the exact order for consistent colors
    // This ensures the stack order is consistent with the visual design
    const ecoKeys = ['A', 'B', 'C', 'D', 'E'];

    // Prepare data for stacking
    // Adapted from: https://d3-graph-gallery.com/graph/barplot_stacked_basicWide.html
    const stack = d3.stack()
      .keys(ecoKeys);

    vis.stackedData = stack(stackData);

    // Update scales
    vis.xScale.domain(ratingBrackets);
    vis.yScale.domain([0, d3.max(stackData, d =>
      d.A + d.B + d.C + d.D + d.E
    )]);

    vis.renderVis();
  }

  // Render the chart
  renderVis() {
    let vis = this;

    // Add bars
    const categories = vis.chart.selectAll('.category')
      .data(vis.stackedData)
      .join('g')
      .attr('class', d => `category eco-${d.key}`)
      .style('fill', d => {
        // Direct color mapping for each ECO category
        // This ensures perfect matching with the sunburst chart
        const color = vis.sunburstColors[d.key];
        console.log(`Stack key ${d.key} gets color: ${color}`);
        return color;
      });

    // Check if we should highlight specific rating bracket
    const highlightRating = vis.selectedRating !== 'all';
    // Check if a specific ECO category is selected
    const highlightECO = vis.selectedECO !== null;

    // Apply opacity to each category based on selection - this is for the entire ECO stacks
    categories.style('opacity', d => {
      if (highlightECO && !highlightRating) {
        // Only ECO filter is active, dim other ECO categories
        return d.key === vis.selectedECO ? 1 : 0.35;
      }
      // If rating filter is active, the opacity is controlled at the rect level below
      return 1;
    });

    // Mouseover
    // Adapted from: https://d3-graph-gallery.com/graph/barplot_stacked_hover.html
    categories.selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('x', d => vis.xScale(d.data.bracket))
      .attr('y', d => vis.yScale(d[1]))
      .attr('height', d => vis.yScale(d[0]) - vis.yScale(d[1]))
      .attr('width', vis.xScale.bandwidth())
      .style('cursor', 'pointer')
      .style('opacity', function (d) {
        // We can access the current rectangle's parent (the ECO category group) through 'this'
        const parentNode = this.parentNode;
        const parentEco = d3.select(parentNode).datum().key;

        // Handle different filtering scenarios
        if (highlightRating && highlightECO) {
          // Both rating and ECO filters are active
          // Only show bars that match BOTH criteria: same rating bracket AND same ECO
          if (d.data.bracket === vis.selectedRating && parentEco === vis.selectedECO) {
            return 1; // Fully visible if matches both criteria
          } else {
            return 0.25; // Grey out if it doesn't match both criteria
          }
        } else if (highlightRating) {
          // Only rating filter is active
          return d.data.bracket === vis.selectedRating ? 1 : 0.25;
        } else if (highlightECO) {
          // Only ECO filter is active
          return parentEco === vis.selectedECO ? 1 : 0.25;
        }
        return 1; // No filters active
      })
      .style('stroke', 'white') // Use consistent white borders
      .style('stroke-width', 1) // Use consistent stroke width
      .on('mouseover', (event, d) => {
        const eco = d3.select(event.target.parentNode).datum().key;
        const count = d[1] - d[0];

        d3.select('#tooltip')
          .style('display', 'block')
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px')
          .html(`
            <div class="tooltip-title">ECO Group ${eco}</div>
            <div>Rating: ${d.data.bracket}</div>
            <div>Games: ${count}</div>
          `);
      })
      .on('mousemove', (event) => {
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('opacity', 0).style('display', 'none');
      })
      .on('click', (event, d) => {
        // Get the ECO group from the parent node's data
        const eco = d3.select(event.target.parentNode).datum().key;

        // Check if this bar is greyed out (when a rating is selected)
        const isGreyedOut = vis.selectedRating !== 'all' && d.data.bracket !== vis.selectedRating;

        // Only allow interaction if bar is not greyed out
        if (!isGreyedOut) {
          // Toggle selection - if the same ECO is already selected, reset it
          if (vis.selectedECO === eco) {
            // Reset the filter
            const resetEvent = new CustomEvent('ecoFilter', {
              detail: { eco: null, bracket: null, source: 'stackedbar-reset' }
            });
            document.dispatchEvent(resetEvent);

            // Remove highlighting
            vis.chart.selectAll('.category rect')
              .style('stroke', 'white')
              .style('stroke-width', 1);
          } else {
            // Set new filter
            const ecoFilterEvent = new CustomEvent('ecoFilter', {
              detail: { eco: eco, bracket: d.data.bracket }
            });
            document.dispatchEvent(ecoFilterEvent);

            // Highlight the clicked category, but keep all borders consistent
            vis.chart.selectAll('.category rect')
              .style('stroke', 'white')
              .style('stroke-width', 1);
          }
        }
      });

    // Update axes
    vis.xAxisG.call(vis.xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    vis.yAxisG.call(vis.yAxis);
  }
} 