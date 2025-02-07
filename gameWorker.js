// gameWorker.js
const { parentPort } = require('worker_threads');

// Recibir el estado del juego (gameState)
parentPort.on('message', (gameState) => {
    // Procesar el estado del juego (aquí podemos actualizar las posiciones, colisiones, etc.)
    Object.values(gameState.players).forEach(player => {
        // Ejemplo de lógica de movimiento de jugadores (deberías modificar esto según tu lógica del juego)
        player.x += 1;
        player.y += 1;
    });

    // Enviar de vuelta el estado actualizado al hilo principal
    parentPort.postMessage(gameState);
});
