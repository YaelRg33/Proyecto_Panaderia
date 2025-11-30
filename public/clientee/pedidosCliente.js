let usuarioActual = null;

async function verificarSesion() {
    try {
        const response = await fetch('/verificarSesion');
        const data = await response.json();
        if (data.autenticado) {
            usuarioActual = data.usuario;
            cargarPedidos();
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error:', error);
        window.location.href = '/login.html';
    }
}

async function cargarPedidos() {
    const contenedor = document.getElementById('lista-pedidos');
    
    try {
        const response = await fetch('/misPedidos');
        const pedidos = await response.json();
        
        if (pedidos.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="color: #999; font-size: 18px;">No tienes pedidos aún</p>
                    <button onclick="window.location.href='index.html'" style="margin-top: 20px; padding: 12px 30px; background: #8B4513; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Ir a comprar
                    </button>
                </div>
            `;
            return;
        }
        
        contenedor.innerHTML = '';
        
        pedidos.forEach(pedido => {
            const div = document.createElement('div');
            div.style.cssText = 'background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-left: 5px solid #8B4513;';
            
            const fecha = new Date(pedido.fecha).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            let badgeColor = '#ffc107';
            if (pedido.estado === 'entregado' || pedido.estado === 'completado') badgeColor = '#4CAF50';
            if (pedido.estado === 'cancelado') badgeColor = '#f44336';
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0 0 10px 0; color: #8B4513;">Pedido #${pedido.id_pedido}</h3>
                        <p style="margin: 5px 0; color: #666;">Fecha: ${fecha}</p>
                        <p style="margin: 5px 0; color: #666;">Total: <strong style="color: #4CAF50;">$${parseFloat(pedido.total).toFixed(2)}</strong></p>
                    </div>
                    <span style="padding: 8px 16px; background: ${badgeColor}; color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
                        ${pedido.estado.toUpperCase()}
                    </span>
                </div>
                <button 
                    onclick="mostrarTicket(${pedido.id_pedido})"
                    style="width: 100%; padding: 12px; background: #8B4513; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                    onmouseover="this.style.background='#A0522D'"
                    onmouseout="this.style.background='#8B4513'"
                >
                    Ver Ticket
                </button>
            `;
            
            contenedor.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p style="text-align: center; color: #f44336; padding: 40px;">Error al cargar pedidos</p>';
    }
}

async function mostrarTicket(idPedido) {
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
                <h2 style="margin: 0; color: #13538bff;">La DesEsperanza</h2>
                <p style="margin: 5px 0; font-size: 14px;">Panadería Artesanal</p>
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
                <p>Resumen:</p>
                <p>Pedido #${pedido.id_pedido}</p>}
            </div>
        `;
        
        document.getElementById('contenido-ticket').innerHTML = ticketHTML;
        document.getElementById('modal-ticket').classList.add('active');
        
        window.ticketActual = { pedido, detalles };
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al generar el ticket');
    }
}

function cerrarModalTicket() {
    document.getElementById('modal-ticket').classList.remove('active');
}

function imprimirTicket() {
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

document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });
    
    document.getElementById('cerrar-ticket').addEventListener('click', cerrarModalTicket);
    document.getElementById('btn-imprimir-ticket').addEventListener('click', imprimirTicket);
    document.getElementById('btn-descargar-ticket').addEventListener('click', descargarTicket);
    
    document.getElementById('modal-ticket').addEventListener('click', (e) => {
        if (e.target.id === 'modal-ticket') cerrarModalTicket();
    });
});