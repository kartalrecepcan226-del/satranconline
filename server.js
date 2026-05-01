const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomID) => {
        if (!rooms[roomID]) {
            rooms[roomID] = [socket.id];
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID });
        } else if (rooms[roomID].length === 1) {
            rooms[roomID].push(socket.id);
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID });
            io.to(roomID).emit('startGame');
        } else {
            socket.emit('errorMsg', 'Bu oda dolu.');
        }
    });

    socket.on('move', (data) => {
        socket.to(data.roomID).emit('move', data);
    });

    socket.on('disconnect', () => {
        for (let roomID in rooms) {
            if (rooms[roomID].includes(socket.id)) {
                io.to(roomID).emit('opponentDisconnected');
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu aktif.`));