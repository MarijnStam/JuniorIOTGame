mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY292YW5zY2hhZ2VuIiwiYSI6ImNqZXVqaDAyazEzdWcyd3FrM2NreW13bnkifQ.RRq8Q73M23OFlqoZ1TKiTw';
var map;
var iconSize = [3, 3];
var iconRound = true;
var teamColorOpacity = 0.3;
var refreshTime = 5000;
var globalMarkerList = {};
var globalUnitsList = {};
var globalTeamsList = {};
var defaultGridTeam = 'gray';

function initMap() {

  if (map3d) {
    map = new mapboxgl.Map({container: "map", style: "mapbox://styles/mapbox/light-v9", pitch: 45, hash: true});
  } else {
    map = new mapboxgl.Map({container: "map", style: "mapbox://styles/marcovanschagen/cjeujr0ip0j662sqo2rttsc9z"});
  }
  map.on('style.load', function() {
    map.getCanvas().style.cursor = 'default';
    //fitbound comes in update function
    if (map3d) {
      init3d();
    }
  });

  update(true);
  window.setInterval(function() {
    update(false)
  }, refreshTime);
}

function update(zoom) {

  //updates the marker positions to what the new JSON specifies
  updateJson(dataJsonURL, function(json) {
    createMarkerList(createPointsJson(updateNodeList(json)), true, map);
  });
  //updates the grid to what the new JSON specifies
  updateJson(gridJsonURL, function(json) {
    let reternVal = updateGrid(json);
    let grid = reternVal.grid;
    let teams = reternVal.teams;
    globalTeamsList = teams;

    if (map.getSource('grid') !== undefined) {
      map.getSource('grid').setData(createGridGeoJSON(grid, teams));
    } else {
      map.addSource('grid', {
        type: 'geojson',
        data: createGridGeoJSON(grid, teams)
      });

      map.addLayer({
        "id": "grid",
        "type": "fill",
        "source": 'grid',
        "paint": {
          'fill-color': [
            'get', 'color'
          ],
          'fill-opacity': ['get', 'fill-opacity']
        }
      });
    }

    //sets the zoom to value specified in json
    if (zoom) {
      map.fitBounds([
        [
          json.game.lng_min, json.game.lat_min
        ],
        [
          json.game.lng_max, json.game.lat_max
        ]
      ]);
    }
  });

  updateScore();
}

function createGridGeoJSON(grid, teams) {
  let json = {
    'type': 'FeatureCollection',
    'features': []
  }

  for (var x = 0; x < grid.lat_length; x++) {
    for (var y = 0; y < grid.lng_length; y++) {
      var team = '';
      if (grid.grid[x] == undefined) {
        team = defaultGridTeam;
      } else if (grid.grid[x][y] == undefined) {
        team = defaultGridTeam;
      } else {
        team = grid.grid[x][y].team;
      }
      if(team == undefined){
        team = defaultGridTeam;
      }

      let color = '';
      if(document.getElementsByClassName('dropDown')[0].value === "game"){
        color = '#' + teams[team].color;
      }else if(document.getElementsByClassName('dropDown')[0].value === "temp"){
        if(grid.grid[x] != undefined && grid.grid[x][y] != undefined && grid.grid[x][y].temp != undefined ){
          let temp = grid.grid[x][y].temp;
          //color = '#' + (Math.floor((temp+10)*10)).toString(16) + "0000";
          color = perc2color((Math.floor((temp+5)*5)));
        }else{
          color = '#111111';
        }
      }else if(document.getElementsByClassName('dropDown')[0].value === "pm"){
        if(grid.grid[x] != undefined && grid.grid[x][y] != undefined && grid.grid[x][y].temp != undefined ){
          let pm = grid.grid[x][y].pm25;
          //color = '#00' + (Math.floor((pm+10)*10)).toString(16) + "00";
          color = perc2color((Math.floor((pm)*1.1)));
          if(pm === -1){
            color = '#111111'
          }
        }else{
          color = '#111111';
        }
      }

      json.features.push({
        'type': 'Feature',
        'geometry': {
          'type': 'Polygon',
          'coordinates': [
            [
              [
                grid.lng_min + y * grid.lng_boxsize,
                grid.lat_min + x * grid.lat_boxsize
              ],
              [
                grid.lng_min + y * grid.lng_boxsize + grid.lng_boxsize,
                grid.lat_min + x * grid.lat_boxsize
              ],
              [
                grid.lng_min + y * grid.lng_boxsize + grid.lng_boxsize,
                grid.lat_min + x * grid.lat_boxsize + grid.lat_boxsize
              ],
              [
                grid.lng_min + y * grid.lng_boxsize,
                grid.lat_min + x * grid.lat_boxsize + grid.lat_boxsize
              ],
              [
                grid.lng_min + y * grid.lng_boxsize,
                grid.lat_min + x * grid.lat_boxsize
              ]
            ]
          ]
        },
        'properties': {
          'color': color,
          'fill-opacity': 0.4
        }
      });
    }
  }
  return json;
}

