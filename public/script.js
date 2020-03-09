/**
 * @fileoverview Client side script for a simple chat application developed for SENG 513 at the University of Calgary.
 * @author Emilio Alvarez Veronesi
 */

$(document).ready(function() {
    $('#message-box').focus();
    const socket = io();

    let users = [];
    let user_info = {
        id: 'nothing yet',
        name: 'Username',
        color: '#FFFFFF',
        online: 'true'
    };

    // New stylesheet which will contain all user colors.
    const style = document.createElement('style');
    document.head.appendChild(style);
    const dynamic_sheet = style.sheet;

    /**
     * Adds a user to the user list.
     *
     * @param {{id: string, name: string}} user A user object.
     */
    function appendUser(user) {
        const user_html =
            `<li class="${user.id} user">` +
                `<span class="username">${user.name}</span>` +
            '</li';
        $('#users').append(user_html);
    }

    /**
     * Appends a message to the chat box.
     *
     * @param {{text: string, timestamp: Date, user_id: string, username: string}} msg The message to append.
     */
    function appendMessage(msg) {
        const date = new Date(msg.timestamp);
        const message_html =
            `<li class="${msg.user_id} message">` +
                `<span class="username">${msg.username}</span>` +
                `<span class="timestamp">${date.toLocaleString()}</span></br>` +
                `<span class="text">${msg.text}</span>` +
            '</li>';
        $('#messages').append(message_html);
    }

    /**
     * Displays an info message to the user. Not shown to other users.
     *
     * @param {string} text The text to show the user.
     * @param {boolean} error Whether this message is an error.
     */
    function appendInfoMessage(text, error) {
        const message_type = error ? 'error' : 'info';
        const message_html =
            `<li class="${message_type}">` +
                `<span class="text">${text}</span>` +
            '</li>';
        $('#messages').append(message_html);
    }

    /**
     * Injects a style that changes the color of a user's username.
     *
     * @param {string} id ID of the user.
     * @param {string} color Hex color (with #).
     */
    function addUserColor(id, color) {
        const css_rule = `.${id} .username { color: ${color}; }`;

        dynamic_sheet.insertRule(css_rule, dynamic_sheet.cssRules.length);
    }

    /**
     * Lists all the users that are online.
     */
    function listUsers() {
        $('#users').empty();

        for (let i=0; i<users.length; i++) {
            addUserColor(users[i].id, users[i].color);

            if (users[i].online) {
                appendUser(users[i]);
            }
        }
    }

    /**
     * Snaps to the newest message.
     */
    function snapToNewest() {
        $("#messages").scrollTop($("#messages")[0].scrollHeight);
    }

    /**
     * Will keep the messages viewport at the bottom if the user is not viewing older messages.
     *
     * INCOMPLETE: Shouldn't scroll if you're viewing older messages.
     *  This is technically not a requirement, but a nice to have.
     */
    function messagesScrollToNewest() {
        // Todo: Make it scroll only when already at the bottom.
        snapToNewest();
    }

    $('form').submit(function(e) {
        // Submit a message
        e.preventDefault();
        socket.emit('new message', $('#message-box').val());
        $('#message-box').val('');
        return false;
    });

    socket.on('cookie', function() {
        // "Inspiration" from: https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
        if (document.cookie.split(';').filter(function(item) {
            return item.trim().indexOf('userid=') == 0
        }).length) {
            // Cookie exists, send it to the server
            const cookie_value = document.cookie.replace(/(?:(?:^|.*;\s*)userid\s*\=\s*([^;]*).*$)|^.*$/, "$1");
            socket.emit('cookie', cookie_value);
        }
        else {
            // The cookie does not exist send undefined to the server
            socket.emit('cookie', undefined);
        }
    });

    socket.on('user info', function(user) {
        // Received information about the user in this session
        user_info = user;
        document.cookie = `userid = ${user_info.id}; max-age = ${60*60*24*7}; path=/`;

        $('#username').html(`You are ${user.name}`);

        // Bold all the user's messages
        const css_rule = `.${user_info.id}.message { font-weight: bold; }`;
        dynamic_sheet.insertRule(css_rule, dynamic_sheet.cssRules.length);
    });

    socket.on('all users', function(users_received) {
        // Received list of all users (usually on startup)
        users = users_received;

        listUsers();
    });

    socket.on('all messages', function(messages) {
        // Received all messages (usually on startup)
        for (let i=0; i<messages.length; i++) {
            appendMessage(messages[i]);
        }

        snapToNewest();
    });

    socket.on('new message', function(msg) {
        // Some user sent a new message
        appendMessage(msg);

        messagesScrollToNewest();
    });

    socket.on('user connected', function(user) {
        // A user connected. If new add them to the list of users, or set them online. List users.
        let existing_user = users.find((x) => x.id === user.id);

        if (existing_user) {
            existing_user.online++;
        }
        else {
            users.push(user);
        }

        listUsers();
    });

    socket.on('user disconnected', function(user) {
        // A user disconnected. Set them offline. List users.
        let existing_user = users.find((x) => x.id === user.id);

        if (existing_user) {
            existing_user.online--;
        }

        listUsers();
    });

    socket.on('user updated', function(user) {
        // A user updated their information. Synchronize information. Refresh user list.
        let existing_user = users.find((x) => x.id === user.id);

        existing_user.name = user.name;
        existing_user.color = user.color;

        if (existing_user.id === user_info.id) {
            user_info = existing_user;
            $('#username').html(`You are ${user_info.name}`);
        }

        listUsers();
    });

    socket.on('name exists', function(name) {
        // The name the user tried to change to is taken.
        const message = `The nickname ${name} is already taken by another user. Please choose another nickname.`;
        appendInfoMessage(message, true);
        messagesScrollToNewest();
    });

    socket.on('name changed', function(name) {
        // The name of the user was successfully changed.
        const message = `Your nickname was changed to ${name}. Future messages will be posted under this nickname.`;
        appendInfoMessage(message, false);
        messagesScrollToNewest();
    });

    socket.on('color invalid', function(color) {
        // The color specified was invalid.
        const message = `${color} is not a valid hex color. Please input a CSS hex color.`;
        appendInfoMessage(message, true);
        messagesScrollToNewest();
    });

    socket.on('color changed', function(color) {
        // The color of the user was successfully changed.
        const message = `Your color was successfully changed to ${color}.`;
        appendInfoMessage(message, false);
        messagesScrollToNewest();
    });

    socket.on('command failure', function(command) {
        // The command the user executed does not exist.
        const message =
            `The command "${command}" does not exist. The available commands are: <br/>` +
            `&nbsp;&nbsp;&nbsp;&nbsp;/nick &ltnew nickname&gt <br/>` +
            `&nbsp;&nbsp;&nbsp;&nbsp;/nickcolor &ltCSS hex color&gt`;
        appendInfoMessage(message, true);
        messagesScrollToNewest();
    });
});
