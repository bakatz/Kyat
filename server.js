//	Customization

var appPort = 8080;

// Libraries

var express = require('express'), app = express();
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , validator = require('validator');
  
var connectedUsers = {};
var numUsers = 0; //count the numUsers

// Socket.IO Options
//io.set('transports', ['xhr-polling']); // cloudflare doesn't support proxying for websockets. need to use long-polling.

// View settings
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set("view options", { layout: false })
app.use(express.static(__dirname + '/public'));

// Render and send the main page

app.get('/', function(req, res){
  res.render('home.ejs');
});
server.listen(appPort, "::");
// app.listen(appPort);
console.log("Server listening on port " + appPort);

// Handle the socket.io connections

io.on('connection', function (socket) { // First connection
	numUsers++;
	reloadUsers(); // Send the count to all the numUsers
	socket.on('message', function (data) { // Broadcast the message to all
		var senderName = socket.username;
		var partnerSocket = socket.partner;
		var partnerName = partnerSocket.username;
		var transmit = {date : new Date().toISOString(), username : validator.escape(senderName), message : validator.escape(data)};
		console.log("Got partner name to send: ", partnerName);
		var partner = connectedUsers[partnerName];
		if(typeof partner !== "undefined" && partner !== null && typeof partner.connection !== "undefined" && partner.connection !== null) {
			partner.connection.emit('message', transmit);
		}
	});

	
	socket.on('setUsername', function (username) { // Assign a name to the user
		if (typeof connectedUsers[username] === "undefined") // Test if the name is already taken
		{
			socket.username = username;
			connectedUsers[username] = {hasPartner: false, connection: socket};
			console.log("user " + username + " connected. finding partner...")
			computeRandomPartner(connectedUsers[username].connection, username);
		}
		else
		{
			socket.emit('usernameStatus', 'error') // Send the error
		}
	});
	
	socket.on('disconnect', function () { // Disconnection of the client
		numUsers -= 1;
		reloadUsers();
		var name = socket.username;
		console.log(name, " disconnected");
		delete connectedUsers[name];
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
	console.log("trying to find partner for ", username);
	// if we try to match with someone who already has a partner or ourself, find another...
	while((connectedUsers[randomUsername].hasPartner || randomSock === socket) && keys.length >= 2) {
		var randomIndex = keys.length * Math.random() << 0;
		randomUsername = keys[randomIndex];
		randomSock = connectedUsers[randomUsername].connection;
		keys.splice(randomIndex, 1);
	}
	
	console.log("found partner for ", username, ": ", randomUsername);
	
	if(typeof(randomUsername) !== "undefined" && randomUsername !== null && typeof(randomSock) !== "undefined" && randomSock !== null) {
		setPartner(socket, randomSock, username, randomUsername);
	}
}

function setPartner(socket, partnerSocket, username, partnerUsername) {
	socket.partner = partnerSocket;
	partnerSocket.partner = socket;
	socket.emit('usernameStatus', 'ok');
	partnerSocket.emit('usernameStatus', 'ok');
	
	connectedUsers[username].hasPartner = true;
	connectedUsers[partnerUsername].hasPartner = true;
	console.log("set partner done");
}
