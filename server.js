import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mysql from 'mysql2/promise';
import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import dotenv from 'dotenv';
import os from 'os';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Usar el puerto proporcionado por Render o el puerto 3000 en desarrollo
const PORT = process.env.PORT || 8080;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://stars-hunters.ctorre', 'http://25.60.52.132:5500'],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
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
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
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
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://stars-hunters.ctorre', 'http://25.60.52.132:5500'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Función para generar estrellas en posiciones aleatorias
function generarEstrellas() {
    return Array.from({ length: 10 }, () => ({
        x: Math.random() * 800,  // Asumiendo que el área de juego es de 800x600
        y: Math.random() * 600
    }));
}
const canvasWidth = 800; // Ancho del área de juego
const canvasHeight = 600; // Alto del área de juego
function generarEstrellaAleatoria(gameState) {
    let nuevaEstrella;
    let colisionada;

    do {
        // Generar una posición aleatoria
        nuevaEstrella = {
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight
        };

        // Verificar si la nueva estrella colisiona con alguna estrella existente
        colisionada = false;
        for (const estrella of gameState.estrellas) {
            const distancia = Math.sqrt(
                Math.pow(nuevaEstrella.x - estrella.x, 2) + Math.pow(nuevaEstrella.y - estrella.y, 2)
            );
            if (distancia < 50) {  // Verificamos que las estrellas no estén demasiado cerca (ajustable)
                colisionada = true;
                break;
            }
        }

    } while (colisionada);  // Repetir hasta encontrar una posición sin colisiones

    return nuevaEstrella;
}


export const createNamespace = (namespace) => {
    console.log(`Creando namespace: ${namespace}`);
    const nsp = io.of(namespace);
    const gameState = {
        estrellas: generarEstrellas(),
        players: new Map() // Usamos Map para un acceso más rápido
    };

    gameStates[namespace] = gameState; // Guardar el estado globalmente

    nsp.on('connection', (socket) => {
        console.log(`Nuevo jugador conectado: ${socket.id}`);

        // Asignar una posición inicial aleatoria al jugador
        const player = {
            x: Math.random() * 800,
            y: Math.random() * 600,
            id: socket.id,
            rotation: 0
        };

        gameState.players.set(socket.id, player);

        // Emitir el estado inicial al nuevo jugador
        socket.emit('gameState', {
            estrellas: gameState.estrellas,
            players: Object.fromEntries(gameState.players) // Convertimos el Map a un objeto
        });

        // Enviar al cliente su propio ID
        socket.emit('playerID', socket.id);

        // Notificar a otros jugadores sobre el nuevo jugador
        socket.broadcast.emit('newPlayer', player);

        // Emitir a todos los jugadores el estado completo con el nuevo jugador
        nsp.emit('gameState', {
            estrellas: gameState.estrellas,
            players: Object.fromEntries(gameState.players)
        });

        // Manejo de movimiento del jugador
        socket.on('move', (data) => {
            const player = gameState.players.get(socket.id);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                player.rotation = data.rotation; // Guardamos la rotación recibida
        
                // Emitir actualización SOLO para el jugador que se movió
                nsp.emit('gameState', {
                    estrellas: gameState.estrellas,
                    players: Object.fromEntries(gameState.players)
                });
            }
        });
        

        // Recibir evento de eliminación de estrella
        socket.on('removeEstrella', (estrella) => {
            // Eliminar la estrella del array en el gameState correspondiente
            const index = gameState.estrellas.findIndex(
                (e) => e.x === estrella.x && e.y === estrella.y
            );
            if (index !== -1) {
                gameState.estrellas.splice(index, 1); // Eliminar la estrella de la lista
        
                // Generar una nueva estrella en una posición aleatoria
                const nuevaEstrella = generarEstrellaAleatoria(gameState);  // Pasa gameState aquí
                gameState.estrellas.push(nuevaEstrella);  // Añadimos una nueva estrella
            }
        
            // Emitir el estado actualizado del juego solo al namespace actual
            nsp.emit('gameState', {
                estrellas: gameState.estrellas,
                players: Object.fromEntries(gameState.players)
            });
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
        nsp.emit('gameState', {
            estrellas: gameState.estrellas,
            players: Object.fromEntries(gameState.players) // Convierte el Map a un objeto
        });
    }, 1000 / 30); // 30Hz, emite cada 33ms
};

// Aumentar los valores de keepAliveTimeout y headersTimeout
server.keepAliveTimeout = 120 * 1000; // 120 segundos
server.headersTimeout = 120 * 1000; // 120 segundos

function checkResourceUsage() {
    // Memoria RAM
    const memoryUsage = process.memoryUsage();
    const ramUsedMB = memoryUsage.rss / 1024 / 1024; // RSS es la memoria total usada

    // CPU (carga promedio en 1 minuto por núcleo)
    const cores = os.cpus().length;
    const load1Min = os.loadavg()[0]; // Carga promedio en 1 minuto
    const loadPerCore = load1Min / cores; // Carga normalizada por núcleo

    // Umbrales
    const MAX_RAM_MB = 512;
    const MAX_CPU_LOAD = 2; // Carga por núcleo

    // Mensajes en rojo (ANSI escape code: \x1b[31m)
    if (ramUsedMB > MAX_RAM_MB) {
        console.log('\x1b[31m%s\x1b[0m', `⚠️ ¡ALERTA! RAM superada: ${ramUsedMB.toFixed(2)} MB (Límite: ${MAX_RAM_MB} MB)`);
    }
    if (loadPerCore > MAX_CPU_LOAD) {
        console.log('\x1b[31m%s\x1b[0m', `⚠️ ¡ALERTA! CPU superada: ${loadPerCore.toFixed(2)} (Límite: ${MAX_CPU_LOAD} por núcleo)`);
    }
}

// Ejecutar la verificación cada 5 segundos
setInterval(checkResourceUsage, 5000);

// Iniciar el servidor
// server.listen(PORT, () => {
//     console.log(`Servidor escuchando en el puerto ${PORT}`);
// });

// Inciar el servidor en localhost y por el puerto 3000
server.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
