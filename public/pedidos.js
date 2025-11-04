// autentificacion

async function verificarAutenticacion() {
    try {
        const response = await fetch('/verificarSesion');
        const data = await response.json();
        
        if (!data.autenticado || data.usuario.rol !== 'admin') {
            window.location.href = '/login.html';
            return false;
        }
        
        const nombreUsuario = document.getElementById('nombre-usuario');
        if (nombreUsuario) {
            nombreUsuario.textContent = `Hola, ${data.usuario.nombre}`;
        }
        
        return true;
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// cargar pedidos

async function cargarPedidos() {
    try {
        const response = await fetch('/obtenerPedidos');
        const pedidos = await response.json();
        
        mostrarPedidos(pedidos);
        actualizarEstadisticas(pedidos);
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        document.getElementById('tabla-pedidos').innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p>Error al cargar los pedidos</p>
                </td>
            </tr>
        `;
    }
}

function mostrarPedidos(pedidos) {
    const tbody = document.getElementById('tabla-pedidos');
    
    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p>No hay pedidos registrados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    pedidos.forEach(pedido => {
        const fila = document.createElement('tr');
        
        const fecha = new Date(pedido.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let badgeClase = 'badge-pendiente';
        if (pedido.estado === 'completado') badgeClase = 'badge-completado';
        if (pedido.estado === 'cancelado') badgeClase = 'badge-cancelado';
        
        fila.innerHTML = `
            <td><strong>#${pedido.id_pedido}</strong></td>
            <td>${pedido.nombre_usuario}</td>
            <td>${pedido.email}</td>
            <td>${fechaFormateada}</td>
            <td><strong>$${parseFloat(pedido.total).toFixed(2)}</strong></td>
            <td>
                <select class="select-estado ${badgeClase}" onchange="cambiarEstado(${pedido.id_pedido}, this.value)">
                    <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="completado" ${pedido.estado === 'completado' ? 'selected' : ''}>Completado</option>
                    <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td>
                <button class="btn-ver" onclick="verDetalle(${pedido.id_pedido})">Ver Detalle</button>
            </td>
        `;
        
        tbody.appendChild(fila);
    });
}

function actualizarEstadisticas(pedidos) {
    const total = pedidos.length;
    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    const completados = pedidos.filter(p => p.estado === 'completado').length;
    const ingresos = pedidos
        .filter(p => p.estado === 'completado')
        .reduce((sum, p) => sum + parseFloat(p.total), 0);
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pendientes').textContent = pendientes;
    document.getElementById('stat-completados').textContent = completados;
    document.getElementById('stat-ingresos').textContent = `$${ingresos.toFixed(2)}`;
}

// detalles

async function verDetalle(idPedido) {
    try {
        // Obtener información del pedido
        const responsePedidos = await fetch('/obtenerPedidos');
        const pedidos = await responsePedidos.json();
        const pedido = pedidos.find(p => p.id_pedido === idPedido);
        
        // Obtener detalles del pedido
        const responseDetalle = await fetch(`/obtenerDetallePedido/${idPedido}`);
        const detalles = await responseDetalle.json();
        
        if (!pedido) {
            alert('No se encontró el pedido');
            return;
        }
        
        // Mostrar información del pedido
        document.getElementById('numero-pedido').textContent = idPedido;
        
        const fecha = new Date(pedido.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        document.getElementById('info-pedido').innerHTML = `
            <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span>${pedido.nombre_usuario}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span>${pedido.email}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Fecha:</span>
                <span>${fechaFormateada}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Estado:</span>
                <span class="badge badge-${pedido.estado}">${pedido.estado.toUpperCase()}</span>
            </div>
        `;
        
        // Mostrar productos
        const contenedor = document.getElementById('detalle-productos');
        contenedor.innerHTML = '';
        
        if (detalles.length === 0) {
            contenedor.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay productos en este pedido</p>';
        } else {
            detalles.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'detalle-item';
                
                const imagenHTML = item.img
                    ? `<img src="${item.img}" alt="${item.nombre_producto}" class="detalle-imagen">`
                    : '<div class="detalle-imagen" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">Sin imagen</div>';
                
                itemDiv.innerHTML = `
                    ${imagenHTML}
                    <div class="detalle-info">
                        <div class="detalle-nombre">${item.nombre_producto}</div>
                        <div class="detalle-cantidad">
                            ${item.cantidad} x $${parseFloat(item.precio_unitario).toFixed(2)}
                        </div>
                    </div>
                    <div class="detalle-subtotal">
                        $${parseFloat(item.subtotal).toFixed(2)}
                    </div>
                `;
                
                contenedor.appendChild(itemDiv);
            });
        }
        
        document.getElementById('total-pedido').textContent = `$${parseFloat(pedido.total).toFixed(2)}`;
        
        document.getElementById('modal-detalle').classList.add('active');
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        alert('Error al cargar el detalle del pedido');
    }
}

function cerrarModal() {
    document.getElementById('modal-detalle').classList.remove('active');
}

async function cambiarEstado(idPedido, nuevoEstado) {
    try {
        const response = await fetch(`/cambiarEstadoPedido/${idPedido}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarNotificacion('Estado actualizado correctamente');
            cargarPedidos(); 
        } else {
            alert('Error al actualizar el estado: ' + data.error);
            cargarPedidos();
        }
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        alert('Error al actualizar el estado');
        cargarPedidos();
    }
}

function irAProductos() {
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
    console.log('Página de pedidos cargada');
    
    const autenticado = await verificarAutenticacion();
    if (!autenticado) return;
    
    await cargarPedidos();
    
    document.getElementById('modal-detalle').addEventListener('click', (e) => {
        if (e.target.id === 'modal-detalle') {
            cerrarModal();
        }
    });
    
    // recarga los pedidos cada 30 segundos
    setInterval(cargarPedidos, 30000);
});