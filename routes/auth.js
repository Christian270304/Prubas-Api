const express = require('express');
const router = express.Router();

// Ruta de autenticación (ejemplo)
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Aquí deberías verificar las credenciales del usuario
    if (username === 'user' && password === 'password') {
        // Si las credenciales son correctas, enviar una respuesta exitosa
        res.status(200).json({ message: 'Login successful' });
    } else {
        // Si las credenciales son incorrectas, enviar una respuesta de error
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

module.exports = router;