//	Customization

var appPort = 8080;

// Libraries

var express = require('express'), app = express();
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , validator = require('validator');
var connectedUsers = {};

// Socket.IO Options
io.set('transports', ['xhr-polling']); // cloudflare doesn't support proxying for websockets. need to use long-polling.
io.set('log level', 3); // only log errors.

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
					var transmit = {date : new Date().toISOString(), username : validator.escape(senderName), message : validator.escape(data)};
					console.log("Got partner name to send: ", partnerName);
					var partner = connectedUsers[partnerName];
					if(typeof partner !== "undefined" && partner != null && typeof partner.connection !== "undefined" && partner.connection != null) {
						partner.connection.emit('message', transmit);
						//console.log("user ", senderName ," said ", data, " to ", partnerName);
					}
				});
			});
		});
	});

	
	socket.on('setUsername', function (username) { // Assign a name to the user
		if (typeof connectedUsers[username] === "undefined") // Test if the name is already taken
		{
			socket.set('username', username, function() {
				connectedUsers[username] = {hasPartner: false, connection: socket};
				
				console.log("user " + username + " connected. finding partner...")
				computeRandomPartner(connectedUsers[username].connection, username);
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
		socket.get('username', function(err, name) {
			console.log(name, " disconnected");
			delete connectedUsers[name];
		});
	});
});

function reloadUsers() { // Send the count of the numUsers to all
	io.sockets.emit('numUsers', {"num": numUsers});
}


function computeRandomPartner(socket, username) {
	var keys = Object.keys(connectedUsers);
	if(keys.length < 2) {
		return; // no one connected yet, let the next person to click the button find this guy who wasn't able to match.
	}
	
	var randomUsername = keys[keys.length * Math.random() << 0];
	var randomSock = connectedUsers[randomUsername].connection;
	
	// if we try to match with someone who already has a partner or ourself, find another...
        var count = 0;
	while(connectedUsers[randomUsername].hasPartner || randomSock == socket || count < 10) {
		keys = Object.keys(connectedUsers);
		randomUsername = keys[keys.length * Math.random() << 0];
		randomSock = connectedUsers[randomUsername].connection;
		count++;
	}
	setRandomPartner(socket, randomSock, username, randomUsername);
}

function setRandomPartner(socket, partnerSocket, username, partnerUsername) {
	socket.set('partner', partnerSocket, function() {
		partnerSocket.set('partner', socket, function() {
			socket.emit('usernameStatus', 'ok');
			partnerSocket.emit('usernameStatus', 'ok');
			
			connectedUsers[username].hasPartner = true;
			connectedUsers[partnerUsername].hasPartner = true;
			console.log("set partner done");
		});
	});
}
