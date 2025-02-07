import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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
const io = new Server(server, {
    cors: {
        origin: 'http://stars-hunters.ctorres.cat',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool;

// Conectar a la base de datos MySQL
async function connectToDatabase() {
    try {
        pool = mysql.createPool({
            host: process.env.HOST,
            user: process.env.USER,
            password: process.env.PASSWORD,
            database: process.env.DATABASE,
            waitForConnections: true,
            connectionLimit: 10, // Ajusta este valor según tus necesidades
            queueLimit: 0
        });

        console.log('Conectado a la base de datos');
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        process.exit(1); // Salir del proceso si no se puede conectar a la base de datos
    }
}

await connectToDatabase();

// Middleware para parsear JSON
app.use(express.json());

// Configurar CORS para permitir solicitudes desde el dominio del frontend
app.use(cors({
    origin: 'http://stars-hunters.ctorres.cat',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.options('*', cors());

// Servir el archivo socket.io.js desde node_modules
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist')));

// Usar las rutas de autenticación
app.use('/auth', authRoutes(pool));
app.use('/servers', serverRoutes(pool));

// Crear múltiples namespaces para diferentes instancias de juego
const namespaces = {};

export const createNamespace = (namespace) => {
    const nsp = io.of(namespace);
    const gameState = {
        estrellas: generarEstrellas(),
        players: {}
    };

    nsp.on('connection', (socket) => {
        console.log(`Nuevo jugador conectado en ${namespace}: ${socket.id}`);

        // Asignar posición inicial aleatoria al nuevo jugador
        gameState.players[socket.id] = {
            x: Math.random() * 800,
            y: Math.random() * 600,
            id: socket.id
        };

        // Emitir estado inicial al jugador
        socket.emit('gameState', gameState);

        // Notificar a otros jugadores sobre el nuevo jugador
        socket.broadcast.emit('newPlayer', gameState.players[socket.id]);

        // Manejo de movimiento
        socket.on('move', (data) => {
            if (gameState.players[socket.id]) {
                gameState.players[socket.id].x = data.x;
                gameState.players[socket.id].y = data.y;
                // Emitir solo a jugadores cercanos
                Object.values(gameState.players).forEach(p => {
                    if (Math.abs(gameState.players[socket.id].x - p.x) < 500 && Math.abs(gameState.players[socket.id].y - p.y) < 500) {
                        socket.to(p.id).emit('playerMoved', gameState.players[socket.id]);
                    }
                });
            }
        });

        // Manejo de desconexión
        socket.on('disconnect', () => {
            console.log(`Jugador desconectado en ${namespace}: ${socket.id}`);
            socket.broadcast.emit('playerDisconnected', socket.id);
            delete gameState.players[socket.id];
            nsp.emit('gameState', gameState);
        });
    });

    namespaces[namespace] = nsp;
};

// Función para generar estrellas en posiciones aleatorias
function generarEstrellas() {
    return Array.from({ length: 10 }, () => ({
        x: Math.random() * 800,
        y: Math.random() * 600
    }));
}

// Aumentar los valores de keepAliveTimeout y headersTimeout
server.keepAliveTimeout = 120 * 1000; // 120 segundos
server.headersTimeout = 120 * 1000; // 120 segundos

// Iniciar el servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
