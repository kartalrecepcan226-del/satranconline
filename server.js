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
            // readyForRestart dizisi ile rövanş onaylarını tutuyoruz
            rooms[roomID] = { players: [socket.id], readyForRestart: [] };
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID });
        }
    });

    socket.on('joinRoom', (roomID) => {
        if (!rooms[roomID]) {
            socket.emit('errorMsg', 'Oda bulunamadı.');
        } else if (rooms[roomID].players.length >= 2) {
            socket.emit('errorMsg', 'Oda dolu.');
        } else {
            rooms[roomID].players.push(socket.id);
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID });
            io.to(roomID).emit('startGame');
        }
    });

    // RÖVANŞ İSTEĞİ VE ONAYI
    socket.on('requestRestart', (roomID) => {
        if (rooms[roomID]) {
            if (!rooms[roomID].readyForRestart.includes(socket.id)) {
                rooms[roomID].readyForRestart.push(socket.id);
                // Rakibe rövanş isteği geldiğini bildir
                socket.to(roomID).emit('opponentWantsRematch');
            }
            // Her iki oyuncu da onay verdiyse oyunu başlat (Renkler aynı kalır)
            if (rooms[roomID].readyForRestart.length === 2) {
                rooms[roomID].readyForRestart = [];
                io.to(roomID).emit('startGame');
            }
        }
    });

    // Hamle iletimi (Seçim iletimi kaldırıldı)
    socket.on('move', (data) => {
        socket.to(data.roomID).emit('move', data);
    });

    socket.on('disconnect', () => {
        for (let roomID in rooms) {
            if (rooms[roomID].players.includes(socket.id)) {
                io.to(roomID).emit('opponentDisconnected');
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu aktif.`));