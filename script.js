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

async function update(zoom) {
  nodes = [];
  //updates the marker positions to what the new JSON specifies
  await fetchJSON(dataJsonURL, function(json) {
    nodes = updateNodeList(json);
    createMarkerList(createNodePointsJson(nodes), true, map);
  });

  // Check if node has a log (it is a proper node if this is the case)
  // parse the gateway(s) afterwards
  for (node of nodes) {
    if(node.log != undefined)
    {
      gatewayObjects = [];
      //Fetch the gateway info by getting the raw node JSON data which contains gateway metadata
      await fetchJSON(node.url, function(json) {
        //A node can have multiple gateways, register each. 
        json.body.uplink_message.rx_metadata.forEach(gateway => {
          registeredGateway = registerGateway(gateway)
          gatewayObjects.push(registeredGateway);
        });
      });
  
      //Link the gateway objects back to the node so we can visualize this on the map (TODO LATER)
      node.gateways = gatewayObjects;

      if(document.getElementsByClassName('dropDown')[0].value === "gateways")
      {
        //Draw the connections between nodes and gateways
        drawGatewayConnections(node, true);
      }
      else
      {
        drawGatewayConnections(node, false);
      }
    }
  }

  //Make the gateway markers visible/hidden on the map
  let markers = document.getElementsByClassName("gateway");
  let visibility = (document.getElementsByClassName('dropDown')[0].value === "gateways") ? "visible" : "hidden";

  for (let i = 0; i < markers.length; i++) {
    markers[i].style.visibility = visibility;
  }

  //Show the gateways on the map
  createMarkerList(createGatewayPointsJson(gateways), true, map, true);

  //updates the grid to what the new JSON specifies
  await fetchJSON(gridJsonURL, function(json) {
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

      let color = '#ffffff';
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

function createNodePointsJson(data) {
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

function createGatewayPointsJson(data) {
  json = {
    "type": "FeatureCollection",
    "features": []
  };
  for (var i = 0; i < data.length; i++) {
    //Some gateways do not have a location property, skip these
    if (data[i].hasOwnProperty('location'))
    {
      var feature = {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [
            data[i].location.longitude,
            data[i].location.latitude
          ]
        },
        "properties": {
          "name": data[i].gateway_ids.gateway_id,
          "img": "icons/gateway.png",
          "message": "<span class='popup'>"
        + data[i].gateway_ids.gateway_id
        +"</span>"
        }
      };
      json.features.push(feature);
    }
  }
  return (json);
}

function createMarkerList(dataJson, addToMap, map, isGateway) {
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

      if(isGateway)
      {
        el.style.visibility = "hidden";
        el.className = 'gateway'
      }

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

function drawGatewayConnections(node, draw)
{
  node.gateways.forEach(gateway => {
    if(gateway.location != undefined)
    {
      if(map.getSource(node.dev_id + "-" + gateway.gateway_ids.gateway_id) == undefined)
      {
        map.addSource(node.dev_id + "-" + gateway.gateway_ids.gateway_id, {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                        [node.long, node.lat], 
                        [gateway.location.longitude, gateway.location.latitude],
                    ]
                }
            }
        });
        map.addLayer({
          'id': node.dev_id + "-" + gateway.gateway_ids.gateway_id,
          'type': 'line',
          'source': node.dev_id + "-" + gateway.gateway_ids.gateway_id,
          'layout': {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': 'visible'
          },
          'paint': {
              'line-color': '#ff0000',
              'line-width': 6,
              'line-dasharray': [0, 3]
          }
        });
      }

        let visibility = draw ? "visible" : "none";
        map.setLayoutProperty(node.dev_id + "-" + gateway.gateway_ids.gateway_id, 'visibility', visibility);
    }
  });
}