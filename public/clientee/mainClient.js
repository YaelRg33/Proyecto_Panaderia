let productos = [];
let categorias = [];
let carrito = [];
let usuarioActual = null;
let categoriaActual = 'todas';

// cargar datos
async function verificarSesion() {
    try {
        const response = await fetch('/verificarSesion');
        const data = await response.json();
        if (data.autenticado) {
            usuarioActual = data.usuario;
            mostrarInfoUsuario();
        } else {
          mostrarOpcionLogin();
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        mostrarOpcionLogin();
    }
}

function mostrarInfoUsuario() {
    const nombreUsuarioSpan = document.getElementById('nombre-usuario');
    if (nombreUsuarioSpan && usuarioActual) {
        nombreUsuarioSpan.textContent = `Hola, ${usuarioActual.nombre}`;
    }
}

function mostrarOpcionLogin() {
    const nombreUsuarioSpan = document.getElementById('nombre-usuario');
    if (nombreUsuarioSpan) {
        nombreUsuarioSpan.textContent = 'Visitante';
    }
}

async function cargarProductos() {
    try {
        const response = await fetch('/obtenerProductos');
        productos = await response.json();
        mostrarProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

async function cargarCategorias() {
    try {
        const response = await fetch('/obtenerCategorias');
        categorias = await response.json();
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

// mostrar producots

function mostrarProductos() {
    const grid = document.getElementById('grid-productos');
    grid.innerHTML = '';
    const productosFiltrados = categoriaActual === 'todas'
        ? productos
        : productos.filter(p => p.id_categoria == categoriaActual);

    if (productosFiltrados.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No hay productos en esta categoría</p>';
        return;
    }
   
    productosFiltrados.forEach(producto => {
        const card = crearCardProducto(producto);
        grid.appendChild(card);
    });
}

function crearCardProducto(producto) {
    const card = document.createElement('div');
    card.className = 'card-producto';
    const categoria = categorias.find(c => c.id_categoria == producto.id_categoria);
    const nombreCategoria = categoria ? categoria.nombre : 'Sin categoría';
    const imagenHTML = producto.img
        ? `<img src="${producto.img}" alt="${producto.nombre}">`
        : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">Sin imagen</div>';
    const stockDisponible = producto.stock > 0;
    const textoStock = stockDisponible
        ? `Stock: ${producto.stock}`
        : 'Agotado';
    card.innerHTML = `
        <div class="producto-imagen">
            ${imagenHTML}
        </div>
        <div class="producto-info">
            <div class="producto-categoria">${nombreCategoria}</div>
            <h3 class="producto-nombre">${producto.nombre}</h3>
            <p class="producto-descripcion">${producto.descripcion}</p>
            <div class="producto-footer">
                <span class="producto-precio">$${parseFloat(producto.precio).toFixed(2)}</span>
                <span class="producto-stock">${textoStock}</span>
            </div>
            <button
                class="btn-agregar"
                onclick="agregarAlCarrito(${producto.id_producto})"
                ${!stockDisponible ? 'disabled' : ''}
            >
                ${stockDisponible ? 'Agregar al carrito' : 'Agotado'}
            </button>
        </div>
    `;
    return card;
}

// carrito
function agregarAlCarrito(idProducto) {
    const producto = productos.find(p => p.id_producto === idProducto);
    if (!producto) return;
    const itemExistente = carrito.find(item => item.id_producto === idProducto);
    if (itemExistente) {
        if (itemExistente.cantidad < producto.stock) {
            itemExistente.cantidad++;
        } else {
            alert('No hay más stock disponible');
            return;
        }
    } else {
        carrito.push({
            ...producto,
            cantidad: 1
        });
    }
    actualizarCarrito();
    mostrarNotificacion('Producto agregado al carrito');
}

function cambiarCantidad(idProducto, cambio) {
    const item = carrito.find(i => i.id_producto === idProducto);
    if (!item) return;
    const producto = productos.find(p => p.id_producto === idProducto);
    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(idProducto);
        return;
    }
    if (nuevaCantidad > producto.stock) {
        alert('No hay suficiente stock');
        return;
    }
    item.cantidad = nuevaCantidad;
    actualizarCarrito();
}

function eliminarDelCarrito(idProducto) {
    carrito = carrito.filter(item => item.id_producto !== idProducto);
    actualizarCarrito();
}

function vaciarCarrito() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
        carrito = [];
        actualizarCarrito();
    }
}

function actualizarCarrito() {
    const contador = document.getElementById('contador-carrito');
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contador.textContent = totalItems;
    mostrarItemsCarrito();
}

function mostrarItemsCarrito() {
    const contenedor = document.getElementById('items-carrito');
    const totalSpan = document.getElementById('total-carrito');
    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío</p>';
        totalSpan.textContent = '0.00';
        return;
    }
    contenedor.innerHTML = '';
    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-carrito';
        const imagenHTML = item.img
            ? `<img src="${item.img}" alt="${item.nombre}" class="item-imagen">`
            : '<div class="item-imagen" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999;">Sin imagen</div>';
        itemDiv.innerHTML = `
            ${imagenHTML}
            <div class="item-info">
                <div class="item-nombre">${item.nombre}</div>
                <div class="item-precio">$${parseFloat(item.precio).toFixed(2)} c/u</div>
                <div class="item-acciones">
                    <button class="btn-cantidad" onclick="cambiarCantidad(${item.id_producto}, -1)">-</button>
                    <span class="item-cantidad">${item.cantidad}</span>
                    <button class="btn-cantidad" onclick="cambiarCantidad(${item.id_producto}, 1)">+</button>
                    <button class="btn-eliminar-item" onclick="eliminarDelCarrito(${item.id_producto})">Eliminar</button>
                </div>
                <div style="margin-top: 10px; font-weight: 600; color: #8B4513;">
                    Subtotal: $${subtotal.toFixed(2)}
                </div>
            </div>
        `;
        contenedor.appendChild(itemDiv);
    });
    totalSpan.textContent = total.toFixed(2);
}

