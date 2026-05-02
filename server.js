const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('createRoom', (roomID) => {
        if (rooms[roomID]) {
            socket.emit('errorMsg', 'Bu isimde bir oda zaten var.');
        } else {
            rooms[roomID] = [socket.id];
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID });
        }
    });

    socket.on('joinRoom', (roomID) => {
        if (!rooms[roomID]) {
            socket.emit('errorMsg', 'Oda bulunamadı.');
        } else if (rooms[roomID].length >= 2) {
            socket.emit('errorMsg', 'Oda dolu.');
        } else {
            rooms[roomID].push(socket.id);
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID });
            io.to(roomID).emit('startGame');
        }
    });

    socket.on('selectPiece', (data) => {
        socket.to(data.roomID).emit('opponentSelected', data);
    });

    socket.on('move', (data) => {
        socket.to(data.roomID).emit('move', data);
    });

    socket.on('disconnect', () => {
        for (let roomID in rooms) {
            if (rooms[roomID] && rooms[roomID].includes(socket.id)) {
                io.to(roomID).emit('opponentDisconnected');
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu aktif.`));