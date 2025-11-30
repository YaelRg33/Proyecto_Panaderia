let productos = [];
let categorias = [];
let carrito = [];
let usuarioActual = null;
let categoriaActual = 'todas';
let map = null;
let marker = null;
let ubicacionSeleccionada = null;

let saldoActual = 0;

async function cargarFondos() {
    if (!usuarioActual) return;
    try {
        const response = await fetch('/obtenerFondos');
        const data = await response.json();
        if (response.ok) {
            saldoActual = parseFloat(data.fondos);
            actualizarDisplayFondos();
        }
    } catch (error) {
        console.error('Error al cargar fondos:', error);
    }
}

function actualizarDisplayFondos() {
    const elemento = document.getElementById('saldo-actual');
    if (elemento) {
        elemento.textContent = saldoActual.toFixed(2);
    }
    const displayHeader = document.getElementById('fondos-header');
    if (displayHeader) {
        displayHeader.textContent = `$${saldoActual.toFixed(2)}`;
    }
}

async function agregarFondos(monto) {
    const btn = document.getElementById('btn-agregar-fondos');
    if (!btn) {
        console.error('Botón de agregar fondos no encontrado.');
        return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    try {
        const response = await fetch('/agregarFondos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto: monto })
        });
        const data = await response.json();
        if (response.ok) {
            saldoActual = parseFloat(data.fondos);
            actualizarDisplayFondos();
            const inputMonto = document.getElementById('input-monto');
            if (inputMonto) inputMonto.value = '';
            mostrarNotificacion('✅ Fondos agregados exitosamente');
            cargarHistorialTransacciones();
        } else {
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

async function cargarHistorialTransacciones() {
    const contenedor = document.getElementById('historial-transacciones');
    if (!contenedor) return;
    try {
        const response = await fetch('/obtenerTransacciones');
        const transacciones = await response.json();
        if (transacciones.length === 0) {
            contenedor.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay transacciones</p>';
            return;
        }
        contenedor.innerHTML = '';
        transacciones.forEach(t => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ' +
                (t.tipo === 'deposito' ? '#4CAF50' : '#f44336');
            const fecha = new Date(t.fecha).toLocaleString('es-MX');
            const icono = t.tipo === 'deposito' ? '💰' : '🛒';
            const signo = t.tipo === 'deposito' ? '+' : '-';
            const color = t.tipo === 'deposito' ? '#4CAF50' : '#f44336';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600;">${icono} ${t.descripcion}</div>
                        <div style="font-size: 12px; color: #666;">${fecha}</div>
                    </div>
                    <div style="font-weight: 700; font-size: 18px; color: ${color};">
                        ${signo}$${parseFloat(t.monto).toFixed(2)}
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #999;">
                    Saldo: $${parseFloat(t.saldo_anterior).toFixed(2)} &rarr; $${parseFloat(t.saldo_nuevo).toFixed(2)}
                </div>
            `;
            contenedor.appendChild(div);
        });
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p style="text-align: center; color: #f44336; padding: 20px;">Error al cargar historial</p>';
    }
}

function abrirModalFondos() {
    const modalFondos = document.getElementById('modal-fondos');
    if (!modalFondos) {
        console.error('Modal de fondos no encontrado.');
        return;
    }
    if (!usuarioActual) {
        alert('Debes iniciar sesión para usar esta función');
        window.location.href = '/login.html';
        return;
    }
    cargarFondos();
    cargarHistorialTransacciones();
    modalFondos.classList.add('active');
}

function cerrarModalFondos() {
    const modalFondos = document.getElementById('modal-fondos');
    if (modalFondos) {
        modalFondos.classList.remove('active');
    }
}

async function mostrarTicket(idPedido) {
    const modalTicket = document.getElementById('modal-ticket');
    const contenidoTicket = document.getElementById('contenido-ticket');
    if (!modalTicket || !contenidoTicket) {
        console.error('Elementos del modal de ticket no encontrados.');
        return;
    }
    try {
        const response = await fetch(`/obtenerTicket/${idPedido}`);
        const data = await response.json();
        if (!response.ok) {
            alert('Error al obtener ticket: ' + data.error);
            return;
        }
        const { pedido, detalles } = data;
        const fecha = new Date(pedido.fecha);
        const fechaFormateada = fecha.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        let productosHTML = '';
        detalles.forEach(item => {
            productosHTML += `
                <tr>
                    <td style="text-align: left; padding: 5px 0;">${item.nombre_producto}</td>
                    <td style="text-align: center; padding: 5px 0;">${item.cantidad}</td>
                    <td style="text-align: right; padding: 5px 0;">$${parseFloat(item.precio_unitario).toFixed(2)}</td>
                    <td style="text-align: right; padding: 5px 0;">$${parseFloat(item.subtotal).toFixed(2)}</td>
                </tr>
            `;
        });
        const ticketHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #8B4513;">🍞 La DesEsperanza</h2>
                <p style="margin: 5px 0; font-size: 14px;">Panadería Artesanal</p>
                <p style="margin: 5px 0; font-size: 12px;">RFC: DESXXX010101XXX</p>
            </div>
            <div style="border-top: 2px dashed #333; border-bottom: 2px dashed #333; padding: 15px 0; margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Ticket:</strong>
                    <span>#${pedido.id_pedido}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Fecha:</strong>
                    <span>${fechaFormateada}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>Cliente:</strong>
                    <span>${pedido.nombre_usuario}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <strong>Estado:</strong>
                    <span>${pedido.estado.toUpperCase()}</span>
                </div>
            </div>
            <table style="width: 100%; margin: 20px 0;">
                <thead>
                    <tr style="border-bottom: 1px solid #333;">
                        <th style="text-align: left; padding: 5px 0;">Producto</th>
                        <th style="text-align: center; padding: 5px 0;">Cant.</th>
                        <th style="text-align: right; padding: 5px 0;">Precio</th>
                        <th style="text-align: right; padding: 5px 0;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosHTML}
                </tbody>
            </table>
            <div style="border-top: 2px dashed #333; padding-top: 15px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
                    <span>TOTAL:</span>
                    <span>$${parseFloat(pedido.total).toFixed(2)}</span>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
                <p>¡Gracias por su compra!</p>
                <p>Pedido #${pedido.id_pedido}</p>
                ${pedido.latitud && pedido.longitud ? '<p>📍 Entrega programada</p>' : ''}
            </div>
        `;
        contenidoTicket.innerHTML = ticketHTML;
        modalTicket.classList.add('active');
        window.ticketActual = { pedido, detalles };
    } catch (error) {
        console.error('Error al mostrar ticket:', error);
        alert('Error al generar el ticket');
    }
}

function cerrarModalTicket() {
    const modalTicket = document.getElementById('modal-ticket');
    if (modalTicket) {
        modalTicket.classList.remove('active');
    }
}

function imprimirTicket() {
    if (!window.ticketActual) {
        alert('No hay ticket para imprimir.');
        return;
    }
    const contenido = document.getElementById('contenido-ticket').innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket - La DesEsperanza</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    padding: 20px;
                    max-width: 400px;
                    margin: 0 auto;
                }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>${contenido}</body>
        </html>
    `);
    ventana.document.close();
    ventana.print();
}

function descargarTicket() {
    if (!window.ticketActual) {
        alert('No hay ticket para descargar.');
        return;
    }
    const contenido = document.getElementById('contenido-ticket').innerHTML;
    const blob = new Blob([`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ticket - La DesEsperanza</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    padding: 20px;
                    max-width: 400px;
                    margin: 0 auto;
                }
            </style>
        </head>
        <body>${contenido}</body>
        </html>
    `], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_${window.ticketActual.pedido.id_pedido}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

async function verificarSesion() {
    try {
        const response = await fetch('/verificarSesion');
        const data = await response.json();
        if (data.autenticado) {
            usuarioActual = data.usuario;
            mostrarInfoUsuario();
            await cargarFondos(); 
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
        ? `<img src="${producto.img}" alt="${producto.nombre}" class="producto-imagen">`
        : '<div class="producto-imagen-placeholder" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">Sin imagen</div>';
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
    if (!contenedor || !totalSpan) return;
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

function irAlMapa() {
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
    document.getElementById('vista-lista-productos').style.display = 'none';
    document.getElementById('vista-mapa-ubicacion').style.display = 'block';
    document.getElementById('botones-carrito').style.display = 'none';
    document.getElementById('botones-mapa').style.display = 'flex';
    document.getElementById('titulo-modal-carrito').innerText = "Confirmar Ubicación";
    initMap();
}

function volverALista() {
    document.getElementById('vista-mapa-ubicacion').style.display = 'none';
    document.getElementById('vista-lista-productos').style.display = 'block';
    document.getElementById('botones-mapa').style.display = 'none';
    document.getElementById('botones-carrito').style.display = 'flex'; 
    document.getElementById('titulo-modal-carrito').innerText = "Mi Carrito";
}

function initMap() {
    if (map) {
        setTimeout(() => { map.invalidateSize(); }, 100);
        return;
    }
    const lat = 19.4326; 
    const lng = -99.1332;
    map = L.map('mapa-seleccion').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
    map.locate({enableHighAccuracy: true});
    map.on('locationfound', (e) => {
        actualizarMarcador(e.latlng);
        map.flyTo(e.latlng, 16);
    });
    map.on('click', (e) => {
        actualizarMarcador(e.latlng);
    });
    setTimeout(() => { map.invalidateSize(); }, 200);
}

function actualizarMarcador(latlng) {
    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng, {draggable: true}).addTo(map);
        marker.on('dragend', function(e) {
            ubicacionSeleccionada = e.target.getLatLng();
            document.getElementById('coords-info').innerText = `Ubicación: ${ubicacionSeleccionada.lat.toFixed(5)}, ${ubicacionSeleccionada.lng.toFixed(5)}`;
        });
    }
    ubicacionSeleccionada = latlng;
    document.getElementById('coords-info').innerText = `Ubicación: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

async function confirmarPedidoFinal() {
    if (!ubicacionSeleccionada) {
        alert("Por favor selecciona tu ubicación en el mapa.");
        return;
    }
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    if (!usuarioActual) {
        alert('Debes iniciar sesión para realizar una compra');
        window.location.href = '/login.html';
        return;
    }
    if (saldoActual < total) {
        if (confirm(`❌ Fondos insuficientes.\n\nTienes: $${saldoActual.toFixed(2)}\nNecesitas: $${total.toFixed(2)}\n\n¿Deseas recargar fondos?`)) {
            cerrarModalCarrito();
            abrirModalFondos();
        }
        return;
    }
    if (saldoActual === 0) {
        if (confirm('❌ No tienes fondos disponibles.\n\n¿Deseas recargar tu cuenta?')) {
            cerrarModalCarrito();
            abrirModalFondos();
        }
        return;
    }
    const btnConfirmar = document.getElementById('btn-confirmar-pedido');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Procesando...';
    try {
        const response = await fetch('/crearPedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                carrito: carrito,
                total: total,
                latitud: ubicacionSeleccionada.lat,
                longitud: ubicacionSeleccionada.lng
            })
        });
        const data = await response.json();
        if (response.ok) {
            saldoActual = parseFloat(data.nuevo_saldo);
            actualizarDisplayFondos();
            carrito = [];
            actualizarCarrito();
            await cargarProductos();
            cerrarModalCarrito();
            ubicacionSeleccionada = null;
            if(marker) { map.removeLayer(marker); marker = null; }
            volverALista();
            mostrarTicket(data.id_pedido);
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error al finalizar compra:', error);
        alert('❌ Error de conexión.');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pedido';
    }
}

function aplicarFiltro(categoria) {
    categoriaActual = categoria;
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    mostrarProductos();
}

function abrirModalCarrito() {
    mostrarItemsCarrito();
    volverALista();
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
                <p><strong>Fondos Disponibles:</strong> <span style="color: #4CAF50; font-size: 20px; font-weight: bold;">$${saldoActual.toFixed(2)}</span></p>
                <button class="btn-login" onclick="abrirModalFondos(); cerrarModalCuenta();" style="background: #4CAF50;">
                    💰 Gestionar Fondos
                </button>
                <button class="btn-login" onclick="verMisPedidos()">
                    📦 Mis Pedidos
                </button>
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

async function verMisPedidos() {
    cerrarModalCuenta();
    try {
        const response = await fetch('/misPedidos');
        const pedidos = await response.json();
        if (pedidos.length === 0) {
            alert('No tienes pedidos aún');
            return;
        }
        let html = 'MIS PEDIDOS:\n\n';
        pedidos.forEach(p => {
            const fecha = new Date(p.fecha).toLocaleDateString('es-MX');
            html += `Pedido #${p.id_pedido}\n`;
            html += `Fecha: ${fecha}\n`;
            html += `Total: $${parseFloat(p.total).toFixed(2)}\n`;
            html += `Estado: ${p.estado.toUpperCase()}\n`;
            html += `------------------------\n`;
        });
        if (confirm(html + '\n¿Deseas ver el ticket de algún pedido?')) {
            const idPedido = prompt('Ingresa el número de pedido:');
            if (idPedido) {
                mostrarTicket(parseInt(idPedido));
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar pedidos');
    }
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
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Tienda cargada');
    await verificarSesion();
    await cargarCategorias();
    await cargarProductos();
    document.getElementById('btn-carrito').addEventListener('click', abrirModalCarrito);
    document.getElementById('cerrar-carrito').addEventListener('click', cerrarModalCarrito);
    const btnIrPagar = document.getElementById('btn-ir-pagar');
    if(btnIrPagar) btnIrPagar.addEventListener('click', irAlMapa);
    const btnVolver = document.getElementById('btn-volver-lista');
    if(btnVolver) btnVolver.addEventListener('click', volverALista);
    const btnConfirmar = document.getElementById('btn-confirmar-pedido');
    if(btnConfirmar) btnConfirmar.addEventListener('click', confirmarPedidoFinal);
    document.getElementById('btn-cuenta').addEventListener('click', abrirModalCuenta);
    document.getElementById('cerrar-cuenta').addEventListener('click', cerrarModalCuenta);
    document.getElementById('modal-carrito').addEventListener('click', (e) => {
        if (e.target.id === 'modal-carrito') cerrarModalCarrito();
    });
    document.getElementById('modal-cuenta').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cuenta') cerrarModalCuenta();
    });
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const categoria = btn.dataset.categoria;
            categoriaActual = categoria;
            document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mostrarProductos();
        });
    });
    const btnCerrarFondos = document.getElementById('cerrar-fondos');
    if (btnCerrarFondos) {
        btnCerrarFondos.addEventListener('click', cerrarModalFondos);
    }
    const btnAgregarFondos = document.getElementById('btn-agregar-fondos');
    if (btnAgregarFondos) {
        btnAgregarFondos.addEventListener('click', () => {
            const monto = parseFloat(document.getElementById('input-monto').value);
            if (isNaN(monto) || monto <= 0) {
                alert('Por favor ingresa un monto válido');
                return;
            }
            if (monto > 999999999999) {
                alert('El monto excede el límite permitido (999,999,999,999)');
                return;
            }
            agregarFondos(monto);
        });
    }
    document.querySelectorAll('.btn-monto-rapido').forEach(btn => {
        btn.addEventListener('click', () => {
            const monto = parseFloat(btn.dataset.monto);
            agregarFondos(monto);
        });
    });
    const inputMonto = document.getElementById('input-monto');
    if (inputMonto && btnAgregarFondos) {
        inputMonto.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnAgregarFondos.click();
            }
        });
    }
    const btnCerrarTicket = document.getElementById('cerrar-ticket');
    if (btnCerrarTicket) {
        btnCerrarTicket.addEventListener('click', cerrarModalTicket);
    }
    const btnImprimirTicket = document.getElementById('btn-imprimir-ticket');
    if (btnImprimirTicket) {
        btnImprimirTicket.addEventListener('click', imprimirTicket);
    }
    const btnDescargarTicket = document.getElementById('btn-descargar-ticket');
    if (btnDescargarTicket) {
        btnDescargarTicket.addEventListener('click', descargarTicket);
    }
    const modalFondos = document.getElementById('modal-fondos');
    if(modalFondos) {
        modalFondos.addEventListener('click', (e) => {
            if (e.target.id === 'modal-fondos') cerrarModalFondos();
        });
    }
    const modalTicket = document.getElementById('modal-ticket');
    if(modalTicket) {
        modalTicket.addEventListener('click', (e) => {
            if (e.target.id === 'modal-ticket') cerrarModalTicket();
        });
    }
});