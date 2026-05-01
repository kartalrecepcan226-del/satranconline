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
    // ODA KURMA MANTIĞI
    socket.on('createRoom', (roomID) => {
        if (rooms[roomID]) {
            // Oda zaten varsa hata gönder
            socket.emit('errorMsg', 'Bu isimde bir oda zaten var.');
        } else {
            rooms[roomID] = [socket.id];
            socket.join(roomID);
            socket.emit('playerRole', { role: 'white', roomID });
        }
    });

    // ODAYA KATILMA MANTIĞI
    socket.on('joinRoom', (roomID) => {
        if (!rooms[roomID]) {
            // Oda hiç kurulmamışsa
            socket.emit('errorMsg', 'Oda bulunamadı.');
        } else if (rooms[roomID].length >= 2) {
            // Oda mevcut ama 2 kişi varsa
            socket.emit('errorMsg', 'Oda dolu.');
        } else {
            rooms[roomID].push(socket.id);
            socket.join(roomID);
            socket.emit('playerRole', { role: 'black', roomID });
            io.to(roomID).emit('startGame'); // İkinci kişi geldiğinde maçı başlat
        }
    });

    // HAMLELERİN İLETİLMESİ
    socket.on('move', (data) => {
        // Hamleyi sadece o odadaki diğer oyuncuya gönder
        socket.to(data.roomID).emit('move', data);
    });

    // BAĞLANTI KOPMA KONTROLÜ
    socket.on('disconnect', () => {
        for (let roomID in rooms) {
            if (rooms[roomID].includes(socket.id)) {
                // Rakibi bilgilendir ve odayı temizle
                io.to(roomID).emit('opponentDisconnected');
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu 3000 portunda aktif.`));