class Heatmap {

	constructor(_config, _data) {
		this.config = {
			parentElement: _config.parentElement,
			containerWidth: _config.containerWidth || 750,
			containerHeight: _config.containerHeight || 500,
			margin: _config.margin || { top: 45, right: 25, bottom: 45, left: 75 }
		}
		this.data = _data;
		this.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		this.ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

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
			.domain(vis.files)
			.padding(0.02);

		vis.yScale = d3.scaleBand()
			.range([vis.height, 0])
			.domain(vis.ranks)
			.padding(0.02);

		// Create axes
		vis.xAxis = d3.axisBottom(vis.xScale)
			.tickSizeInner(0);

		vis.yAxis = d3.axisLeft(vis.yScale)
			.tickSizeInner(0);

		// Build color scale
		vis.colorScale = d3.scaleLinear()
			.range(["rgb(255, 224, 224)", "rgb(224, 105, 105)"]);

		vis.svg = d3.select(vis.config.parentElement)
			.attr('width', vis.config.containerWidth)
			.attr('height', vis.config.containerHeight);

		// Append group element that will contain our actual chart 
		vis.chart = vis.svg.append('g')
			.attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top - 15})`);

		// Append X-axis
		vis.xAxisG = vis.chart.append('g')
			.attr('class', 'axis x-axis')
			.attr('transform', `translate(0,${vis.height})`);

		// Append Y-axis
		vis.yAxisG = vis.chart.append('g')
			.attr('class', 'axis y-axis');

		// Append X-axis label
		vis.svg.append('text')
			.text("File")
			.attr('class', 'axis-label')
			.attr('text-anchor', 'middle')
			.attr('x', vis.width / 2 + vis.config.margin.left)
			.attr('y', vis.config.containerHeight - vis.config.margin.bottom + 15);

		// Append Y-axis label
		vis.svg.append('text')
			.text("Rank")
			.attr('class', 'axis-label')
			.attr('text-anchor', 'middle')
			.attr('transform', `translate(${vis.config.margin.left - 25}, ${vis.config.containerHeight / 2}) rotate(-90)`);

		// Create a gradient legend
		vis.legendWidth = 20;
		vis.legendHeight = vis.height;

		// Append the legend container to the svg
		vis.legend = vis.svg.append('g')
			.attr('transform', `translate(${vis.config.containerWidth}, ${vis.config.margin.top - 15})`);

		// Define the gradient for the color scale
		vis.legend.append('defs')
			.append('linearGradient')
			.attr('id', 'legend-gradient')
			.attr('x1', '0%')
			.attr('x2', '0%')
			.attr('y1', '100%')
			.attr('y2', '0%')
			.selectAll('stop')
			.data(vis.colorScale.ticks(10))
			.enter()
			.append('stop')
			.attr('offset', (d, i) => `${(i / 10) * 100}%`)
			.attr('stop-color', d => vis.colorScale(d));

		// Draw the gradient bar
		vis.legend.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', vis.legendWidth)
			.attr('height', vis.legendHeight)
			.attr('stroke', '#333')
			.attr('stroke-width', '1px')
			.style('fill', 'url(#legend-gradient)');

		// Append static text labels for low and high frequency
		vis.legend.append('text')
			.attr('x', vis.legendWidth + 5)
			.attr('y', 10)
			.attr('class', 'axis-label')
			.text('- High Frequency');  // Label for the bottom

		vis.legend.append('text')
			.attr('x', vis.legendWidth + 5)
			.attr('y', vis.legendHeight - 5)
			.attr('class', 'axis-label')
			.text('- Low Frequency');  // Label for the top


		// Call update function to render the chart
		this.updateVis();
	}

	// Process the data
	updateVis() {
		let vis = this;

		let filteredData = structuredClone(vis.data); // deep clone so that further preprocessing doesn't affect vis.data

		const ratingFilter = d3.select('#rating-filter').node();
		const selectedRating = ratingFilter ? ratingFilter.value : 'all';

		const colorRadio = d3.select('input[name="player-color"]:checked').node();
		let selectedColor = null;
		if (colorRadio) {
			selectedColor = colorRadio.value;
		}

		if (selectedRating != 'all' && selectedColor != null) {
			const [minRating, maxRating] = selectedRating.split('-').map(Number);
			filteredData = filteredData.filter(d => {
				const rating = (selectedColor === 'white') ? d.white_rating : d.black_rating;
				return rating >= minRating && rating <= maxRating;
			});
		}

		// update the moves based on the selected player
		if (selectedColor === 'white') {
			filteredData.forEach(d => {
				d.moves = d.moves.filter((move, i) => (i % 2 == 0 && move.includes("+")));
			});
		} else if (selectedColor === 'black') {
			filteredData.forEach(d => {
				d.moves = d.moves.filter((move, i) => (i % 2 == 1 && move.includes("+")));
			});
		} else { // 'all' option - include checks from both players
			filteredData.forEach(d => {
				d.moves = d.moves.filter((move) => move.includes("+"));
			});
		}

		// use 0-8 so that the move can maintain the actual rank as opposed to being off by 1
		let checkCount = {
			a: Array(9).fill(0),
			b: Array(9).fill(0),
			c: Array(9).fill(0),
			d: Array(9).fill(0),
			e: Array(9).fill(0),
			f: Array(9).fill(0),
			g: Array(9).fill(0),
			h: Array(9).fill(0),
		};

		filteredData.forEach(d => {
			d.moves.forEach(move => {
				if (move.includes("=")) {
					// indicates a promotion such as "c1=Q+"
					checkCount[move.at(0)][move.at(1)] += 1;
				} else if (!move.includes("O-O")) {
					// a regular check such as "Bxc4+", we do not include castlings like O-O+
					checkCount[move.at(-3)][move.at(-2)] += 1;
				}
			})
		})

		// convert into flattened array for renderVis
		let heatmapData = [];

		Object.keys(checkCount).forEach(file => {
			for (let rank = 1; rank <= 8; rank++) {
				heatmapData.push({
					file: file,
					rank: rank.toString(),
					value: checkCount[file][rank] || 0
				});
			}
		});

		vis.colorScale.domain([0, d3.max(heatmapData, d => d.value)]);
		this.renderVis(heatmapData);
	}

	// Render the chart
	renderVis(data) {
		let vis = this;

		// Bind data to circles
		let squares = vis.chart.selectAll('.square').data(data);

		squares.enter()
			.append('rect')
			.merge(squares)
			.attr('class', 'square')
			.attr("x", d => { return vis.xScale(d.file) })
			.attr("y", d => { return vis.yScale(d.rank) })
			.attr("width", vis.xScale.bandwidth())
			.attr("height", vis.yScale.bandwidth())
			.attr("fill", d => { return vis.colorScale(d.value) })
			.on('mouseover', (event, d) => {		
				d3.select('#tooltip')
				  .style('display', 'block')
				  .style('opacity', 1)
				  .style('left', (event.pageX + 10) + 'px')
				  .style('top', (event.pageY + 10) + 'px')
				  .html(`
					<div class="tooltip-title">Square ${d.file + d.rank}</div>
					<div>Games: ${d.value}</div>
				  `);
			  })
			  .on('mousemove', (event) => {
				d3.select('#tooltip')
				  .style('left', (event.pageX + 10) + 'px')
				  .style('top', (event.pageY + 10) + 'px');
			  })
			  .on('mouseleave', () => {
				d3.select('#tooltip').style('display', 'none');
			  });

		squares.exit().remove();

		// Update axes
		vis.xAxisG.call(vis.xAxis);
		vis.yAxisG.call(vis.yAxis);
	}
}
