const express = require("express")
const mysql = require("mysql2")
const path = require('path') 
const bodyParser = require('body-parser')
const multer = require('multer')
const session = require('express-session')

const app = express()

// --- CONEXIÓN A LA BD ---
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'n0m3l0',
    database: 'proyectoPanaderia'
}).promise(); // Usamos .promise() para async/await

// ============ DEFINIR FUNCIONES ANTES DE USARLAS ============

// Crear tablas de pedidos (CORREGIDO)
async function crearTablasPedidos() {
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

    try {
        await con.query(tablaPedidos);
        console.log('✓ Tabla pedidos verificada');
        await con.query(tablaDetalle);
        console.log('✓ Tabla detalle_pedidos verificada');
    } catch (err) {
        console.log('Error creando tablas:', err);
    }
}

// Insertar categorías iniciales
async function insertarCategoriasIniciales() {
    const categorias = ['Pan Blanco', 'Pan de Dulce', 'Repostería', 'Especiales'];
    const query = 'INSERT INTO categorias (nombre) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = ?)';
    
    for (const nombre of categorias) {
        try {
            await con.query(query, [nombre, nombre]);
        } catch (err) {
            console.log('Error al insertar categoría:', err);
        }
    }
}

// ============ CONEXIÓN A LA BD (Ahora con async/await) ============
(async () => {
    try {
        await con.connect();
        console.log('✓ Conectado a la BD');
        await insertarCategoriasIniciales();
        await crearTablasPedidos();
    } catch (err) {
        console.log('❌ Error conectando:', err);
    }
})();


// ============ CONFIGURACIÓN DE MULTER ============
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

// ============ MIDDLEWARES ============

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public')) 

// Configurar sesiones
app.use(session({
    secret: 'panaderia-secreta-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}))

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
        console.log('Error:', err);
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
        console.log('Error:', err);
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error'});
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error'});
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error'});
    }
});

app.delete('/eliminarProducto/:id', verificarAdmin, async (req, res) => {
    let {id} = req.params;
    try {
        await con.query('DELETE FROM productos WHERE id_producto = ?', [id]);
        res.json({id_producto: id, mensaje: 'Eliminado'});
    } catch (err) {
        console.log('Error:', err);
        return res.status(500).json({error: 'Error'});
    }
});

// ============ RUTAS DE CATEGORÍAS ============
app.get('/obtenerCategorias', async (req, res) => {
    try {
        const [resultado] = await con.query('SELECT * FROM categorias');
        res.json(resultado || []);
    } catch (err) {
        console.log('Error:', err);
        return res.status(500).json({error: 'Error'});
    }
});

// ============ RUTAS DE CARRITO (CORREGIDAS) ============

// Obtener el carrito del usuario al iniciar sesión
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
        console.error("Error al obtener carrito:", err);
        res.status(500).json({ error: "Error al obtener carrito" });
    }
});

// Agregar/Actualizar un item en el carrito
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
        console.error("Error al agregar al carrito:", err);
        res.status(500).json({ error: "Error al agregar al carrito" });
    }
});

// Eliminar un item del carrito
app.delete('/eliminarDelCarrito/:id_producto', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const { id_producto } = req.params;
    
    const query = 'DELETE FROM carrito_items WHERE id_usuario = ? AND id_producto = ?';
    try {
        await con.query(query, [id_usuario, id_producto]);
        res.json({ mensaje: 'Producto eliminado del carrito' });
    } catch (err) {
        console.error("Error al eliminar del carrito:", err);
        res.status(500).json({ error: "Error al eliminar del carrito" });
    }
});

// Vaciar el carrito
app.delete('/vaciarMiCarrito', verificarUsuario, async (req, res) => {
    const id_usuario = req.session.usuario.id;
    const query = 'DELETE FROM carrito_items WHERE id_usuario = ?';
    try {
        await con.query(query, [id_usuario]);
        res.json({ mensaje: 'Carrito vaciado' });
    } catch (err) {
        console.error("Error al vaciar carrito:", err);
        res.status(500).json({ error: "Error al vaciar carrito" });
    }
});

// ============ RUTAS DE PEDIDOS ============

app.post('/crearPedido', verificarUsuario, async (req, res) => {
    const { carrito, total } = req.body;
    const id_usuario = req.session.usuario.id;

    try {
        await con.beginTransaction();
        
        let erroresStock = [];
        const stockQueries = carrito.map(item => 
            con.query('SELECT nombre, stock FROM productos WHERE id_producto = ? FOR UPDATE', [item.id_producto])
        );
        const stocks = await Promise.all(stockQueries);

        for (let i = 0; i < carrito.length; i++) {
            const item = carrito[i];
            const [productoStock] = stocks[i][0];
            
            if (!productoStock) {
                erroresStock.push(`Producto ID ${item.id_producto} no encontrado.`);
            } else if (productoStock.stock < item.cantidad) {
                erroresStock.push(`Stock insuficiente para ${productoStock.nombre} (sólo quedan ${productoStock.stock})`);
            }
        }
        
        if (erroresStock.length > 0) {
            await con.rollback();
            return res.status(400).json({ error: erroresStock.join(', ') });
        }
        
        const [pedidoResult] = await con.query(
            'INSERT INTO pedidos (id_usuario, total) VALUES (?, ?)',
            [id_usuario, total]
        );
        const id_pedido = pedidoResult.insertId;
        
        const detalleQueries = [];
        const updateStockQueries = [];
        
        for (const item of carrito) {
            const subtotal = item.precio * item.cantidad;
            detalleQueries.push(
                con.query(
                    'INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [id_pedido, item.id_producto, item.cantidad, item.precio, subtotal]
                )
            );
            updateStockQueries.push(
                con.query(
                    'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
                    [item.cantidad, item.id_producto]
                )
            );
        }
        
        await Promise.all(detalleQueries);
        await Promise.all(updateStockQueries);
        
        // Vaciar el carrito del usuario de la BD
        await con.query('DELETE FROM carrito_items WHERE id_usuario = ?', [id_usuario]);
        
        await con.commit();
        
        res.json({
            mensaje: 'Pedido creado exitosamente',
            id_pedido: id_pedido
        });
    
    } catch (err) {
        await con.rollback();
        console.log('Error en transacción /crearPedido:', err);
        res.status(500).json({ error: err.message || 'Error al procesar el pedido' });
    }
});

// Obtener todos los pedidos (solo admin)
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error al obtener pedidos'});
    }
});

// Obtener detalles de un pedido específico
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error al obtener detalles'});
    }
});

// Obtener pedidos del usuario actual
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error al obtener pedidos'});
    }
});

// Cambiar estado del pedido
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
        console.log('Error:', err);
        return res.status(500).json({error: 'Error al actualizar estado'});
    }
});

// ============ RUTA RAÍZ ============

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// ============ INICIAR SERVIDOR ============

app.listen(3000, () => {
    console.log('✓ Servidor corriendo en puerto 3000');
});