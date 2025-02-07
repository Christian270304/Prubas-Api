import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mysql from 'mysql2/promise';

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

// Middleware para parsear JSON
app.use(express.json());
app.use(cors({
  origin: 'http://stars-hunters.ctorres.cat',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Conexión a la base de datos dentro de cada request
async function getDBConnection() {
  return mysql.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

// Endpoint de prueba
app.get("/", (req, res) => {
  res.send("Servidor funcionando con Express y Socket.io en Vercel");
});

// Manejo de Socket.io (no persistente en serverless)
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("mensaje", (data) => {
    console.log("Mensaje recibido:", data);
    io.emit("mensaje", data); // Enviar a todos los clientes
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// Vercel requiere que exportemos una función en lugar de `server.listen`
export default function handler(req, res) {
  server.emit("request", req, res);
}
