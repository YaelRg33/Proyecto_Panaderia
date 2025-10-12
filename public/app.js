// ============ CATEGORÍAS ============

// Cargar categorías al iniciar
function cargarCategorias() {
    fetch('/obtenerCategorias')
        .then(respuesta => respuesta.json())
        .then(categorias => {
            let selectCategoria = document.getElementById('campo-categoria');
            if (selectCategoria) {
                selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';
                
                categorias.forEach(categoria => {
                    let option = document.createElement('option');
                    option.value = categoria.id_categoria;
                    option.textContent = categoria.nombre;
                    selectCategoria.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar categorías:', error);
            // Si hay error, solo continúa sin categorías
        });
}

// ============ PRODUCTOS ============

// Agregar fila a la tabla
function agregarFilaTabla(producto) {
    let cuerpoTabla = document.getElementById('cuerpo-tabla');
    
    let nuevaFila = `
        <tr data-id="${producto.id_producto}">
            <td>${producto.id_producto}</td>
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td class="precio">$${producto.precio.toFixed(2)}</td>
            <td>${producto.stock}</td>
            <td>
                <div class="columna-acciones">
                    <button class="boton-editar" onclick="abrirModalEditar(${producto.id_producto})">Editar</button>
                    <button class="boton-eliminar" onclick="confirmarEliminar(${producto.id_producto})">Eliminar</button>
                </div>
            </td>
        </tr>
    `;
    
    cuerpoTabla.innerHTML += nuevaFila;
}

// Cargar productos
function cargarProductos() {
    fetch('/obtenerProductos')
        .then(respuesta => respuesta.json())
        .then(productos => {
            let cuerpoTabla = document.getElementById('cuerpo-tabla');
            cuerpoTabla.innerHTML = ''; // LIMPIAR LA TABLA
            
            productos.forEach(producto => {
                agregarFilaTabla(producto);
            });
        })
        .catch(error => {
            console.error('Error al cargar productos:', error);
            alert('Error al cargar los productos');
        });
}

// Guardar producto
function guardarProducto(datos) {
    fetch('/agregarProducto', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(datos)
    })
    .then(respuesta => respuesta.json())
    .then(productoCreado => {
        console.log('Producto creado:', productoCreado);
        agregarFilaTabla(productoCreado);
        document.getElementById('modal-formulario').classList.remove('activo');
        document.getElementById('formulario-pan').reset();
        alert('Producto agregado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al agregar el producto');
    });
}

// Eliminar producto
function eliminarProducto(id) {
    fetch(`/eliminarProducto/${id}`, {
        method: 'DELETE'
    })
    .then(respuesta => respuesta.json())
    .then(resultado => {
        console.log('Producto eliminado:', resultado);
        let fila = document.querySelector(`tr[data-id="${id}"]`);
        if (fila) fila.remove();
        
        document.getElementById('modal-eliminar').classList.remove('activo');
        alert('Producto eliminado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al eliminar el producto');
    });
}

// Editar producto
function editarProducto(id, datos) {
    fetch(`/editarProducto/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(datos)
    })
    .then(respuesta => respuesta.json())
    .then(productoActualizado => {
        console.log('Producto actualizado:', productoActualizado);
        let fila = document.querySelector(`tr[data-id="${id}"]`);
        
        fila.innerHTML = `
            <td>${productoActualizado.id_producto}</td>
            <td>${productoActualizado.nombre}</td>
            <td>${productoActualizado.descripcion}</td>
            <td class="precio">$${productoActualizado.precio.toFixed(2)}</td>
            <td>${productoActualizado.stock}</td>
            <td>
                <div class="columna-acciones">
                    <button class="boton-editar" onclick="abrirModalEditar(${productoActualizado.id_producto})">Editar</button>
                    <button class="boton-eliminar" onclick="confirmarEliminar(${productoActualizado.id_producto})">Eliminar</button>
                </div>
            </td>
        `;
        
        document.getElementById('modal-formulario').classList.remove('activo');
        document.getElementById('formulario-pan').dataset.id = '';
        alert('Producto actualizado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al actualizar el producto');
    });
}

// Abrir modal para editar
function abrirModalEditar(id) {
    console.log('Abriendo modal para editar:', id);
    fetch('/obtenerProductos')
        .then(respuesta => respuesta.json())
        .then(productos => {
            let producto = productos.find(p => p.id_producto === id);
            
            if (producto) {
                document.getElementById('titulo-formulario').textContent = 'Editar Producto';
                document.getElementById('campo-nombre').value = producto.nombre;
                document.getElementById('campo-descripcion').value = producto.descripcion;
                document.getElementById('campo-precio').value = producto.precio;
                document.getElementById('campo-stock').value = producto.stock;
                document.getElementById('campo-img').value = producto.img || '';
                document.getElementById('campo-categoria').value = producto.id_categoria || '';
                
                document.getElementById('formulario-pan').dataset.id = id;
                document.getElementById('modal-formulario').classList.add('activo');
            }
        })
        .catch(error => console.error('Error:', error));
}

// Confirmar eliminación
function confirmarEliminar(id) {
    console.log('Confirmando eliminación de:', id);
    document.getElementById('modal-eliminar').classList.add('activo');
    document.getElementById('confirmar-eliminar').onclick = () => eliminarProducto(id);
}

// ============ INICIALIZAR ============

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado');
    
    cargarCategorias();
    cargarProductos();
    
    // Botón agregar
    let botonAgregar = document.getElementById('agregarProducto');
    if (botonAgregar) {
        botonAgregar.addEventListener('click', () => {
            console.log('Click en agregar');
            document.getElementById('titulo-formulario').textContent = 'Agregar Nuevo Producto';
            document.getElementById('formulario-pan').reset();
            document.getElementById('formulario-pan').dataset.id = '';
            document.getElementById('modal-formulario').classList.add('activo');
        });
    } else {
        console.error('No se encontró el botón de agregar');
    }
    
    // Manejar formulario
    let formulario = document.getElementById('formulario-pan');
    if (formulario) {
        formulario.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Formulario enviado');
            
            let datos = {
                nombre: document.getElementById('campo-nombre').value,
                descripcion: document.getElementById('campo-descripcion').value,
                precio: parseFloat(document.getElementById('campo-precio').value),
                stock: parseInt(document.getElementById('campo-stock').value),
                img: document.getElementById('campo-img').value || null,
                id_categoria: parseInt(document.getElementById('campo-categoria').value) || null
            };
            
            console.log('Datos a enviar:', datos);
            
            let idProducto = formulario.dataset.id;
            
            if (idProducto) {
                console.log('Editando producto:', idProducto);
                editarProducto(idProducto, datos);
            } else {
                console.log('Agregando nuevo producto');
                guardarProducto(datos);
            }
        });
    } else {
        console.error('No se encontró el formulario');
    }
    
    // Cerrar modales
    let botonCancelar = document.getElementById('boton-cancelar');
    if (botonCancelar) {
        botonCancelar.addEventListener('click', () => {
            console.log('Cancelando formulario');
            document.getElementById('modal-formulario').classList.remove('activo');
        });
    }
    
    let cancelarEliminar = document.getElementById('cancelar-eliminar');
    if (cancelarEliminar) {
        cancelarEliminar.addEventListener('click', () => {
            console.log('Cancelado');
            document.getElementById('modal-eliminar').classList.remove('activo');
        });
    }
});