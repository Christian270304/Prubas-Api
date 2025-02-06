import { Router } from 'express';

const router = Router();

export default (db) => {
    // Ruta de autenticación 
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const [results] = await db.execute('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

            if (results.length > 0) {
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
            const [results] = await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);

            // Si la inserción fue exitosa, enviar una respuesta exitosa
            res.status(200).json({ message: 'SignUp successful' });
        } catch (error) {
            res.status(500).json({ message: 'Error al registrar el usuario', error });
        }
    });

    return router;
};