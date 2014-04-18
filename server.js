//	Customization

var appPort = 8080;

// Libraries

var express = require('express'), app = express();
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);
  , sanitize = require('validator').sanitize
var connectedUsers = {};

// Socket.IO Options
io.set('transports', ['xhr-polling']); // cloudflare doesn't support proxying for websockets. need to use long-polling.
io.set('log level', 1); // only log errors.

// View settings
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set("view options", { layout: false })

app.configure(function() {
	app.use(express.static(__dirname + '/public'));
});

// Render and send the main page

app.get('/', function(req, res){
  res.render('home.ejs');
});
server.listen(appPort, "::");
// app.listen(appPort);
console.log("Server listening on port " + appPort);

// Handle the socket.io connections

var numUsers = 0; //count the numUsers

io.sockets.on('connection', function (socket) { // First connection
	numUsers++;
	reloadUsers(); // Send the count to all the numUsers
	socket.on('message', function (data) { // Broadcast the message to all
		socket.get('username', function(err, senderName) {
			socket.get('partner', function(err, partnerSocket) {
				partnerSocket.get('username', function(err, partnerName) {
					var transmit = {date : new Date().toISOString(), username : sanitize(senderName).xss(), message : sanitize(data).xss()};
					console.log("Got partner name to send: ", partnerName);
					var partnerSock = connectedUsers[partnerName];
					if(typeof partnerSock !== "undefined" && partnerSock != null){
						partnerSock.emit('message', transmit);
						console.log("user ", senderName ," said ", data, " to ", partnerName);
					}
				});
			});
		});
	}
});
	
	socket.on('setUsername', function (username) { // Assign a name to the user
		if (typeof connectedUsers[username] === "undefined") // Test if the name is already taken
		{
			socket.set('username', username, function(){
				connectedUsers[username] = socket;//.push(username);
				
				console.log("user " + username + " connected. finding partner...")
				computeRandomPartner(socket);
			});
		}
		else
		{
			socket.emit('usernameStatus', 'error') // Send the error
		}
	});
	
	socket.on('disconnect', function () { // Disconnection of the client
		numUsers -= 1;
		reloadUsers();
		//if (isUsernameSet(socket))
		{
			var username;
			socket.get('username', function(err, name) {
				username = name;
			});
			delete connectedUsers[username];
		}
	});
});

function reloadUsers() { // Send the count of the numUsers to all
	io.sockets.emit('numUsers', {"num": numUsers});
}
function isUsernameSet(socket) { // Test if the user has a name
	var test;
	socket.get('username', function(err, name) {
		if (name == null ) test = false;
		else test = true;
	});
	return test;
}


function computeRandomPartner(socket) {
	var keys = Object.keys(connectedUsers);
	if(keys.length < 2) {
		return; // no one connected yet, let the next person to click the button find this guy who wasn't able to match.
	}
	
	var randomName = keys[keys.length * Math.random() << 0];
	var randomSock = connectedUsers[randomName];
	while(socket == randomSock) {
		randomSock = connectedUsers[randomName];
	}
	
	
    console.log("trying to set partner");
	setRandomPartner(socket, randomSock);
}

function setRandomPartner(socket, partner) {
	socket.set('partner', partner, function() {
		partner.set('partner', socket, function() {
		
			socket.emit('usernameStatus', 'ok');
			partner.emit('usernameStatus', 'ok');
			console.log("set partner done");
		});
	});
}
