/**
 * @fileoverview Server side script for a simple chat application developed for SENG 513 at the University of Calgary.
 * @author Emilio Alvarez Veronesi
 */

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const uuid = require('uuid').v4;

app.use(express.static('public'));

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

// Logic for chat
let users = [];     // {id, name, color, online}
let messages = [];  // {text, timestamp, user_id, username}
let current_user_name = 0;

/**
 * Create a new user.
 *
 * @returns {object} A user object.
 */
function createUser() {
    const user = {};

    // Generate an id, name, set default color and status
    user.id = 'id' + uuid(); // Prepend 'id' to allow dynamic style injection
    user.name = 'User' + current_user_name++;
    user.color = '#FFFFFF';
    user.online = 0;

    return user;
}

/**
 * Creates a message object for the user and text specified.
 *
 * @param {{id: string, name: string}} user The user that created the message.
 * @param {string} msg The message text.
 * @returns {{text: string, timestamp: Date, user_id: string, username: string}} A message object.
 */
function createMessage(user, msg) {
    const date = new Date();

    const message = {
        text: msg,
        timestamp: date,
        user_id: user.id,
        username: user.name
    };

    return message;
}

/**
 * Change the nickname of the specified user if the name is not taken.
 *
 * @param {{name: string}} user The user that changed their name.
 * @param {string} new_name The name the user changed to.
 * @returns {number} 0 if the name was changed, 1 if the name exists, 2 if error.
 */
function changeNickname(user, new_name) {
    if (!new_name) return 2;

    let existing_user = users.find((x) => x.name === new_name);

    if (existing_user) {
        // Name already exists, don't change name
        return 1;
    }
    else {
        // Change nickname
        console.log(`${user.name} changed nickname to ${new_name}`);
        user.name = new_name;
        return 0;
    }
}

/**
 * Change the color of the specified user if the color is valid.
 *
 * @param {{color: string}} user The user object to update.
 * @param {string} new_color A hex color value.
 * @returns {number} 0 if the color was changed, 1 if the color is invalid, 2 if error.
 */
function changeColor(user, new_color) {
    if (!new_color) return 2;

    // Let the user type in just the hex, without the hash.
    if (new_color && new_color.charAt(0) !== '#') {
        new_color = '#' + new_color;
    }

    const hexreg = new RegExp(/^#([0-9a-fA-F]{3}){1,2}$/); // Taken from: https://stackoverflow.com/a/8027444
    const result = hexreg.test(new_color);

    if (result) {
        // valid color, change it
        console.log(`${user.name} changed color to ${new_color}`);
        user.color = new_color;
        return 0;
    }
    else {
        // This is an invalid color
        return 1;
    }
}

/**
 * Execute a command in a message.
 *
 * @param {string} message The message containing the command.
 * @param {{name: string, color: string}} user The user who executed a command.
 * @param {object} socket A socket.io socket.
 */
function executeCommand(message, user, socket) {
    const splitMessage = message.split(' ');

    if (splitMessage[0] === '/nick') {
        const result = changeNickname(user, splitMessage[1]);

        if (result === 2) {
            // Invalid command
            socket.emit('command failure', splitMessage[0] + ' undefined');
        }
        else if (result === 1) {
            socket.emit('name exists', splitMessage[1]);
        }
        else if (result === 0) {
            io.emit('user updated', user);
            socket.emit('name changed', splitMessage[1]);
        }
    }
    else if (splitMessage[0] === '/nickcolor') {
        const result = changeColor(user, splitMessage[1]);

        if (result === 2) {
            // Invalid command
            socket.emit('command failure', splitMessage[0] + ' undefined');
        }
        else if (result === 1) {
            socket.emit('color invalid', splitMessage[1]);
        }
        else if (result === 0) {
            io.emit('user updated', user);
            socket.emit('color changed', splitMessage[1]);
        }
    }
    else {
        // Invalid command
        socket.emit('command failure', splitMessage[0]);
    }
}

io.on('connection', function(socket) {
    let user;
    socket.emit('cookie'); // Get the user's cookie

    socket.on('cookie', function(cookie_value) {
        const found = users.find((x) => {return x.id === cookie_value});
        user = found || createUser();
        user.online++;

        socket.emit('user info', user);         // Send the user their information
        socket.emit('all users', users);        // Send all users
        socket.emit('all messages', messages);  // Send all the messages

        if (!found) {
            users.push(user);
        }
        io.emit('user connected', user);        // Send the user that connected to all users

        console.log(`${user.name} connected`);
    });

    socket.on('new message', function(msg) {
        if (msg === '') return;

        let first_char = msg.charAt(0);

        if (first_char === '/') {
            executeCommand(msg, user, socket);
        }
        else {
            let message = createMessage(user, msg);
            messages.push(message);
            io.emit('new message', message);

            console.log(`${message.timestamp}: ${message.username}: ${message.text}`);
        }
    });

    socket.on('disconnect', function() {
        user.online--;
        io.emit('user disconnected', user);
        console.log(`${user.name} disconnected`);
    });
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});
