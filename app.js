const express = require("express")
const mysql = require("mysql2")
const path = require('path') 
const bodyParser = require('body-parser')
const multer = require('multer')
const session = require('express-session')

const app = express()

const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'n0m3l0',
    database: 'proyectoPanaderia'
})

con.connect((err) => {
    if (err) {
        console.log('Error conectando:', err);
    } else {
        console.log('Conectado a la BD');
        insertarCategoriasIniciales();
    }
});

// Configurar almacenamiento de imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Solo se permiten imágenes"));
    }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(express.static('clientee'))

// Configurar sesiones
app.use(session({
    secret: 'panaderia-secreta-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}))

// Insertar categorías iniciales
function insertarCategoriasIniciales() {
    const categorias = ['Pan Blanco', 'Pan de Dulce', 'Repostería', 'Especiales'];
    
    categorias.forEach(nombre => {
        con.query(
            'INSERT INTO categorias (nombre) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = ?)',
            [nombre, nombre],
            (err) => {
                if (err) console.log('Error al insertar categoría:', err);
            }
        );
    });
}

// ============ AUTENTICACIÓN ============

// Login
app.post('/login', (req, res) => {
    let {email, password} = req.body;
    
    con.query(
        'SELECT * FROM usuarios WHERE email = ? AND password = ?',
        [email, password],
        (err, resultado) => {
            if (err) {
                console.log('Error:', err);
                return res.status(500).json({error: 'Error en el servidor'});
            }
            
            if (resultado.length === 0) {
                return res.status(401).json({error: 'Credenciales incorrectas'});
            }
            
            let usuario = resultado[0];
            
            req.session.usuario = {
                id: usuario.id_usuario,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            };
            
            res.json({
                mensaje: 'Login exitoso',
                usuario: {
                    id: usuario.id_usuario,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol
                }
            });
        }
    );
});

// Registro
app.post('/register', (req, res) => {
    let {nombre, email, password} = req.body;
    
    con.query(
        'SELECT * FROM usuarios WHERE email = ?',
        [email],
        (err, resultado) => {
            if (err) {
                console.log('Error:', err);
                return res.status(500).json({error: 'Error en el servidor'});
            }
            
            if (resultado.length > 0) {
                return res.status(400).json({error: 'El email ya está registrado'});
            }
            
            con.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
                [nombre, email, password, 'cliente'],
                (err, resultado) => {
                    if (err) {
                        console.log('Error:', err);
                        return res.status(500).json({error: 'Error al registrar'});
                    }
                    
                    res.json({
                        mensaje: 'Usuario registrado exitosamente',
                        id_usuario: resultado.insertId
                    });
                }
            );
        }
    );
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({error: 'Error al cerrar sesión'});
        }
        res.json({mensaje: 'Sesión cerrada'});
    });
});

// Verificar sesión
app.get('/verificarSesion', (req, res) => {
    if (req.session.usuario) {
        res.json({
            autenticado: true,
            usuario: req.session.usuario
        });
    } else {
        res.json({autenticado: false});
    }
});

// Middleware para proteger rutas de admin
function verificarAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.rol === 'admin') {
        next();
    } else {
        res.status(403).json({error: 'Acceso denegado'});
    }
}

// ============ PRODUCTOS ============

app.get('/obtenerProductos', (req, res) => {
    con.query('SELECT * FROM productos', (err, resultado, fields) => {
        if (err) {
            console.log('Error:', err);
            return res.status(500).json({error: 'Error'});
        }
        res.json(resultado);
    });
});

app.post('/agregarProducto', verificarAdmin, upload.single('imagen'), (req, res) => {
    let {nombre, descripcion, precio, stock, id_categoria} = req.body;
    let img = req.file ? `/images/${req.file.filename}` : null;

    con.query(
        'INSERT INTO productos (nombre, descripcion, precio, stock, img, id_categoria) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, descripcion, precio, stock, img, id_categoria],
        (err, resultado, fields) => {
            if (err) {
                console.log('Error:', err);
                return res.status(500).json({error: 'Error'});
            }
            res.json({
                id_producto: resultado.insertId,
                nombre, descripcion, precio, stock, img, id_categoria
            });
        }
    );
});

app.put('/editarProducto/:id', verificarAdmin, upload.single('imagen'), (req, res) => {
    let {id} = req.params;
    let {nombre, descripcion, precio, stock, id_categoria, img_actual} = req.body;
    let img = req.file ? `/images/${req.file.filename}` : img_actual;

    con.query(
        'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, img = ?, id_categoria = ? WHERE id_producto = ?',
        [nombre, descripcion, precio, stock, img, id_categoria, id],
        (err, resultado, fields) => {
            if (err) {
                console.log('Error:', err);
                return res.status(500).json({error: 'Error'});
            }
            res.json({id_producto: id, nombre, descripcion, precio, stock, img, id_categoria});
        }
    );
});

app.delete('/eliminarProducto/:id', verificarAdmin, (req, res) => {
    let {id} = req.params;

    con.query(
        'DELETE FROM productos WHERE id_producto = ?',
        [id],
        (err, resultado, fields) => {
            if (err) {
                console.log('Error:', err);
                return res.status(500).json({error: 'Error'});
            }
            res.json({id_producto: id, mensaje: 'Eliminado'});
        }
    );
});

// ============ CATEGORÍAS ============

app.get('/obtenerCategorias', (req, res) => {
    con.query('SELECT * FROM categorias', (err, resultado, fields) => {
        if (err) {
            console.log('Error:', err);
            return res.status(500).json({error: 'Error'});
        }
        res.json(resultado || []);
    });
});

// Ruta raíz redirige al login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(3000, () => {
    console.log('Servidor en puerto 3000');
});