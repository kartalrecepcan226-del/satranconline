const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname)); 

let waitingPlayer = null; 

io.on('connection', (socket) => {
    console.log('Bir oyuncu bağlandı:', socket.id);

    if (waitingPlayer) {
        let roomName = 'room_' + waitingPlayer.id;
        socket.join(roomName); 
        waitingPlayer.join(roomName); 

        io.to(waitingPlayer.id).emit('startGame', { color: 'white' });
        io.to(socket.id).emit('startGame', { color: 'black' });

        waitingPlayer = null; 
    } else {
        waitingPlayer = socket;
        socket.emit('waiting', 'Rakip bekleniyor... Lütfen yeni bir sekme açarak bağlanın.');
    }

    socket.on('makeMove', (moveData) => {
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit('opponentMove', moveData);
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        if (waitingPlayer === socket) { waitingPlayer = null; }
    });
});

http.listen(3000, () => {
    console.log('Sunucu Başladı! Tarayıcınızdan http://localhost:3000 adresine gidin.');
});