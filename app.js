const express = require("express")
const mysql = require("mysql2")
const path = require('path') 
const bodyParser = require('body-parser')

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
    }
});

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

// PRODUCTOS
app.get('/obtenerProductos', (req, res) => {
    con.query('SELECT * FROM productos', (err, resultado, fields) => {
        if (err) {
            console.log('Error:', err);
            return res.status(500).json({error: 'Error'});
        }
        res.json(resultado);
    });
});

app.post('/agregarProducto', (req, res) => {
    let {nombre, descripcion, precio, stock, img, id_categoria} = req.body;

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

app.put('/editarProducto/:id', (req, res) => {
    let {id} = req.params;
    let {nombre, descripcion, precio, stock, img, id_categoria} = req.body;

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

app.delete('/eliminarProducto/:id', (req, res) => {
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

// CATEGORÍAS
app.get('/obtenerCategorias', (req, res) => {
    con.query('SELECT * FROM categorias', (err, resultado, fields) => {
        if (err) {
            console.log('Error:', err);
            return res.status(500).json({error: 'Error'});
        }
        res.json(resultado || []);
    });
});

app.listen(10000, () => {
    console.log('Servidor en puerto 10000');
});