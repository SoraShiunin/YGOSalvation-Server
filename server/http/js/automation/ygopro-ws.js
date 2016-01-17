/*jslint browser:true, plusplus : true, bitwise : true*/
/*globals WebSocket, Buffer, Uint8Array, enums, makeCard, recieveSTOC, CommandParser, Framemaker, makeCTOS*/
// buffer.js
// card.js
// gui.js

var lobby = {
    deckcheck: 0,
    draw_count: 0,
    lflist: 0,
    mode: 0,
    noshuffle: 0,
    prio: 0,
    rule: 0,
    startlp: 0,
    starthand: 0,
    timelimit: 0,
    player: {
        0: {
            name: ''
        },
        1: {
            name: ''
        },
        2: {
            name: ''
        },
        3: {
            name: ''
        }
    },
    spectators: 0
};

function parsePackets(command, message) {
    "use strict";

    var task = [],
        packet = {
            message: message.slice(1),
            readposition: 0
        };
    packet[command] = enums[command][message[0]];
    task.push(packet);
    return task;
}

function processTask(task, socket) {
    'use strict';
    var i = 0,
        l = 0,
        output = [],
        RESPONSE = false;
    for (i; task.length > i; i++) {
        output.push(recieveSTOC(task[i]));
    }

    return output;
}


/*globals console*/

function initiateNetwork(network) {
    'use strict';
    network.on('STOC_JOIN_GAME', function (STOC_JOIN_GAME) {
        //copy the object over into the model
        lobby.deckcheck = STOC_JOIN_GAME.deckcheck;
        lobby.draw_count = STOC_JOIN_GAME.draw_count;
        lobby.banlistHashCode = STOC_JOIN_GAME.banlistHashCode;
        lobby.mode = STOC_JOIN_GAME.mode;
        lobby.noshuffle = STOC_JOIN_GAME.noshuffle;
        lobby.prio = STOC_JOIN_GAME.prio;
        lobby.startlp = STOC_JOIN_GAME.startlp;
        lobby.starthand = STOC_JOIN_GAME.startlp;
        //fire handbars to render the view.
    });
    network.on('STOC_TYPE_CHANGE', function (STOC_TYPE_CHANGE) {
        lobby.ishost = STOC_TYPE_CHANGE.ishost;
    });
    network.on('STOC_HS_PLAYER_ENTER', function (STOC_HS_PLAYER_ENTER) {
        var i;
        for (i = 0; 3 > i; i++) {
            if (!lobby.player[i].name) {
                lobby.player[i].name = STOC_HS_PLAYER_ENTER.person;
                return;
            }
        }
    });
    network.on('STOC_HS_PLAYER_CHANGE', function (STOC_HS_PLAYER_CHANGE) {
        var state = STOC_HS_PLAYER_CHANGE.state,
            stateText = STOC_HS_PLAYER_CHANGE.stateText,
            pos = STOC_HS_PLAYER_CHANGE.changepos,
            previousName;
        if (STOC_HS_PLAYER_CHANGE.pos > 3) {
            return;
        }
        if (STOC_HS_PLAYER_CHANGE.state < 8) {
            previousName = String(lobby.player[pos]); //copy then delete...
            lobby.player[state].name = previousName;
            lobby.player[pos].name = '';
            lobby.player[pos].ready = false;
            console.log('???');
        } else if (stateText === 'PLAYERCHANGE_READY') {
            lobby.player[pos].ready = true;
        } else if (stateText === 'PLAYERCHANGE_NOTREADY') {
            lobby.player[pos].ready = false;
        } else if (stateText === 'PLAYERCHANGE_LEAVE') {
            lobby.player[pos].name = '';
            lobby.player[pos].ready = false;
        } else if (stateText === 'PLAYERCHANGE_OBSERVE') {
            lobby.player[pos].name = '';
            lobby.player[pos].ready = false;
            lobby.spectators++;
        }
    });
    network.on('STOC_HS_WATCH_CHANGE', function (STOC_HS_WATCH_CHANGE) {
        STOC_HS_WATCH_CHANGE.spectators = lobby.spectators;
    });
}

//"ws://192.99.11.19:8082"
function startgame(roompass) {
    'use strict';
    try {
        window.ws.close();
        window.ws = undefined;
    } catch (noWebSocket) {
        //no previous websocket so dont worry about it.
    }
    if (localStorage.nickname === undefined) {
        console.log('localStorage.nickname is undefined, required!');
        return;
    }
    var framer = new Framemaker(),
        ws = new WebSocket("ws://127.0.0.1:8082", "duel"),
        network = new CommandParser(),
        dInfo = {};
    window.activeReplayRecorde = [];
    ws.binaryType = 'arraybuffer';

    ws.onopen = function () {
        console.log('connected');

    };
    ws.onerror = function (errormessage) {
        console.log('There was an error with the websocket', errormessage);
        ws.close();
    };
    ws.onclose = function () {
        console.log('Websocket died');
    };
    ws.onmessage = function (data) {
        var q = new Buffer(new Uint8Array(data.data)),
            frame,
            task,
            newframes = 0,
            commands,
            l = 0,
            reply;

        console.log('.');
        frame = framer.input(q);
        for (newframes; frame.length > newframes; newframes++) {
            task = parsePackets('STOC', new Buffer(frame[newframes]));
            commands = processTask(task);
            l = 0;
            for (l; commands.length > l; l++) {
                /*binary code goes in and comes out as events*/
                window.activeReplayRecorde.push({
                    type: 'input',
                    action: commands[l]
                });
                console.log(commands[l]);
                network.input(commands[l]);
            }
        }
        frame = [];
    };
    ws.onopen = function () {
        console.log('Send Game request for', roompass);
        var CTOS_PlayerInfo = makeCTOS('CTOS_PlayerInfo', localStorage.nickname),
            CTOS_JoinGame = makeCTOS('CTOS_JoinGame', roompass),
            toduelist = makeCTOS('CTOS_HS_TODUELIST'),
            tosend = Buffer.concat([CTOS_PlayerInfo, CTOS_JoinGame]);
        window.activeReplayRecorde.push({
            type: 'output',
            action: tosend
        });
        window.ws.send(tosend);
    };
    window.ws = ws;
    window.onunload = window.ws.close;
    initiateNetwork(network);
}

function sendDeckListToServer(deck) {
    'use strict';
    window.ws.send(makeCTOS('CTOS_UPDATE_DECK', deck));
    window.ws.send(makeCTOS('CTOS_HS_READY'))
}

function movetoSpectator() {
    'use strict';
    var servermessage = makeCTOS('CTOS_HS_TOOBSERVER');
    console.log(servermessage);
    window.ws.send(servermessage);
}