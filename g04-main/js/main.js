d3.csv('data/games_preprocessed.csv')
  .then(data => {
    data.forEach((obj) => {
      obj.rated = obj.rated === "TRUE";
      obj.turns = parseInt(obj.turns);
      obj.white_rating = parseInt(obj.white_rating);
      obj.black_rating = parseInt(obj.black_rating);
      obj.moves = obj.moves.split(" ");
      obj.opening_ply = parseInt(obj.opening_ply);
      obj.white_castling_move = parseInt(obj.white_castling_move);
      obj.black_castling_move = parseInt(obj.black_castling_move);
    });

    data = data.filter(d => {
      return d.white_rating < 2700 && d.black_rating < 2700;
    })

    // Initialize the visualizations with balanced dimensions
    const heatmap = new Heatmap({
      parentElement: '#vis1 .heatmap-svg',
      containerWidth: 390,
      containerHeight: 390,
      margin: { top: 45, right: 45, bottom: 45, left: 45 }
    }, data);

    const stackedBarChart = new StackedBarChart({
      parentElement: '#vis2 .stackedBarChart-svg',
      containerWidth: 600,
      containerHeight: 390,
      margin: { top: 20, right: 60, bottom: 100, left: 75 }
    }, data);

    const sunburstChart = new SunburstChart({
      parentElement: '#vis3 .sunburstChart-svg',
      width: 800,
      height: 530,
      margin: { top: 10, right: 10, bottom: 10, left: 10 }
    });

    // Set up filter event listeners
    d3.select('#rating-filter').on('change', () => {
      const resetEvent = new CustomEvent('ecoFilter', {
        detail: { eco: null, bracket: null, source: 'rating-change-reset' }
      });
      document.dispatchEvent(resetEvent);
      
      stackedBarChart.updateVis();
      sunburstChart.updateVis();
      heatmap.updateVis();
    });

    d3.selectAll('input[name="player-color"]').on('change', () => {
      stackedBarChart.updateVis();
      sunburstChart.updateVis();
      heatmap.updateVis();
    });

    // Show the visualizations
    heatmap.updateVis();
    stackedBarChart.updateVis();
    sunburstChart.updateVis();
  })
  .catch(error => console.error(error));