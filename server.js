const WebSocket = require('ws');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });
console.log('Сервер WebSocket запущен на порту ' + PORT);

let waitingPlayer = null;
let rooms = {};
let roomIdCounter = 0;

const USERS_FILE = 'users.json';
let users = {};

// Загрузка пользователей
if (fs.existsSync(USERS_FILE)) {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        console.error('Ошибка загрузки users.json', e);
    }
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

wss.on('connection', (ws) => {
    console.log('Новый игрок подключился');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register') {
                if (!data.username || !data.password) {
                    ws.send(JSON.stringify({ type: 'login_error', message: 'Пустое имя или пароль' }));
                    return;
                }
                if (users[data.username]) {
                    ws.send(JSON.stringify({ type: 'login_error', message: 'Пользователь уже существует' }));
                } else {
                    users[data.username] = { password: data.password };
                    saveUsers();
                    ws.username = data.username;
                    ws.send(JSON.stringify({ type: 'login_success', username: data.username }));
                }
            } else if (data.type === 'login') {
                if (!data.username || !data.password) {
                    ws.send(JSON.stringify({ type: 'login_error', message: 'Пустое имя или пароль' }));
                    return;
                }
                if (users[data.username] && users[data.username].password === data.password) {
                    ws.username = data.username;
                    ws.send(JSON.stringify({ type: 'login_success', username: data.username }));
                } else {
                    ws.send(JSON.stringify({ type: 'login_error', message: 'Неверное имя или пароль' }));
                }
            } else if (data.type === 'join') {
                ws.username = data.username || ws.username || "Unknown";
                ws.character = data.character || "thomas";
                
                if (waitingPlayer && waitingPlayer.readyState === WebSocket.OPEN) {
                    // Найден соперник!
                    const roomId = 'room_' + roomIdCounter++;
                    rooms[roomId] = [waitingPlayer, ws];
                    
                    waitingPlayer.roomId = roomId;
                    waitingPlayer.playerId = 1;
                    
                    ws.roomId = roomId;
                    ws.playerId = 2;
                    
                    // Уведомляем обоих игроков о старте
                    waitingPlayer.send(JSON.stringify({ 
                        type: 'start', id: 1, 
                        opponent_username: ws.username, 
                        opponent_character: ws.character 
                    }));
                    ws.send(JSON.stringify({ 
                        type: 'start', id: 2, 
                        opponent_username: waitingPlayer.username, 
                        opponent_character: waitingPlayer.character 
                    }));
                    
                    waitingPlayer = null;
                    console.log('Комната создана: ' + roomId);
                } else {
                    waitingPlayer = ws;
                    ws.send(JSON.stringify({ type: 'waiting' }));
                }
            } else if (data.type === 'update' || data.type === 'damage' || data.type === 'ability') {
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
