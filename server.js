import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mysql from 'mysql2/promise';
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';

// Usar el puerto proporcionado por Render o el puerto 3000 en desarrollo
const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server);

// Conectar a la base de datos MySQL
async function connectToDatabase() {
    try {
        db = await mysql.createConnection({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD,
            database: process.env.DATABASE
        });

        console.log('Conectado a la base de datos');
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        process.exit(1); // Salir del proceso si no se puede conectar a la base de datos
    }
}

const db = await connectToDatabase();

// Middleware para parsear JSON
app.use(express.json());

// Configurar CORS para permitir solicitudes desde el dominio del frontend
app.use(cors({
    origin: 'http://stars-hunters.ctorres.cat', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Usar las rutas de autenticación
app.use('/auth', authRoutes(db));
app.use('/servers', serverRoutes(db));

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

// Crear múltiples namespaces para diferentes instancias de juego
const namespaces = {};

const createNamespace = (namespace) => {
    const nsp = io.of(namespace);
    const players = {};

    nsp.on('connection', (socket) => {
        console.log(`Nuevo jugador conectado en ${namespace}:`, socket.id);

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
            console.log(`Jugador desconectado en ${namespace}:`, socket.id);
            delete players[socket.id];
        });
    });

    namespaces[namespace] = nsp;
};

// Iniciar el servidor
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});