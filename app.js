require('dotenv').config(); 
const express = require("express");
const mysql = require("mysql2");
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const app = express();
app.set('trust proxy', 1);
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000
});

const con = pool.promise();

async function crearTablasPedidos() {
    try {
        const tablaPedidos = `CREATE TABLE IF NOT EXISTS pedidos (
            id_pedido INT PRIMARY KEY AUTO_INCREMENT,
            id_usuario INT NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total DECIMAL(10,2) NOT NULL,
            estado VARCHAR(50) DEFAULT 'pendiente',
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        )`;

        const tablaDetalle = `CREATE TABLE IF NOT EXISTS detalle_pedidos (
            id_detalle INT PRIMARY KEY AUTO_INCREMENT,
            id_pedido INT NOT NULL,
            id_producto INT NOT NULL,
            cantidad INT NOT NULL,
            precio_unitario DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
        )`;

        await con.query(tablaPedidos);
        await con.query(tablaDetalle);
    } catch (err) {
        console.log(' Error creando tablas de pedidos:', err.message);
    }
}

async function insertarCategoriasIniciales() {
    
        const [categoriaActuales] = await con.query('SELECT COUNT(*) as total FROM categorias');
        
        if (categoriaActuales[0].total > 0) {
            return;
        }
        
        const categorias = ['Pan Blanco', 'Pan de Dulce', 'Repostería', 'Especiales'];
        const query = 'INSERT INTO categorias (nombre) VALUES (?)';
        
        for (const nombre of categorias) {
            await con.query(query, [nombre]);
        }
}

async function inicializarApp() {
    try {
       
        const [rows] = await con.query('SELECT 1 as connected');
        console.log(' Conectado a la BD');
        
        await insertarCategoriasIniciales();
        await crearTablasPedidos();
    } catch (err) {
        console.log(' Error en inicialización:', err.message);
    }
}

inicializarApp();

// ============ CONFIGURACIÓN DE MULTER ============
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

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
});

// ============ MIDDLEWARES ============
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// CAMBIO 3: Configurar el store de sesiones usando el pool existente
const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'session_bakery_app', // Nombre opcional para la cookie
    secret: process.env.SESSION_SECRET || '0Oyb0pxvbir0o9y1EbBs3QqQd0n0HtwW',
    store: sessionStore, // Usar MySQL para guardar sesiones
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// Middleware para proteger rutas de admin
function verificarAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.rol === 'admin') {
        next();
    } else {
        res.status(403).json({error: 'Acceso denegado'});
    }
}

// Middleware para verificar usuario autenticado
function verificarUsuario(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.status(401).json({error: 'No autenticado'});
    }
}

// ============ RUTAS DE AUTENTICACIÓN ============
app.post('/login', async (req, res) => {
    let {email, password} = req.body;
    try {
        const [resultado] = await con.query(
            'SELECT * FROM usuarios WHERE email = ? AND password = ?',
            [email, password]
        );
        
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
            usuario: req.session.usuario
        });
    } catch (err) {
        console.log('Error en login:', err.message);
        return res.status(500).json({error: 'Error en el servidor'});
    }
});

app.post('/register', async (req, res) => {
    let {nombre, email, password} = req.body;
    try {
        const [resultado] = await con.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );
        
        if (resultado.length > 0) {
            return res.status(400).json({error: 'El email ya está registrado'});
        }
        
        const [resultadoInsert] = await con.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, password, 'cliente']
        );
        
        res.json({
            mensaje: 'Usuario registrado exitosamente',
            id_usuario: resultadoInsert.insertId
        });
    } catch (err) {
        console.log('Error en registro:', err.message);
        return res.status(500).json({error: 'Error al registrar'});
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({error: 'Error al cerrar sesión'});
        }
        res.json({mensaje: 'Sesión cerrada'});
    });
});

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

// ============ RUTAS DE PRODUCTOS ============
app.get('/obtenerProductos', async (req, res) => {
    try {
        const [resultado] = await con.query('SELECT * FROM productos');
        res.json(resultado);
    } catch (err) {
        console.log('Error obteniendo productos:', err.message);
        return res.status(500).json({error: 'Error al obtener productos'});
    }
});

