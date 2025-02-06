import { Router } from 'express';

const router = Router();

export default (pool) => {
    // Ruta de autenticación 
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const connection = await pool.getConnection();
            const [results] = await connection.execute('SELECT password FROM users WHERE username = ?', [username]);
            connection.release();

            if (results.length > 0 && results[0].password === password) {
                // Si las credenciales son correctas, enviar una respuesta exitosa
                res.status(200).json({ message: 'Login successful' });
            } else {
                // Si las credenciales son incorrectas, enviar una respuesta de error
                res.status(401).json({ message: 'Invalid credentials' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error al verificar las credenciales', error });
        }
    });

    // Ruta de creación de usuario 
    router.post('/signup', async (req, res) => {
        const { username, password } = req.body;

        try {
            const connection = await pool.getConnection();
            const [results] = await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
            connection.release();

            // Si la inserción fue exitosa, enviar una respuesta exitosa
            res.status(200).json({ message: 'SignUp successful' });
        } catch (error) {
            res.status(500).json({ message: 'Error al registrar el usuario', error });
        }
    });

    return router;
};