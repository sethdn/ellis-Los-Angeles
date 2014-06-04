
$( document ).ready(function() {
  /*Tooltip showing address info*/
  var tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("z-index", "60")
    .style("visibility", "hidden")
    .text("tooltip");

  /*Initialize Leaflet Map*/
  var map = new L.Map("map", {
    center: [34.025, -118.47],
    minZoom: 10,
    zoom: 13
  })
  .addLayer(new L.TileLayer("http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png"));

  /* Initialize the SVG layer */
  map._initPathRoot();

  /* Pass map SVG layer to d3 */
  var svg = d3.select("#map").select("svg"),
  g = svg.append("g");

  /*Animation Timing Variables*/
  // starting time = 507628800000
  // max time 1385668800000

  var startingTime, startingDateString, maxTime, counterTime, timer;
  var step = 1500000000;
  var isPlaying = false;

  //notes from tara: the fields that we are getting from cartodb are not necessarily the right fields, 
  //I was just experimenting with those. so, no_units_on_property and eviction_date probably need to be substituteds

  /*Load data file from cartoDB and initialize coordinates*/
  var sql = new cartodb.SQL({ user: 'ampitup', format: 'geojson'});
  /*Load from CartoDB database*/
  sql.execute("SELECT the_geom, bldg_number_street, cartodb_id, eviction_date, no_units_on_property FROM {{table_name}} WHERE NOT(the_geom IS NULL OR eviction_date IS NULL OR no_units_on_property IS NULL) ORDER BY eviction_date ASC", {
    table_name: 'santa_monica_ellis'})
  .done(function(collection) {
    var cumEvictions = 0;
    // sets starting time to January 1st in the year of the first eviction
    var firstDate = new Date(collection.features[0].properties.eviction_date);
    startingTime = new Date(firstDate.getFullYear(), 0, 1).valueOf();
    // for the #date text on the slider widget
    startingDateString = firstDate.getFullYear() +"/1/1";
    counterTime = startingTime;

    maxTime =  Date.parse(collection.features[(collection.features.length)-1].properties.eviction_date)+4000000;
    collection.features.forEach(function (d) {
      d.LatLng = new L.LatLng(d.geometry.coordinates[1],d.geometry.coordinates[0]);
      cumEvictions += d.properties.no_units_on_property;
      d.properties.totalEvictions = cumEvictions;
    });

     /*Add an svg group for each data point*/
    var node = g.selectAll(".node").data(collection.features).enter().append("g");

    var feature = node.append("circle")
    .attr("r", function(d) { return d.properties.no_units_on_property;})
    .attr("class",  "center")
    .style("stroke", function(d) { 
      if(d.properties.type == "OMI") {
        return "#606";
      } else if (d.properties.type == "DEMO") {
        return "#066";
      }
      return "#f30";
    });

    /*show node info on mouseover*/
    node.on("mouseover", function (d) {
      var fullDate = d.properties.eviction_date;
      var thisYear = new Date(fullDate).getFullYear();
      var currMonth = new Date(fullDate).getMonth()+1;
      var currDay = new Date(fullDate).getDate();
      var units = d.properties.no_units_on_property;
      var unitText = units + " eviction";
      if (units > 1) {
        unitText = units + " evictions";
      }
      var dateString = currMonth+"/"+currDay + "/"+thisYear;
      $(".tooltip").html(d.properties.bldg_number_street+ "<br>"+unitText+"<br>"+dateString);
      return tooltip.style("visibility", "visible");
    })
    .on("mousemove", function () {return tooltip.style("top",
      (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
    .on("click", function (d) {
      tooltip.text(d.properties.bldg_number_street);
      return tooltip.style("visibility", "visible");})
    .on("mouseout", function(){return tooltip.style("visibility", "hidden");});

     /*Initialize play button and slider*/
    $( "#play" ).click(togglePlay);
    $( "#slider" ).slider({
      min: startingTime, max: maxTime, value: maxTime, step: step, 

      start: function( event, ui ) {
        clearInterval(timer);
      }, change: function( event, ui ) {
        counterTime = $( "#slider" ).slider( "value" );
        filterCurrentPoints();
      }, slide: function( event, ui ) {
        counterTime = $( "#slider" ).slider( "value" );
        filterCurrentPoints();
      }, stop: function( event, ui ) {
        if (isPlaying) {
          playAnimation();
        }
        filterCurrentPoints();
      }
    });

     /*Starting setup*/
    var currDate = new Date(counterTime).getFullYear();
    //stopAnimation();
    filterCurrentPoints();
    map.on("zoomend", update);
    update();
    playAnimation();

      /*Filter map points by date*/
    function filterCurrentPoints(){
       var filtered = node.attr("visibility", "hidden")
       .filter(function(d) { return Date.parse(d.properties.eviction_date) < counterTime;}) 
       .attr("visibility", "visible");
      // console.log(JSON.stringify(filtered[0]));
      // updateCounter(filtered[0].length-1);
      filtered.filter(function(d) { 
        return Date.parse(d.properties.eviction_date) > counterTime-step;
      }) 
      .append("circle")
      .attr("r", 4)
      .style("fill","red")
      .style("fill-opacity", 0.8)
      .transition()

      .duration(800)
      .ease(Math.sqrt)
      .attr("r", function (d) {return d.properties.no_units_on_property*30;})
      .style("fill","#f40")
      .style("fill-opacity", 1e-6)
      .remove();
      updateCounter(filtered[0].length-1);
    }

    /*Update map counters*/
    function updateCounter(index){
      var totalEvictions = 0;
      if (index<1) {} else {
       var props = collection.features[index].properties;
       totalEvictions = props.totalEvictions;
      }
      document.getElementById('counter').innerHTML =totalEvictions + " ";

      currDate = new Date(counterTime).getFullYear();
      var currMonth = new Date(counterTime).getMonth()+1;
      var currDay = new Date(counterTime).getDate();
     
      document.getElementById('date').innerHTML = startingDateString +" - "+ currMonth+"/"+currDay + "/"+currDate;
    }

    /*Update slider*/
    function playAnimation(){
      counterTime = $( "#slider" ).slider( "value" );
      if(counterTime >=maxTime){
        $( "#slider" ).slider( "value", startingTime);
      }
      isPlaying = true;
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
        var up = map.getZoom()/13;
        node.attr("transform", function (d) {
          return "translate(" + map.latLngToLayerPoint(d.LatLng).x + "," + 
            map.latLngToLayerPoint(d.LatLng).y + ") scale("+up+")";});
      }

      /*called when play/pause button is pressed*/
      function togglePlay(){
        if(isPlaying){
          stopAnimation();
        } else {
          $('#play').css('background-image', 'url(images/pause.png)');
          playAnimation();
        }
      }
    });

  /*Show info about on mouseover*/
  $( ".popup" ).hide();
  $( ".triggerPopup" ).mouseover(function(e) {
    $( ".popup" ).position();
    var id = $(this).attr('id');
    if(id=="ellis"){
      $( "#ellisPopup" ).show();
    } else if (id=="omi"){
      $( "#omiPopup" ).show();
    } else {
      $( "#demoPopup" ).show();
    }
    $('.popup').css("top", e.pageY+20);
  });

  $( ".triggerPopup" ).on("mouseout", function(){ $( ".popup" ).hide();});
});