app.post('/agregarProducto', verificarAdmin, upload.single('imagen'), async (req, res) => {
    let {nombre, descripcion, precio, stock, id_categoria} = req.body;
    let img = req.file ? `/images/${req.file.filename}` : null;
    
    try {
        const [resultado] = await con.query(
            'INSERT INTO productos (nombre, descripcion, precio, stock, img, id_categoria) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, descripcion, precio, stock, img, id_categoria]
        );
        
        res.json({
            id_producto: resultado.insertId,
            nombre, descripcion, precio, stock, img, id_categoria
        });
    } catch (err) {
        console.log('Error agregando producto:', err.message);
        return res.status(500).json({error: 'Error al agregar producto'});
    }
});

app.put('/editarProducto/:id', verificarAdmin, upload.single('imagen'), async (req, res) => {
    let {id} = req.params;
    let {nombre, descripcion, precio, stock, id_categoria, img_actual} = req.body;
    let img = req.file ? `/images/${req.file.filename}` : img_actual;
    
    try {
        await con.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, img = ?, id_categoria = ? WHERE id_producto = ?',
            [nombre, descripcion, precio, stock, img, id_categoria, id]
        );
        
        res.json({id_producto: id, nombre, descripcion, precio, stock, img, id_categoria});
    } catch (err) {
        console.log('Error editando producto:', err.message);
        return res.status(500).json({error: 'Error al editar producto'});
    }
});

app.delete('/eliminarProducto/:id', verificarAdmin, async (req, res) => {
    let {id} = req.params;
    try {
        await con.query('DELETE FROM productos WHERE id_producto = ?', [id]);
        res.json({id_producto: id, mensaje: 'Eliminado'});
    } catch (err) {
        console.log('Error eliminando producto:', err.message);
        return res.status(500).json({error: 'Error al eliminar producto'});
    }
});

// ============ RUTAS DE CATEGORÍAS ============
app.get('/obtenerCategorias', async (req, res) => {
    try {
        const [resultado] = await con.query('SELECT * FROM categorias');
        res.json(resultado || []);
    } catch (err) {
        console.log('Error obteniendo categorías:', err.message);
        return res.status(500).json({error: 'Error al obtener categorías'});
    }
});

// ============ RUTAS DE CARRITO ============
app.get('/miCarrito', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const query = `SELECT p.*, ci.cantidad
FROM carrito_items ci
JOIN productos p ON ci.id_producto = p.id_producto
WHERE ci.id_usuario = ?`;
    
    try {
        const [items] = await con.query(query, [id_usuario]);
        res.json(items);
    } catch (err) {
        console.error("Error al obtener carrito:", err.message);
        res.status(500).json({ error: "Error al obtener carrito" });
    }
});

app.post('/agregarAlCarrito', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const { id_producto, cantidad } = req.body;
    
    const query = `INSERT INTO carrito_items (id_usuario, id_producto, cantidad)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE cantidad = ?`;
    
    try {
        await con.query(query, [id_usuario, id_producto, cantidad, cantidad]);
        res.json({ mensaje: 'Producto agregado/actualizado en el carrito' });
    } catch (err) {
        console.error("Error al agregar al carrito:", err.message);
        res.status(500).json({ error: "Error al agregar al carrito" });
    }
});

app.delete('/eliminarDelCarrito/:id_producto', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const { id_producto } = req.params;
    
    const query = 'DELETE FROM carrito_items WHERE id_usuario = ? AND id_producto = ?';
    
    try {
        await con.query(query, [id_usuario, id_producto]);
        res.json({ mensaje: 'Producto eliminado del carrito' });
    } catch (err) {
        console.error("Error al eliminar del carrito:", err.message);
        res.status(500).json({ error: "Error al eliminar del carrito" });
    }
});

app.delete('/vaciarMiCarrito', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const query = 'DELETE FROM carrito_items WHERE id_usuario = ?';
    
    try {
        await con.query(query, [id_usuario]);
        res.json({ mensaje: 'Carrito vaciado' });
    } catch (err) {
        console.error("Error al vaciar carrito:", err.message);
        res.status(500).json({ error: "Error al vaciar carrito" });
    }
});

