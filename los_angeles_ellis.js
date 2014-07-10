
/*

// Database             ---> la_20combined         --->
Row ID                  ---> cartodb_id            --->
Geolocated Address      ---> the_geom              --->
Street address          ---> address               --->
Date of Eviction        ---> date_filed            --->
# of Units Evicted      ---> no_of_withdrawn_units --->

Landlord                ---> owner_name

// Hand entered Map + Animation varibales
lat, long               ---> [34.0953048,-118.265477]    --->

animationDuration       ---> 90                   --->
animationInterval       ---> 250                  --->

colorExplodeStart       ---> "red"                --->

colorExplodeFinish      ---> "#f40"               --->

finalRadiusMultiplier   --->                      --->

*/



$( document ).ready(function() {
  /*Tooltip showing address info*/

  /* Initialize animation variables. These will be generated dynamically from the cartoDB data */
  var startingTime, startingDateString, maxTime, counterTime, step, timer;
  var animationDuration = 90; // in seconds
  var animationInterval = 250; // in milliseconds
  var finalRadiusMultiplier = 1; //0.6
  var colorStaticCircle = "#f30" ;
  var colorExplodeStart = "red";
  var colorExplodeFinish = "#f40";
  var defaultZoom = 11;

  var isPlaying = false;

  var tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("z-index", "60")
    .style("visibility", "hidden")
    .text("tooltip");

  /*Initialize Leaflet Map*/
  var map = new L.Map("map", {
    center: [34.0953048,-118.265477],
    minZoom: 9,
    zoom: defaultZoom
  })
  .addLayer(new L.TileLayer("http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png"));

  /* Initialize the SVG layer */
  map._initPathRoot();

  /* Pass map SVG layer to d3 */
  var svg = d3.select("#map").select("svg"),
  g = svg.append("g");


  /*Load data file from cartoDB and initialize coordinates*/
  var sql = new cartodb.SQL({ user: 'ampitup', format: 'geojson'});
  /*Load from CartoDB database*/
  sql.execute("SELECT the_geom, address, cartodb_id, owner_name, date_filed, no_of_withdrawn_units FROM {{table_name}} WHERE NOT(the_geom IS NULL OR date_filed IS NULL OR no_of_withdrawn_units IS NULL) ORDER BY date_filed ASC", {
    table_name: 'la_20combined'})
  .done(function(collection) {

    /* Set animation variables */
    var cumEvictions = 0;
    var firstDate = new Date(collection.features[0].properties.date_filed);
    /* Sets startingTime to January 1st in the year of the first eviction */
    startingTime = new Date(firstDate.getFullYear(), 0, 1).valueOf();
    /* Text for #date above the slider widget */
    startingDateString = "1/1/" + firstDate.getFullYear();
    counterTime = startingTime;
    maxTime =  Date.parse(collection.features[(collection.features.length)-1].properties.date_filed)+4000000;
    step = Math.floor((maxTime - startingTime) / (animationDuration * (1000 / animationInterval)));

    collection.features.forEach(function (d) {
      d.LatLng = new L.LatLng(d.geometry.coordinates[1],d.geometry.coordinates[0]);
      cumEvictions += d.properties.no_of_withdrawn_units;
      d.properties.totalEvictions = cumEvictions;
    });

    /*Add an svg group for each data point*/
    var node = g.selectAll(".node").data(collection.features).enter().append("g");

    /*Static circles on map*/
    var feature = node.append("circle")
    // .attr("r", function(d) { return ((d.properties.no_of_withdrawn_units / (2 * Math.PI)) * finalRadiusMultiplier);})
    // .attr("r", function(d) { return (d.properties.no_of_withdrawn_units / 2) * finalRadiusMultiplier;})
    // .attr("r", function(d) { return (Math.pow((d.properties.no_of_withdrawn_units / 2), 0.9) * finalRadiusMultiplier) + 1.5 ;})
    .attr("r", function(d) { return (d.properties.no_of_withdrawn_units / 2 * finalRadiusMultiplier) + 1.5 ;})


    .attr("class",  "center")
    .style("stroke", colorStaticCircle);

    /*Show node info on mouseover*/
    node.on("mouseover", function (d) {
      var fullDate = d.properties.date_filed;
      var thisYear = new Date(fullDate).getFullYear();
      var currMonth = new Date(fullDate).getMonth()+1;
      var currDay = new Date(fullDate).getDate();
      var dateString = currMonth + "/" + currDay + "/" + thisYear;

      var address = d.properties.address;
      var owner = d.properties.owner_name;
      var units = d.properties.no_of_withdrawn_units;
      var addressText = "";
      var ownerText = "";

      var unitText = units + " eviction" + "<br>";
      if (units > 1) { unitText = units + " evictions" + "<br>"; }
      if (address) { addressText = address + "<br>"; }
      if (owner) { ownerText = "Landlord: " + owner + "<br>"; }


      $(".tooltip").html(unitText+addressText+ownerText+dateString);
      return tooltip.style("visibility", "visible");
    })
    .on("mousemove", function () {return tooltip.style("top",
      (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
    .on("click", function (d) {
      tooltip.text(d.properties.address);
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
       .filter(function(d) { return Date.parse(d.properties.date_filed) < counterTime;}) 
       .attr("visibility", "visible");

      /*Animate most recent evictions*/
      filtered.filter(function(d) {
        return Date.parse(d.properties.date_filed) > counterTime-step;
      }) 
      .append("circle")
      .attr("r", 4)
      .style("fill", colorExplodeStart)
      .style("fill-opacity", 0.4)
      .transition()
      .duration(800)
      .ease(Math.sqrt)
      .attr("r", function (d) {return d.properties.no_of_withdrawn_units * 10;})
      .style("fill", colorExplodeFinish)
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
      },animationInterval);
    }

    function stopAnimation(){
      clearInterval(timer);
      $('#play').css('background-image', 'url(images/play.png)');
      isPlaying = false;
    }

    /*Scale dots when map size or zoom is changed*/
    function update() {
      var up = map.getZoom()/defaultZoom;
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
