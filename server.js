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
		if(!partnerSocket) {
			console.log("WARN: ", senderName, " tried to send a message to an undefined partner, ignoring");
			return;
		}
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
		console.log("couldn't find partner for ", username, " because no one else has connected yet. waiting for the next person to match.");
		return; // no one else connected yet, let the next person to click the start chatting button find this unmatched socket
	}
	
	var matchedUsername = null;
	var matchedSock = null;
	
	for(var i = 0; i < keys.length; i++) {
		var currUsername = keys[i];
		var currUserObj = connectedUsers[currUsername];
		var currSock = currUserObj.connection;
		if(currUserObj.hasPartner === false && currSock !== socket) {
			matchedUsername = currUsername;
			matchedSock = currSock;
			break;
		}
	}
	
	if(matchedUsername && matchedSock) {
		console.log("found partner for ", username, ": ", matchedUsername);
		setPartner(socket, matchedSock, username, matchedUsername);
	} else {
		console.log("couldn't find partner for ", username, ", waiting for next person to match.");
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
