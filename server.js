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
        console.log(`Nuevo jugador conectado: ${socket.id}`);
    
        // Asignar una posición inicial aleatoria al jugador
        gameState.players.set(socket.id, {
            x: Math.random() * 800,
            y: Math.random() * 600,
            id: socket.id
        });
    
        // Emitir el estado inicial al nuevo jugador
        socket.emit('gameState', {
            estrellas: gameState.estrellas,
            players: Object.fromEntries(gameState.players) // Convertimos el Map a un objeto
        });
        console.log("Estado de los jugadores enviado:", Object.fromEntries(gameState.players));
        // Notificar a otros jugadores sobre el nuevo jugador
        socket.broadcast.emit('newPlayer', gameState.players.get(socket.id));
    
        // Manejo de movimiento del jugador
        socket.on('move', (data) => {
            // Asegurarse de que el jugador está en el Map
            const player = gameState.players.get(socket.id);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                // Emitir el estado actualizado a todos los jugadores
                nsp.emit('gameState', {
                    estrellas: gameState.estrellas,
                    players: Object.fromEntries(gameState.players) // Convertimos el Map a un objeto
                });
            }
        });
    
        // Manejo de desconexión de jugador
        socket.on('disconnect', () => {
            console.log(`Jugador desconectado: ${socket.id}`);
            // Eliminar el jugador del Map
            gameState.players.delete(socket.id);
            // Emitir el estado actualizado a todos los jugadores
            nsp.emit('gameState', {
                estrellas: gameState.estrellas,
                players: Object.fromEntries(gameState.players) // Convertimos el Map a un objeto
            });
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