// ============ RUTAS DE PEDIDOS ============
app.post('/crearPedido', verificarUsuario, async (req, res) => {
    const { carrito, total } = req.body;
    const id_usuario = req.session.usuario.id;

    let connection;
    try {
        connection = await con.getConnection();
        await connection.beginTransaction();
        
        let erroresStock = [];
        
        // Verificar stock para cada producto
        for (const item of carrito) {
            const [productos] = await connection.query(
                'SELECT nombre, stock FROM productos WHERE id_producto = ? FOR UPDATE', 
                [item.id_producto]
            );
            
            if (productos.length === 0) {
                erroresStock.push(`Producto ID ${item.id_producto} no encontrado.`);
            } else if (productos[0].stock < item.cantidad) {
                erroresStock.push(`Stock insuficiente para ${productos[0].nombre} (sólo quedan ${productos[0].stock})`);
            }
        }
        
        if (erroresStock.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: erroresStock.join(', ') });
        }
        
        // Crear pedido
        const [pedidoResult] = await connection.query(
            'INSERT INTO pedidos (id_usuario, total) VALUES (?, ?)',
            [id_usuario, total]
        );
        const id_pedido = pedidoResult.insertId;
        
        // Crear detalles y actualizar stock
        for (const item of carrito) {
            const subtotal = item.precio * item.cantidad;
            
            await connection.query(
                'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [id_pedido, item.id_producto, item.cantidad, item.precio, subtotal]
            );
            
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
                [item.cantidad, item.id_producto]
            );
        }
        
        // Vaciar carrito
        await connection.query('DELETE FROM carrito_items WHERE id_usuario = ?', [id_usuario]);
        
        await connection.commit();
        
        res.json({
            mensaje: 'Pedido creado exitosamente',
            id_pedido: id_pedido
        });
    
    } catch (err) {
        if (connection) await connection.rollback();
        console.log('Error en transacción /crearPedido:', err.message);
        res.status(500).json({ error: 'Error al procesar el pedido' });
    } finally {
        if (connection) connection.release();
    }
});

// Resto de las rutas de pedidos
app.get('/obtenerPedidos', verificarAdmin, async (req, res) => {
    const query = `SELECT 
    p.id_pedido, p.fecha, p.total, p.estado,
    u.nombre as nombre_usuario, u.email
FROM pedidos p
JOIN usuarios u ON p.id_usuario = u.id_usuario
ORDER BY p.fecha DESC`;
    
    try {
        const [resultado] = await con.query(query);
        res.json(resultado);
    } catch (err) {
        console.log('Error obteniendo pedidos:', err.message);
        return res.status(500).json({error: 'Error al obtener pedidos'});
    }
});

app.get('/obtenerDetallePedido/:id', verificarAdmin, async (req, res) => {
    let {id} = req.params;
    const query = `SELECT 
    dp.id_detalle, dp.cantidad, dp.precio_unitario, dp.subtotal,
    pr.nombre as nombre_producto, pr.img
FROM detalle_pedidos dp
JOIN productos pr ON dp.id_producto = pr.id_producto
WHERE dp.id_pedido = ?`;
    
    try {
        const [resultado] = await con.query(query, [id]);
        res.json(resultado);
    } catch (err) {
        console.log('Error obteniendo detalle pedido:', err.message);
        return res.status(500).json({error: 'Error al obtener detalles'});
    }
});

app.get('/misPedidos', verificarUsuario, async (req, res) => {
    let id_usuario = req.session.usuario.id;
    const query = `SELECT p.id_pedido, p.fecha, p.total, p.estado
FROM pedidos p
WHERE p.id_usuario = ?
ORDER BY p.fecha DESC`;
    
    try {
        const [resultado] = await con.query(query, [id_usuario]);
        res.json(resultado);
    } catch (err) {
        console.log('Error obteniendo mis pedidos:', err.message);
        return res.status(500).json({error: 'Error al obtener pedidos'});
    }
});

app.put('/cambiarEstadoPedido/:id', verificarAdmin, async (req, res) => {
    let {id} = req.params;
    let {estado} = req.body;
    
    try {
        await con.query(
            'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
            [estado, id]
        );
        res.json({mensaje: 'Estado actualizado', id_pedido: id, estado});
    } catch (err) {
        console.log('Error cambiando estado pedido:', err.message);
        return res.status(500).json({error: 'Error al actualizar estado'});
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const [result] = await con.query('SELECT 1 as connected');
        res.json({ 
            status: 'OK', 
            database: 'Connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Error', 
            database: 'Disconnected',
            error: error.message 
        });
    }
});

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});