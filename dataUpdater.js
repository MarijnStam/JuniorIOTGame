var dataJsonURL = "http://junioriotchallenge.nl/ttn_data/gamedata/nodes.json";
var gridJsonURL = "http://junioriotchallenge.nl/ttn_data/gamedata/game.json";
var gateways = [];

async function fetchJSON(fetchURL, callback){
  let dataJson;
  await fetch(fetchURL)
    .then(function(response) {
      return response.json();
  }).then(function(myJson) {
    callback(myJson);
  });
  return dataJson;
}

function updateNodeList(data){
  var nodeObjectList = [];
  for (var node in data.nodes) {
    var nodeObject = {};
    nodeObject.dev_id = data.nodes[node].dev_id;
    nodeObject.app_id = data.nodes[node].app_id;
    nodeObject.time = data.nodes[node].time;
    nodeObject.url = data.nodes[node].url;
    nodeObject.log = data.nodes[node].log;
    nodeObject.long = parseFloat(data.nodes[node].gps_lng);
    nodeObject.lat = parseFloat(data.nodes[node].gps_lat);
    nodeObject.temp = parseFloat(data.nodes[node].temp);
    nodeObject.moist = parseFloat(data.nodes[node].moist);
    nodeObject.gateways = {};
    
    nodeObjectList.push(nodeObject);
  }
  return nodeObjectList;
}

function updateGrid(data) {
  if (data === undefined) {
    throw new Error('updateGrid called with undefined');
  };

  //console.log(data);

  let grid = {
    'lat_boxsize': data.game.lat_boxsize,
    'lat_max': data.game.lat_max,
    'lat_min': data.game.lat_min,
    'lat_length': Math.ceil((data.game.lat_max-data.game.lat_min)/data.game.lat_boxsize),
    'lng_boxsize': data.game.lng_boxsize,
    'lng_max': data.game.lng_max,
    'lng_min': data.game.lng_min,
    'lng_length': Math.ceil((data.game.lng_max-data.game.lng_min)/data.game.lng_boxsize),
    'grid': data.grid
  };

  let teams = {};
  for (team_name in data.game.team_color) {
      let team_color = data.game.team_color[team_name];
      teams[team_name] = {
        'color': team_color,
        'score': data.score[team_name],
        'nodes': []
      };
  }
  for (node in data.game.node_team) {
    team = data.game.node_team[node];
    if(globalUnitsList[node] != undefined){
      globalUnitsList[node].properties.team = team;
    }
    teams[team].nodes.push(node);
  }
  return {'grid': grid, 'teams': teams}
}

function registerGateway(gateway)
{
  //Check if the passed gateway already exists in our static list of gateways
  //findIndex will either return index of object if it was matched, or -1 if it is not present
  let num = gateways.findIndex(registeredGateway => {
    //Try and match with a unique ID
    return registeredGateway.gateway_ids.eui == gateway.gateway_ids.eui;
  });

  //Gateway not found yet, push to list
  if(num == -1)
  {
    num = (gateways.push(gateway) - 1);
  }
  
  return gateways[num];
}
