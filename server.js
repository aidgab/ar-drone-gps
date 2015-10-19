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

var io  = require('socket.io').listen(server)

io.set('destroy upgrade', false)


var drone = require('./drone');

io.sockets.on('connection', function(socket) {
  console.log('Socket.io client connected')

  socket.on('control', function(ev) { 
    console.log('[control]', JSON.stringify(ev)); 
    if(ev.action == 'animate'){
      client.animate(ev.animation, ev.duration)
    } else {
      client[ev.action].call(client, ev.speed);
    }
  })

  socket.on('takeoff', function(data){
    console.log('takeoff', data);
    drone.takeoff();
  })  
  
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
  currentLat = data.gps.latitude
  currentLon = data.gps.longitude

  currentYaw = data.demo.rotation.yaw;

  if (targetLat == null || targetLon == null || currentYaw ==  null || currentLat == null || currentLon == null) return;

  var bearing = vincenty.distVincenty(currentLat, currentLon, targetLat, targetLon)

  if(bearing.distance > 1){
    currentDistance = bearing.distance
    console.log('distance', bearing.distance)
    console.log('bearing:', bearing.initialBearing)
    targetYaw = bearing.initialBearing

    console.log('currentYaw:', currentYaw);
    var eyaw = targetYaw - currentYaw;
    console.log('eyaw:', eyaw);

    var uyaw = yawPID.getCommand(eyaw);
    console.log('uyaw:', uyaw);

    var cyaw = within(uyaw, -1, 1);
    console.log('cyaw:', cyaw);

    client.clockwise(cyaw)
    client.front(0.05)
  } else {
    targetYaw = null
    io.sockets.emit('waypointReached', {lat: targetLat, lon: targetLon})
    console.log('Reached ', targetLat, targetLon)
    stop()
  }
}

function within(x, min, max) {
  if (x < min) {
      return min;
  } else if (x > max) {
      return max;
  } else {
      return x;
  }
}
