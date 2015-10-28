var express   = require('express')
  , app       = express()
  , server    = require('http').createServer(app)

app.use(express.static(__dirname + '/public'));
app.use(app.router);

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/phone', function(req, res) {
  res.sendfile(__dirname + '/phone.html');
});

server.listen(8080);

require("dronestream").listen(server);

var vincenty = require('node-vincenty');
var io  = require('socket.io').listen(server)

io.set('destroy upgrade', false)

var Drone = require('./drone');
var drone = new Drone();

drone.disableEmergency();

io.sockets.on('connection', function(socket) {
  console.log('Socket.io client connected')

  socket.on('control', function(ev) { 
    console.log('[control]', JSON.stringify(ev)); 
    if(ev.action == 'animate'){
      //client.animate(ev.animation, ev.duration)
    } else {
      //client[ev.action].call(client, ev.speed);
    }
  })

  socket.on('takeoff', function(data){
    console.log('takeoff', data);
    drone.takeoff();
  });

  socket.on('go', function(data){
    console.log('going to ', data);
    targetLat = data.lat;
    targetLon = data.lon;
  });
  
  socket.on('land', function(data){
    console.log('land', data)
    drone.land();
  })
  
  socket.on('reset', function(data){
    console.log('reset', data)
    drone.disableEmergency();
  })
  socket.on('phone', function(data){
    console.log('phone', data)
    targetLat = data.lat
    targetLon = data.lon
    phoneAccuracy = data.accuracy
  })  
  socket.on('stop', function(data){
    stop()
  })  

  setInterval(function(){
    io.sockets.emit('drone', {lat: currentLat, lon: currentLon, yaw: currentYaw, distance: currentDistance, battery: battery})
    io.sockets.emit('phone', {lat: targetLat, lon: targetLon, accuracy: phoneAccuracy})
  },1000)
});

var targetLat, targetLon, targetYaw, cyaw, currentLat, currentLon,currentDistance, currentYaw, phoneAccuracy;
var battery = 0;

var stop = function(){
  console.log('stop', data)
  targetYaw = null
  targetLat = null
  targetLon = null
  drone.stop();
}

var handleNavData = function(data){
  if ( data.demo == null || data.gps == null) return;
  battery = data.demo.batteryPercentage
  //currentLat = data.gps.latitude
  //currentLon = data.gps.longitude

  //todo hardcoded stuff
  currentLat = 55.754348;
  currentLon = 48.743209;

  currentYaw = data.demo.rotation.yaw;

  if (targetLat == null || targetLon == null || currentYaw ==  null || currentLat == null || currentLon == null) return;

  var bearing = vincenty.distVincenty(currentLat, currentLon, targetLat, targetLon)

  //set the orientation
  drone.setMagnetoYaw(bearing.initialBearing);

  if(bearing.distance > 3){
    currentDistance = bearing.distance
    console.log('distance', bearing.distance)
    console.log('bearing:', bearing.initialBearing)
    //fly towards the phone
    drone.front(0.02);
  } else {
    io.sockets.emit('waypointReached', {lat: targetLat, lon: targetLon})
    console.log('Reached ', targetLat, targetLon)
    stop()
  }
};

drone.on('navdata', handleNavData);