function createPointsJson(data) {
  json = {
    "type": "FeatureCollection",
    "features": []
  };
  for (var node = 0; node < data.length; node++) {
    var feature = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          data[node].long,
          data[node].lat
        ]
      },
      "properties": {
        "name": data[node].dev_id,
        "img": "icons/" + data[node].dev_id + ".png",
        "message": "<span class='popup'>"
			+"<a target=_new href='" + data[node].url + "'>" + data[node].dev_id + "</a>" 
			+ ( data[node].time.length < 5  ? " " :
					" <a target=_new href='/graph/?application=" + data[node].app_id + "&device=" + data[node].dev_id + "'>graph</a>"
					+ " <a target=_new href='" + data[node].log + "'>log</a>" 
					+ " - " + data[node].time 
				 )
			+ "</span>",
        "time": data[node].time
      }
    };
    json.features.push(feature);
  }
  return (json);
}

function createMarkerList(dataJson, addToMap, map) {
  dataJson.features.forEach(function(marker) {
    if (globalUnitsList.hasOwnProperty(marker.properties.name)) {
      if (globalUnitsList[marker.properties.name].properties.time != marker.properties.time
        || globalUnitsList[marker.properties.name].properties.message != marker.properties.message
        || globalMarkerList[marker.properties.name]._element.style.backgroundColor != globalTeamsList[globalUnitsList[marker.properties.name].properties.team]
      ) {
        globalUnitsList[marker.properties.name].properties.time = marker.properties.time;
        globalUnitsList[marker.properties.name].properties.message = marker.properties.message;
        globalMarkerList[marker.properties.name].setLngLat(marker.geometry.coordinates);
        if(globalTeamsList[globalUnitsList[marker.properties.name].properties.team] != undefined){
          let color = globalTeamsList[globalUnitsList[marker.properties.name].properties.team].color;
          let rs = "0x" + color.charAt(0) + color.charAt(1);
          let ri = parseInt(rs);
          let gs = "0x" + color.charAt(2) + color.charAt(3);
          let gi = parseInt(gs);
          let bs = "0x" + color.charAt(4) + color.charAt(5);
          let bi = parseInt(bs);
          globalMarkerList[marker.properties.name]._element.style.backgroundColor = "rgba(" + ri + ", " + gi + ", " + bi + ", " + teamColorOpacity + ")";
        }
        var popup = new mapboxgl.Popup().setHTML(marker.properties.message);
        globalMarkerList[marker.properties.name].setPopup(popup);
      }
    } else {
      var el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = "<img width=100% height=100% src='" + marker.properties.img + "' onerror=\"javascript:this.src='icons/grey.png'\">";
      if (iconRound) {
        el.style.borderRadius = Math.min(iconSize[0], iconSize[1]) + "em"
      };
      el.style.width = iconSize[0] + 'em';
      el.style.height = iconSize[1] + 'em';

      var mapboxMarker = new mapboxgl.Marker(el);
      mapboxMarker.setLngLat(marker.geometry.coordinates);

      var popup = new mapboxgl.Popup().setHTML(marker.properties.message);
      mapboxMarker.setPopup(popup);

      // add markers to list
      globalMarkerList[marker.properties.name] = mapboxMarker;
      globalUnitsList[marker.properties.name] = marker;
      if (addToMap) {
        mapboxMarker.addTo(map)
      }
    }
  });
  return globalMarkerList;
}

function updateScore(){
  let val = "";
  let dropVal = document.getElementsByClassName('dropDown')[0].value;
  val += dropDown;

  for(key in globalTeamsList){
    if (globalTeamsList[key].score !== undefined){
      val = val + "<span style='color: #" + globalTeamsList[key].color + "'> " + globalTeamsList[key].score + " </span><br>";
    }else{
      val = val + "<span style='color: #" + globalTeamsList[key].color + "'> - </span><br>";
    }
  }
  document.getElementsByClassName("score")[0].innerHTML = val;

  document.getElementsByClassName('dropDown')[0].value = dropVal;
}

function perc2color(perc) {
	var r, g, b = 0;
	if(perc < 50) {
		r = 255;
		g = Math.round(5.1 * perc);
	}
	else {
		g = 255;
		r = Math.round(510 - 5.10 * perc);
	}
	var h = r * 0x10000 + g * 0x100 + b * 0x1;
	return '#' + ('000000' + h.toString(16)).slice(-6);
}
