const express = require('express');
const path = require('path');
const app = express();
const authRoutes = require('./routes/auth');

// Middleware para parsear JSON
app.use(express.json());

// Usar las rutas de autenticación
app.use('/auth', authRoutes);

// Ruta protegida (ejemplo)
app.get('/protected', (req, res) => {
    // Aquí deberías verificar si el usuario está autenticado
    const isAuthenticated = false; // Cambia esto por tu lógica de autenticación
    if (isAuthenticated) {
        res.status(200).send('Contenido protegido');
    } else {
        res.redirect('http://stars-hunters.ctorres.cat/login.html'); // Redirigir al frontend para el login
    }
});

// Manejo de conexiones de WebSocket
const players = {};
const server = require('http').createServer(app);
const io = require('socket.io')(server);

io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);

    players[socket.id] = { x: Math.random() * 800, y: Math.random() * 600, id: socket.id };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('estrella', (data) => {
        console.log(`Mensaje recibido: ${data}`);
        socket.emit('respuesta', 'Mensaje recibido en el servidor');
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
    });
});