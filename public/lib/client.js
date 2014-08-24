$.fn.disable = function() {
    return this.each(function() {
        if (typeof this.disabled != "undefined") this.disabled = true;
    });
}

$.fn.enable = function() {
    return this.each(function() {
        if (typeof this.disabled != "undefined") this.disabled = false;
    });
}

$(function() {
	var socket = null;
	
	function disableButtons() {
		$("#sendButton").disable();
		$("#messageInput").disable();
		$("#messagesContainer").disable();
	}
	
	function enableButtons() {
		$("#sendButton").enable();
		$("#messageInput").enable();
		$("#messagesContainer").enable();
	}
	function addMessage(usernameStr, messageStr, timeStr) {
		$("#messagesContainer").append(timeStr + " - <span class=\"username\">" + usernameStr + ": </span><span class=\"message\">" + messageStr + "</span><br />");
		$("#messageInput").val("");
		$("#messagesContainer").slimScroll({scrollTo: Number.MAX_SAFE_INTEGER});
	}
	
	function sendMessage() {
		var usernameStr = "You";
		var messageStr = $("#messageInput").val();
		var timeStr = new Date().toLocaleString();
		addMessage(usernameStr, messageStr, timeStr);
		emitMessage(messageStr);
	}
	
	function emitMessage(messageStr) {
		socket.emit("message", messageStr);
	}
	
	
    $("#chatDiv").hide();
	disableButtons();
	
	$("#startChattingButton").click(function() {

		$("#welcomeDiv").fadeOut();
		$("#chatDiv").fadeIn();
	});

	
	$("#sendButton").click(sendMessage);
	$("#messageInput").keyup(function(event) {
		event.preventDefault();
		
		var key = event.which;
		
		// Enter key -> send message shortcut.
		if(key === 13) {
			sendMessage();
		}
	});
	
	$("#messagesContainer").slimScroll({height: 350, alwaysVisible: true});

	$("#startChattingButton").click(function() {
		socket = io.connect();
		socket.on('connect', function() {
			console.log('connected');
		});
		socket.on('numUsers', function(msg) {
			$("#numUsers").html(parseInt(msg.num) <= 0 ? "0" : ((parseInt(msg.num)-1)+""));
		});
		
		socket.on('connectionStatus', function(status) {
			if(status === "start") {
				console.log("start!");
				$("#messagesContainer").append("<strong>You are now connected with a stranger. Say hello, or click disconnect if they're too weird.</strong><br />");
				enableButtons();
			} else if(status === "stop") {
				console.log("Got partner disconnect, also sending disconnect message since we're now without a partner");
				socket.emit("disconnect");
				$("#messagesContainer").append("<strong>Your partner disconnected.</strong><br />");
				disableButtons();
			} else {
				console.log("Got connection status error: ", status);
				$("#messagesContainer").append("<strong>ERROR: You are already connected.</strong><br />");
			}
		});
		socket.on('message', function(data) {
			//addMessage(data['message'], data['username'], new Date().toISOString(), false);
			addMessage("Stranger", data["message"], new Date().toLocaleString());
			console.log("Got message: ", data['message'], " from ", data['username']);
		});
	});
});