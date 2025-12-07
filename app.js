require('dotenv').config();
const express = require("express");
const mysql = require("mysql2");
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const http = require('http');
const socketIO = require('socket.io');
const engine = require('ejs-mate');
const app = express();

const server = http.createServer(app);
const io = socketIO(server);

app.set('trust proxy', 1);
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
            total DECIMAL(15,2) NOT NULL,
            estado VARCHAR(50) DEFAULT 'pendiente',
            latitud DECIMAL(10, 8) NULL,
            longitud DECIMAL(11, 8) NULL,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        )`;
        const tablaDetalle = `CREATE TABLE IF NOT EXISTS detalle_pedidos (
            id_detalle INT PRIMARY KEY AUTO_INCREMENT,
            id_pedido INT NOT NULL,
            id_producto INT NOT NULL,
            cantidad INT NOT NULL,
            precio_unitario DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(15,2) NOT NULL,
            FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
        )`;
        const tablaTransaccionesFondos = `CREATE TABLE IF NOT EXISTS transacciones_fondos (
            id_transaccion INT PRIMARY KEY AUTO_INCREMENT,
            id_usuario INT NOT NULL,
            tipo VARCHAR(50) NOT NULL,
            monto DECIMAL(15,2) NOT NULL,
            saldo_anterior DECIMAL(15,2) NOT NULL,
            saldo_nuevo DECIMAL(15,2) NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            descripcion VARCHAR(255),
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        )`;
        await con.query(tablaPedidos);
        await con.query(tablaDetalle);
        await con.query(tablaTransaccionesFondos);
        // Ajuste en el tipo de dato de total en pedidos (de 10,2 a 15,2 para ser consistente con fondos)
        await con.query(`ALTER TABLE pedidos MODIFY total DECIMAL(15,2) NOT NULL`);
        // Ajuste en el tipo de dato de subtotal en detalle_pedidos (de 10,2 a 15,2 para ser consistente con fondos)
        await con.query(`ALTER TABLE detalle_pedidos MODIFY subtotal DECIMAL(15,2) NOT NULL`);
        const [columnasUsuarios] = await con.query(`SHOW COLUMNS FROM usuarios LIKE 'fondos'`);
        if (columnasUsuarios.length === 0) {
            await con.query(`ALTER TABLE usuarios ADD fondos DECIMAL(15,2) DEFAULT 0.00`);
            console.log(' Columna "fondos" añadida a la tabla "usuarios".');
        }
        // Se añade la columna username a usuarios si no existe
        const [columnasUsername] = await con.query(`SHOW COLUMNS FROM usuarios LIKE 'username'`);
        if (columnasUsername.length === 0) {
            await con.query(`ALTER TABLE usuarios ADD username VARCHAR(50) UNIQUE NULL AFTER nombre`);
            console.log(' Columna "username" añadida a la tabla "usuarios".');
        }
    } catch (err) {
        console.log(' Error creando tablas de pedidos/transacciones:', err.message);
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
        await crearTablasPedidos();
        await insertarCategoriasIniciales();
    } catch (err) {
        console.log(' Error en inicialización:', err.message);
    }
}

inicializarApp();

function validarNumero(valor, min, max, nombre) {
    const num = parseFloat(valor);
    if (isNaN(num)) {
        return { valido: false, error: `${nombre} debe ser un número válido` };
    }
    if (num < min) {
        return { valido: false, error: `${nombre} no puede ser menor a ${min}` };
    }
    if (num > max) {
        return { valido: false, error: `${nombre} excede el límite permitido (${max})` };
    }
    return { valido: true, valor: num };
}

function validarEntero(valor, min, max, nombre) {
    const num = parseInt(valor);
    if (isNaN(num) || !Number.isInteger(parseFloat(valor))) {
        return { valido: false, error: `${nombre} debe ser un número entero` };
    }
    if (num < min) {
        return { valido: false, error: `${nombre} no puede ser menor a ${min}` };
    }
    if (num > max) {
        return { valido: false, error: `${nombre} excede el límite permitido (${max})` };
    }
    return { valido: true, valor: num };
}

function validarTexto(valor, minLen, maxLen, nombre) {
    const texto = String(valor || '').trim();
    if (!texto) {
        return { valido: false, error: `${nombre} es requerido` };
    }
    if (texto.length < minLen) {
        return { valido: false, error: `${nombre} debe tener al menos ${minLen} caracteres` };
    }
    if (texto.length > maxLen) {
        return { valido: false, error: `${nombre} no puede tener más de ${maxLen} caracteres` };
    }
    return { valido: true, valor: texto };
}

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'session_bakery_app', 
    secret: process.env.SESSION_SECRET || '0Oyb0pxvbir0o9y1EbBs3QqQd0n0HtwW',
    store: sessionStore, 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

function verificarAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.rol === 'admin') {
        next();
    } else {
        res.status(403).json({error: 'Acceso denegado'});
    }
}

function verificarUsuario(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.status(401).json({error: 'No autenticado'});
    }
}

try {
    app.use(require('./routes/index'));
} catch (e) {
    console.log("Advertencia: No se encontró ./routes/index para Leaflet, continuando sin él.");
}

app.post('/login', async (req, res) => {
    let {username, password} = req.body; 
    
    const validUsername = validarTexto(username, 3, 50, 'Nombre de usuario');
    if (!validUsername.valido) {
        return res.status(400).json({error: validUsername.error});
    }
    username = validUsername.valor;
    
    if (!password || password.length < 6 || password.length > 255) {
        return res.status(400).json({error: 'Contraseña inválida'});
    }
    
    try {
        const [resultado] = await con.query(
            'SELECT * FROM usuarios WHERE username = ? AND password = ?',
            [username, password]
        );
        
        if (resultado.length === 0) {
            return res.status(401).json({error: 'Usuario o contraseña incorrectos'});
        }
        
        let usuario = resultado[0];
        req.session.usuario = {
            id: usuario.id_usuario,
            nombre: usuario.nombre,
            username: usuario.username,
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
    let {nombre, username, email, password} = req.body;
    
    const validNombre = validarTexto(nombre, 2, 100, 'Nombre');
    if (!validNombre.valido) {
        return res.status(400).json({error: validNombre.error});
    }
    nombre = validNombre.valor;
    
    const validUsername = validarTexto(username, 3, 50, 'Nombre de usuario');
    if (!validUsername.valido) {
        return res.status(400).json({error: validUsername.error});
    }
    username = validUsername.valor;
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({error: 'El nombre de usuario solo puede contener letras, números y guiones bajos'});
    }
    
    email = String(email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({error: 'Email inválido'});
    }
    if (email.length > 100) {
        return res.status(400).json({error: 'Email demasiado largo'});
    }
    
    if (!password || password.length < 6) {
        return res.status(400).json({error: 'La contraseña debe tener al menos 6 caracteres'});
    }
    if (password.length > 255) {
        return res.status(400).json({error: 'La contraseña es demasiado larga'});
    }
    
    try {
        const [resultadoEmail] = await con.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );
        if (resultadoEmail.length > 0) {
            return res.status(400).json({error: 'El email ya está registrado'});
        }
        
        const [resultadoUsername] = await con.query(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );
        if (resultadoUsername.length > 0) {
            return res.status(400).json({error: 'El nombre de usuario ya está en uso'});
        }
        
        const [resultadoInsert] = await con.query(
            'INSERT INTO usuarios (nombre, username, email, password, rol) VALUES (?, ?, ?, ?, ?)',
            [nombre, username, email, password, 'cliente']
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
    
    const validNombre = validarTexto(nombre, 2, 100, 'Nombre del producto');
    if (!validNombre.valido) {
        return res.status(400).json({error: validNombre.error});
    }
    nombre = validNombre.valor;
    
    const validDesc = validarTexto(descripcion, 5, 500, 'Descripción');
    if (!validDesc.valido) {
        return res.status(400).json({error: validDesc.error});
    }
    descripcion = validDesc.valor;
    
    const validPrecio = validarNumero(precio, 0.01, 999999999, 'Precio');
    if (!validPrecio.valido) {
        return res.status(400).json({error: validPrecio.error});
    }
    precio = validPrecio.valor;
    
    const validStock = validarEntero(stock, 0, 999999999, 'Stock');
    if (!validStock.valido) {
        return res.status(400).json({error: validStock.error});
    }
    stock = validStock.valor;
    
    const validCategoria = validarEntero(id_categoria, 1, 999999, 'Categoría');
    if (!validCategoria.valido) {
        return res.status(400).json({error: validCategoria.error});
    }
    id_categoria = validCategoria.valor;
    
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
    
    const validId = validarEntero(id, 1, 999999999, 'ID del producto');
    if (!validId.valido) {
        return res.status(400).json({error: validId.error});
    }
    id = validId.valor;
    
    const validNombre = validarTexto(nombre, 2, 100, 'Nombre del producto');
    if (!validNombre.valido) {
        return res.status(400).json({error: validNombre.error});
    }
    nombre = validNombre.valor;
    
    const validDesc = validarTexto(descripcion, 5, 500, 'Descripción');
    if (!validDesc.valido) {
        return res.status(400).json({error: validDesc.error});
    }
    descripcion = validDesc.valor;
    
    const validPrecio = validarNumero(precio, 0.01, 999999999, 'Precio');
    if (!validPrecio.valido) {
        return res.status(400).json({error: validPrecio.error});
    }
    precio = validPrecio.valor;
    
    const validStock = validarEntero(stock, 0, 999999999, 'Stock');
    if (!validStock.valido) {
        return res.status(400).json({error: validStock.error});
    }
    stock = validStock.valor;
    
    const validCategoria = validarEntero(id_categoria, 1, 999999, 'Categoría');
    if (!validCategoria.valido) {
        return res.status(400).json({error: validCategoria.error});
    }
    id_categoria = validCategoria.valor;
    
    try {
        await con.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, img = ?, id_categoria = ? WHERE id_producto = ?',
            [nombre, descripcion, precio, stock, img, id_categoria, id]
        );
        res.json({id_producto: id, nombre, descripcion, precio, stock, img, id_categoria});
    } catch (err) {
        console.log('Error editando producto:', err.message);
        return res.status(400).json({error: 'Error al editar producto'});
    }
});

app.delete('/eliminarProducto/:id', verificarAdmin, async (req, res) => {
    let {id} = req.params;
    const validId = validarEntero(id, 1, 999999999, 'ID del producto');
    if (!validId.valido) {
        return res.status(400).json({error: validId.error});
    }
    id = validId.valor;
    
    try {
        const [resultado] = await con.query('DELETE FROM productos WHERE id_producto = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({error: 'Producto no encontrado'});
        }
        res.json({id_producto: id, mensaje: 'Eliminado'});
    } catch (err) {
        console.log('Error eliminando producto:', err.message);
        return res.status(500).json({error: 'Error al eliminar producto'});
    }
});

app.get('/obtenerCategorias', async (req, res) => {
    try {
        const [resultado] = await con.query('SELECT * FROM categorias');
        res.json(resultado || []);
    } catch (err) {
        console.log('Error obteniendo categorías:', err.message);
        return res.status(500).json({error: 'Error al obtener categorías'});
    }
});

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
    let { id_producto, cantidad } = req.body;
    
    const validIdProducto = validarEntero(id_producto, 1, 999999999, 'ID del producto');
    if (!validIdProducto.valido) {
        return res.status(400).json({error: validIdProducto.error});
    }
    id_producto = validIdProducto.valor;
    
    const validCantidad = validarEntero(cantidad, 1, 999999, 'Cantidad');
    if (!validCantidad.valido) {
        return res.status(400).json({error: validCantidad.error});
    }
    cantidad = validCantidad.valor;
    
    try {
        const [producto] = await con.query(
            'SELECT stock FROM productos WHERE id_producto = ?',
            [id_producto]
        );
        
        if (producto.length === 0) {
            return res.status(404).json({error: 'Producto no encontrado'});
        }
        
        if (producto[0].stock < cantidad) {
            return res.status(400).json({error: `Stock insuficiente. Solo quedan ${producto[0].stock} unidades`});
        }
        
        const query = `INSERT INTO carrito_items (id_usuario, id_producto, cantidad)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE cantidad = ?`;
        
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
    
    const validIdProducto = validarEntero(id_producto, 1, 999999999, 'ID del producto');
    if (!validIdProducto.valido) {
        return res.status(400).json({error: validIdProducto.error});
    }
    
    const query = 'DELETE FROM carrito_items WHERE id_usuario = ? AND id_producto = ?';
    
    try {
        await con.query(query, [id_usuario, validIdProducto.valor]);
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
        res.status(500).json({ error: "Error al vaciar el carrito" });
    }
});

app.get('/obtenerFondos', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    try {
        const [resultado] = await con.query(
            'SELECT fondos FROM usuarios WHERE id_usuario = ?',
            [id_usuario]
        );
        if (resultado.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ fondos: resultado[0].fondos });
    } catch (err) {
        console.error('Error obteniendo fondos:', err.message);
        res.status(500).json({ error: 'Error al obtener los fondos' });
    }
});

app.post('/agregarFondos', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    let { monto } = req.body;
    
    const validMonto = validarNumero(monto, 0.01, 999999999999, 'Monto');
    if (!validMonto.valido) {
        return res.status(400).json({error: validMonto.error});
    }
    monto = validMonto.valor;
    
    if ((monto * 100) % 1 !== 0) {
        return res.status(400).json({error: 'El monto solo puede tener hasta 2 decimales'});
    }
    
    let connection;
    try {
        connection = await con.getConnection();
        await connection.beginTransaction();
        
        const [usuario] = await connection.query(
            'SELECT fondos FROM usuarios WHERE id_usuario = ? FOR UPDATE',
            [id_usuario]
        );
        
        if (usuario.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const saldoAnterior = parseFloat(usuario[0].fondos || 0);
        const saldoNuevo = saldoAnterior + monto;
        
        if (saldoNuevo > 999999999999) {
            await connection.rollback();
            return res.status(400).json({ 
                error: `No se puede agregar esa cantidad porque excede el límite de fondos permitido.\nTienes: $${saldoAnterior.toFixed(2)}\nIntentando agregar: $${monto.toFixed(2)}\nNuevo saldo sería: $${saldoNuevo.toFixed(2)}\nLímite: $999,999,999,999.00` 
            });
        }
        
        await connection.query(
            'UPDATE usuarios SET fondos = ? WHERE id_usuario = ?',
            [saldoNuevo, id_usuario]
        );
        
        await connection.query(
            'INSERT INTO transacciones_fondos (id_usuario, tipo, monto, saldo_anterior, saldo_nuevo, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
            [id_usuario, 'deposito', monto, saldoAnterior, saldoNuevo, 'Depósito de fondos']
        );
        
        await connection.commit();
        
        res.json({
            mensaje: 'Fondos agregados exitosamente',
            fondos: saldoNuevo,
            monto_agregado: monto,
            saldo_anterior: saldoAnterior
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error agregando fondos:', err);
        res.status(500).json({ error: 'Error al agregar fondos: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/obtenerTransacciones', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    try {
        const [transacciones] = await con.query(
            'SELECT * FROM transacciones_fondos WHERE id_usuario = ? ORDER BY fecha DESC LIMIT 50',
            [id_usuario]
        );
        res.json(transacciones);
    } catch (err) {
        console.error('Error obteniendo transacciones:', err.message);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});

app.post('/crearPedido', verificarUsuario, async (req, res) => {
    const { carrito, total, latitud, longitud } = req.body;
    const id_usuario = req.session.usuario.id;

    if (!Array.isArray(carrito) || carrito.length === 0) {
        return res.status(400).json({error: 'El carrito está vacío'});
    }
    
    if (carrito.length > 100) {
        return res.status(400).json({error: 'El carrito tiene demasiados productos'});
    }
    
    const validTotal = validarNumero(total, 0.01, 999999999999, 'Total');
    if (!validTotal.valido) {
        return res.status(400).json({error: validTotal.error});
    }
    const totalPedido = validTotal.valor;
    
    let lat = null, lng = null;
    if (latitud !== null && latitud !== undefined && String(latitud).trim() !== '') {
        const validLat = validarNumero(latitud, -90, 90, 'Latitud');
        if (!validLat.valido) {
            return res.status(400).json({error: validLat.error});
        }
        lat = validLat.valor;
    }
    if (longitud !== null && longitud !== undefined && String(longitud).trim() !== '') {
        const validLng = validarNumero(longitud, -180, 180, 'Longitud');
        if (!validLng.valido) {
            return res.status(400).json({error: validLng.error});
        }
        lng = validLng.valor;
    }

    let connection;
    try {
        connection = await con.getConnection();
        await connection.beginTransaction();
        
        const [usuario] = await connection.query(
            'SELECT fondos FROM usuarios WHERE id_usuario = ? FOR UPDATE',
            [id_usuario]
        );
        
        if (usuario.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const fondosActuales = parseFloat(usuario[0].fondos || 0);
        
        if (fondosActuales === 0 || fondosActuales < 0.01) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'No tienes fondos disponibles. Por favor recarga tu cuenta.' 
            });
        }
        
        if (fondosActuales < totalPedido) {
            await connection.rollback();
            return res.status(400).json({ 
                error: `Fondos insuficientes. Tienes $${fondosActuales.toFixed(2)} y necesitas $${totalPedido.toFixed(2)}` 
            });
        }
        
        let erroresStock = [];
        let totalCalculado = 0;
        
        for (let i = 0; i < carrito.length; i++) {
            const item = carrito[i];
            const validId = validarEntero(item.id_producto, 1, 999999999, 'ID del producto');
            const validCant = validarEntero(item.cantidad, 1, 999999, 'Cantidad');
            const validPrecio = validarNumero(item.precio, 0.01, 999999999, 'Precio unitario'); // Asumiendo que el precio viene del frontend para el cálculo, pero se verificará el real
            
            if (!validId.valido || !validCant.valido || !validPrecio.valido) {
                erroresStock.push(`Datos inválidos en el ítem ${i + 1} del carrito`);
                continue;
            }
            
            const [productos] = await connection.query(
                'SELECT nombre, stock, precio FROM productos WHERE id_producto = ? FOR UPDATE', 
                [validId.valor]
            );
            
            if (productos.length === 0) {
                erroresStock.push(`Producto ID ${validId.valor} no encontrado.`);
            } else if (productos[0].stock < validCant.valor) {
                erroresStock.push(`Stock insuficiente para ${productos[0].nombre} (sólo quedan ${productos[0].stock})`);
            } else if (Math.abs(productos[0].precio - validPrecio.valor) > 0.01) {
                erroresStock.push(`Error de precio para ${productos[0].nombre}. Precio actual: $${productos[0].precio}, Enviado: $${validPrecio.valor}`);
            } else {
                totalCalculado += validPrecio.valor * validCant.valor;
            }
        }
        
        if (erroresStock.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: erroresStock.join(', ') });
        }
        
        if (Math.abs(totalCalculado - totalPedido) > 0.01) {
            await connection.rollback();
            return res.status(400).json({ error: `Error en el cálculo del total. Total calculado: $${totalCalculado.toFixed(2)}, Total enviado: $${totalPedido.toFixed(2)}` });
        }
        
        const [pedidoResult] = await connection.query(
            'INSERT INTO pedidos (id_usuario, total, latitud, longitud) VALUES (?, ?, ?, ?)',
            [id_usuario, totalPedido, lat, lng]
        );
        const id_pedido = pedidoResult.insertId;
        
        for (const item of carrito) {
            const precioUnitario = parseFloat(item.precio);
            const cantidadItem = parseInt(item.cantidad);
            const subtotal = precioUnitario * cantidadItem;
            
            await connection.query(
                'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [id_pedido, item.id_producto, cantidadItem, precioUnitario, subtotal]
            );
            
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
                [cantidadItem, item.id_producto]
            );
        }
        
        const nuevoSaldo = fondosActuales - totalPedido;
        await connection.query(
            'UPDATE usuarios SET fondos = ? WHERE id_usuario = ?',
            [nuevoSaldo, id_usuario]
        );
        
        await connection.query(
            'INSERT INTO transacciones_fondos (id_usuario, tipo, monto, saldo_anterior, saldo_nuevo, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
            [id_usuario, 'compra', totalPedido, fondosActuales, nuevoSaldo, `Compra - Pedido #${id_pedido}`]
        );
        
        await connection.query('DELETE FROM carrito_items WHERE id_usuario = ?', [id_usuario]);
        
        await connection.commit();
        
        res.json({
            mensaje: 'Pedido creado exitosamente',
            id_pedido: id_pedido,
            nuevo_saldo: nuevoSaldo
        });
    
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error en transacción /crearPedido:', err.message);
        res.status(500).json({ error: 'Error al procesar el pedido' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/obtenerPedidos', verificarAdmin, async (req, res) => {
    const query = `SELECT 
    p.id_pedido, p.fecha, p.total, p.estado, p.latitud, p.longitud,
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
    const validId = validarEntero(id, 1, 999999999, 'ID del pedido');
    if (!validId.valido) {
        return res.status(400).json({error: validId.error});
    }
    id = validId.valor;
    
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
    
    const validId = validarEntero(id, 1, 999999999, 'ID del pedido');
    if (!validId.valido) {
        return res.status(400).json({error: validId.error});
    }
    id = validId.valor;
    
    const estadosValidos = ['pendiente', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];
    if (!estado || !estadosValidos.includes(estado.toLowerCase().trim())) {
        return res.status(400).json({error: 'Estado de pedido inválido'});
    }
    estado = estado.toLowerCase().trim();
    
    try {
        const [resultado] = await con.query(
            'UPDATE pedidos SET estado = ? WHERE id_pedido = ?',
            [estado, id]
        );
        if (resultado.affectedRows === 0) {
            return res.status(404).json({error: 'Pedido no encontrado'});
        }
        res.json({mensaje: 'Estado actualizado', id_pedido: id, estado});
    } catch (err) {
        console.log('Error cambiando estado pedido:', err.message);
        return res.status(500).json({error: 'Error al actualizar estado'});
    }
});

app.get('/obtenerTicket/:id_pedido', verificarUsuario, async (req, res) => {
    const { id_pedido } = req.params;
    const id_usuario = req.session.usuario.id;
    
    const validIdPedido = validarEntero(id_pedido, 1, 999999999, 'ID del pedido');
    if (!validIdPedido.valido) {
        return res.status(400).json({error: validIdPedido.error});
    }
    
    try {
        const [pedido] = await con.query(
            `SELECT p.*, u.nombre as nombre_usuario, u.email
             FROM pedidos p
             JOIN usuarios u ON p.id_usuario = u.id_usuario
             WHERE p.id_pedido = ? AND p.id_usuario = ?`,
            [validIdPedido.valor, id_usuario]
        );
        
        if (pedido.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        const [detalles] = await con.query(
            `SELECT dp.*, pr.nombre as nombre_producto, pr.img
             FROM detalle_pedidos dp
             JOIN productos pr ON dp.id_producto = pr.id_producto
             WHERE dp.id_pedido = ?`,
            [validIdPedido.valor]
        );
        
        res.json({
            pedido: pedido[0],
            detalles: detalles
        });
        
    } catch (err) {
        console.error('Error obteniendo ticket:', err.message);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

app.get('/health', async (req, res) => {
    try {
        const [result] = await con.query('SELECT 1 as connected');
        res.json({ status: 'OK', database: 'Connected' });
    } catch (error) {
        res.status(500).json({ status: 'Error', error: error.message });
    }
});

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

try {
    require('./sockets')(io);
} catch (e) {
    console.log("No se encontro sockets.js");
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT} http://localhost:3000`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});