async function finalizarCompra() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    if (!usuarioActual) {
        if (confirm('Necesitas iniciar sesión para finalizar la compra. ¿Deseas ir al login?')) {
            window.location.href = '/login.html';
        }
        return;
    }
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    const btnFinalizar = document.getElementById('btn-finalizar');
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = 'Procesando...';
    
    try {
        const response = await fetch('/crearPedido', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                carrito: carrito,
                total: total
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const mensaje = `¡Compra finalizada exitosamente!\n\nTotal: $${total.toFixed(2)}\nNúmero de pedido: ${data.id_pedido}\n\n¡Gracias por tu compra, ${usuarioActual.nombre}!`;
            alert(mensaje);
            
            // Limpiar el carrito y recargar productos
            carrito = [];
            actualizarCarrito();
            await cargarProductos(); 
            document.getElementById('modal-carrito').classList.remove('active');
        } else {
            alert('Error al procesar la compra: ' + data.error);
        }
    } catch (error) {
        console.error('Error al finalizar compra:', error);
        alert('Error al procesar la compra. Por favor intenta nuevamente.');
    } finally {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'Finalizar Compra';
    }
}

// filtros
function aplicarFiltro(categoria) {
    categoriaActual = categoria;
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    mostrarProductos();
}

// modales
function abrirModalCarrito() {
    mostrarItemsCarrito();
    document.getElementById('modal-carrito').classList.add('active');
}

function cerrarModalCarrito() {
    document.getElementById('modal-carrito').classList.remove('active');
}

function abrirModalCuenta() {
    const infoDiv = document.getElementById('info-usuario');
    if (usuarioActual) {
        infoDiv.innerHTML = `
            <div class="info-usuario">
                <p><strong>Nombre:</strong> ${usuarioActual.nombre}</p>
                <p><strong>Email:</strong> ${usuarioActual.email}</p>
                <p><strong>Rol:</strong> ${usuarioActual.rol === 'admin' ? 'Administrador' : 'Cliente'}</p>
                ${usuarioActual.rol === 'admin' ? '<button class="btn-login" onclick="irAPanelAdmin()">Ir al Panel de Admin</button>' : ''}
                <button class="btn-logout" onclick="cerrarSesion()">Cerrar Sesión</button>
            </div>
        `;
    } else {
        infoDiv.innerHTML = `
            <div class="info-usuario">
                <p style="text-align: center; color: #666; margin-bottom: 20px;">
                    No has iniciado sesión
                </p>
                <button class="btn-login" onclick="irALogin()">Iniciar Sesión</button>
                <button class="btn-login" onclick="irARegistro()">Crear Cuenta</button>
            </div>
        `;
    }
    document.getElementById('modal-cuenta').classList.add('active');
}

function cerrarModalCuenta() {
    document.getElementById('modal-cuenta').classList.remove('active');
}

function irALogin() {
    window.location.href = '/login.html';
}

function irARegistro() {
    window.location.href = '/register.html';
}

function irAPanelAdmin() {
    window.location.href = '/index.html';
}

async function cerrarSesion() {
    try {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s;
    `;
    notif.textContent = mensaje;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;

document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Tienda cargada');

    await verificarSesion();
    await cargarCategorias();
    await cargarProductos();

    // Eventos de carrito
    document.getElementById('btn-carrito').addEventListener('click', abrirModalCarrito);
    document.getElementById('cerrar-carrito').addEventListener('click', cerrarModalCarrito);
    document.getElementById('btn-finalizar').addEventListener('click', finalizarCompra);
    document.getElementById('btn-vaciar').addEventListener('click', vaciarCarrito);
    
    // Eventos de cuenta
    document.getElementById('btn-cuenta').addEventListener('click', abrirModalCuenta);
    document.getElementById('cerrar-cuenta').addEventListener('click', cerrarModalCuenta);
    
    // Cerrar modales al hacer click fuera
    document.getElementById('modal-carrito').addEventListener('click', (e) => {
        if (e.target.id === 'modal-carrito') {
            cerrarModalCarrito();
        }
    });
    document.getElementById('modal-cuenta').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cuenta') {
            cerrarModalCuenta();
        }
    });
    
    // Eventos de filtros
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoria = btn.dataset.categoria;
            categoriaActual = categoria;

            document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mostrarProductos();
        });
    });
});