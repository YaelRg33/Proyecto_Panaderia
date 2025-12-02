let chartCategorias, chartEstados, chartProductos, chartVentasDiarias;
let pedidosGlobales = [];
let productosGlobales = [];
let categoriasGlobales = [];

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
async function cargarDatosCompletos() {
    try {
        const resPedidos = await fetch('/obtenerPedidos');
        pedidosGlobales = await resPedidos.json();
        
        const resProductos = await fetch('/obtenerProductos');
        productosGlobales = await resProductos.json();
        
        const resCategorias = await fetch('/obtenerCategorias');
        categoriasGlobales = await resCategorias.json();
        
        console.log('Datos cargados:', {
            pedidos: pedidosGlobales.length,
            productos: productosGlobales.length,
            categorias: categoriasGlobales.length
        });
        
        mostrarPedidos(pedidosGlobales);
        
        await crearGraficos();
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        document.getElementById('tabla-pedidos').innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p>Error al cargar los datos</p>
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
        if (pedido.estado === 'completado' || pedido.estado === 'entregado') badgeClase = 'badge-completado';
        if (pedido.estado === 'cancelado') badgeClase = 'badge-cancelado';
        if (pedido.estado === 'en_camino') badgeClase = 'badge-pendiente';

        const iconoMapa = (pedido.latitud && pedido.longitud) ? '' : '';
        
        fila.innerHTML = `
            <td><strong>#${pedido.id_pedido}</strong></td>
            <td>${pedido.nombre_usuario}</td>
            <td>${pedido.email}</td>
            <td>${fechaFormateada}</td>
            <td><strong>$${parseFloat(pedido.total).toFixed(2)}</strong></td>
            <td>
                <select class="select-estado ${badgeClase}" onchange="cambiarEstado(${pedido.id_pedido}, this.value)">
                    <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="en_camino" ${pedido.estado === 'en_camino' ? 'selected' : ''}>En Camino</option>
                    <option value="entregado" ${pedido.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                    <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td>
                <button class="btn-ver" onclick="verDetalle(${pedido.id_pedido})">
                    ${iconoMapa}Ver Detalle
                </button>
            </td>
        `;
        
        tbody.appendChild(fila);
    });
}
async function crearGraficos() {
    console.log('Creando gráficos...');
    
    await crearGraficoCategoria();
    crearGraficoEstados();
    await crearGraficoProductos();
    crearGraficoVentasDiarias();
    
    console.log('Gráficos creados exitosamente');
}
async function crearGraficoCategoria() {
    const ventasPorCategoria = {};
    
    categoriasGlobales.forEach(cat => {
        ventasPorCategoria[cat.nombre] = 0;
    });
    
    for (const pedido of pedidosGlobales) {
        if (pedido.estado === 'entregado' || pedido.estado === 'completado') {
            try {
                const res = await fetch(`/obtenerDetallePedido/${pedido.id_pedido}`);
                const detalles = await res.json();
                
                detalles.forEach(detalle => {
                    const producto = productosGlobales.find(p => p.id_producto === detalle.id_producto);
                    if (producto) {
                        const categoria = categoriasGlobales.find(c => c.id_categoria === producto.id_categoria);
                        const nombreCat = categoria ? categoria.nombre : 'Sin categoría';
                        ventasPorCategoria[nombreCat] = 
                            (ventasPorCategoria[nombreCat] || 0) + parseFloat(detalle.subtotal);
                    }
                });
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    const totalVendido = Object.values(ventasPorCategoria).reduce((a, b) => a + b, 0);
    document.getElementById('total-categorias').textContent = `$${totalVendido.toFixed(2)}`;

    const ctx = document.getElementById('chartCategorias');
    if (chartCategorias) chartCategorias.destroy();
    
    chartCategorias = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(ventasPorCategoria),
            datasets: [{
                data: Object.values(ventasPorCategoria),
                backgroundColor: [
                    '#8B4513',
                    '#D2691E',
                    '#CD853F',
                    '#DEB887',
                    '#F4A460'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: $${context.parsed.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}
function crearGraficoEstados() {
    const estados = {};
    pedidosGlobales.forEach(p => {
        const estadoNombre = p.estado.replace('_', ' ').toUpperCase();
        estados[estadoNombre] = (estados[estadoNombre] || 0) + 1;
    });

    document.getElementById('total-pedidos').textContent = pedidosGlobales.length;

    const ctx = document.getElementById('chartEstados');
    if (chartEstados) chartEstados.destroy();
    
    chartEstados = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(estados),
            datasets: [{
                data: Object.values(estados),
                backgroundColor: [
                    '#ffc107',
                    '#4CAF50',
                    '#2196F3',
                    '#f44336'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}
async function crearGraficoProductos() {
    const ventasPorProducto = {};
    let totalProductosVendidos = 0;

    for (const pedido of pedidosGlobales) {
        if (pedido.estado === 'entregado' || pedido.estado === 'completado') {
            try {
                const res = await fetch(`/obtenerDetallePedido/${pedido.id_pedido}`);
                const detalles = await res.json();
                
                detalles.forEach(detalle => {
                    if (!ventasPorProducto[detalle.nombre_producto]) {
                        ventasPorProducto[detalle.nombre_producto] = 0;
                    }
                    ventasPorProducto[detalle.nombre_producto] += detalle.cantidad;
                    totalProductosVendidos += detalle.cantidad;
                });
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    document.getElementById('total-productos').textContent = totalProductosVendidos;
    
    const clientesUnicos = new Set(
        pedidosGlobales
            .filter(p => p.estado === 'entregado' || p.estado === 'completado')
            .map(p => p.id_usuario)
    );
    document.getElementById('total-clientes').textContent = clientesUnicos.size;

    const top5 = Object.entries(ventasPorProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const ctx = document.getElementById('chartProductos');
    if (chartProductos) chartProductos.destroy();
    
    chartProductos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top5.map(p => p[0]),
            datasets: [{
                label: 'Unidades Vendidas',
                data: top5.map(p => p[1]),
                backgroundColor: '#8B4513',
                borderColor: '#6B3410',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function crearGraficoVentasDiarias() {
    const ventasPorDia = {};
    const hoy = new Date();

    for (let i = 6; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - i);
        const key = fecha.toLocaleDateString('es-MX', { 
            month: 'short', 
            day: 'numeric' 
        });
        ventasPorDia[key] = 0;
    }
    pedidosGlobales.forEach(p => {
        if (p.estado === 'entregado' || p.estado === 'completado') {
            const fecha = new Date(p.fecha);
            const key = fecha.toLocaleDateString('es-MX', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            if (ventasPorDia.hasOwnProperty(key)) {
                ventasPorDia[key] += parseFloat(p.total);
            }
        }
    });

    const totalSemana = Object.values(ventasPorDia).reduce((a, b) => a + b, 0);
    document.getElementById('ingresos-semana').textContent = `$${totalSemana.toFixed(2)}`;
    document.getElementById('promedio-dia').textContent = `$${(totalSemana / 7).toFixed(2)}`;

    const ctx = document.getElementById('chartVentasDiarias');
    if (chartVentasDiarias) chartVentasDiarias.destroy();
    
    chartVentasDiarias = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(ventasPorDia),
            datasets: [{
                label: 'Ventas ($)',
                data: Object.values(ventasPorDia),
                borderColor: '#8B4513',
                backgroundColor: 'rgba(139, 69, 19, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#8B4513',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Ventas: $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}
async function verDetalle(idPedido) {
    try {
        const pedido = pedidosGlobales.find(p => p.id_pedido === idPedido);
        const responseDetalle = await fetch(`/obtenerDetallePedido/${idPedido}`);
        const detalles = await responseDetalle.json();
        
        if (!pedido) {
            alert('No se encontró el pedido');
            return;
        }
        
        document.getElementById('numero-pedido').textContent = idPedido;
        
        const fecha = new Date(pedido.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let infoHTML = `
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

        if (pedido.latitud && pedido.longitud) {
            infoHTML += `
                <div class="info-row" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                    <span class="info-label">📍 Entrega:</span>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <a href="https://www.google.com/maps?q=${pedido.latitud},${pedido.longitud}" 
                           target="_blank" 
                           style="background-color: #4CAF50; color: white; padding: 8px 12px; text-decoration: none; border-radius: 4px; text-align: center; font-size: 0.9em; font-weight: bold;">
                           Ver en Google Maps
                        </a>
                        <small style="color: #999; font-size: 0.8em;">Lat: ${pedido.latitud}, Lng: ${pedido.longitud}</small>
                    </div>
                </div>
            `;
        }

        document.getElementById('info-pedido').innerHTML = infoHTML;
        
        const contenedor = document.getElementById('detalle-productos');
        contenedor.innerHTML = '';
        
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
        
        document.getElementById('total-pedido').textContent = `$${parseFloat(pedido.total).toFixed(2)}`;
        
        const modal = document.getElementById('modal-detalle');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        alert('Error al cargar el detalle del pedido');
    }
}

function cerrarModal() {
    const modal = document.getElementById('modal-detalle');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}
async function cambiarEstado(idPedido, nuevoEstado) {
    try {
        const response = await fetch(`/cambiarEstadoPedido/${idPedido}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        
        if (response.ok) {
            mostrarNotificacion('Estado actualizado correctamente');
            await cargarDatosCompletos();
        } else {
            const data = await response.json();
            alert('Error: ' + data.error);
            await cargarDatosCompletos();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar el estado');
        await cargarDatosCompletos();
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
        console.error('Error:', error);
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
if (!document.getElementById('estilos-animaciones')) {
    const style = document.createElement('style');
    style.id = 'estilos-animaciones';
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
}
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de pedidos cargada');
    
    const autenticado = await verificarAutenticacion();
    if (!autenticado) return;
    
    await cargarDatosCompletos();
    
    const modal = document.getElementById('modal-detalle');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal-detalle') {
                cerrarModal();
            }
        });
    }
    
    setInterval(cargarDatosCompletos, 30000);
});