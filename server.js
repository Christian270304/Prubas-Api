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
const io = new Server(server);

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
    allowedHeaders: ['Content-Type']
}));

app.options('*', cors());

// Servir el archivo socket.io.js desde node_modules
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist')));

// Usar las rutas de autenticación
app.use('/auth', authRoutes(pool));
app.use('/servers', serverRoutes(pool));

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

export const createNamespace = (namespace) => {
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

// Aumentar los valores de keepAliveTimeout y headersTimeout
server.keepAliveTimeout = 120 * 1000; // 120 segundos
server.headersTimeout = 120 * 1000; // 120 segundos

// Iniciar el servidor
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});