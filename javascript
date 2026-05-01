const WebSocket = require('ws');

// Хостинги выдают порт через process.env.PORT
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });
console.log('Сервер WebSocket запущен на порту ' + PORT);

let waitingPlayer = null;
let rooms = {};
let roomIdCounter = 0;

wss.on('connection', (ws) => {
    console.log('Новый игрок подключился');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join') {
                if (waitingPlayer && waitingPlayer.readyState === WebSocket.OPEN) {
                    // Найден соперник! Создаем комнату
                    const roomId = 'room_' + roomIdCounter++;
                    rooms[roomId] = [waitingPlayer, ws];
                    
                    waitingPlayer.roomId = roomId;
                    waitingPlayer.playerId = 1;
                    
                    ws.roomId = roomId;
                    ws.playerId = 2;
                    
                    // Уведомляем обоих игроков о старте
                    waitingPlayer.send(JSON.stringify({ type: 'start', id: 1 }));
                    ws.send(JSON.stringify({ type: 'start', id: 2 }));
                    
                    waitingPlayer = null;
                    console.log('Комната создана: ' + roomId);
                } else {
                    waitingPlayer = ws;
                    ws.send(JSON.stringify({ type: 'waiting' }));
                }
            } else if (data.type === 'update' || data.type === 'damage') {
                // Пересылаем сообщение другому игроку в комнате
                const roomId = ws.roomId;
                if (roomId && rooms[roomId]) {
                    const room = rooms[roomId];
                    const otherPlayer = room.find(p => p !== ws);
                    if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                        data.id = ws.playerId; // Добавляем ID отправителя
                        otherPlayer.send(JSON.stringify(data));
                    }
                }
            }
        } catch (e) {
            console.error('Ошибка парсинга сообщения', e);
        }
    });

    ws.on('close', () => {
        console.log('Игрок отключился');
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        
        if (ws.roomId && rooms[ws.roomId]) {
            const room = rooms[ws.roomId];
            const otherPlayer = room.find(p => p !== ws);
            if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                otherPlayer.send(JSON.stringify({ type: 'opponent_disconnected' }));
            }
            delete rooms[ws.roomId];
        }
    });
});
