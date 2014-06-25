
/*

// Database columns
Row ID                  ---> cartodb_id
Geolocated Address      ---> the_geom
Street address          ---> address_1
Date of Eviction        ---> date_filed
# of Units Evicted      ---> units

// Map + Animation varibales
lat, long               ---> [34.025, -118.47]

*/

$( document ).ready(function() {
  /*Tooltip showing address info*/
  var tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("z-index", "60")
    .style("visibility", "hidden")
    .text("a simple tooltip");

  /*Initialize Leaflet Map*/
  var map = new L.Map("map", {
    center: [37.7756, -122.4193],
    minZoom: 10,
    zoom: 13
  })
  .addLayer(new L.TileLayer("http://{s}.tile.cloudmade.com/1a1b06b230af4efdbb989ea99e9841af/59870/256/{z}/{x}/{y}.png"));

  /* Initialize the SVG layer */
  map._initPathRoot();   

  /* Pass map SVG layer to d3 */
  var svg = d3.select("#map").select("svg"),
  g = svg.append("g");

  /*Animation Timing Variables*/
  var startingTime = 861667200000;
  var step = 1500000000;
  var maxTime = 1357167200000;
  var inititalZoom = 13;
  var timer;
  var isPlaying = true;
  var counterTime = startingTime;

  /*Load data file and initialize coordinates*/

  var sql = new cartodb.SQL({ user: 'antievictionmappingproject', format: 'geojson'});
  /*Load from CartoDB database*/
  sql.execute("SELECT the_geom, date_filed, units, address_1 FROM {{table_name}} WHERE the_geom IS NOT NULL ORDER BY date_filed DESC", {
    table_name: 'ellis_with_address_count'})
  .done(function(collection) {
    var cumEvictions = 3709;//total number of evictions
    maxTime =  Date.parse(collection.features[0].properties.date_filed);
    console.log(maxTime);
    collection.features.forEach(function(d) {
      d.LatLng = new L.LatLng(d.geometry.coordinates[1],d.geometry.coordinates[0]);
      cumEvictions -= d.properties.units;
      d.totalEvictions = cumEvictions;
      console.log(d.properties.date_filed + " with " + d.totalEvictions);
    });

    /*Add an svg group for each data point*/
    var node = g.selectAll(".node").data(collection.features).enter().append("g");

    var feature = node.append("circle")
    .attr("r", function(d) { return d.properties.units;})
    .attr("class", "center");

    node.on("mouseover", function (d) {
      tooltip.text(d.properties.address_1);
      return tooltip.style("visibility", "visible");})
    .on("mousemove", function () { return tooltip.style("top",
      (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
    .on("click", function (d) {
      tooltip.text(d.properties.address_1);
      return tooltip.style("visibility", "visible"); })
    .on("mouseout", function () { return tooltip.style("visibility", "hidden"); });

    $( "#play" ).click(togglePlay);
    $( "#slider" ).slider({ 
      
      max: maxTime, min:counterTime, 

      start: function( event, ui ) {
        clearInterval(timer);
      }, change: function( event, ui ) {
        counterTime = $( "#slider" ).slider( "value" );
        updateCounter();
        updateMap();

      }, slide: function( event, ui ) {
        counterTime = $( "#slider" ).slider( "value" );
        updateCounter();
        updateMap();

      }, stop: function( event, ui ) {
        if(isPlaying){
          playAnimation();
        }
      }
    });

    var currDate = new Date(counterTime).getFullYear();
    playAnimation();
    map.on("viewreset", update);
    update();

    function updateCounter(){
      var totalEvictions = getTotalEvictions();
      //$('#counter').text = totalEvictions+" ";
      document.getElementById('counter').innerHTML = totalEvictions + " ";
      console.log(totalEvictions);
    }

    function updateMap(){
      node.attr("visibility", "hidden")
      /*Show all dots with date before time*/
      .filter(function(d) { return Date.parse(d.properties.date_filed) < counterTime;}) 
      .attr("visibility", "visible")
      /*Animate most recent evictions*/
      .filter(function(d) { 

        return Date.parse(d.properties.date_filed) > counterTime-step;}) 
      .append("circle")
      .attr("r", 4)
      .style("fill","red")
      .style("fill-opacity", 0.8)
      .transition()

      .duration(800)
      .ease(Math.sqrt)
      .attr("r", function(d) { return d.properties.units*30;})
      .style("fill","#f40")
      .style("fill-opacity", 1e-6)
      .remove();
          
      currDate = new Date(counterTime).getFullYear();
      var currMonth = new Date(counterTime).getMonth();
      var currDay = new Date(counterTime).getDate();
      if(currMonth===0){
        currMonth = 12;
        currDate --;
      }

      document.getElementById('date').innerHTML = "1/1/1997 - " + currMonth+"/"+currDay + "/"+currDate;
    }

    // quake();
    function getTotalEvictions(){
      for(var i = 0; i < collection.features.length; i ++){
        if(Date.parse(collection.features[i].properties.date_filed)< counterTime){
          return collection.features[i].totalEvictions;
        }
      }
      return 0;
    }
       
    /*Update slider*/
    function playAnimation(){
      counterTime = $( "#slider" ).slider( "value" );
      if(counterTime >=maxTime){
        $( "#slider" ).slider( "value", startingTime);
      }

      isPlaying = true;
      console.log("playAnimation called");
      timer = setInterval(function() {
        counterTime += step; 
        $( "#slider" ).slider( "value", counterTime);
        if(counterTime >=maxTime){
          stopAnimation(); 
        }
      },500);
    }

    function stopAnimation(){
      clearInterval(timer);
      $('#play').css('background-image', 'url(images/play.png)');
      isPlaying = false;
    }

    /*Scale dots when map size or zoom is changed*/
    function update() {
      updateMap();
      node.attr("transform", function(d) {
        return "translate(" +  map.latLngToLayerPoint(d.LatLng).x + "," + map.latLngToLayerPoint(d.LatLng).y + ") scale("+map.getZoom()/13+")";
      });
    }

    function togglePlay(){
      if(isPlaying){
        stopAnimation();
      } else {
        $('#play').css('background-image', 'url(images/pause.png)');
        playAnimation();
      }
    }
  });
});