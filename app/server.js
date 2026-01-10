const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server started on port 8080');

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Рассылаем сообщение всем подключенным клиентам
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                // Преобразуем буфер в строку перед отправкой
                client.send(message.toString());
            }
        });
    });

    // Приветственное сообщение (опционально)
    // ws.send(JSON.stringify({ sender: 'System', text: 'Добро пожаловать в чат!' }));
});