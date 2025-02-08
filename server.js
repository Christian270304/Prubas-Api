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
const PORT = process.env.PORT || 8080;

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
const gameStates = {}; // Guardará el estado de cada namespace

export const createNamespace = (namespace) => {
    const nsp = io.of(namespace);
    const gameState = {
        estrellas: generarEstrellas(),
        players: new Map() // Usamos Map para un acceso más rápido
    };

    gameStates[namespace] = gameState; // Guardar el estado globalmente

    nsp.on('connection', (socket) => {
        console.log(`Nuevo jugador conectado en ${namespace}: ${socket.id}`);

        // Asignar posición inicial aleatoria al nuevo jugador
        gameState.players.set(socket.id, {
            x: Math.random() * 800,
            y: Math.random() * 600,
            id: socket.id
        });
        console.log('Estado actual de jugadores:', gameState.players); 
        // Emitir estado inicial al jugador (incluyendo jugadores y estrellas)
        socket.emit('gameState', {
            estrellas: gameState.estrellas,
            players: Object.fromEntries(gameState.players) // Convertimos el Map a un objeto
        });

        // Notificar a otros jugadores sobre el nuevo jugador
        socket.broadcast.emit('newPlayer', gameState.players.get(socket.id));

        // Emitir la lista completa de jugadores a los demás
        gameState.players.forEach((player, id) => {
            if (id !== socket.id) {
                socket.emit('newPlayer', player);
            }
        });

        // Manejo de movimiento
        socket.on('move', (data) => {
            if (gameState.players.has(socket.id)) {
                const player = gameState.players.get(socket.id);
                player.x = data.x;
                player.y = data.y;

                // Emitir solo a jugadores cercanos
                gameState.players.forEach((p, id) => {
                    if (Math.abs(player.x - p.x) < 500 && Math.abs(player.y - p.y) < 500) {
                        socket.to(id).emit('playerMoved', player);
                    }
                });
            }
        });

        // Manejo de desconexión
        socket.on('disconnect', () => {
            console.log(`Jugador desconectado en ${namespace}: ${socket.id}`);
            socket.broadcast.emit('playerDisconnected', socket.id);
            gameState.players.delete(socket.id);
            nsp.emit('gameState', gameState); // Actualizar a todos los jugadores
        });
    });

    namespaces[namespace] = nsp;

    // Emisión periódica del estado del juego a todos los jugadores (30Hz, 33ms)
    setInterval(() => {
        // Solo emite si hay cambios, evita emitir a todos siempre
        nsp.emit('gameState', gameState);
    }, 1000 / 30); // 30Hz, emite cada 33ms
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
