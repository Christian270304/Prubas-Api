import { Router } from 'express';

const router = Router();

export default (pool) => {
    // Ruta para crear un servidor
    router.post('/create', async (req, res) => {
        const { name } = req.body;
        const namespace = `/game-${Date.now()}`;

        try {
            const connection = await pool.getConnection();
            const [results] = await connection.execute('INSERT INTO servers (name, namespace) VALUES (?, ?)', [name, namespace]);
            connection.release();

            if (results.affectedRows > 0) {
                // Crear el namespace en Socket.IO
                createNamespace(namespace);

                res.status(200).json({ message: 'Server created', namespace });
            } else {
                res.status(500).json({ message: 'Error al crear el servidor' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error al crear el servidor', error });
        }
    });

    // Ruta para listar los servidores disponibles
    router.get('/list', async (req, res) => {
        try {
            const connection = await pool.getConnection();
            const [results] = await connection.execute('SELECT * FROM servers');
            connection.release();

            res.status(200).json(results);
        } catch (error) {
            res.status(500).json({ message: 'Error al listar los servidores', error });
        }
    });

    return router;
};