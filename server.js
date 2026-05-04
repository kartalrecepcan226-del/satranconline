const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {}; 

io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
        const { roomID, token } = data;
        if (rooms[roomID]) {
            socket.emit('errorMsg', 'Bu isimde bir oda zaten var.');
        } else {
            // Artık odaları token ve socket kimlikleriyle takip ediyoruz
            rooms[roomID] = { 
                white: token, 
                black: null, 
                sockets: { white: socket.id, black: null }, 
                readyForRestart: [] 
            };
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID, isReconnect: false });
        }
    });

    socket.on('joinRoom', (data) => {
        const { roomID, token } = data;
        const room = rooms[roomID];

        if (!room) {
            return socket.emit('errorMsg', 'Oda bulunamadı.');
        }

        // BEYAZ oyuncu düşüp tekrar girerse
        if (room.white === token) {
            room.sockets.white = socket.id;
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID, isReconnect: true });
            // Odada bekleyen siyahtan oyunun güncel halini iste
            if (room.sockets.black) io.to(room.sockets.black).emit('provideSyncData', socket.id);
        } 
        // SİYAH oyuncu düşüp tekrar girerse
        else if (room.black === token) {
            room.sockets.black = socket.id;
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID, isReconnect: true });
            // Odada bekleyen beyazdan oyunun güncel halini iste
            if (room.sockets.white) io.to(room.sockets.white).emit('provideSyncData', socket.id);
        } 
        // Siyah oyuncu İLK DEFA giriyorsa
        else if (!room.black) {
            room.black = token;
            room.sockets.black = socket.id;
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID, isReconnect: false });
            io.to(roomID).emit('startGame');
        } 
        else {
            socket.emit('errorMsg', 'Oda dolu veya yetkisiz giriş.');
        }
    });

    // Bekleyen oyuncudan gelen güncel tahtayı, yeni bağlanan oyuncuya iletir
    socket.on('syncDataResponse', ({ targetSocketId, roomID, state }) => {
        io.to(targetSocketId).emit('syncGameState', state);
        io.to(roomID).emit('gameResumed');
    });

    // RÖVANŞ İSTEĞİ VE ONAYI
    socket.on('requestRestart', (roomID) => {
        const room = rooms[roomID];
        if (room) {
            if (!room.readyForRestart.includes(socket.id)) {
                room.readyForRestart.push(socket.id);
                socket.to(roomID).emit('opponentWantsRematch');
            }
            if (room.readyForRestart.length === 2) {
                room.readyForRestart = [];
                io.to(roomID).emit('startGame');
            }
        }
    });

    socket.on('move', (data) => {
        socket.to(data.roomID).emit('move', data);
    });

    socket.on('disconnect', () => {
        for (let roomID in rooms) {
            const room = rooms[roomID];
            
            if (room.sockets.white === socket.id) {
                room.sockets.white = null;
                socket.to(roomID).emit('opponentOffline');
            }
            if (room.sockets.black === socket.id) {
                room.sockets.black = null;
                socket.to(roomID).emit('opponentOffline');
            }

            room.readyForRestart = room.readyForRestart.filter(id => id !== socket.id);

            // Her iki oyuncu da çıktıysa odayı yok et (Sıfırdan temizlik)
            if (!room.sockets.white && !room.sockets.black) {
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu aktif. Çık-Gir senkronizasyonu devrede.`));