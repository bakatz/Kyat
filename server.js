//	Customization

var appPort = 8080;

// Libraries

var express = require('express'), app = express();
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , validator = require('validator');
var uuid = require('node-uuid');
var connectedUsers = {};
var numUsers = 0; //count the numUsers

// Socket.IO Options
//io.set('transports', ['xhr-polling']); // cloudflare doesn't support proxying for websockets. need to use long-polling.

// View settings
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set("view options", { layout: false })
app.use(express.static(__dirname + '/public'));


// Set up routes
app.get('/', function(req, res){
  res.render('home.ejs');
});

app.get('/about', function(req, res){
  res.render('about.ejs');
});

app.get('/feedback', function(req, res){
  res.render('feedback.ejs');
});


server.listen(appPort, "::");
console.log("Server listening on port " + appPort);

// Handle the necessary socket.io events
io.on('connection', function (socket) {
	setupSocket(socket, uuid.v4());
	numUsers++;
	broadcastNumUsers(); // Send the count to all sockets.
	socket.on('message', function (data) { // Broadcast the message to all
		var senderName = socket.username;
		var partnerSocket = socket.partner;
		var partnerName = partnerSocket.username;
		var messageObj = {
			date : new Date().toISOString(), 
			username : senderName, //TODO: add this back in when users can set their own names. validator.escape(senderName), 
			message : validator.escape(data)
		};
		console.log("trying to send message from ", senderName, " to ", partnerName, " : ", validator.escape(data));
		var partner = connectedUsers[partnerName];
		if(partner && partner.connection) {
			partner.connection.emit('message', messageObj);
		}
	});

	
/* 	socket.on('setUsername', function (username) { // Assign a name to the user
		if (typeof connectedUsers[username] === "undefined") // Test if the name is already taken
		{
			socket.username = username;
			connectedUsers[username] = {hasPartner: false, connection: socket};
			console.log("user " + username + " connected. finding partner...")
			computeRandomPartner(connectedUsers[username].connection, username);
		}
		else
		{
			socket.emit('connectionStatus', 'error') // Send the error
		}
	}); */
	
	// Handle disconnection of the client
	socket.on('disconnect', function () {
		numUsers--;
		broadcastNumUsers();
		var name = socket.username;
		if(name) {
			console.log(name, " disconnected");
			
			// if we're talking to someone, we need to notify them that we just disconnected
			if(socket.partner) {
				socket.partner.emit("connectionStatus", "stop");
			}
			delete connectedUsers[name];
		} else {
			console.log("WARNING: socket disconnected without a username set, can't remove from list");
		}
	});
});

function setupSocket(socket, username) {
	console.log("trying to set up with username: ", username, ", connectedUsers: ", connectedUsers);
	if(!connectedUsers[username]) // Test if the name is already taken
	{
		socket.username = username;
		connectedUsers[username] = {hasPartner: false, connection: socket};
		console.log("user " + username + " connected. finding partner...")
		computeRandomPartner(connectedUsers[username].connection, username);
	}
	else
	{
		socket.emit('connectionStatus', 'error') // Send the error
	}
}


function broadcastNumUsers() { // Send the count of the numUsers to all
	io.sockets.emit('numUsers', {"num": numUsers});
}

function isDefined(variable) {
	return typeof(variable) !== "undefined" && variable !== null;
}


function computeRandomPartner(socket, username) {
	var keys = Object.keys(connectedUsers);
	if(keys.length < 2) {
		return; // no one else connected yet, let the next person to click the start chatting button find this unmatched socket
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
	
	if(randomUsername && randomSock) {
		setPartner(socket, randomSock, username, randomUsername);
	}
}

function setPartner(socket, partnerSocket, username, partnerUsername) {
	socket.partner = partnerSocket;
	partnerSocket.partner = socket;
	socket.emit('connectionStatus', 'start');
	partnerSocket.emit('connectionStatus', 'start');
	
	connectedUsers[username].hasPartner = true;
	connectedUsers[partnerUsername].hasPartner = true;
	console.log("set partner done");
}
